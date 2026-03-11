# Family Bookshelf — Setup Guide

## Step 1: Create a Supabase project (5 minutes)

1. Go to https://supabase.com and sign up (free)
2. Click **New Project** — give it a name like "family-bookshelf"
3. Set a database password (save it somewhere)
4. Wait ~2 minutes for the project to provision

## Step 2: Set up the database

1. In your Supabase project, go to **SQL Editor** (left sidebar)
2. Click **New Query**
3. Paste the entire contents of `supabase/schema.sql`
4. Click **Run**

## Step 3: Add your credentials

1. In Supabase, go to **Project Settings → API**
2. Copy your **Project URL** and **anon (public) key**
3. Open `js/config.js` and paste them in:

```js
const SUPABASE_URL      = "https://xxxxx.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGci...";
```

## Step 4: Deploy to GitHub Pages (free hosting)

1. Create a new GitHub repository called `family-bookshelf` (make it **public** for free Pages)
2. Open a terminal in this folder and run:

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/family-bookshelf.git
git push -u origin main
```

3. In GitHub, go to your repo → **Settings → Pages**
4. Under **Source**, select **Deploy from a branch** → **main** → **/ (root)**
5. Click **Save** — your app will be live at `https://YOUR_USERNAME.github.io/family-bookshelf/`

## Step 5: Configure Supabase Auth (important!)

1. In Supabase, go to **Authentication → URL Configuration**
2. Add your GitHub Pages URL to **Site URL**:
   `https://YOUR_USERNAME.github.io/family-bookshelf/`
3. Also add it to **Redirect URLs**

---

## Optional: Run locally for testing

Just open `index.html` in a browser. No server needed — it's all static files + Supabase API calls.

## Adding family members

Each person creates their own account on the app. Their book lists are completely private — Row Level Security in Supabase ensures no one can see another user's books.
