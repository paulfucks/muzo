/**
 * Muzo - High Performance Music Streaming Engine
 * Optimized for Instant Playback (<500ms) and Fast Caching.
 */

// App State
const state = {
  currentTrack: null,
  queue: [],
  queueIndex: -1,
  isPlaying: false,
  isShuffle: false,
  repeatMode: 0, // 0: off, 1: repeat all, 2: repeat one
  volume: 80,
  isMuted: false,
  likedSongs: JSON.parse(localStorage.getItem('muzo_liked') || localStorage.getItem('harmony_liked') || '[]'),
  playlists: JSON.parse(localStorage.getItem('muzo_playlists') || localStorage.getItem('harmony_playlists') || '[]'),
  history: JSON.parse(localStorage.getItem('muzo_history') || '[]'),
  lyrics: [],
  activeLyricIndex: -1,
  activeView: 'home',
  currentCategory: 'trending',
  pendingSongForPlaylist: null,
  isVideoOpen: false,
  recommendations: []
};

// High-speed client-side cache
const clientSearchCache = new Map();
const clientChartsCache = new Map();

let ytPlayer = null;
let progressTimer = null;
let searchDebounceTimer = null;
let recommendationDebounceTimer = null;

// =================================================================
// 1. YouTube Player Setup (High Priority Audio Engine)
// =================================================================
window.onYouTubeIframeAPIReady = function() {
  ytPlayer = new YT.Player('yt-player-frame', {
    height: '100%',
    width: '100%',
    videoId: 'Rif-RTvmmss', // Pre-warm audio engine immediately
    playerVars: {
      autoplay: 0,
      controls: 0,
      disablekb: 1,
      fs: 0,
      modestbranding: 1,
      rel: 0,
      playsinline: 1,
      origin: window.location.origin
    },
    events: {
      onReady: onPlayerReady,
      onStateChange: onPlayerStateChange,
      onError: onPlayerError
    }
  });
};

function onPlayerReady(event) {
  event.target.setVolume(state.volume);
  updateVolumeUI();
}

function onPlayerStateChange(event) {
  if (event.data === YT.PlayerState.PLAYING) {
    state.isPlaying = true;
    updatePlayPauseButton();
    startProgressLoop();
    updateMediaSession();
  } else if (event.data === YT.PlayerState.PAUSED) {
    state.isPlaying = false;
    updatePlayPauseButton();
    stopProgressLoop();
  } else if (event.data === YT.PlayerState.ENDED) {
    handleTrackEnded();
  }
}

function onPlayerError(event) {
  console.warn('YouTube Player Error:', event.data);
  showToast('Playback restricted, playing next song...', 'alert-circle');
  setTimeout(() => playNextTrack(), 1000);
}

function handleTrackEnded() {
  if (state.repeatMode === 2) {
    ytPlayer.seekTo(0);
    ytPlayer.playVideo();
  } else {
    playNextTrack();
  }
}

// =================================================================
// 2. Playback Control (Instant Response)
// =================================================================
function playTrack(track, newQueue = null, indexInQueue = null) {
  if (!track || !track.id) return;

  state.currentTrack = track;

  // Immediate UI update across Desktop, Mobile Mini, and Mobile Fullscreen players
  const thumbUrl = track.thumbnail || 'https://i.ytimg.com/vi/' + track.id + '/hqdefault.jpg';
  const trackTitle = track.title || 'Unknown Track';
  const trackArtist = track.artist || 'Muzo Music';

  // Desktop Player
  const deskThumb = document.getElementById('player-thumb');
  const deskTitle = document.getElementById('player-title');
  const deskArtist = document.getElementById('player-artist');
  if (deskThumb) deskThumb.src = thumbUrl;
  if (deskTitle) deskTitle.innerText = trackTitle;
  if (deskArtist) deskArtist.innerText = trackArtist;

  // Mobile Mini Player
  const mobThumb = document.getElementById('mob-player-thumb');
  const mobTitle = document.getElementById('mob-player-title');
  const mobArtist = document.getElementById('mob-player-artist');
  if (mobThumb) mobThumb.src = thumbUrl;
  if (mobTitle) mobTitle.innerText = trackTitle;
  if (mobArtist) mobArtist.innerText = trackArtist;

  // Mobile Fullscreen Player
  const mobFullThumb = document.getElementById('mob-full-thumb');
  const mobFullTitle = document.getElementById('mob-full-title');
  const mobFullArtist = document.getElementById('mob-full-artist');
  if (mobFullThumb) mobFullThumb.src = thumbUrl;
  if (mobFullTitle) mobFullTitle.innerText = trackTitle;
  if (mobFullArtist) mobFullArtist.innerText = trackArtist;

  updateLikeButtonUI();
  updatePlayPauseButton();

  // Queue handling
  if (newQueue) {
    state.queue = [...newQueue];
    state.queueIndex = indexInQueue !== null ? indexInQueue : state.queue.findIndex(t => t.id === track.id);
  } else {
    const idx = state.queue.findIndex(t => t.id === track.id);
    if (idx !== -1) {
      state.queueIndex = idx;
    } else {
      state.queue.push(track);
      state.queueIndex = state.queue.length - 1;
    }
  }
  updateQueueUI();

  // Instant Audio Playback: Request lightweight stream directly with zero delay
  if (ytPlayer && ytPlayer.loadVideoById) {
    try {
      ytPlayer.loadVideoById({
        videoId: track.id,
        suggestedQuality: 'small'
      });
      ytPlayer.playVideo();
    } catch (e) {
      try {
        ytPlayer.loadVideoById(track.id);
        ytPlayer.playVideo();
      } catch (err) {}
    }
  }

  // Record history locally (instant)
  recordHistory(track);

  // Background non-blocking fetch for lyrics (only if lyrics view is active)
  if (state.activeView === 'lyrics') {
    fetchAndRenderLyrics(track);
  }

  // Non-blocking recommendations (debounced by 4s so audio startup gets 100% bandwidth!)
  clearTimeout(recommendationDebounceTimer);
  recommendationDebounceTimer = setTimeout(() => {
    if (state.activeView === 'home') {
      fetchAndRenderRecommendations(track);
    }
  }, 4000);

  showToast(`Playing: ${track.title}`, 'music');
}

function recordHistory(track) {
  state.history = state.history.filter(t => t.id !== track.id);
  state.history.unshift(track);
  if (state.history.length > 40) {
    state.history = state.history.slice(0, 40);
  }
  localStorage.setItem('muzo_history', JSON.stringify(state.history));
}

function togglePlayPause() {
  if (!state.currentTrack) {
    const firstTrending = state.queue[0];
    if (firstTrending) playTrack(firstTrending);
    return;
  }

  if (!ytPlayer) return;

  if (state.isPlaying) {
    ytPlayer.pauseVideo();
  } else {
    ytPlayer.playVideo();
  }
}

function playNextTrack() {
  if (state.queue.length === 0) return;

  let nextIdx;
  if (state.isShuffle) {
    nextIdx = Math.floor(Math.random() * state.queue.length);
  } else {
    nextIdx = state.queueIndex + 1;
    if (nextIdx >= state.queue.length) {
      if (state.repeatMode === 1) {
        nextIdx = 0;
      } else {
        showToast('End of queue', 'info');
        return;
      }
    }
  }

  state.queueIndex = nextIdx;
  playTrack(state.queue[nextIdx]);
}

function playPrevTrack() {
  if (!ytPlayer) return;

  const curTime = ytPlayer.getCurrentTime ? ytPlayer.getCurrentTime() : 0;
  if (curTime > 3) {
    ytPlayer.seekTo(0);
    return;
  }

  if (state.queueIndex > 0) {
    state.queueIndex--;
    playTrack(state.queue[state.queueIndex]);
  } else if (state.queue.length > 0) {
    state.queueIndex = state.queue.length - 1;
    playTrack(state.queue[state.queueIndex]);
  }
}

function toggleShuffle() {
  state.isShuffle = !state.isShuffle;
  const btn = document.getElementById('btn-shuffle');
  const mobBtn = document.getElementById('mob-full-shuffle');
  
  [btn, mobBtn].forEach(el => {
    if (!el) return;
    if (state.isShuffle) {
      el.classList.add('text-cyan-400');
      el.classList.remove('text-spotify-subtext');
    } else {
      el.classList.remove('text-cyan-400');
      el.classList.add('text-spotify-subtext');
    }
  });

  if (state.isShuffle) {
    showToast('Shuffle ON', 'shuffle');
  } else {
    showToast('Shuffle OFF', 'shuffle');
  }
}

