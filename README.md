# Spotify Wrapped React

A React + Vite dashboard built on Spotify's Web API to surface personal
listening insights — built to explore OAuth flows and real-time API
integration

- Top tracks and artists for short, medium, and long term windows - 4 weeks, 6 months, 12 months
- Ranked top 10, 25, or 50 lists where Spotify returns enough results
- Currently playing track, playback state, devices, upcoming queue, and Spotify search
- Recently played tracks
- Saved library tracks and albums
- Track and album metadata

## Demo screenshots
<img width="960" height="520" alt="MainPage" src="https://github.com/user-attachments/assets/5a428315-9caf-4ebf-bee9-108574c3c1fa" />
<img width="445" height="352" alt="Queue" src="https://github.com/user-attachments/assets/0b7c8e44-d41c-471d-bb39-f715347c06cf" />
<img width="445" height="352" alt="RecentlyPlayed" src="https://github.com/user-attachments/assets/56fff252-afdc-4cc8-8066-82925d4aac9b" />
<img width="480" height="320" alt="SongInfo" src="https://github.com/user-attachments/assets/f9584d8f-e4f5-4b68-8570-3cfc27234f50" />

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
#
> **Note:** Spotify's API enforces rate limits. If you hit the limit during testing, wait for it to reset rather than retrying immediately. See [Spotify's rate limit docs](https://developer.spotify.com/documentation/web-api/concepts/rate-limits).

## About

A personal project built to learn React and practice working with a
third-party OAuth API. AI coding tools (e.g. Codex) were used during
development. All Spotify branding and data belong to their respective owners.

