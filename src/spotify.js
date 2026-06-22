const AUTH_ENDPOINT = 'https://accounts.spotify.com/authorize';
const TOKEN_ENDPOINT = 'https://accounts.spotify.com/api/token';
const API_ENDPOINT = 'https://api.spotify.com/v1';

const CLIENT_ID = import.meta.env.VITE_SPOTIFY_CLIENT_ID;
const REDIRECT_URI = `${window.location.origin}/callback`;
const SCOPES = ['user-top-read', 'user-read-recently-played', 'user-library-read', 'user-read-playback-state'];
const TOKEN_KEY = 'spotify_wrapped_token';
const VERIFIER_KEY = 'spotify_wrapped_code_verifier';
const PAGE_LIMIT = 50;

export const rankLimitOptions = [10, 25, 50];

const termLabels = {
  short_term: 'Last 4 weeks',
  medium_term: 'Last 6 months',
  long_term: 'Last 12 months',
};

export const terms = Object.keys(termLabels);
export const getTermLabel = (term) => termLabels[term] ?? term;
export const hasClientId = Boolean(CLIENT_ID);

const encode = (buffer) =>
  btoa(String.fromCharCode(...new Uint8Array(buffer)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

const createVerifier = () => {
  const values = new Uint8Array(64);
  crypto.getRandomValues(values);
  return encode(values);
};

const createChallenge = async (verifier) => {
  const data = new TextEncoder().encode(verifier);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return encode(digest);
};

export const login = async () => {
  if (!CLIENT_ID) {
    throw new Error('Missing VITE_SPOTIFY_CLIENT_ID in .env');
  }

  const verifier = createVerifier();
  const challenge = await createChallenge(verifier);
  sessionStorage.setItem(VERIFIER_KEY, verifier);

  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    response_type: 'code',
    redirect_uri: REDIRECT_URI,
    scope: SCOPES.join(' '),
    code_challenge_method: 'S256',
    code_challenge: challenge,
  });

  window.location.assign(`${AUTH_ENDPOINT}?${params.toString()}`);
};

export const logout = () => {
  localStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(VERIFIER_KEY);
  window.location.assign('/');
};

export const getStoredToken = () => {
  const raw = localStorage.getItem(TOKEN_KEY);
  if (!raw) return null;

  try {
    const token = JSON.parse(raw);
    if (!token.access_token || Date.now() >= token.expires_at) {
      localStorage.removeItem(TOKEN_KEY);
      return null;
    }
    return token;
  } catch {
    localStorage.removeItem(TOKEN_KEY);
    return null;
  }
};

export const handleCallback = async () => {
  const params = new URLSearchParams(window.location.search);
  const code = params.get('code');
  const error = params.get('error');

  if (error) {
    throw new Error(`Spotify authorization failed: ${error}`);
  }

  if (!code) return getStoredToken();

  const verifier = sessionStorage.getItem(VERIFIER_KEY);
  if (!verifier) {
    throw new Error('Missing Spotify code verifier. Please sign in again.');
  }

  const response = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      grant_type: 'authorization_code',
      code,
      redirect_uri: REDIRECT_URI,
      code_verifier: verifier,
    }),
  });

  if (!response.ok) {
    throw new Error('Could not exchange Spotify authorization code.');
  }

  const token = await response.json();
  const storedToken = {
    ...token,
    expires_at: Date.now() + token.expires_in * 1000 - 30_000,
  };

  localStorage.setItem(TOKEN_KEY, JSON.stringify(storedToken));
  sessionStorage.removeItem(VERIFIER_KEY);
  window.history.replaceState({}, document.title, '/');
  return storedToken;
};

const spotifyFetch = async (path, token, searchParams) => {
  const url = new URL(`${API_ENDPOINT}${path}`);
  if (searchParams) {
    Object.entries(searchParams).forEach(([key, value]) => url.searchParams.set(key, value));
  }

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token.access_token}` },
  });

  if (response.status === 204) {
    return null;
  }

  if (response.status === 401) {
    localStorage.removeItem(TOKEN_KEY);
    throw new Error('Spotify session expired. Please sign in again.');
  }

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error?.message || `Spotify request failed: ${response.status}`);
  }

  return response.json();
};

const list = (path, token, params) => spotifyFetch(path, token, params).then((data) => data.items ?? []);

const pagedTopList = async (path, token, timeRange, requestedLimit) => {
  const pages = [];
  let offset = 0;

  while (offset < requestedLimit) {
    const limit = Math.min(PAGE_LIMIT, requestedLimit - offset);
    pages.push(
      list(path, token, {
        time_range: timeRange,
        limit,
        offset,
      }),
    );
    offset += limit;
  }

  const results = await Promise.all(pages);
  return results.flat().slice(0, requestedLimit);
};

export const getCurrentUser = (token) => spotifyFetch('/me', token);

export const getPlaybackState = (token) => spotifyFetch('/me/player', token);

export const getAvailableDevices = (token) => spotifyFetch('/me/player/devices', token);

export const getUserQueue = (token) => spotifyFetch('/me/player/queue', token);

export const getArtist = (token, artistId) => spotifyFetch(`/artists/${artistId}`, token);

export const getAlbum = (token, albumId) => spotifyFetch(`/albums/${albumId}`, token);

export const getTopTracks = (token, timeRange, limit) => pagedTopList('/me/top/tracks', token, timeRange, limit);

export const getTopArtists = (token, timeRange, limit) => pagedTopList('/me/top/artists', token, timeRange, limit);

export const getRecentlyPlayed = (token) => list('/me/player/recently-played', token, { limit: 30 });

export const getSavedTracksPage = (token) => spotifyFetch('/me/tracks', token, { limit: 30 });

export const getSavedAlbumsPage = (token) => spotifyFetch('/me/albums', token, { limit: 30 });

export const searchSpotify = (token, query) => {
  if (!query.trim()) {
    return Promise.resolve({ tracks: { items: [] }, artists: { items: [] }, albums: { items: [] } });
  }

  return spotifyFetch('/search', token, {
    q: query.trim(),
    type: 'track,artist,album',
    limit: 8,
  });
};

export const formatDuration = (ms = 0) => {
  const totalSeconds = Math.round(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = String(totalSeconds % 60).padStart(2, '0');
  return `${minutes}:${seconds}`;
};

export const formatDate = (value) =>
  value
    ? new Intl.DateTimeFormat(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      }).format(new Date(value))
    : 'Unknown';

export const formatPopularity = (value) => (typeof value === 'number' ? value : 'Unavailable');