function toggleRepeat() {
  state.repeatMode = (state.repeatMode + 1) % 3;
  const btn = document.getElementById('btn-repeat');
  const mobBtn = document.getElementById('mob-full-repeat');
  
  [btn, mobBtn].forEach(el => {
    if (!el) return;
    if (state.repeatMode === 1) {
      el.classList.add('text-cyan-400');
      el.classList.remove('text-spotify-subtext');
      el.title = "Repeat All";
    } else if (state.repeatMode === 2) {
      el.classList.add('text-cyan-400');
      el.classList.remove('text-spotify-subtext');
      el.title = "Repeat One";
    } else {
      el.classList.remove('text-cyan-400');
      el.classList.add('text-spotify-subtext');
      el.title = "Repeat Off";
    }
  });

  if (state.repeatMode === 1) {
    showToast('Repeat: All', 'repeat');
  } else if (state.repeatMode === 2) {
    showToast('Repeat: Current Song', 'repeat-1');
  } else {
    showToast('Repeat: OFF', 'repeat');
  }
}

function updatePlayPauseButton() {
  const btn = document.getElementById('btn-play-pause');
  const mobBtn = document.getElementById('mob-player-play-pause-btn');
  const mobFullBtn = document.getElementById('mob-full-play-pause');

  if (state.isPlaying) {
    if (btn) btn.innerHTML = `<i data-lucide="pause" class="w-5 h-5 fill-black"></i>`;
    if (mobBtn) mobBtn.innerHTML = `<i data-lucide="pause" class="w-5 h-5 fill-black"></i>`;
    if (mobFullBtn) mobFullBtn.innerHTML = `<i data-lucide="pause" class="w-8 h-8 fill-black"></i>`;
  } else {
    if (btn) btn.innerHTML = `<i data-lucide="play" class="w-5 h-5 fill-black ml-0.5"></i>`;
    if (mobBtn) mobBtn.innerHTML = `<i data-lucide="play" class="w-5 h-5 fill-black ml-0.5"></i>`;
    if (mobFullBtn) mobFullBtn.innerHTML = `<i data-lucide="play" class="w-8 h-8 fill-black ml-1"></i>`;
  }
  lucide.createIcons();
}

// =================================================================
// 3. Scrubber Timeline & Lyrics Sync Loop
// =================================================================
function startProgressLoop() {
  stopProgressLoop();
  progressTimer = setInterval(() => {
    if (!ytPlayer || !ytPlayer.getCurrentTime) return;

    const currentTime = ytPlayer.getCurrentTime();
    const duration = ytPlayer.getDuration() || 0;
    const curFmt = formatTime(currentTime);
    const totFmt = formatTime(duration);
    const progressPct = duration > 0 ? (currentTime / duration) * 100 : 0;

    // Desktop
    const deskCur = document.getElementById('player-time-current');
    const deskTot = document.getElementById('player-time-total');
    const deskProg = document.getElementById('progress-bar');
    if (deskCur) deskCur.innerText = curFmt;
    if (deskTot) deskTot.innerText = totFmt;
    if (deskProg) deskProg.style.width = `${progressPct}%`;

    // Mobile Mini Player
    const mobMiniProg = document.getElementById('mobile-mini-progress');
    if (mobMiniProg) mobMiniProg.style.width = `${progressPct}%`;

    // Mobile Fullscreen Player
    const mobFullCur = document.getElementById('mob-full-time-current');
    const mobFullTot = document.getElementById('mob-full-time-total');
    const mobFullProg = document.getElementById('mob-full-progress-bar');
    if (mobFullCur) mobFullCur.innerText = curFmt;
    if (mobFullTot) mobFullTot.innerText = totFmt;
    if (mobFullProg) mobFullProg.style.width = `${progressPct}%`;

    syncLyricsWithTime(currentTime);
  }, 250);
}

function stopProgressLoop() {
  if (progressTimer) clearInterval(progressTimer);
}

document.getElementById('progress-container').addEventListener('click', function(e) {
  if (!ytPlayer || !ytPlayer.getDuration) return;
  const rect = this.getBoundingClientRect();
  const clickX = e.clientX - rect.left;
  const pct = Math.max(0, Math.min(1, clickX / rect.width));
  const newTime = pct * ytPlayer.getDuration();
  ytPlayer.seekTo(newTime, true);
  document.getElementById('progress-bar').style.width = `${pct * 100}%`;
});

function seekFromMobileMini(e) {
  if (!ytPlayer || !ytPlayer.getDuration) return;
  const rect = e.currentTarget.getBoundingClientRect();
  const clickX = e.clientX - rect.left;
  const pct = Math.max(0, Math.min(1, clickX / rect.width));
  const newTime = pct * ytPlayer.getDuration();
  ytPlayer.seekTo(newTime, true);
  const prog = document.getElementById('mobile-mini-progress');
  if (prog) prog.style.width = `${pct * 100}%`;
}

function seekFromMobileFull(e) {
  if (!ytPlayer || !ytPlayer.getDuration) return;
  const rect = e.currentTarget.getBoundingClientRect();
  const clickX = e.clientX - rect.left;
  const pct = Math.max(0, Math.min(1, clickX / rect.width));
  const newTime = pct * ytPlayer.getDuration();
  ytPlayer.seekTo(newTime, true);
  const prog = document.getElementById('mob-full-progress-bar');
  if (prog) prog.style.width = `${pct * 100}%`;
}

function openMobilePlayer() {
  if (!state.currentTrack) return;
  const modal = document.getElementById('mobile-player-modal');
  if (modal) {
    modal.classList.add('open');
    document.body.style.overflow = 'hidden';
  }
}

function closeMobilePlayer() {
  const modal = document.getElementById('mobile-player-modal');
  if (modal) {
    modal.classList.remove('open');
    document.body.style.overflow = '';
  }
}

