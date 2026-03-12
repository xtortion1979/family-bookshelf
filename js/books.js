// ── Google Books API search ───────────────────────────────────────────────
async function searchBooks(query, maxResults = 20) {
  if (!query.trim()) return [];
  let url = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(query)}&maxResults=${maxResults}&printType=books`;
  if (typeof GOOGLE_BOOKS_API_KEY !== 'undefined' && GOOGLE_BOOKS_API_KEY) {
    url += `&key=${GOOGLE_BOOKS_API_KEY}`;
  }
  const resp = await fetch(url);
  if (resp.status === 429 || resp.status === 403) {
    throw new Error('Google search limit reached for today. Search will work again after midnight Pacific time.');
  }
  if (!resp.ok) throw new Error('Google Books search failed. Please try again later.');
  const data = await resp.json();
  return (data.items || []).map(normalizeBook);
}

// ── Normalize a Google Books item into a flat object ─────────────────────
function normalizeBook(item) {
  const info = item.volumeInfo || {};
  const img  = info.imageLinks;
  // Prefer higher resolution thumbnail; fall back gracefully
  let thumbnail = img?.thumbnail || img?.smallThumbnail || null;
  // Force HTTPS
  if (thumbnail) thumbnail = thumbnail.replace('http://', 'https://');
  return {
    google_book_id: item.id,
    title:          info.title         || 'Unknown Title',
    authors:        (info.authors || []).join(', ') || 'Unknown Author',
    description:    info.description   || '',
    thumbnail,
    published_date: info.publishedDate || '',
    page_count:     info.pageCount     || null,
  };
}

// ── Supabase list helpers ─────────────────────────────────────────────────

async function addToList(book, listName, extra = {}) {
  const { error } = await getSupabase()
    .from('book_lists')
    .upsert({
      user_id:        (await getSupabase().auth.getUser()).data.user.id,
      google_book_id: book.google_book_id,
      title:          book.title,
      authors:        book.authors,
      thumbnail:      book.thumbnail,
      description:    book.description,
      published_date: book.published_date,
      list_name:      listName,
      ...extra,
    }, { onConflict: 'user_id,google_book_id,list_name' });
  if (error) throw error;
}

async function updateBookMeta(googleBookId, listName, data) {
  const { error } = await getSupabase()
    .from('book_lists')
    .update(data)
    .eq('user_id', (await getSupabase().auth.getUser()).data.user.id)
    .eq('google_book_id', googleBookId)
    .eq('list_name', listName);
  if (error) throw error;
}

async function removeFromList(googleBookId, listName) {
  const { error } = await getSupabase()
    .from('book_lists')
    .delete()
    .eq('user_id', (await getSupabase().auth.getUser()).data.user.id)
    .eq('google_book_id', googleBookId)
    .eq('list_name', listName);
  if (error) throw error;
}

async function getList(listName) {
  const { data, error } = await getSupabase()
    .from('book_lists')
    .select('*')
    .eq('user_id', (await getSupabase().auth.getUser()).data.user.id)
    .eq('list_name', listName)
    .order('added_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

// ── Share code & family connections ──────────────────────────────────────

async function ensureShareCode() {
  const userId = (await getSupabase().auth.getUser()).data.user.id;
  const { data } = await getSupabase().from('profiles').select('share_code').eq('id', userId).single();
  if (data?.share_code) return data.share_code;
  // Generate a 6-char code (no ambiguous chars)
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const code = Array.from({length: 6}, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  await getSupabase().from('profiles').update({ share_code: code }).eq('id', userId);
  return code;
}

async function findUserByShareCode(code) {
  const { data } = await getSupabase()
    .from('profiles')
    .select('id, name, share_code')
    .eq('share_code', code.toUpperCase().trim())
    .single();
  return data || null;
}

async function addFamilyConnection(otherUserId) {
  const userId = (await getSupabase().auth.getUser()).data.user.id;
  if (userId === otherUserId) throw new Error('That is your own code.');
  const { error } = await getSupabase()
    .from('family_connections')
    .upsert({ user_id: userId, connected_user_id: otherUserId },
             { onConflict: 'user_id,connected_user_id' });
  if (error) throw error;
}

async function removeFamilyConnection(otherUserId) {
  const userId = (await getSupabase().auth.getUser()).data.user.id;
  await getSupabase().from('family_connections').delete()
    .eq('user_id', userId).eq('connected_user_id', otherUserId);
  await getSupabase().from('family_connections').delete()
    .eq('user_id', otherUserId).eq('connected_user_id', userId);
}

async function getAllFamilyBooks() {
  const { data, error } = await getSupabase()
    .from('book_lists')
    .select('user_id, google_book_id, title, authors, thumbnail, list_name, rating, finished_at')
    .order('title', { ascending: true });
  if (error) throw error;
  return data || [];
}

async function getAllProfiles() {
  const { data, error } = await getSupabase()
    .from('profiles')
    .select('id, name');
  if (error) throw error;
  return data || [];
}

async function getRecentlyAdded(limit = 10) {
  const { data } = await getSupabase()
    .from('book_lists')
    .select('*')
    .eq('user_id', (await getSupabase().auth.getUser()).data.user.id)
    .order('added_at', { ascending: false })
    .limit(limit);
  return data || [];
}

async function getAllMyBooks() {
  const { data, error } = await getSupabase()
    .from('book_lists')
    .select('google_book_id, list_name')
    .eq('user_id', (await getSupabase().auth.getUser()).data.user.id);
  if (error) return {};
  // Return a map: { googleBookId: Set of list names }
  const map = {};
  for (const row of data) {
    if (!map[row.google_book_id]) map[row.google_book_id] = new Set();
    map[row.google_book_id].add(row.list_name);
  }
  return map;
}

// ── Render helpers ────────────────────────────────────────────────────────

const LIST_LABELS = {
  'to-read':   { label: 'To Read',   dot: 'dot-to-read',   badge: 'badge-to-read'   },
  'purchased': { label: 'Purchased', dot: 'dot-purchased', badge: 'badge-purchased' },
  'read':      { label: 'Read',      dot: 'dot-read',      badge: 'badge-read'      },
};

function bookCover(book) {
  if (book.thumbnail) {
    return `<img class="book-cover" src="${escHtml(book.thumbnail)}" alt="Cover" loading="lazy" onerror="this.replaceWith(coverPlaceholder())">`;
  }
  return `<div class="book-cover-placeholder"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" width="32" height="32"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.966 8.966 0 00-6 2.292m0-14.25v14.25"/></svg></div>`;
}

function coverPlaceholder() {
  const div = document.createElement('div');
  div.className = 'book-cover-placeholder';
  div.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" width="32" height="32"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.966 8.966 0 00-6 2.292m0-14.25v14.25"/></svg>`;
  return div;
}

