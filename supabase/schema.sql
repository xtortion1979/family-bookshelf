-- Run this entire file in your Supabase SQL Editor
-- Dashboard → SQL Editor → New Query → paste & run

-- Book lists table
-- (Users are managed by Supabase Auth automatically)
CREATE TABLE IF NOT EXISTS book_lists (
  id            UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id       UUID        REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  google_book_id TEXT        NOT NULL,
  title         TEXT        NOT NULL,
  authors       TEXT,
  thumbnail     TEXT,
  description   TEXT,
  published_date TEXT,
  list_name     TEXT        NOT NULL CHECK (list_name IN ('to-read', 'purchased', 'read')),
  added_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, google_book_id, list_name)
);

-- Row Level Security — users can only see/edit their own books
ALTER TABLE book_lists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select own books"
  ON book_lists FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "insert own books"
  ON book_lists FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "delete own books"
  ON book_lists FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "update own books"
  ON book_lists FOR UPDATE
  USING (auth.uid() = user_id);

-- Optional: store display names (Supabase Auth doesn't store names by default)
CREATE TABLE IF NOT EXISTS profiles (
  id         UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "insert own profile"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

CREATE POLICY "update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);