function formatTime(seconds) {
  if (isNaN(seconds) || seconds < 0) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

// =================================================================
// 4. Volume Controls
// =================================================================
const volumeSlider = document.getElementById('volume-slider');
volumeSlider.addEventListener('input', function() {
  const val = parseInt(this.value);
  state.volume = val;
  state.isMuted = val === 0;
  if (ytPlayer && ytPlayer.setVolume) {
    ytPlayer.setVolume(val);
    if (ytPlayer.isMuted && ytPlayer.isMuted()) ytPlayer.unMute();
  }
  updateVolumeUI();
});

function toggleMute() {
  if (!ytPlayer) return;
  state.isMuted = !state.isMuted;
  if (state.isMuted) {
    ytPlayer.mute();
    volumeSlider.value = 0;
  } else {
    ytPlayer.unMute();
    volumeSlider.value = state.volume;
  }
  updateVolumeUI();
}

function updateVolumeUI() {
  const iconBtn = document.getElementById('btn-volume-icon');
  let iconName = 'volume-2';
  if (state.isMuted || state.volume === 0) {
    iconName = 'volume-x';
  } else if (state.volume < 40) {
    iconName = 'volume-1';
  }
  iconBtn.innerHTML = `<i data-lucide="${iconName}" class="w-4 h-4"></i>`;
  lucide.createIcons();
}

// =================================================================
// 5. Smart Recommendations Engine
// =================================================================
async function fetchAndRenderRecommendations(seedTrack = null) {
  const container = document.getElementById('recommendations-grid');
  const heading = document.getElementById('recommendations-heading');
  const badge = document.getElementById('recommendation-badge');

  let seedQuery = "";
  if (seedTrack) {
    seedQuery = `${seedTrack.title} ${seedTrack.artist}`;
    heading.innerHTML = `
      <i data-lucide="sparkles" class="w-6 h-6 text-cyan-400"></i>
      <span>Because you played <span class="text-cyan-300">"${seedTrack.title}"</span></span>
    `;
    badge.innerText = `Based on: ${seedTrack.artist || 'recent track'}`;
  } else if (state.history.length > 0) {
    const recent = state.history[0];
    seedQuery = `${recent.title} ${recent.artist}`;
    heading.innerHTML = `
      <i data-lucide="sparkles" class="w-6 h-6 text-cyan-400"></i>
      <span>Recommended For You</span>
    `;
    badge.innerText = `Inspired by: ${recent.artist || recent.title}`;
  } else {
    seedQuery = "Popular Anime OST Chill Lofi Pop Hits";
    heading.innerHTML = `
      <i data-lucide="sparkles" class="w-6 h-6 text-cyan-400"></i>
      <span>Recommended For You</span>
    `;
    badge.innerText = "Trending Mix";
  }

  try {
    const res = await fetch(`/api/recommendations?seed=${encodeURIComponent(seedQuery)}`);
    const tracks = await res.json();

    if (tracks && tracks.length > 0) {
      const filtered = tracks.filter(t => !seedTrack || t.id !== seedTrack.id).slice(0, 10);
      state.recommendations = filtered;

      container.innerHTML = filtered.map((track, idx) => `
        <div class="music-card bg-spotify-card p-3.5 rounded-2xl cursor-pointer group relative border border-white/5" onclick='playTrack(${JSON.stringify(track).replace(/'/g, "&#39;")}, ${JSON.stringify(filtered).replace(/'/g, "&#39;")}, ${idx})'>
          <div class="relative w-full aspect-square rounded-xl overflow-hidden mb-3 shadow-lg bg-neutral-800">
            <img src="${track.thumbnail}" class="w-full h-full object-cover group-hover:scale-105 transition duration-300">
            <button class="play-btn absolute bottom-3 right-3 w-10 h-10 rounded-full bg-gradient-to-r from-teal-400 to-cyan-400 flex items-center justify-center text-black shadow-xl shadow-cyan-400/30 hover:scale-110 active:scale-95 transition">
              <i data-lucide="play" class="w-5 h-5 fill-black ml-0.5"></i>
            </button>
            <button onclick="event.stopPropagation(); openAddToPlaylistModal(${JSON.stringify(track).replace(/'/g, "&#39;")})" title="Add to Playlist" class="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/70 hover:bg-cyan-500 hover:text-black text-white flex items-center justify-center opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition shadow">
              <i data-lucide="plus" class="w-4 h-4"></i>
            </button>
          </div>
          <div class="font-bold text-white text-sm truncate mb-0.5">${track.title}</div>
          <div class="text-xs text-spotify-subtext truncate">${track.artist}</div>
        </div>
      `).join('');
    }
  } catch (err) {}
  lucide.createIcons();
}

function refreshRecommendations() {
  if (state.currentTrack) {
    fetchAndRenderRecommendations(state.currentTrack);
  } else if (state.history.length > 0) {
    const randomSeed = state.history[Math.floor(Math.random() * state.history.length)];
    fetchAndRenderRecommendations(randomSeed);
  } else {
    fetchAndRenderRecommendations();
  }
  showToast('Refreshing recommendations...', 'sparkles');
}

// =================================================================
// 6. Lyrics Engine
// =================================================================
async function fetchAndRenderLyrics(track) {
  state.lyrics = [];
  state.activeLyricIndex = -1;
  const container = document.getElementById('lyrics-container');
  document.getElementById('lyrics-title').innerText = track.title;
  document.getElementById('lyrics-artist').innerText = track.artist;

  container.innerHTML = `
    <div class="flex flex-col items-center justify-center py-16 gap-3 text-spotify-subtext">
      <div class="w-7 h-7 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin"></div>
      <div class="text-xs">Fetching synchronized lyrics...</div>
    </div>
  `;

  try {
    const cleanTitle = (track.title || '').replace(/\(Official.*?\)|\[Official.*?\]|Official Audio|Official Video|Lyric Video|Lyrics/gi, '').trim();
    const cleanArtist = (track.artist || '').replace(/- Topic/gi, '').trim();

    let data = null;
    try {
      const url = `/api/lyrics?title=${encodeURIComponent(cleanTitle)}&artist=${encodeURIComponent(cleanArtist)}`;
      const res = await fetch(url);
      if (res.ok) data = await res.json();
    } catch (e) {}

    // Universal Direct Fallback via LRCLIB & lyrics.ovh
    if (!data || (!data.syncedLyrics && !data.plainLyrics)) {
      try {
        const lrcRes = await fetch(`https://lrclib.net/api/get?track_name=${encodeURIComponent(cleanTitle)}&artist_name=${encodeURIComponent(cleanArtist)}`);
        if (lrcRes.ok) {
          const lrcData = await lrcRes.json();
          if (lrcData.syncedLyrics || lrcData.plainLyrics) {
            data = lrcData;
          }
        }
      } catch (e) {}
    }

    if (data && data.syncedLyrics) {
      parseLrcLyrics(data.syncedLyrics);
      renderSyncedLyrics();
    } else if (data && data.plainLyrics) {
      renderPlainLyrics(data.plainLyrics);
    } else {
      container.innerHTML = `<div class="text-spotify-subtext text-base py-16">No lyrics found for this track.</div>`;
    }
  } catch (err) {
    container.innerHTML = `<div class="text-spotify-subtext text-base py-16">Could not load lyrics.</div>`;
  }
}

function parseLrcLyrics(lrcText) {
  const lines = lrcText.split('\n');
  const parsed = [];
  const timeRegex = /\[(\d{2}):(\d{2}(?:\.\d+)?)\]/;

  for (const line of lines) {
    const match = timeRegex.exec(line);
    if (match) {
      const min = parseFloat(match[1]);
      const sec = parseFloat(match[2]);
      const time = min * 60 + sec;
      const text = line.replace(timeRegex, '').trim();
      if (text) {
        parsed.push({ time, text });
      }
    }
  }
  state.lyrics = parsed;
}

function renderSyncedLyrics() {
  const container = document.getElementById('lyrics-container');
  container.innerHTML = state.lyrics.map((item, idx) => `
    <div id="lyric-${idx}" class="lyric-line" onclick="seekToLyric(${item.time})">
      ${item.text}
    </div>
  `).join('');
}

function renderPlainLyrics(plainText) {
  const container = document.getElementById('lyrics-container');
  const formatted = plainText.split('\n').map(l => l.trim() ? `<p class="py-1 text-white/80 text-lg">${l}</p>` : `<br/>`).join('');
  container.innerHTML = `<div class="max-w-md mx-auto text-left py-8">${formatted}</div>`;
}

function seekToLyric(time) {
  if (ytPlayer && ytPlayer.seekTo) {
    ytPlayer.seekTo(time, true);
    if (!state.isPlaying) ytPlayer.playVideo();
  }
}

function syncLyricsWithTime(currentTime) {
  if (!state.lyrics || state.lyrics.length === 0) return;

  let activeIndex = -1;
  for (let i = 0; i < state.lyrics.length; i++) {
    if (currentTime >= state.lyrics[i].time) {
      activeIndex = i;
    } else {
      break;
    }
  }

  if (activeIndex !== state.activeLyricIndex) {
    if (state.activeLyricIndex !== -1) {
      const prevEl = document.getElementById(`lyric-${state.activeLyricIndex}`);
      if (prevEl) prevEl.classList.remove('active');
    }

    if (activeIndex !== -1) {
      const curEl = document.getElementById(`lyric-${activeIndex}`);
      if (curEl) {
        curEl.classList.add('active');
        curEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
    state.activeLyricIndex = activeIndex;
  }
}

function toggleLyrics() {
  if (state.activeView === 'lyrics') {
    showView('home');
  } else {
    showView('lyrics');
    if (state.currentTrack && state.lyrics.length === 0) {
      fetchAndRenderLyrics(state.currentTrack);
    }
  }
}

// =================================================================
// 7. Up Next Queue
// =================================================================
function toggleQueue() {
  const drawer = document.getElementById('queue-drawer');
  drawer.classList.toggle('hidden');
  updateQueueUI();
}

function updateQueueUI() {
  const nowPlayingEl = document.getElementById('queue-now-playing');
  const listEl = document.getElementById('queue-list');
  const badge = document.getElementById('queue-badge');

  if (state.currentTrack) {
    nowPlayingEl.innerHTML = `
      <img src="${state.currentTrack.thumbnail}" class="w-10 h-10 rounded-md object-cover">
      <div class="overflow-hidden flex-1">
        <div class="font-semibold text-white truncate text-xs">${state.currentTrack.title}</div>
        <div class="text-[11px] text-cyan-400 truncate">${state.currentTrack.artist}</div>
      </div>
      <div class="flex items-center gap-1">
        <span class="eq-bar"></span>
        <span class="eq-bar"></span>
        <span class="eq-bar"></span>
      </div>
    `;
  } else {
    nowPlayingEl.innerHTML = `<div class="text-xs text-spotify-subtext">No track selected</div>`;
  }

  const upcoming = state.queue.slice(state.queueIndex + 1);
  if (upcoming.length > 0) {
    badge.classList.remove('hidden');
    listEl.innerHTML = upcoming.map((t, idx) => `
      <div class="flex items-center justify-between p-2 rounded-lg hover:bg-white/10 group cursor-pointer" onclick="playTrackFromQueue(${state.queueIndex + 1 + idx})">
        <div class="flex items-center gap-2.5 overflow-hidden">
          <span class="text-xs text-spotify-subtext w-4">${idx + 1}</span>
          <img src="${t.thumbnail}" class="w-8 h-8 rounded object-cover">
          <div class="overflow-hidden">
            <div class="font-medium text-white truncate text-xs">${t.title}</div>
            <div class="text-[11px] text-spotify-subtext truncate">${t.artist}</div>
          </div>
        </div>
        <span class="text-[11px] text-spotify-subtext font-mono">${t.duration}</span>
      </div>
    `).join('');
  } else {
    badge.classList.add('hidden');
    listEl.innerHTML = `<div class="text-xs text-spotify-subtext text-center py-6">No upcoming songs in queue</div>`;
  }
}

function playTrackFromQueue(index) {
  if (index >= 0 && index < state.queue.length) {
    state.queueIndex = index;
    playTrack(state.queue[index]);
  }
}

function clearQueue() {
  if (state.currentTrack) {
    state.queue = [state.currentTrack];
    state.queueIndex = 0;
  } else {
    state.queue = [];
    state.queueIndex = -1;
  }
  updateQueueUI();
  showToast('Queue cleared', 'trash-2');
}

// =================================================================
// 8. Instant Search & Autocomplete
// =================================================================
const searchInput = document.getElementById('search-input');
const searchClearBtn = document.getElementById('search-clear');
const suggestionsDropdown = document.getElementById('suggestions-dropdown');
const suggestionsList = document.getElementById('suggestions-list');

searchInput.addEventListener('input', function() {
  const query = this.value.trim();
  if (query.length > 0) {
    searchClearBtn.classList.remove('hidden');
  } else {
    searchClearBtn.classList.add('hidden');
    suggestionsDropdown.classList.add('hidden');
    return;
  }

  clearTimeout(searchDebounceTimer);
  searchDebounceTimer = setTimeout(() => {
    fetchSuggestions(query);
  }, 180);
});

searchInput.addEventListener('keydown', function(e) {
  if (e.key === 'Enter') {
    e.preventDefault();
    suggestionsDropdown.classList.add('hidden');
    performSearch(this.value.trim());
  }
});

function clearSearch() {
  searchInput.value = '';
  searchClearBtn.classList.add('hidden');
  suggestionsDropdown.classList.add('hidden');
  searchInput.focus();
}

function focusSearch() {
  showView('search');
  searchInput.focus();
}

async function fetchSuggestions(query) {
  try {
    let suggestions = null;
    try {
      const res = await fetch(`/api/suggestions?q=${encodeURIComponent(query)}`);
      if (res.ok) suggestions = await res.json();
    } catch (e) {}

    // Universal Direct Fallback via Google Suggest JSONP
    if (!suggestions || suggestions.length === 0) {
      suggestions = await fetchDirectSuggestions(query);
    }

    if (suggestions && suggestions.length > 0) {
      suggestionsList.innerHTML = suggestions.slice(0, 6).map(s => `
        <div class="px-4 py-2 hover:bg-white/10 cursor-pointer flex items-center gap-3 text-spotify-subtext hover:text-cyan-300 transition" onclick="selectSuggestion('${escapeQuotes(s)}')">
          <i data-lucide="search" class="w-4 h-4"></i>
          <span>${s}</span>
        </div>
      `).join('');
      suggestionsDropdown.classList.remove('hidden');
      lucide.createIcons();
    } else {
      suggestionsDropdown.classList.add('hidden');
    }
  } catch (e) {
    suggestionsDropdown.classList.add('hidden');
  }
}

function fetchDirectSuggestions(query) {
  return new Promise((resolve) => {
    const cb = 'muzo_suggest_' + Math.floor(Math.random() * 1000000);
    const script = document.createElement('script');
    const timer = setTimeout(() => { cleanup(); resolve([]); }, 1800);

    function cleanup() {
      clearTimeout(timer);
      try { delete window[cb]; } catch(e) {}
      if (script.parentNode) script.parentNode.removeChild(script);
    }

    window[cb] = function(data) {
      cleanup();
      if (data && Array.isArray(data[1])) {
        resolve(data[1].map(it => Array.isArray(it) ? it[0] : it).slice(0, 6));
      } else {
        resolve([]);
      }
    };

    script.src = `https://suggestqueries.google.com/complete/search?client=youtube&ds=yt&jsonp=${cb}&q=${encodeURIComponent(query)}`;
    script.onerror = () => { cleanup(); resolve([]); };
    document.head.appendChild(script);
  });
}

function selectSuggestion(text) {
  searchInput.value = text;
  suggestionsDropdown.classList.add('hidden');
  performSearch(text);
}

document.addEventListener('click', (e) => {
  if (!searchInput.contains(e.target) && !suggestionsDropdown.contains(e.target)) {
    suggestionsDropdown.classList.add('hidden');
  }
});

// Universal Direct Search Fallback Mirrors (Open CORS endpoints)
const PUBLIC_INVIDIOUS_MIRRORS = [
  'https://inv.nadeko.net',
  'https://invidious.nerdvpn.de',
  'https://iv.melmac.space',
  'https://yt.drgnz.club'
];

async function fetchDirectClientSearch(query) {
  for (const mirror of PUBLIC_INVIDIOUS_MIRRORS) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3500);
      const res = await fetch(`${mirror}/api/v1/search?q=${encodeURIComponent(query)}&type=video`, {
        signal: controller.signal
      });
      clearTimeout(timeout);
      if (!res.ok) continue;

      const items = await res.json();
      if (Array.isArray(items) && items.length > 0) {
        return items.filter(it => it.videoId && it.lengthSeconds).map(it => ({
          id: it.videoId,
          title: it.title || 'Unknown Song',
          artist: it.author || 'Muzo Artist',
          duration: formatTime(it.lengthSeconds),
          thumbnail: `https://i.ytimg.com/vi/${it.videoId}/hqdefault.jpg`
        })).slice(0, 25);
      }
    } catch (e) {}
  }
  return null;
}