// Render a search result card (with add-to-list dropdown)
function renderSearchCard(book, myLists) {
  const inLists = myLists[book.google_book_id] || new Set();

  const dropdownItems = Object.entries(LIST_LABELS).map(([key, info]) => {
    const already = inLists.has(key);
    return `<button class="dropdown-item" onclick="handleAdd('${escHtml(book.google_book_id)}', '${key}', this)" ${already ? 'disabled style="opacity:.5"' : ''}>
      <span class="dot ${info.dot}"></span>
      ${info.label}${already ? ' ✓' : ''}
    </button>`;
  }).join('');

  const sid = escHtml(book.google_book_id);
  return `
  <div class="book-card" data-id="${sid}">
    <div onclick="openDetail('${sid}', null)" style="cursor:pointer">${bookCover(book)}</div>
    <div class="book-info">
      <div class="book-title detail-tap" onclick="openDetail('${sid}', null)">${escHtml(book.title)}</div>
      <div class="book-author">${escHtml(book.authors)}</div>
      ${book.published_date ? `<div class="book-year">${escHtml(book.published_date.slice(0,4))}</div>` : ''}
      ${book.description ? `<div class="book-desc">${escHtml(book.description)}</div>` : ''}
      <div class="add-btn-wrap">
        <button class="add-btn" onclick="toggleDropdown(this)">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 4v16m8-8H4"/></svg>
          Add to list
        </button>
        <div class="dropdown">${dropdownItems}</div>
      </div>
    </div>
  </div>`;
}

