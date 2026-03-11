// ── Google Books API search ───────────────────────────────────────────────
async function searchBooks(query, maxResults = 20) {
  if (!query.trim()) return [];
  let url = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(query)}&maxResults=${maxResults}&printType=books`;
  if (typeof GOOGLE_BOOKS_API_KEY !== 'undefined' && GOOGLE_BOOKS_API_KEY) {
    url += `&key=${GOOGLE_BOOKS_API_KEY}`;
  }
  const resp = await fetch(url);
  if (!resp.ok) throw new Error('Google Books API error');
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
  };
}

// ── Supabase list helpers ─────────────────────────────────────────────────

async function addToList(book, listName) {
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
    }, { onConflict: 'user_id,google_book_id,list_name' });
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

  return `
  <div class="book-card" data-id="${escHtml(book.google_book_id)}">
    ${bookCover(book)}
    <div class="book-info">
      <div class="book-title">${escHtml(book.title)}</div>
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

// Render a list card (with remove button)
function renderListCard(entry, listName) {
  const info = LIST_LABELS[listName];
  return `
  <div class="book-card" data-id="${escHtml(entry.google_book_id)}">
    ${bookCover(entry)}
    <div class="book-info">
      <span class="list-badge ${info.badge}">${info.label}</span>
      <div class="book-title">${escHtml(entry.title)}</div>
      <div class="book-author">${escHtml(entry.authors || '')}</div>
      ${entry.published_date ? `<div class="book-year">${escHtml(entry.published_date.slice(0,4))}</div>` : ''}
      ${entry.description ? `<div class="book-desc">${escHtml(entry.description)}</div>` : ''}
      <button class="remove-btn" onclick="handleRemove('${escHtml(entry.google_book_id)}', '${listName}', this)">
        Remove
      </button>
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