async function performSearch(query) {
  if (!query) return;

  showView('search');
  document.getElementById('search-title').innerText = `Results for "${query}"`;
  
  const cacheKey = query.toLowerCase().trim();
  const listEl = document.getElementById('search-results-list');
  const topCardEl = document.getElementById('top-result-card');

  // Check 0ms instant client cache
  if (clientSearchCache.has(cacheKey)) {
    renderSearchResults(clientSearchCache.get(cacheKey));
    return;
  }

  document.getElementById('search-count').innerText = 'Searching...';
  listEl.innerHTML = `
    <div class="flex items-center justify-center py-12 gap-3 text-spotify-subtext">
      <div class="w-6 h-6 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin"></div>
      <span>Searching songs and artists...</span>
    </div>
  `;
  topCardEl.innerHTML = '';

  let results = null;

  // 1. Try local or cloud backend /api/search
  try {
    const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
    if (res.ok) {
      results = await res.json();
    }
  } catch (err) {
    console.warn('Backend search unreachable, activating Universal Direct Client Fallback...');
  }

  // 2. Direct client-side fallback if server is offline or static hosting
  if (!results || results.length === 0) {
    try {
      results = await fetchDirectClientSearch(query);
    } catch (e) {}
  }

  if (results && results.length > 0) {
    clientSearchCache.set(cacheKey, results);
    renderSearchResults(results);
  } else {
    document.getElementById('search-count').innerText = '0 songs found';
    listEl.innerHTML = `<div class="text-spotify-subtext py-8 text-center">No matching songs found. Try another search!</div>`;
  }
}

