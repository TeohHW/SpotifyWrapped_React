import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Disc3,
  ExternalLink,
  Library,
  ListOrdered,
  Loader2,
  LogOut,
  Maximize2,
  Minimize2,
  Music2,
  Radio,
  RefreshCw,
  Search,
  Sparkles,
  UserRound,
} from 'lucide-react';
import {
  formatDate,
  formatDuration,
  formatPopularity,
  getAlbum,
  getAvailableDevices,
  getArtist,
  getCurrentUser,
  getPlaybackState,
  getRecentlyPlayed,
  getSavedAlbumsPage,
  getSavedTracksPage,
  getStoredToken,
  getTermLabel,
  getTopArtists,
  getTopTracks,
  getUserQueue,
  handleCallback,
  hasClientId,
  login,
  logout,
  rankLimitOptions,
  searchSpotify,
  terms,
} from './spotify';

const emptyData = {
  user: null,
  topTracks: {},
  topArtists: {},
  recent: [],
  savedTracks: [],
  savedAlbums: [],
  playback: null,
  devices: [],
  queue: {
    currently_playing: null,
    queue: [],
  },
  libraryTotals: {
    tracks: 0,
    albums: 0,
  },
};

const navItems = [
  { id: 'top-tracks', label: 'Top Tracks', icon: Music2 },
  { id: 'top-artists', label: 'Top Artists', icon: UserRound },
  { id: 'library', label: 'Library', icon: Library },
];

