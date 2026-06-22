# Spotify Wrapped React

A React + Vite dashboard that uses Spotify's Web API to show personal listening summaries:

- Top tracks and artists for short, medium, and long term windows
- Ranked top 10, 25, or 50 lists where Spotify returns enough results
- Currently playing track, playback state, devices, upcoming queue, and Spotify search
- Recently played tracks
- Saved library tracks and albums
- Track and album metadata

## Setup

1. Create a Spotify app at the Spotify Developer Dashboard.
2. Add this redirect URI to the app: `http://127.0.0.1:5173/callback`
3. Copy `.env.example` to `.env` and set `VITE_SPOTIFY_CLIENT_ID`.
4. Install and run:

```bash
npm install
npm run dev
```

Open `http://127.0.0.1:5173`.

## Required Spotify Scopes

The app requests:

- `user-top-read`
- `user-read-recently-played`
- `user-library-read`
- `user-read-playback-state`

## Note
Personal project, not intended for commercial use — just something I wanted to build to study React. AI coding tools such as Codex were used during development.
Do take not that there is a limit to Spotify's API calls, after a certain limit Spotify will temporarily restrict the usage.
Recommended for user to just wait until the usage resets. Do refer to their webpage for more information.
#
All assets used belong to their respective owners.