function renderSearchResults(results) {
  document.getElementById('search-count').innerText = `${results.length} songs found`;
  const listEl = document.getElementById('search-results-list');
  const topCardEl = document.getElementById('top-result-card');

  const top = results[0];
  topCardEl.innerHTML = `
    <div class="flex flex-col gap-4" onclick='playTrack(${JSON.stringify(top).replace(/'/g, "&#39;")}, ${JSON.stringify(results).replace(/'/g, "&#39;")}, 0)'>
      <img src="${top.thumbnail}" class="w-32 h-32 rounded-xl object-cover shadow-2xl">
      <div>
        <span class="text-xs uppercase font-bold text-cyan-400 tracking-wider">Top Result</span>
        <h2 class="text-2xl font-black text-white mt-1 mb-1 line-clamp-1">${top.title}</h2>
        <p class="text-sm text-spotify-subtext">${top.artist} • <span class="font-mono">${top.duration}</span></p>
      </div>
      <div class="flex items-center gap-3">
        <button class="w-12 h-12 rounded-full bg-gradient-to-r from-teal-400 to-cyan-400 flex items-center justify-center text-black shadow-xl shadow-cyan-400/25 hover:scale-105">
          <i data-lucide="play" class="w-6 h-6 fill-black ml-0.5"></i>
        </button>
        <button onclick="event.stopPropagation(); openAddToPlaylistModal(${JSON.stringify(top).replace(/'/g, "&#39;")})" title="Add to Playlist" class="p-2.5 rounded-full bg-white/10 hover:bg-cyan-500 hover:text-black text-white transition">
          <i data-lucide="plus" class="w-5 h-5"></i>
        </button>
      </div>
    </div>
  `;

  listEl.innerHTML = results.map((track, idx) => `
    <div class="track-row flex items-center justify-between p-2.5 rounded-xl hover:bg-white/10 group cursor-pointer" onclick='playTrack(${JSON.stringify(track).replace(/'/g, "&#39;")}, ${JSON.stringify(results).replace(/'/g, "&#39;")}, ${idx})'>
      <div class="flex items-center gap-3 overflow-hidden flex-1">
        <div class="w-6 text-center text-xs text-spotify-subtext shrink-0">
          <span class="row-index font-mono">${idx + 1}</span>
          <button class="row-play-btn text-cyan-400"><i data-lucide="play" class="w-4 h-4 fill-cyan-400"></i></button>
        </div>
        <img src="${track.thumbnail}" class="w-11 h-11 rounded-lg object-cover bg-neutral-800 shrink-0 shadow">
        <div class="overflow-hidden pr-2">
          <div class="text-sm font-semibold text-white truncate">${track.title}</div>
          <div class="text-xs text-spotify-subtext truncate">${track.artist}</div>
        </div>
      </div>
      <div class="flex items-center gap-3 shrink-0">
        <button onclick="event.stopPropagation(); openAddToPlaylistModal(${JSON.stringify(track).replace(/'/g, "&#39;")})" title="Add to Playlist" class="text-spotify-subtext hover:text-cyan-400 p-2 rounded-full hover:bg-white/10 transition opacity-100 sm:opacity-0 sm:group-hover:opacity-100">
          <i data-lucide="plus-circle" class="w-4 h-4"></i>
        </button>
        <span class="text-xs text-spotify-subtext font-mono w-12 text-right">${track.duration}</span>
      </div>
    </div>
  `).join('');
  lucide.createIcons();
}

function searchAndPlayQuery(query) {
  searchInput.value = query;
  performSearch(query);
}

// =================================================================
// 9. Charts & Curated Playlists (Instant from Cache)
// =================================================================

// Built-in Curated Evergreen Chart Fallbacks (Instant offline / zero-server startup)
const DEFAULT_CHART_FALLBACKS = {
  trending: [
    { id: '4NRXx6U8ABQ', title: 'Blinding Lights', artist: 'The Weeknd', duration: '3:20', thumbnail: 'https://i.ytimg.com/vi/4NRXx6U8ABQ/hqdefault.jpg' },
    { id: 'TUVcZfQe-Kw', title: 'Levitating', artist: 'Dua Lipa', duration: '3:23', thumbnail: 'https://i.ytimg.com/vi/TUVcZfQe-Kw/hqdefault.jpg' },
    { id: 'JGwWNGJdvx8', title: 'Shape of You', artist: 'Ed Sheeran', duration: '3:53', thumbnail: 'https://i.ytimg.com/vi/JGwWNGJdvx8/hqdefault.jpg' },
    { id: 'ApXoWvfEYVU', title: 'Sunflower (Spider-Man)', artist: 'Post Malone, Swae Lee', duration: '2:38', thumbnail: 'https://i.ytimg.com/vi/ApXoWvfEYVU/hqdefault.jpg' },
    { id: 'kJQP7kiw5Fk', title: 'Despacito', artist: 'Luis Fonsi ft. Daddy Yankee', duration: '3:48', thumbnail: 'https://i.ytimg.com/vi/kJQP7kiw5Fk/hqdefault.jpg' },
    { id: '0VwhorTQig8', title: 'Starboy', artist: 'The Weeknd ft. Daft Punk', duration: '3:50', thumbnail: 'https://i.ytimg.com/vi/0VwhorTQig8/hqdefault.jpg' },
    { id: 'fJ9rUzIMcZQ', title: 'Bohemian Rhapsody', artist: 'Queen', duration: '5:55', thumbnail: 'https://i.ytimg.com/vi/fJ9rUzIMcZQ/hqdefault.jpg' },
    { id: 'hT_nvWreIhg', title: 'Counting Stars', artist: 'OneRepublic', duration: '4:17', thumbnail: 'https://i.ytimg.com/vi/hT_nvWreIhg/hqdefault.jpg' }
  ],
  anime: [
    { id: 'pmanD_s7G3U', title: 'Gurenge (Demon Slayer)', artist: 'LiSA', duration: '3:58', thumbnail: 'https://i.ytimg.com/vi/pmanD_s7G3U/hqdefault.jpg' },
    { id: '1FlicTWXsCA', title: 'Shinunoga E-Wa', artist: 'Fujii Kaze', duration: '3:05', thumbnail: 'https://i.ytimg.com/vi/1FlicTWXsCA/hqdefault.jpg' },
    { id: 'v2K1aZ5fR3w', title: 'Unravel (Tokyo Ghoul)', artist: 'TK from Ling Tosite Sigure', duration: '3:58', thumbnail: 'https://i.ytimg.com/vi/v2K1aZ5fR3w/hqdefault.jpg' },
    { id: 'O2ZlE9f9O-4', title: 'Blue Bird (Naruto Shippuden)', artist: 'Ikimonogakari', duration: '3:35', thumbnail: 'https://i.ytimg.com/vi/O2ZlE9f9O-4/hqdefault.jpg' }
  ],
  pop: [
    { id: 'TUVcZfQe-Kw', title: 'Levitating', artist: 'Dua Lipa', duration: '3:23', thumbnail: 'https://i.ytimg.com/vi/TUVcZfQe-Kw/hqdefault.jpg' },
    { id: '4NRXx6U8ABQ', title: 'Blinding Lights', artist: 'The Weeknd', duration: '3:20', thumbnail: 'https://i.ytimg.com/vi/4NRXx6U8ABQ/hqdefault.jpg' },
    { id: 'vRXZj0DzXIA', title: 'Cruel Summer', artist: 'Taylor Swift', duration: '2:58', thumbnail: 'https://i.ytimg.com/vi/vRXZj0DzXIA/hqdefault.jpg' },
    { id: 'H5v3kku4y6Q', title: 'As It Was', artist: 'Harry Styles', duration: '2:47', thumbnail: 'https://i.ytimg.com/vi/H5v3kku4y6Q/hqdefault.jpg' }
  ],
  hiphop: [
    { id: 'JFm7YDVlqnI', title: "God's Plan", artist: 'Drake', duration: '3:18', thumbnail: 'https://i.ytimg.com/vi/JFm7YDVlqnI/hqdefault.jpg' },
    { id: 'tvTRZJ-4EyI', title: 'HUMBLE.', artist: 'Kendrick Lamar', duration: '2:57', thumbnail: 'https://i.ytimg.com/vi/tvTRZJ-4EyI/hqdefault.jpg' },
    { id: 'ApXoWvfEYVU', title: 'Sunflower', artist: 'Post Malone, Swae Lee', duration: '2:38', thumbnail: 'https://i.ytimg.com/vi/ApXoWvfEYVU/hqdefault.jpg' }
  ],
  chill: [
    { id: 'jfKfPfyJRdk', title: 'Lofi Hip Hop Radio - Beats to Relax/Study to', artist: 'Lofi Girl', duration: '3:45', thumbnail: 'https://i.ytimg.com/vi/jfKfPfyJRdk/hqdefault.jpg' },
    { id: 'DWcJFNfaw9c', title: 'Weightless', artist: 'Marconi Union', duration: '8:08', thumbnail: 'https://i.ytimg.com/vi/DWcJFNfaw9c/hqdefault.jpg' }
  ],
  rock: [
    { id: 'fJ9rUzIMcZQ', title: 'Bohemian Rhapsody', artist: 'Queen', duration: '5:55', thumbnail: 'https://i.ytimg.com/vi/fJ9rUzIMcZQ/hqdefault.jpg' },
    { id: 'hTWKbfoikeg', title: 'Smells Like Teen Spirit', artist: 'Nirvana', duration: '5:01', thumbnail: 'https://i.ytimg.com/vi/hTWKbfoikeg/hqdefault.jpg' }
  ],
  bollywood: [
    { id: 'Umqb9KENgmk', title: 'Kesariya', artist: 'Arijit Singh, Pritam', duration: '4:28', thumbnail: 'https://i.ytimg.com/vi/Umqb9KENgmk/hqdefault.jpg' },
    { id: 'k4yXQkGLeAA', title: 'Raataan Lambiyan', artist: 'Jubin Nautiyal, Asees Kaur', duration: '3:50', thumbnail: 'https://i.ytimg.com/vi/k4yXQkGLeAA/hqdefault.jpg' }
  ]
};

