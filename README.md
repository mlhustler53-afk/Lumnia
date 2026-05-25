# Lumnia

A music streaming app powered by YouTube — search, play, playlists, and see who's listening. Built with React + Express.

## Project structure

```
LUMINA/
├── backend/          # Express API (search, stream, lyrics, listeners)
├── frontend/         # React/Vite SPA
├── logo.png          # App logo (also in frontend/public/)
└── README.md
```

## Quick start

### 1. Install dependencies

```bash
cd backend && npm install
cd ../frontend && npm install
```

Requires **yt-dlp** on your PATH for audio streaming.

### 2. Start the backend

```bash
cd backend
npm run dev
```

Runs at `http://localhost:3001`.

### 3. Start the frontend

```bash
cd frontend
npm run dev
```

Runs at `http://localhost:5173` (proxies `/api` to the backend in dev).

## Production deployment

### Frontend (Vercel / Netlify / Cloudflare Pages)

| Setting | Value |
|---------|--------|
| Root directory | `frontend` |
| Build command | `npm run build` |
| Output directory | `dist` |
| Environment | `VITE_API_URL` = your backend URL (e.g. `https://your-api.railway.app`) |

### Backend (Railway / Render / Fly.io)

| Setting | Value |
|---------|--------|
| Root directory | `backend` |
| Build command | `npm run build` |
| Start command | `npm start` |
| Environment | `FRONTEND_URL` = your frontend URL |
| | `PORT` = usually set by the host |

Install **yt-dlp** on the server image or buildpack.

## Features

- YouTube search & streaming (no API keys)
- Name-only “login” (stored locally)
- Favorites & playlists (browser localStorage)
- Who's listening (shared list via backend)
- Lyrics (Genius)

## Tech stack

| Layer | Tech |
|-------|------|
| Frontend | React 19, Vite, Tailwind CSS 4, Motion |
| Backend | Express, yt-search, yt-dlp |
| Storage | localStorage (client), JSON file (listeners) |