function App() {
  const [token, setToken] = useState(null);
  const [data, setData] = useState(emptyData);
  const [activeTerm, setActiveTerm] = useState('short_term');
  const [rankLimit, setRankLimit] = useState(50);
  const [activePage, setActivePage] = useState('top-tracks');
  const [isBooting, setIsBooting] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [isPlaybackLoading, setIsPlaybackLoading] = useState(false);
  const [error, setError] = useState('');
  const [isPlaybackMinimized, setIsPlaybackMinimized] = useState(false);
  const [listOverlay, setListOverlay] = useState(null);
  const [detailOverlay, setDetailOverlay] = useState(null);
  const [expandedLists, setExpandedLists] = useState({
    savedTracks: false,
    savedAlbums: false,
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState(null);
  const [isSearching, setIsSearching] = useState(false);
  const hasLoadedBaseDataRef = useRef(false);
  const activeLoadKeyRef = useRef('');

  useEffect(() => {
    let cancelled = false;

    const boot = async () => {
      try {
        const resolvedToken = window.location.pathname === '/callback' ? await handleCallback() : getStoredToken();
        if (!cancelled) setToken(resolvedToken);
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setIsBooting(false);
      }
    };

    boot();
    return () => {
      cancelled = true;
    };
  }, []);

  // Playback/device state now only fetches on demand (initial load + manual refresh button)
  // instead of polling automatically every few seconds. This avoids unnecessary Spotify API
  // calls that contributed to hitting rate limits.
  const loadPlaybackData = useCallback(async () => {
    if (!token) return;

    setIsPlaybackLoading(true);
    try {
      const [playbackResult, devicesResult, queueResult] = await Promise.allSettled([
        getPlaybackState(token),
        getAvailableDevices(token),
        getUserQueue(token),
      ]);

      setData((current) => ({
        ...current,
        playback: playbackResult.status === 'fulfilled' ? playbackResult.value : current.playback,
        devices: devicesResult.status === 'fulfilled' ? devicesResult.value?.devices ?? [] : current.devices,
        queue: queueResult.status === 'fulfilled' ? queueResult.value ?? emptyData.queue : current.queue,
      }));
    } finally {
      setIsPlaybackLoading(false);
    }
  }, [token]);

  const loadData = useCallback(async () => {
    if (!token) return;

    const loadKey = `${activeTerm}:${rankLimit}`;
    if (activeLoadKeyRef.current === loadKey) return;
    activeLoadKeyRef.current = loadKey;
    setIsLoading(true);
    setError('');

    try {
      const [topTracksForTerm, topArtistsForTerm] = await Promise.all([
        getTopTracks(token, activeTerm, rankLimit),
        getTopArtists(token, activeTerm, rankLimit),
      ]);

      if (!hasLoadedBaseDataRef.current) {
        const [user, recent, savedTracksPage, savedAlbumsPage] = await Promise.all([
          getCurrentUser(token),
          getRecentlyPlayed(token),
          getSavedTracksPage(token),
          getSavedAlbumsPage(token),
        ]);

        hasLoadedBaseDataRef.current = true;
        setData((current) => ({
          ...current,
          user,
          recent,
          savedTracks: savedTracksPage.items ?? [],
          savedAlbums: savedAlbumsPage.items ?? [],
          libraryTotals: {
            tracks: savedTracksPage.total ?? 0,
            albums: savedAlbumsPage.total ?? 0,
          },
          topTracks: {
            ...current.topTracks,
            [activeTerm]: topTracksForTerm,
          },
          topArtists: {
            ...current.topArtists,
            [activeTerm]: topArtistsForTerm,
          },
        }));

        // Fetch playback/devices once on initial load only.
        await loadPlaybackData();
      } else {
        setData((current) => ({
          ...current,
          topTracks: {
            ...current.topTracks,
            [activeTerm]: topTracksForTerm,
          },
          topArtists: {
            ...current.topArtists,
            [activeTerm]: topArtistsForTerm,
          },
        }));
      }
    } catch (err) {
      setError(err.message);
    } finally {
      activeLoadKeyRef.current = '';
      setIsLoading(false);
    }
  }, [activeTerm, loadPlaybackData, rankLimit, token]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // NOTE: automatic polling interval removed. Playback/device state now only refreshes
  // on initial load or when the user clicks the manual refresh button in the overlay.

  const handleSearch = async (event) => {
    event.preventDefault();
    if (!searchQuery.trim()) {
      setSearchResults(null);
      return;
    }

    setIsSearching(true);
    setError('');

    try {
      const results = await searchSpotify(token, searchQuery);
      setSearchResults(results);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSearching(false);
    }
  };

  const toggleExpandedList = (key) => {
    setExpandedLists((current) => ({ ...current, [key]: !current[key] }));
  };

  if (isBooting) return <LoadingScreen />;

  if (!token) {
    return <LoginScreen error={error} />;
  }

  const tracks = data.topTracks[activeTerm] ?? [];
  const artists = data.topArtists[activeTerm] ?? [];
  const savedTracksLimit = expandedLists.savedTracks ? 30 : 10;
  const savedAlbumsLimit = expandedLists.savedAlbums ? 30 : 10;

  const openArtistDetails = async (artist) => {
    setDetailOverlay({ type: 'artist', item: artist, isLoading: true });
    try {
      const fullArtist = artist.id ? await getArtist(token, artist.id) : artist;
      setDetailOverlay({ type: 'artist', item: fullArtist, isLoading: false });
    } catch (err) {
      setDetailOverlay({ type: 'artist', item: artist, isLoading: false, error: err.message });
    }
  };

  const openAlbumDetails = async (album) => {
    setDetailOverlay({ type: 'album', item: album, isLoading: true });
    try {
      const fullAlbum = album.id ? await getAlbum(token, album.id) : album;
      setDetailOverlay({ type: 'album', item: fullAlbum, isLoading: false });
    } catch (err) {
      setDetailOverlay({ type: 'album', item: album, isLoading: false, error: err.message });
    }
  };

  const openTrackDetails = async (track) => {
    setDetailOverlay({ type: 'track', item: track, artists: [], isLoading: true });
    try {
      const artistsInfo = await Promise.all(
        (track.artists ?? [])
          .filter((artist) => artist.id)
          .slice(0, 4)
          .map((artist) => getArtist(token, artist.id)),
      );
      setDetailOverlay({ type: 'track', item: track, artists: artistsInfo, isLoading: false });
    } catch (err) {
      setDetailOverlay({ type: 'track', item: track, artists: [], isLoading: false, error: err.message });
    }
  };

  return (
    <main className="app-shell">
      <PlaybackDeviceOverlay
        playback={data.playback}
        devices={data.devices}
        queue={data.queue}
        isMinimized={isPlaybackMinimized}
        isLoading={isPlaybackLoading}
        onToggleMinimize={() => setIsPlaybackMinimized((value) => !value)}
        onRefresh={loadPlaybackData}
        onOpenRecent={() => setListOverlay('recent')}
        onOpenQueue={() => setListOverlay('queue')}
      />

      {listOverlay && (
        <ListOverlay
          type={listOverlay}
          recentItems={data.recent.slice(0, 20)}
          queueItems={(data.queue.queue ?? []).slice(0, 20)}
          onClose={() => setListOverlay(null)}
          onSelectTrack={openTrackDetails}
        />
      )}

      {detailOverlay && <DetailOverlay detail={detailOverlay} onClose={() => setDetailOverlay(null)} />}

      <section className="hero">
        <div className="hero__main">
          <p className="eyebrow">
            <Sparkles size={16} />
            Spotify Wrapped
          </p>
          <h1>{data.user?.display_name ? `${data.user.display_name}'s listening map` : 'Your listening map'}</h1>
          <div className="hero__stats" aria-label="Spotify data summary">
            <Stat label="Top tracks" value={tracks.length} />
            <Stat label="Top artists" value={artists.length} />
            <Stat label="Recent plays" value={data.recent.length} />
            <Stat label="Library items" value={data.libraryTotals.tracks + data.libraryTotals.albums} />
          </div>
        </div>

        <div className="hero__side">
          <div className="hero__actions">
            <button className="icon-button" type="button" onClick={loadData} aria-label="Refresh data" title="Refresh data">
              {isLoading ? <Loader2 className="spin" size={20} /> : <RefreshCw size={20} />}
            </button>
            <button className="icon-button" type="button" onClick={logout} aria-label="Sign out" title="Sign out">
              <LogOut size={20} />
            </button>
          </div>
        </div>
      </section>

      {error && <div className="error-banner">{error}</div>}

      <SearchPanel
        query={searchQuery}
        results={searchResults}
        isSearching={isSearching}
        onQueryChange={setSearchQuery}
        onSearch={handleSearch}
        onSelectTrack={openTrackDetails}
        onSelectArtist={openArtistDetails}
        onSelectAlbum={openAlbumDetails}
      />

      <nav className="page-nav" aria-label="Dashboard sections">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <button
              className={activePage === item.id ? 'is-active' : ''}
              key={item.id}
              type="button"
              onClick={() => setActivePage(item.id)}
            >
              <Icon size={17} />
              {item.label}
            </button>
          );
        })}
      </nav>

      {(activePage === 'top-tracks' || activePage === 'top-artists') && (
        <section className="toolbar" aria-label="Rank filters">
          <div className="toolbar__group" aria-label="Time range">
            {terms.map((term) => (
              <button
                className={activeTerm === term ? 'is-active' : ''}
                key={term}
                type="button"
                onClick={() => setActiveTerm(term)}
              >
                {getTermLabel(term)}
              </button>
            ))}
          </div>
          <div className="toolbar__group" aria-label="Rank count">
            {rankLimitOptions.map((limit) => (
              <button
                className={rankLimit === limit ? 'is-active' : ''}
                key={limit}
                type="button"
                onClick={() => setRankLimit(limit)}
              >
                Top {limit}
              </button>
            ))}
          </div>
        </section>
      )}

      {activePage === 'top-tracks' && (
        <Panel title="Top Tracks" icon={<Music2 size={18} />} wide>
          <RankedTrackList items={tracks} onSelectTrack={openTrackDetails} />
        </Panel>
      )}

      {activePage === 'top-artists' && (
        <Panel title="Top Artists" icon={<UserRound size={18} />} wide>
          <RankedArtistList items={artists} onSelectArtist={openArtistDetails} />
        </Panel>
      )}

      {activePage === 'library' && (
        <section className="dashboard-grid">
          <Panel title="Saved Tracks" icon={<Library size={18} />}>
            <SavedTrackList items={data.savedTracks.slice(0, savedTracksLimit)} onSelectTrack={openTrackDetails} />
            <ShowMoreButton
              isExpanded={expandedLists.savedTracks}
              total={Math.min(data.savedTracks.length, 30)}
              onClick={() => toggleExpandedList('savedTracks')}
            />
          </Panel>
          <Panel title="Saved Albums" icon={<Disc3 size={18} />}>
            <AlbumList items={data.savedAlbums.slice(0, savedAlbumsLimit)} onSelectAlbum={openAlbumDetails} />
            <ShowMoreButton
              isExpanded={expandedLists.savedAlbums}
              total={Math.min(data.savedAlbums.length, 30)}
              onClick={() => toggleExpandedList('savedAlbums')}
            />
          </Panel>
        </section>
      )}

    </main>
  );
}