async function loadChartCategory(category) {
  state.currentCategory = category;

  document.querySelectorAll('.genre-pill').forEach(pill => {
    pill.classList.remove('active', 'bg-cyan-400', 'text-black', 'shadow-md', 'shadow-cyan-400/20');
    pill.classList.add('bg-white/10', 'text-white');
  });
  if (event && event.target && event.target.classList.contains('genre-pill')) {
    event.target.classList.add('active', 'bg-cyan-400', 'text-black', 'shadow-md', 'shadow-cyan-400/20');
    event.target.classList.remove('bg-white/10', 'text-white');
  }

  showView('home');

  const headingMap = {
    'trending': '🔥 Global Top Trending',
    'anime': '🌸 Anime & Japanese OST',
    'pop': '✨ Top Pop Hits',
    'hiphop': '🎤 Best of Hip-Hop & Rap',
    'chill': '☕ Chill & Lofi Vibes',
    'rock': '⚡ Classic & Modern Rock',
    'bollywood': '💖 Bollywood & Indie Hits'
  };
  document.getElementById('charts-heading').innerText = headingMap[category] || '🔥 Top Music';

  // Check client cache
  if (clientChartsCache.has(category)) {
    renderChartGrid(clientChartsCache.get(category));
    return;
  }

  let tracks = null;
  try {
    const res = await fetch(`/api/charts?category=${category}`);
    if (res.ok) tracks = await res.json();
  } catch (err) {}

  if (!tracks || tracks.length === 0) {
    tracks = DEFAULT_CHART_FALLBACKS[category] || DEFAULT_CHART_FALLBACKS.trending;
  }

  if (tracks && tracks.length > 0) {
    clientChartsCache.set(category, tracks);
    renderChartGrid(tracks);
  }
}

function renderChartGrid(tracks) {
  const gridEl = document.getElementById('trending-grid');
  gridEl.innerHTML = tracks.map((track, idx) => `
    <div class="music-card bg-spotify-card p-3.5 rounded-2xl cursor-pointer group relative border border-white/5" onclick='playTrack(${JSON.stringify(track).replace(/'/g, "&#39;")}, ${JSON.stringify(tracks).replace(/'/g, "&#39;")}, ${idx})'>
      <div class="relative w-full aspect-square rounded-xl overflow-hidden mb-3 shadow-lg bg-neutral-800">
        <img src="${track.thumbnail}" class="w-full h-full object-cover group-hover:scale-105 transition duration-300">
        <button class="play-btn absolute bottom-3 right-3 w-10 h-10 rounded-full bg-gradient-to-r from-teal-400 to-cyan-400 flex items-center justify-center text-black shadow-xl shadow-cyan-400/30 hover:scale-110 active:scale-95 transition">
          <i data-lucide="play" class="w-5 h-5 fill-black ml-0.5"></i>
        </button>
        <button onclick="event.stopPropagation(); openAddToPlaylistModal(${JSON.stringify(track).replace(/'/g, "&#39;")})" title="Add to Playlist" class="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/70 hover:bg-cyan-500 hover:text-black text-white flex items-center justify-center opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition shadow">
          <i data-lucide="plus" class="w-4 h-4"></i>
        </button>
      </div>
      <div class="font-bold text-white text-sm truncate mb-0.5">${track.title}</div>
      <div class="text-xs text-spotify-subtext truncate">${track.artist}</div>
    </div>
  `).join('');

  const quickPicks = tracks.slice(0, 6);
  document.getElementById('quick-picks-grid').innerHTML = quickPicks.map((track, idx) => `
    <div class="flex items-center bg-white/5 hover:bg-white/10 rounded-xl overflow-hidden cursor-pointer group transition p-1.5 pr-3 hover:border-l-2 hover:border-cyan-400" onclick='playTrack(${JSON.stringify(track).replace(/'/g, "&#39;")}, ${JSON.stringify(tracks).replace(/'/g, "&#39;")}, ${idx})'>
      <img src="${track.thumbnail}" class="w-12 h-12 rounded-lg object-cover shrink-0">
      <div class="flex-1 px-3 overflow-hidden min-w-0">
        <div class="font-bold text-sm text-white truncate">${track.title}</div>
        <div class="text-xs text-spotify-subtext truncate">${track.artist}</div>
      </div>
      <div class="flex items-center gap-1 shrink-0">
        <button onclick="event.stopPropagation(); openAddToPlaylistModal(${JSON.stringify(track).replace(/'/g, "&#39;")})" title="Add to Playlist" class="w-7 h-7 rounded-full hover:bg-white/10 text-spotify-subtext hover:text-cyan-400 flex items-center justify-center transition">
          <i data-lucide="plus" class="w-3.5 h-3.5"></i>
        </button>
        <button class="w-8 h-8 rounded-full bg-gradient-to-r from-teal-400 to-cyan-400 text-black flex items-center justify-center opacity-100 sm:opacity-0 sm:group-hover:opacity-100 shadow-md transition hover:scale-105">
          <i data-lucide="play" class="w-4 h-4 fill-black ml-0.5"></i>
        </button>
      </div>
    </div>
  `).join('');
  lucide.createIcons();
}

// =================================================================
// 10. Playlists & Liked Songs
// =================================================================
let activePlaylistId = null;

function renderSidebarPlaylists() {
  const container = document.getElementById('sidebar-playlists');
  document.getElementById('liked-count').innerText = `${state.likedSongs.length} songs`;

  if (state.playlists.length === 0) {
    container.innerHTML = `<div class="text-xs text-spotify-subtext px-2 py-3">No custom playlists yet. Click '+' to create!</div>`;
    return;
  }

  container.innerHTML = state.playlists.map(pl => `
    <div onclick="showPlaylistDetail('${pl.id}')" class="px-2 py-2 rounded-lg cursor-pointer hover:bg-white/10 transition text-spotify-subtext hover:text-cyan-300 truncate flex items-center justify-between group">
      <span class="truncate">${pl.name}</span>
      <span class="text-[11px] text-spotify-subtext/60 group-hover:text-cyan-400">${pl.tracks.length}</span>
    </div>
  `).join('');
}

function showLikedSongs() {
  activePlaylistId = 'liked';
  showView('playlist');
  document.getElementById('playlist-title').innerText = 'Liked Songs';
  document.getElementById('playlist-desc').innerText = `${state.likedSongs.length} favorite songs saved to your library`;
  document.getElementById('playlist-delete-btn').classList.add('hidden');
  document.getElementById('playlist-artwork').innerHTML = `
    <div class="w-full h-full bg-gradient-to-br from-teal-500 via-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/20">
      <i data-lucide="heart" class="w-16 h-16 text-black fill-black"></i>
    </div>
  `;
  renderPlaylistTable(state.likedSongs);
  lucide.createIcons();
}

function showPlaylistDetail(id) {
  activePlaylistId = id;
  const pl = state.playlists.find(p => p.id === id);
  if (!pl) return;

  showView('playlist');
  document.getElementById('playlist-title').innerText = pl.name;
  document.getElementById('playlist-desc').innerText = `${pl.tracks.length} songs • Custom Playlist`;
  document.getElementById('playlist-delete-btn').classList.remove('hidden');

  const firstThumb = pl.tracks.length > 0 ? pl.tracks[0].thumbnail : null;
  if (firstThumb) {
    document.getElementById('playlist-artwork').innerHTML = `<img src="${firstThumb}" class="w-full h-full object-cover">`;
  } else {
    document.getElementById('playlist-artwork').innerHTML = `<i data-lucide="music" class="w-16 h-16 text-cyan-400"></i>`;
  }

  renderPlaylistTable(pl.tracks);
  lucide.createIcons();
}

