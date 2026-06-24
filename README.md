# Spotify Wrapped React

A React + Vite dashboard that uses Spotify's Web API to show personal listening summaries:

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

> [!NOTE]
> Do take not that there is a limit to Spotify's API usage, after a certain limit user will be restricted from making API calls \
> \
> Recommended for user to just wait until the usage resets. \
Refer to https://developer.spotify.com/documentation/web-api/concepts/rate-limits for more information. 

## About
Personal project, not intended for commercial use — just something I wanted to build to study React. AI coding tools such as Codex were used during development.
#
All assets used belong to their respective owners.