function LoginScreen({ error }) {
  return (
    <main className="login-shell">
      <section className="login-hero">
        <p className="eyebrow">
          <Sparkles size={16} />
          Spotify Wrapped
        </p>
        <h1>Your Spotify listening story, ranked and ready.</h1>
        <p>
          Connect your Spotify account to view top tracks, top artists, playback state, recently played music, and saved
          library metadata across Spotify&apos;s recent weeks, last 6 months, and last 12 months.
        </p>
        {!hasClientId && (
          <div className="setup-note">
            Add `VITE_SPOTIFY_CLIENT_ID` to `.env`, then restart the dev server.
          </div>
        )}
        {error && <div className="error-banner">{error}</div>}
        <button className="primary-button" type="button" onClick={login} disabled={!hasClientId}>
          Connect Spotify
          <ExternalLink size={18} />
        </button>
      </section>
    </main>
  );
}

function LoadingScreen() {
  return (
    <main className="loading-screen">
      <Loader2 className="spin" size={34} />
      <span>Preparing your wrap</span>
    </main>
  );
}

function Stat({ label, value }) {
  return (
    <div>
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

function Panel({ title, icon, children, compact = false, wide = false }) {
  const className = ['panel', compact ? 'panel--compact' : '', wide ? 'panel--wide' : ''].filter(Boolean).join(' ');

  return (
    <section className={className}>
      <header>
        <span>{icon}</span>
        <h2>{title}</h2>
      </header>
      {children}
    </section>
  );
}

function PlaybackDeviceOverlay({
  playback,
  devices,
  queue,
  isMinimized,
  isLoading,
  onToggleMinimize,
  onRefresh,
  onOpenRecent,
  onOpenQueue,
}) {
  const track = playback?.item ?? queue?.currently_playing;
  const artists = track?.artists?.map((artist) => artist.name).join(', ');
  const activeDevice = playback?.device ?? devices.find((device) => device.is_active);

  return (
    <aside className={isMinimized ? 'playback-overlay playback-overlay--minimized' : 'playback-overlay'} aria-label="Current playback and devices">
      <header>
        <span>
          <Radio size={16} />
          Playback & Devices
        </span>
        <div className="playback-overlay__header-actions">
          <button
            className="icon-button icon-button--small"
            type="button"
            onClick={onRefresh}
            aria-label="Refresh playback state"
            title="Refresh playback state"
            disabled={isLoading}
          >
            {isLoading ? <Loader2 className="spin" size={14} /> : <RefreshCw size={14} />}
          </button>
          <button className="icon-button icon-button--small" type="button" onClick={onToggleMinimize} aria-label="Minimize playback overlay">
            {isMinimized ? <Maximize2 size={15} /> : <Minimize2 size={15} />}
          </button>
        </div>
      </header>
      {!isMinimized && (
        <>
          <div className="playback-card__track">
            <Cover src={track?.album?.images?.[2]?.url} alt="" small />
            <div className="item-copy">
              <strong>{track?.name ?? 'Nothing playing'}</strong>
              <span>{artists ?? 'Start Spotify to see live playback'}</span>
              <small>
                {playback?.is_playing ? 'Playing' : 'Paused or inactive'} / {formatDuration(playback?.progress_ms ?? 0)} of{' '}
                {formatDuration(track?.duration_ms ?? 0)}
              </small>
            </div>
          </div>
          <div className="playback-card__meta">
            <InfoValue label="State" value={playback?.is_playing ? 'Playing' : 'Paused or inactive'} />
            <InfoValue label="Shuffle" value={playback?.shuffle_state ? 'On' : 'Off'} />
            <InfoValue label="Repeat" value={playback?.repeat_state ?? 'Off'} />
            <InfoValue
              label="Progress"
              value={`${formatDuration(playback?.progress_ms ?? 0)} / ${formatDuration(track?.duration_ms ?? 0)}`}
            />
            <InfoValue label="Device" value={activeDevice?.name ?? 'No active device'} />
            {activeDevice?.type && <InfoValue label="Device Type" value={activeDevice.type} />}
            {typeof activeDevice?.volume_percent === 'number' && (
              <InfoValue label="Volume" value={`${activeDevice.volume_percent}%`} />
            )}
            <InfoValue label="Available Devices" value={devices.length} />
          </div>
          <div className="playback-card__links" aria-label="Playback related sections">
            <button type="button" onClick={onOpenRecent}>
              <Disc3 size={15} />
              Recently Played
            </button>
            <button type="button" onClick={onOpenQueue}>
              <ListOrdered size={15} />
              Queue
            </button>
          </div>
          {track?.external_urls?.spotify && (
            <a className="spotify-link" href={track.external_urls.spotify} target="_blank" rel="noreferrer">
              Open in Spotify
              <ExternalLink size={16} />
            </a>
          )}
        </>
      )}
    </aside>
  );
}

function InfoValue({ label, value }) {
  return (
    <div className="info-value">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function ListOverlay({ type, recentItems, queueItems, onClose, onSelectTrack }) {
  const isRecent = type === 'recent';
  const [showAll, setShowAll] = useState(false);
  const items = isRecent ? recentItems : queueItems;
  const visibleItems = showAll ? items.slice(0, 20) : items.slice(0, 10);

  return (
    <div className="modal-backdrop" role="presentation">
      <section className="modal-panel" role="dialog" aria-modal="true" aria-label={isRecent ? 'Recently played' : 'Upcoming queue'}>
        <header>
          <span>
            {isRecent ? <Disc3 size={18} /> : <ListOrdered size={18} />}
            {isRecent ? 'Recently Played' : 'Upcoming Queue'}
          </span>
          <button className="icon-button icon-button--small" type="button" onClick={onClose} aria-label="Close overlay">
            x
          </button>
        </header>
        {isRecent ? (
          <RecentList items={visibleItems} onSelectTrack={onSelectTrack} />
        ) : (
          <QueueList items={visibleItems} onSelectTrack={onSelectTrack} />
        )}
        <ShowMoreButton isExpanded={showAll} total={Math.min(items.length, 20)} onClick={() => setShowAll((value) => !value)} />
      </section>
    </div>
  );
}

function DetailOverlay({ detail, onClose }) {
  const { type, item, artists = [], isLoading, error } = detail;
  const image = item.album?.images?.[1]?.url ?? item.images?.[1]?.url;
  const spotifyUrl = item.external_urls?.spotify;
  const hasPopularity = typeof item.popularity === 'number';
  const releaseText = item.release_date ? `Released ${item.release_date}` : '';

  return (
    <div className="modal-backdrop" role="presentation">
      <section className="modal-panel modal-panel--detail" role="dialog" aria-modal="true" aria-label={`${type} details`}>
        <header>
          <span>{type === 'track' ? 'Track Details' : type === 'artist' ? 'Artist Details' : 'Album Details'}</span>
          <button className="icon-button icon-button--small" type="button" onClick={onClose} aria-label="Close details">
            x
          </button>
        </header>
        <div className="detail-hero">
          <Cover src={image} alt="" />
          <div className="item-copy">
            <strong>{item.name}</strong>
            <span>{type === 'track' ? item.artists?.map((artist) => artist.name).join(', ') : item.type}</span>
            {(hasPopularity || releaseText) && (
              <small>
                {[hasPopularity ? `Popularity ${formatPopularity(item.popularity)}` : '', releaseText].filter(Boolean).join(' / ')}
              </small>
            )}
          </div>
          {spotifyUrl && (
            <a className="spotify-link detail-spotify-link" href={spotifyUrl} target="_blank" rel="noreferrer">
              Open in Spotify
              <ExternalLink size={16} />
            </a>
          )}
        </div>

        {isLoading && <EmptyState text="Loading Spotify details..." />}
        {error && <div className="error-banner">{error}</div>}

        {type === 'track' && (
          <div className="detail-grid detail-grid--modal">
            {item.album?.name && <InfoValue label="Album" value={item.album.name} />}
            <InfoValue label="Duration" value={formatDuration(item.duration_ms)} />
            <InfoValue label="Explicit" value={item.explicit ? 'Yes' : 'No'} />
            {item.artists?.length > 0 && (
              <InfoValue label="Artists" value={item.artists.map((artist) => artist.name).join(', ')} />
            )}
          </div>
        )}

        {type === 'album' && (
          <div className="detail-grid detail-grid--modal">
            {item.album_type && <InfoValue label="Album Type" value={item.album_type} />}
            {typeof item.total_tracks === 'number' && <InfoValue label="Total Tracks" value={item.total_tracks} />}
            {item.release_date && <InfoValue label="Release Date" value={item.release_date} />}
            {item.artists?.length > 0 && (
              <InfoValue label="Artists" value={item.artists.map((artist) => artist.name).join(', ')} />
            )}
          </div>
        )}

        {type === 'artist' && (
          <div className="detail-grid detail-grid--modal">
            {typeof item.followers?.total === 'number' && (
              <InfoValue label="Followers" value={item.followers.total.toLocaleString()} />
            )}
            {hasPopularity && <InfoValue label="Popularity" value={formatPopularity(item.popularity)} />}
            {item.genres?.length > 0 && <InfoValue label="Genres" value={item.genres.join(', ')} />}
            <InfoValue label="Spotify Type" value={item.type ?? 'Artist'} />
          </div>
        )}

        {type === 'track' && artists.length > 0 && (
          <section className="artist-strip">
            <h3>Artist / Group Info</h3>
            <div>
              {artists.map((artist) => (
                <article key={artist.id}>
                  <a
                    className="artist-image-link"
                    href={artist.external_urls?.spotify}
                    target="_blank"
                    rel="noreferrer"
                    title={`Open ${artist.name} in Spotify`}
                  >
                    <Cover src={artist.images?.[1]?.url ?? artist.images?.[2]?.url} alt="" />
                  </a>
                  <div className="artist-card-copy">
                    <strong>{artist.name}</strong>
                    {artist.genres?.length > 0 && <span>{artist.genres.slice(0, 3).join(', ')}</span>}
                    {typeof artist.followers?.total === 'number' && <small>{artist.followers.total.toLocaleString()} followers</small>}
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}
      </section>
    </div>
  );
}

function SearchPanel({ query, results, isSearching, onQueryChange, onSearch, onSelectTrack, onSelectArtist, onSelectAlbum }) {
  const tracks = results?.tracks?.items ?? [];
  const artists = results?.artists?.items ?? [];
  const albums = results?.albums?.items ?? [];

  return (
    <section className="search-panel">
      <form className="search-form" onSubmit={onSearch}>
        <Search size={18} />
        <input
          type="search"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="Search Spotify tracks, artists, albums"
          aria-label="Search Spotify"
        />
        <button className="primary-button" type="submit" disabled={isSearching}>
          {isSearching ? 'Searching' : 'Search'}
        </button>
      </form>
      {results && (
        <div className="search-results">
          <SearchColumn title="Tracks" items={tracks} getImage={(item) => item.album?.images?.[2]?.url} onSelect={onSelectTrack} />
          <SearchColumn title="Artists" items={artists} getImage={(item) => item.images?.[2]?.url} onSelect={onSelectArtist} />
          <SearchColumn title="Albums" items={albums} getImage={(item) => item.images?.[2]?.url} onSelect={onSelectAlbum} />
        </div>
      )}
    </section>
  );
}

function SearchColumn({ title, items, getImage, onSelect }) {
  return (
    <section>
      <h3>{title}</h3>
      {items.length ? (
        <ol className="mini-list mini-list--tight">
          {items.map((item, index) => (
            <li key={`${item.id}-${index}`}>
              <Cover src={getImage(item)} alt="" small />
              <div className="item-copy">
                <button className="text-button" type="button" onClick={() => onSelect(item)}>
                  {item.name}
                </button>
                <span>{item.artists?.map((artist) => artist.name).join(', ') || item.type}</span>
              </div>
            </li>
          ))}
        </ol>
      ) : (
        <EmptyState text="No matches yet." />
      )}
    </section>
  );
}

function QueueList({ items, onSelectTrack }) {
  if (!items.length) return <EmptyState text="No upcoming queue returned." />;

  return (
    <ol className="mini-list scroll-list">
      {items.slice(0, 30).map((item, index) => (
        <li key={`${item.id}-${index}`}>
          <Cover src={item.album?.images?.[2]?.url} alt="" small />
          <div className="item-copy">
            <button className="text-button" type="button" onClick={() => onSelectTrack(item)}>
              {item.name}
            </button>
            <span>{item.artists?.map((artist) => artist.name).join(', ') || item.type}</span>
          </div>
        </li>
      ))}
    </ol>
  );
}

function ShowMoreButton({ isExpanded, total, onClick }) {
  if (total <= 10) return null;

  return (
    <button className="show-more-button" type="button" onClick={onClick}>
      {isExpanded ? 'Show less' : 'Show more'}
    </button>
  );
}

function RankedTrackList({ items, onSelectTrack }) {
  if (!items.length) return <EmptyState text="No top tracks returned yet." />;

  return (
    <ol className="rank-list scroll-list">
      {items.map((track, index) => (
        <li key={`${track.id}-${index}`}>
          <Rank value={index + 1} />
          <Cover src={track.album?.images?.[1]?.url} alt="" />
          <div className="item-copy">
            <button className="text-button" type="button" onClick={() => onSelectTrack(track)}>
              {track.name}
            </button>
            <span>{track.artists?.map((artist) => artist.name).join(', ')}</span>
            <TrackMetadata track={track} />
          </div>
        </li>
      ))}
    </ol>
  );
}

function TrackMetadata({ track }) {
  const parts = [track.album?.name];
  if (typeof track.popularity === 'number') {
    parts.push(`Popularity ${formatPopularity(track.popularity)}`);
  }

  const text = parts.filter(Boolean).join(' / ');
  return text ? <small>{text}</small> : null;
}

function RankedArtistList({ items, onSelectArtist }) {
  if (!items.length) return <EmptyState text="No top artists returned yet." />;

  return (
    <ol className="rank-list scroll-list">
      {items.map((artist, index) => (
        <li key={`${artist.id}-${index}`}>
          <Rank value={index + 1} />
          <Cover src={artist.images?.[1]?.url} alt="" />
          <div className="item-copy">
            <button className="text-button" type="button" onClick={() => onSelectArtist(artist)}>
              {artist.name}
            </button>
            <ArtistMetadata artist={artist} />
          </div>
        </li>
      ))}
    </ol>
  );
}

function ArtistMetadata({ artist }) {
  const detailParts = [];
  if (typeof artist.followers?.total === 'number') {
    detailParts.push(`Followers ${artist.followers.total.toLocaleString()}`);
  }
  if (typeof artist.popularity === 'number') {
    detailParts.push(`Popularity ${formatPopularity(artist.popularity)}`);
  }

  return (
    <>
      {artist.genres?.length > 0 && <span>{artist.genres.slice(0, 3).join(', ')}</span>}
      {detailParts.length > 0 && <small>{detailParts.join(' / ')}</small>}
    </>
  );
}

function RecentList({ items, onSelectTrack }) {
  if (!items.length) return <EmptyState text="No recently played tracks returned." />;

  return (
    <ol className="mini-list">
      {items.map((item, index) => (
        <li key={`${item.played_at}-${item.track?.id}-${index}`}>
          <Cover src={item.track?.album?.images?.[2]?.url} alt="" small />
          <div className="item-copy">
            <button className="text-button" type="button" onClick={() => onSelectTrack(item.track)}>
              {item.track?.name}
            </button>
            <span>{item.track?.artists?.map((artist) => artist.name).join(', ')}</span>
            {item.played_at && <small>Played {formatDate(item.played_at)}</small>}
          </div>
        </li>
      ))}
    </ol>
  );
}

function SavedTrackList({ items, onSelectTrack }) {
  if (!items.length) return <EmptyState text="No saved tracks returned." />;

  return (
    <ol className="mini-list">
      {items.map((item, index) => (
        <li key={`${item.track?.id}-${index}`}>
          <Cover src={item.track?.album?.images?.[2]?.url} alt="" small />
          <div className="item-copy">
            <button className="text-button" type="button" onClick={() => onSelectTrack(item.track)}>
              {item.track?.name}
            </button>
            <span>{item.track?.artists?.map((artist) => artist.name).join(', ')}</span>
            <SavedTrackMetadata item={item} />
          </div>
        </li>
      ))}
    </ol>
  );
}

function SavedTrackMetadata({ item }) {
  const parts = [];
  if (item.added_at) parts.push(`Saved ${formatDate(item.added_at)}`);
  if (item.track?.album?.release_date) parts.push(item.track.album.release_date);

  return parts.length > 0 ? <small>{parts.join(' / ')}</small> : null;
}

function AlbumList({ items, onSelectAlbum }) {
  if (!items.length) return <EmptyState text="No saved albums returned." />;

  return (
    <ol className="mini-list">
      {items.map((item, index) => (
        <li key={`${item.album?.id}-${index}`}>
          <Cover src={item.album?.images?.[2]?.url} alt="" small />
          <div className="item-copy">
            <button className="text-button" type="button" onClick={() => onSelectAlbum(item.album)}>
              {item.album?.name}
            </button>
            <span>{item.album?.artists?.map((artist) => artist.name).join(', ')}</span>
            <AlbumMetadata album={item.album} />
          </div>
        </li>
      ))}
    </ol>
  );
}

function AlbumMetadata({ album }) {
  const parts = [];
  if (album?.album_type) parts.push(album.album_type);
  if (typeof album?.total_tracks === 'number') parts.push(`${album.total_tracks} tracks`);
  if (album?.release_date) parts.push(`Released ${album.release_date}`);

  return parts.length > 0 ? <small>{parts.join(' / ')}</small> : null;
}

function Cover({ src, alt, small = false }) {
  return src ? (
    <img className={small ? 'cover cover--small' : 'cover'} src={src} alt={alt} loading="lazy" />
  ) : (
    <span className={small ? 'cover cover--small cover--empty' : 'cover cover--empty'}>
      <Music2 size={small ? 16 : 20} />
    </span>
  );
}

function Rank({ value }) {
  return <span className="rank">{String(value).padStart(2, '0')}</span>;
}

function EmptyState({ text }) {
  return <p className="empty-state">{text}</p>;
}

export default App;