function renderPlaylistTable(tracks) {
  const tbody = document.getElementById('playlist-tracks-body');
  if (!tracks || tracks.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5" class="py-12 text-center text-spotify-subtext">This playlist is currently empty. Add songs by clicking '+' on any track!</td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = tracks.map((track, idx) => `
    <tr class="track-row cursor-pointer" onclick='playTrack(${JSON.stringify(track).replace(/'/g, "&#39;")}, ${JSON.stringify(tracks).replace(/'/g, "&#39;")}, ${idx})'>
      <td class="py-3 px-4 font-mono text-xs">
        <span class="row-index">${idx + 1}</span>
        <button class="row-play-btn text-cyan-400"><i data-lucide="play" class="w-4 h-4 fill-cyan-400"></i></button>
      </td>
      <td class="py-3 px-4 flex items-center gap-3 overflow-hidden">
        <img src="${track.thumbnail}" class="w-10 h-10 rounded-md object-cover bg-neutral-800 shrink-0">
        <div class="overflow-hidden">
          <div class="font-semibold text-white truncate text-sm">${track.title}</div>
          <div class="text-xs text-spotify-subtext md:hidden truncate">${track.artist}</div>
        </div>
      </td>
      <td class="py-3 px-4 hidden md:table-cell text-spotify-subtext truncate max-w-[180px]">${track.artist}</td>
      <td class="py-3 px-4 font-mono text-xs text-right">${track.duration}</td>
      <td class="py-3 px-4 text-right">
        <button onclick="event.stopPropagation(); removeTrackFromCurrentPlaylist(${idx})" title="Remove" class="text-spotify-subtext hover:text-red-400 p-1 transition opacity-100 sm:opacity-0 sm:group-hover:opacity-100">
          <i data-lucide="trash-2" class="w-4 h-4"></i>
        </button>
      </td>
    </tr>
  `).join('');
  lucide.createIcons();
}

function playCurrentPlaylist() {
  const tracks = activePlaylistId === 'liked' ? state.likedSongs : (state.playlists.find(p => p.id === activePlaylistId)?.tracks || []);
  if (tracks.length > 0) {
    playTrack(tracks[0], tracks, 0);
  } else {
    showToast('Playlist is empty', 'alert-circle');
  }
}

function shuffleCurrentPlaylist() {
  const tracks = activePlaylistId === 'liked' ? state.likedSongs : (state.playlists.find(p => p.id === activePlaylistId)?.tracks || []);
  if (tracks.length > 0) {
    state.isShuffle = true;
    document.getElementById('btn-shuffle').classList.add('text-cyan-400');
    const randomIdx = Math.floor(Math.random() * tracks.length);
    playTrack(tracks[randomIdx], tracks, randomIdx);
  }
}

function deleteCurrentPlaylist() {
  if (activePlaylistId && activePlaylistId !== 'liked') {
    state.playlists = state.playlists.filter(p => p.id !== activePlaylistId);
    savePlaylists();
    renderSidebarPlaylists();
    showView('home');
    showToast('Playlist deleted', 'trash-2');
  }
}

function removeTrackFromCurrentPlaylist(index) {
  if (activePlaylistId === 'liked') {
    state.likedSongs.splice(index, 1);
    saveLikedSongs();
    showLikedSongs();
  } else {
    const pl = state.playlists.find(p => p.id === activePlaylistId);
    if (pl) {
      pl.tracks.splice(index, 1);
      savePlaylists();
      showPlaylistDetail(activePlaylistId);
    }
  }
  renderSidebarPlaylists();
}

function toggleLikeCurrentSong() {
  if (!state.currentTrack) return;

  const idx = state.likedSongs.findIndex(t => t.id === state.currentTrack.id);
  if (idx !== -1) {
    state.likedSongs.splice(idx, 1);
    showToast('Removed from Liked Songs', 'heart-off');
  } else {
    state.likedSongs.unshift(state.currentTrack);
    showToast('Added to Liked Songs', 'heart');
  }

  saveLikedSongs();
  updateLikeButtonUI();
  renderSidebarPlaylists();
}

function updateLikeButtonUI() {
  const desktopBtn = document.getElementById('player-like-btn');
  const mobBtn = document.getElementById('mob-player-like-btn');
  const mobFullBtn = document.getElementById('mob-full-like-btn');
  if (!state.currentTrack) return;

  const isLiked = state.likedSongs.some(t => t.id === state.currentTrack.id);
  const activeIcon = `<i data-lucide="heart" class="w-5 h-5 text-cyan-400 fill-cyan-400"></i>`;
  const inactiveIcon = `<i data-lucide="heart" class="w-5 h-5 text-spotify-subtext"></i>`;
  const activeFullIcon = `<i data-lucide="heart" class="w-6 h-6 text-cyan-400 fill-cyan-400"></i>`;
  const inactiveFullIcon = `<i data-lucide="heart" class="w-6 h-6 text-spotify-subtext"></i>`;

  if (desktopBtn) desktopBtn.innerHTML = isLiked ? activeIcon : inactiveIcon;
  if (mobBtn) mobBtn.innerHTML = isLiked ? activeIcon : inactiveIcon;
  if (mobFullBtn) mobFullBtn.innerHTML = isLiked ? activeFullIcon : inactiveFullIcon;
  lucide.createIcons();
}

function saveLikedSongs() {
  localStorage.setItem('muzo_liked', JSON.stringify(state.likedSongs));
}

function savePlaylists() {
  localStorage.setItem('muzo_playlists', JSON.stringify(state.playlists));
}

// =================================================================
// 11. Add to Playlist
// =================================================================
function openAddToPlaylistModalForCurrent() {
  if (!state.currentTrack) {
    showToast('Please play a song first!', 'info');
    return;
  }
  openAddToPlaylistModal(state.currentTrack);
}

function openAddToPlaylistModal(track) {
  state.pendingSongForPlaylist = track;
  const modalList = document.getElementById('modal-playlist-list');
  document.getElementById('modal-song-name').innerText = `Adding: "${track.title}"`;

  const isLiked = state.likedSongs.some(t => t.id === track.id);

  let html = `
    <div onclick="togglePendingInLiked()" class="p-3 bg-white/5 hover:bg-white/10 rounded-xl cursor-pointer flex items-center justify-between transition group">
      <div class="flex items-center gap-3">
        <div class="w-8 h-8 rounded bg-gradient-to-tr from-teal-500 via-cyan-500 to-blue-600 flex items-center justify-center">
          <i data-lucide="heart" class="w-4 h-4 text-black fill-black"></i>
        </div>
        <span class="font-semibold text-white text-sm">Liked Songs</span>
      </div>
      <div class="flex items-center gap-2">
        <span class="text-xs text-spotify-subtext">${state.likedSongs.length} songs</span>
        <span class="${isLiked ? 'text-cyan-400 font-bold' : 'text-spotify-subtext'} text-xs">
          ${isLiked ? '✓ Saved' : '+ Add'}
        </span>
      </div>
    </div>
  `;

  if (state.playlists.length > 0) {
    html += state.playlists.map(pl => {
      const inPlaylist = pl.tracks.some(t => t.id === track.id);
      return `
        <div onclick="togglePendingInPlaylist('${pl.id}')" class="p-3 bg-white/5 hover:bg-white/10 rounded-xl cursor-pointer flex items-center justify-between transition group">
          <div class="flex items-center gap-2.5 overflow-hidden">
            <div class="w-7 h-7 rounded bg-white/10 flex items-center justify-center text-cyan-400">
              <i data-lucide="list-music" class="w-4 h-4"></i>
            </div>
            <span class="font-semibold text-white truncate text-sm">${pl.name}</span>
          </div>
          <div class="flex items-center gap-2 shrink-0">
            <span class="text-xs text-spotify-subtext">${pl.tracks.length} songs</span>
            <span class="${inPlaylist ? 'text-cyan-400 font-bold' : 'text-spotify-subtext'} text-xs">
              ${inPlaylist ? '✓ In Playlist' : '+ Add'}
            </span>
          </div>
        </div>
      `;
    }).join('');
  } else {
    html += `
      <div class="text-center py-4 text-xs text-spotify-subtext">
        No custom playlists yet. Create one above!
      </div>
    `;
  }

  modalList.innerHTML = html;
  document.getElementById('add-to-playlist-modal').classList.remove('hidden');
  lucide.createIcons();
}

function closeAddToPlaylistModal() {
  document.getElementById('add-to-playlist-modal').classList.add('hidden');
  state.pendingSongForPlaylist = null;
}

function togglePendingInLiked() {
  if (state.pendingSongForPlaylist) {
    const idx = state.likedSongs.findIndex(t => t.id === state.pendingSongForPlaylist.id);
    if (idx !== -1) {
      state.likedSongs.splice(idx, 1);
      showToast('Removed from Liked Songs', 'heart-off');
    } else {
      state.likedSongs.unshift(state.pendingSongForPlaylist);
      showToast('Added to Liked Songs', 'heart');
    }
    saveLikedSongs();
    updateLikeButtonUI();
    renderSidebarPlaylists();
    openAddToPlaylistModal(state.pendingSongForPlaylist);
  }
}

function togglePendingInPlaylist(playlistId) {
  const pl = state.playlists.find(p => p.id === playlistId);
  if (pl && state.pendingSongForPlaylist) {
    const idx = pl.tracks.findIndex(t => t.id === state.pendingSongForPlaylist.id);
    if (idx !== -1) {
      pl.tracks.splice(idx, 1);
      showToast(`Removed from "${pl.name}"`, 'info');
    } else {
      pl.tracks.push(state.pendingSongForPlaylist);
      showToast(`Added to "${pl.name}"!`, 'check');
    }
    savePlaylists();
    renderSidebarPlaylists();
    openAddToPlaylistModal(state.pendingSongForPlaylist);
  }
}

function createAndAddPlaylistFromModal() {
  const input = document.getElementById('modal-new-playlist-input');
  const name = input.value.trim();
  if (!name) return;

  const newPl = {
    id: 'pl_' + Date.now(),
    name: name,
    tracks: state.pendingSongForPlaylist ? [state.pendingSongForPlaylist] : []
  };

  state.playlists.push(newPl);
  savePlaylists();
  renderSidebarPlaylists();
  input.value = '';

  if (state.pendingSongForPlaylist) {
    showToast(`Created "${name}" & added song!`, 'check');
    openAddToPlaylistModal(state.pendingSongForPlaylist);
  } else {
    showToast(`Playlist "${name}" created!`, 'check');
  }
}

function openCreatePlaylistModal() {
  document.getElementById('create-playlist-modal').classList.remove('hidden');
  const input = document.getElementById('new-playlist-input');
  input.value = '';
  input.focus();
}

function closeCreatePlaylistModal() {
  document.getElementById('create-playlist-modal').classList.add('hidden');
}

function saveNewPlaylist() {
  const name = document.getElementById('new-playlist-input').value.trim();
  if (!name) return;

  const newPl = {
    id: 'pl_' + Date.now(),
    name: name,
    tracks: []
  };

  state.playlists.push(newPl);
  savePlaylists();
  renderSidebarPlaylists();
  closeCreatePlaylistModal();
  showPlaylistDetail(newPl.id);
  showToast(`Playlist "${name}" created!`, 'check');
}

// =================================================================
// 12. View Management & Instant Mini Video
// =================================================================
function showView(viewName) {
  state.activeView = viewName;

  document.querySelectorAll('.view-panel').forEach(el => el.classList.add('hidden'));
  document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));

  if (viewName === 'home') {
    document.getElementById('view-home').classList.remove('hidden');
    document.getElementById('nav-home').classList.add('active');
  } else if (viewName === 'search') {
    document.getElementById('view-search').classList.remove('hidden');
    document.getElementById('nav-search').classList.add('active');
  } else if (viewName === 'library') {
    showLikedSongs();
    document.getElementById('nav-library').classList.add('active');
  } else if (viewName === 'playlist') {
    document.getElementById('view-playlist').classList.remove('hidden');
    document.getElementById('nav-library').classList.add('active');
  } else if (viewName === 'lyrics') {
    document.getElementById('view-lyrics').classList.remove('hidden');
  }

  // Update mobile navigation items
  document.querySelectorAll('.mobile-nav-btn').forEach(btn => {
    btn.classList.remove('text-cyan-400', 'active');
    btn.classList.add('text-spotify-subtext');
  });
  if (viewName === 'home') {
    const mob = document.getElementById('mob-nav-home');
    if (mob) { mob.classList.add('text-cyan-400', 'active'); mob.classList.remove('text-spotify-subtext'); }
  } else if (viewName === 'search') {
    const mob = document.getElementById('mob-nav-search');
    if (mob) { mob.classList.add('text-cyan-400', 'active'); mob.classList.remove('text-spotify-subtext'); }
  } else if (viewName === 'library' || viewName === 'playlist') {
    const mob = document.getElementById('mob-nav-library');
    if (mob) { mob.classList.add('text-cyan-400', 'active'); mob.classList.remove('text-spotify-subtext'); }
  }

  document.getElementById('main-scroll').scrollTop = 0;
}

function toggleMiniVideo() {
  state.isVideoOpen = !state.isVideoOpen;
  const container = document.getElementById('mini-video-container');
  const btn = document.getElementById('btn-toggle-video');
  if (state.isVideoOpen) {
    container.classList.remove('video-docked');
    container.classList.add('video-open');
    if (btn) btn.classList.add('text-cyan-400');
    showToast('Video Mode ON', 'tv');
  } else {
    container.classList.add('video-docked');
    container.classList.remove('video-open');
    if (btn) btn.classList.remove('text-cyan-400');
    showToast('Audio-only Mode', 'volume-2');
  }
}

// =================================================================
// 13. MediaSession API
// =================================================================
function updateMediaSession() {
  if ('mediaSession' in navigator && state.currentTrack) {
    navigator.mediaSession.metadata = new MediaMetadata({
      title: state.currentTrack.title,
      artist: state.currentTrack.artist,
      album: 'Muzo Free Music',
      artwork: [
        { src: state.currentTrack.thumbnail, sizes: '512x512', type: 'image/jpeg' }
      ]
    });

    navigator.mediaSession.setActionHandler('play', () => togglePlayPause());
    navigator.mediaSession.setActionHandler('pause', () => togglePlayPause());
    navigator.mediaSession.setActionHandler('previoustrack', () => playPrevTrack());
    navigator.mediaSession.setActionHandler('nexttrack', () => playNextTrack());
    navigator.mediaSession.setActionHandler('seekto', (details) => {
      if (details.seekTime !== undefined && ytPlayer && ytPlayer.seekTo) {
        ytPlayer.seekTo(details.seekTime, true);
      }
    });
  }
}

// =================================================================
// 14. Toast Helper
// =================================================================
let toastTimeout = null;
function showToast(msg, icon = 'check-circle') {
  const toast = document.getElementById('toast');
  const toastMsg = document.getElementById('toast-msg');
  const toastIcon = document.getElementById('toast-icon');

  toastMsg.innerText = msg;
  toastIcon.setAttribute('data-lucide', icon);
  lucide.createIcons();

  toast.classList.remove('translate-y-[-100px]', 'opacity-0');
  toast.classList.add('translate-y-0', 'opacity-100');

  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => {
    toast.classList.add('translate-y-[-100px]', 'opacity-0');
    toast.classList.remove('translate-y-0', 'opacity-100');
  }, 2800);
}

function escapeQuotes(str) {
  return str.replace(/'/g, "\\'").replace(/"/g, '&quot;');
}

// =================================================================
// 15. Initialization
// =================================================================
document.addEventListener('DOMContentLoaded', () => {
  const hour = new Date().getHours();
  let greeting = 'Good Evening';
  if (hour >= 5 && hour < 12) greeting = 'Good Morning';
  else if (hour >= 12 && hour < 18) greeting = 'Good Afternoon';
  document.getElementById('greeting-text').innerText = greeting;

  lucide.createIcons();
  renderSidebarPlaylists();
  loadChartCategory('trending');
  setTimeout(() => fetchAndRenderRecommendations(), 1500);

  // Pre-load popular genres into clientSearchCache for 0ms instant searches
  const popularCats = ['trending', 'anime', 'pop', 'hiphop', 'chill', 'rock', 'bollywood'];
  popularCats.forEach(cat => {
    fetch(`/api/charts?category=${cat}`)
      .then(res => res.json())
      .then(data => {
        if (data && data.length) {
          clientSearchCache.set(cat, data);
        }
      })
      .catch(() => {});
  });

  // Fetch local LAN network info for mobile connecting
  fetchNetworkInfo();
});

// =================================================================
// 16. Mobile PWA & Multi-Device Connection
// =================================================================
let mobileNetworkInfo = null;

async function fetchNetworkInfo() {
  try {
    const res = await fetch('/api/network-info');
    mobileNetworkInfo = await res.json();
  } catch (e) {
    mobileNetworkInfo = {
      lanIp: window.location.hostname,
      port: window.location.port || 5050,
      mobileUrl: `${window.location.protocol}//${window.location.hostname}:${window.location.port || 5050}`
    };
  }
}