// Render a list card (with move dropdown + remove)
function renderListCard(entry, listName) {
  const info = LIST_LABELS[listName];
  const id = escHtml(entry.google_book_id);

  const moveItems = Object.entries(LIST_LABELS)
    .filter(([key]) => key !== listName)
    .map(([key, mi]) => `<button class="dropdown-item" onclick="handleMove('${id}', '${listName}', '${key}', this)">
      <span class="dot ${mi.dot}"></span>Move to ${mi.label}
    </button>`).join('');

  // Stars (1–5)
  const rating = entry.rating || 0;
  const stars = [1,2,3,4,5].map(n =>
    `<span class="star${rating >= n ? ' star-filled' : ''}" onclick="handleRating('${id}','${listName}',${n},this)">★</span>`
  ).join('');

  // Finished date (Read list only)
  const finishedHtml = listName === 'read' && entry.finished_at
    ? `<div class="book-finished">Finished ${new Date(entry.finished_at).toLocaleDateString('en-US',{month:'long',year:'numeric'})}</div>`
    : '';

  // Reading progress (Purchased only)
  const cur = entry.current_page || 0;
  const tot = entry.total_pages || 0;
  const pct = (cur && tot) ? Math.min(Math.round(cur / tot * 100), 100) : 0;
  const progressHtml = listName === 'purchased' ? `
    <div class="progress-section">
      ${(cur || tot) ? `
        <div class="progress-bar-track"><div class="progress-bar-fill" style="width:${pct}%"></div></div>
        <div class="progress-label">${tot ? `${pct}% &mdash; page ${cur} of ${tot}` : `Page ${cur}`}</div>
      ` : ''}
      <button class="progress-toggle-btn" onclick="toggleProgress(this)">${cur ? 'Update progress' : 'Track progress'}</button>
      <div class="progress-editor" style="display:none">
        <div class="progress-inputs">
          <input type="number" class="progress-input" placeholder="Current page" value="${cur || ''}" min="0" inputmode="numeric">
          <span class="progress-sep">of</span>
          <input type="number" class="progress-input" placeholder="Total pages" value="${tot || ''}" min="0" inputmode="numeric">
        </div>
        <button class="progress-save-btn" onclick="saveProgress('${id}','purchased',this)">Save</button>
      </div>
    </div>` : '';

  // Notes
  const noteText = entry.notes || '';
  const noteDisplayHtml = noteText ? `<div class="book-note">${escHtml(noteText)}</div>` : '';

  return `
  <div class="book-card" data-id="${id}">
    <div onclick="openDetail('${id}','${listName}')" style="cursor:pointer">${bookCover(entry)}</div>
    <div class="book-info">
      <span class="list-badge ${info.badge}">${info.label}</span>
      <div class="book-title detail-tap" onclick="openDetail('${id}','${listName}')">${escHtml(entry.title)}</div>
      <div class="book-author">${escHtml(entry.authors || '')}</div>
      ${entry.published_date ? `<div class="book-year">${escHtml(entry.published_date.slice(0,4))}</div>` : ''}
      ${finishedHtml}
      ${entry.description ? `<div class="book-desc">${escHtml(entry.description)}</div>` : ''}
      ${progressHtml}
      <div class="star-row">${stars}</div>
      ${noteDisplayHtml}
      <button class="note-btn" onclick="toggleNote(this)">${noteText ? 'Edit note' : '+ Add note'}</button>
      <div class="note-editor" style="display:none">
        <textarea class="note-textarea" placeholder="Add a note about this book…">${escHtml(noteText)}</textarea>
        <button class="note-save-btn" onclick="saveNote('${id}','${listName}',this)">Save</button>
      </div>
      <div class="add-btn-wrap" style="display:flex;gap:0.5rem;align-items:center;flex-wrap:wrap;margin-top:0.4rem">
        <div style="position:relative">
          <button class="add-btn" onclick="toggleDropdown(this)">
            <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"/></svg>
            Move
          </button>
          <div class="dropdown">${moveItems}</div>
        </div>
        <button class="remove-btn" onclick="handleRemove('${id}', '${listName}', this)">Remove</button>
      </div>
    </div>
  </div>`;
}


function escHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