function openMobileConnectModal() {
  const modal = document.getElementById('mobile-connect-modal');
  const input = document.getElementById('mobile-url-input');
  const qrImg = document.getElementById('mobile-qr-code');

  const mobileUrl = mobileNetworkInfo && mobileNetworkInfo.mobileUrl 
    ? mobileNetworkInfo.mobileUrl 
    : `${window.location.protocol}//${window.location.hostname}:${window.location.port || 5050}`;

  input.value = mobileUrl;
  qrImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(mobileUrl)}`;

  modal.classList.remove('hidden');
  lucide.createIcons();
}

function closeMobileConnectModal() {
  document.getElementById('mobile-connect-modal').classList.add('hidden');
}

function copyMobileUrl() {
  const input = document.getElementById('mobile-url-input');
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(input.value).then(() => {
      showToast('Mobile link copied!', 'check-circle');
    }).catch(() => {
      input.select();
      document.execCommand('copy');
      showToast('Mobile link copied!', 'check-circle');
    });
  } else {
    input.select();
    document.execCommand('copy');
    showToast('Mobile link copied!', 'check-circle');
  }
}

// Register PWA Service Worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then(() => {
      console.log('Muzo PWA Service Worker Registered!');
    }).catch(() => {});
  });
}

// PWA Install prompt handler
let deferredPrompt = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  console.log('Muzo is ready to be installed as an App!');
});
