var image_save_msg='You Can Not Save images!';
var no_menu_msg='Context Menu disabled!';
var smessage = "Content is protected !!";

function disableEnterKey(e) {
  if (e.ctrlKey){
    var key = window.event ? window.event.keyCode : e.which;
    if ([97, 65, 67, 99, 88, 120, 26, 85, 86, 83, 43].includes(key)) {
      alert('You are not allowed to copy content or view source');
      return false;
    }
  }
}

function disable_copy(e) {
  var elemtype = e.target.nodeName.toUpperCase();
  var isSafari = /Safari/.test(navigator.userAgent) && /Apple Computer/.test(navigator.vendor);
  if (!["TEXT", "TEXTAREA", "INPUT", "PASSWORD", "SELECT", "OPTION", "EMBED"].includes(elemtype)) {
    if (smessage !== "" && e.detail === 2) alert(smessage);
    return isSafari ? true : false;
  }
}

function disable_copy_ie() {
  var elemtype = window.event.srcElement.nodeName.toUpperCase();
  if (!["TEXT", "TEXTAREA", "INPUT", "PASSWORD", "SELECT", "OPTION", "EMBED"].includes(elemtype)) {
    return false;
  }
}

function reEnable() { return true; }

document.onkeydown = disableEnterKey;
document.onselectstart = disable_copy_ie;
if(navigator.userAgent.indexOf('MSIE') === -1){
  document.onmousedown = disable_copy;
  document.onclick = reEnable;
}

function disableSelection(target) {
  if (typeof target.onselectstart != "undefined") target.onselectstart = disable_copy_ie;
  else if (typeof target.style.MozUserSelect != "undefined") target.style.MozUserSelect = "none";
  else target.onmousedown = function() { return false; }
  target.style.cursor = "default";
}

window.onload = function() {
  disableSelection(document.body);
};

document.ondragstart = function() { return false; }

document.oncontextmenu = function(e) { 
  const container = document.getElementById('video-container');
  if (container && container.style.display === 'flex') {
    e.preventDefault();
    handlePlayerBackAction();
    return false;
  }
  return false; 
}

let player, hls;
let allChannelsGlobal = []; 
let moviesList = [];
let seriesList = [];
let homeList = [];

async function lockScreenOrientation() {
  try {
    if (screen.orientation && screen.orientation.lock) {
      await screen.orientation.lock('landscape');
    }
  } catch (err) {
    console.warn('Orientation lock failed:', err);
  }
}

async function requestFullscreenAndLockOrientation(element) {
  try {
    if (element.requestFullscreen) {
      await element.requestFullscreen();
    } else if (element.webkitRequestFullscreen) { 
      await element.webkitRequestFullscreen();
    }
    await lockScreenOrientation();
  } catch (err) {
    console.warn('Fullscreen or lock failed:', err);
  }
}

document.addEventListener('fullscreenchange', () => {
  if (document.fullscreenElement) lockScreenOrientation();
});
document.addEventListener('webkitfullscreenchange', () => {
  if (document.webkitFullscreenElement) lockScreenOrientation();
});

function parseM3U(content) {
  const lines = content.split('\n');
  const playlist = [];
  let current = {};

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line === '') continue;

    if (line.indexOf('#EXTINF') === 0) {
      const logoMatch = line.match(/tvg-logo="([^"]+)"/);
      const groupMatch = line.match(/group-title="([^"]+)"/);
      const commaPos = line.lastIndexOf(',');
      const name = (commaPos !== -1) ? line.substring(commaPos + 1).trim() : 'Unknown Item';

      const group = groupMatch ? groupMatch[1].trim() : 'Movies';
      const isSeries = group.toLowerCase().includes('series') || group.toLowerCase().includes('tv') || group.toLowerCase().includes('show') || name.toLowerCase().includes('series');

      current = {
        name: name,
        logo: logoMatch ? logoMatch[1] : 'https://i.postimg.cc/0NcB0R4p/SMPTE.png',
        group: group,
        isSeries: isSeries
      };
    } else if (line.indexOf('#KODIPROP') === 0 && line.includes('license_key=')) {
      const keyInfo = line.match(/license_key=(.*?):(.*)/);
      if (keyInfo) {
        current.drm = 'clearkey';
        current.keyId = keyInfo[1].trim();
        current.key = keyInfo[2].trim();
      }
    } else if (line.indexOf('#') !== 0) {
      current.url = line;
      playlist.push(current);
      current = {}; 
    }
  }
  return playlist;
}

function processPlaylistData(items) {
  moviesList = [];
  homeList = [];
  const seriesMap = {};

  items.forEach(item => {
    const groupStr = item.group.toLowerCase();
    const nameStr = item.name.toLowerCase();

    const isStrictMovie = groupStr.includes('movies') || nameStr.includes('movies');
    const isStrictSeries = groupStr.includes('tv series') || groupStr.includes('series') || nameStr.includes('tv series') || nameStr.includes('series');

    if (isStrictSeries) {
      let baseName = item.name
        .replace(/s\d+e\d+.*/i, '')
        .replace(/ep?\s*\d+.*/i, '')
        .replace(/episode\s*\d+.*/i, '')
        .trim();

      if (!baseName) baseName = item.name;

      if (!seriesMap[baseName]) {
        seriesMap[baseName] = {
          name: baseName,
          logo: item.logo,
          group: item.group,
          isSeries: true,
          episodes: []
        };
      }

      seriesMap[baseName].episodes.push({
        title: item.name,
        url: item.url,
        logo: item.logo,
        drm: item.drm,
        keyId: item.keyId,
        key: item.key
      });

    } else if (isStrictMovie) {
      moviesList.push(item);
    } else {
      homeList.push(item);
    }
  });

  seriesList = Object.values(seriesMap);
}

function createCard(channel, isSeries = false) {
  const li = document.createElement('div');
  li.className = 'channel-item';

  li.innerHTML = `
    <div class="poster-box">
      <img src="${channel.logo || 'https://i.postimg.cc/0NcB0R4p/SMPTE.png'}" alt="${channel.name}" onerror="this.src='https://i.postimg.cc/0NcB0R4p/SMPTE.png'">
    </div>
    <div class="channel-info">
      <div class="channel-title" title="${channel.name}">${channel.name}</div>
    </div>
  `;

  li.addEventListener('click', () => {
    if (isSeries) {
      if (!channel.episodes) {
        channel.episodes = [{ title: channel.name, url: channel.url, logo: channel.logo, drm: channel.drm, keyId: channel.keyId, key: channel.key }];
      }
      showSeriesDetail(channel);
    } else {
      const targetUrl = channel.url || (channel.episodes && channel.episodes[0] ? channel.episodes[0].url : '');
      const targetDrm = channel.drm ? { keyId: channel.keyId, key: channel.key } : (channel.episodes && channel.episodes[0] && channel.episodes[0].drm ? { keyId: channel.episodes[0].keyId, key: channel.episodes[0].key } : null);
      const targetName = channel.name;
      
      initShaka(targetUrl, targetDrm, targetName);
    }
  });

  return li;
}

function renderHomeSections() {
  const spinner = document.getElementById('loading-spinner');
  const sectionsContainer = document.getElementById('sections-container');
  
  if (spinner) spinner.classList.add('hidden');
  if (sectionsContainer) sectionsContainer.classList.remove('hidden');

  const livetvRow = document.getElementById('livetv-row');
  const moviesRow = document.getElementById('movies-row');
  const seriesRow = document.getElementById('series-row');

  if (livetvRow) {
    livetvRow.innerHTML = '';
    if (homeList.length === 0) {
      livetvRow.innerHTML = '<div class="loading-text col-span-full text-gray-400">No program details available for this.</div>';
    } else {
      homeList.forEach(item => { livetvRow.appendChild(createCard(item, false)); });
    }
  }

  if (moviesRow) {
    moviesRow.innerHTML = '';
    if (moviesList.length === 0) {
      moviesRow.innerHTML = '<div class="loading-text col-span-full text-gray-400">No program details available for this.</div>';
    } else {
      moviesList.forEach(item => { moviesRow.appendChild(createCard(item, false)); });
    }
  }

  if (seriesRow) {
    seriesRow.innerHTML = '';
    if (seriesList.length === 0) {
      seriesRow.innerHTML = '<div class="loading-text col-span-full text-gray-400">No program details available for this.</div>';
    } else {
      seriesList.forEach(item => { seriesRow.appendChild(createCard(item, true)); });
    }
  }
}

function showCategoryAll(type) {
  document.getElementById('sections-container').classList.add('hidden');
  document.getElementById('search-results-container').classList.add('hidden');
  document.getElementById('detail-view').style.display = 'none';
  
  const allContainer = document.getElementById('category-all-container');
  const grid = document.getElementById('category-all-grid');
  const titleEl = document.getElementById('category-all-title');
  
  grid.innerHTML = '';
  allContainer.classList.remove('hidden');

  let targetList = [];
  if (type === 'livetv') {
    titleEl.textContent = 'Live TV';
    targetList = homeList;
  } else if (type === 'movies') {
    titleEl.textContent = 'Movies';
    targetList = moviesList;
  } else if (type === 'series') {
    titleEl.textContent = 'Series';
    targetList = seriesList;
  }

  if (targetList.length === 0) {
    grid.innerHTML = '<div class="loading-text col-span-full text-gray-400">No program details available for this.</div>';
  } else {
    targetList.forEach(item => {
      grid.appendChild(createCard(item, type === 'series'));
    });
  }

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function showSeriesDetail(series) {
  window.history.pushState({ view: 'detail', seriesName: series.name }, '');
  document.getElementById('main-content').style.display = 'none';
  document.getElementById('detail-view').style.display = 'block';

  document.getElementById('detail-poster').src = series.logo;
  document.getElementById('detail-title').textContent = series.name;

  const eps = series.episodes || [{ title: series.name, url: series.url, logo: series.logo }];
  const episodesList = document.getElementById('episodes-list');
  episodesList.innerHTML = '';

  eps.forEach((ep) => {
    const epDiv = document.createElement('div');
    epDiv.className = 'border-b border-gray-700 last:border-b-0';
    const drmParam = ep.drm ? `, {keyId: '${ep.keyId}', key: '${ep.key}'}` : ', null';
    
    epDiv.innerHTML = `
      <div class="p-4">
        <button onclick="initShaka('${ep.url}' ${drmParam}, '${ep.title}')" class="w-full flex items-center space-x-4 hover:bg-gray-700 transition-colors duration-200 rounded-lg p-2 -m-2 cursor-pointer text-left">
          <div class="flex-shrink-0">
            <div class="relative w-32 h-20 rounded-lg overflow-hidden bg-gray-900">
              <img alt="${ep.title}" class="object-cover w-full h-full" src="${ep.logo}" onerror="this.src='https://admin.homietv.com/assets/images/default-episode-thumbnail-2.png'">
            </div>
          </div>
          <div class="flex-1">
            <h5 class="text-white font-medium text-lg">${ep.title}</h5>
          </div>
        </button>
      </div>
    `;
    episodesList.appendChild(epDiv);
  });

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function goBackToCategoryAll() {
  document.getElementById('detail-view').style.display = 'none';
  document.getElementById('main-content').style.display = 'block';
  document.getElementById('category-all-container').classList.remove('hidden');
  document.getElementById('sections-container').classList.add('hidden');
  document.getElementById('search-results-container').classList.add('hidden');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function showMainHome() {
  document.getElementById('detail-view').style.display = 'none';
  document.getElementById('category-all-container').classList.add('hidden');
  document.getElementById('main-content').style.display = 'block';
  document.getElementById('sections-container').classList.remove('hidden');
  document.getElementById('search-results-container').classList.add('hidden');
  
  const searchInput = document.getElementById('searchInput');
  if (searchInput) searchInput.value = '';
}

const searchInputEl = document.getElementById('searchInput');
if (searchInputEl) {
  searchInputEl.addEventListener('input', (e) => {
    const query = e.target.value.toLowerCase().trim();

    if (!query) {
      showMainHome();
      return;
    }

    document.getElementById('detail-view').style.display = 'none';
    document.getElementById('category-all-container').classList.add('hidden');
    document.getElementById('main-content').style.display = 'block';
    document.getElementById('sections-container').classList.add('hidden');
    document.getElementById('search-results-container').classList.remove('hidden');

    const searchGrid = document.getElementById('search-grid');
    searchGrid.innerHTML = '';

    const allItems = [...homeList, ...moviesList, ...seriesList];
    const filtered = allItems.filter(item => item.name.toLowerCase().includes(query));

    if (filtered.length === 0) {
      searchGrid.innerHTML = '<div class="col-span-full text-gray-400">ရှာဖွေမှု ရလဒ် မရှိပါ။</div>';
    } else {
      filtered.forEach(item => {
        searchGrid.appendChild(createCard(item, item.isSeries || item.episodes !== undefined));
      });
    }
  });
}

document.addEventListener('DOMContentLoaded', async () => {
  setupCustomPlayerControls();
  window.history.replaceState({ view: 'home' }, '');
  try {
    const response = await fetch('https://stream-api.rolexbaho567.workers.dev/api/playlist');
    const content = await response.text();
    allChannelsGlobal = parseM3U(content);
    processPlaylistData(allChannelsGlobal);
    
    renderHomeSections();

  } catch (err) {
    console.error('Playlist Error:', err);
    const spinner = document.getElementById('loading-spinner');
    if (spinner) spinner.innerHTML = 'No Channels Found. Please check your connection and try again';
  }
});

async function initShaka(url, drmData = null, channelName = '') {
  const container = document.getElementById('video-container');
  container.style.display = 'flex';

  window.history.pushState({ view: 'player' }, '');

  const video = document.getElementById('tv-player');
  const playerContainer = document.getElementById('playerContainer');
  
  updateTitleAndFormat(url, channelName);
  shaka.polyfill.installAll();

  if (hls) { hls.destroy(); hls = null; }
  if (player) { await player.destroy(); player = null; }

  const lowerUrl = url.toLowerCase();
  const isTsStream = lowerUrl.includes('.ts');
  const isMp4Stream = lowerUrl.includes('.mp4');

  if (isTsStream && !drmData) {
    video.setAttribute('crossorigin', 'anonymous');
    if (Hls.isSupported()) {
      hls = new Hls({
        xhrSetup: function(xhr) { xhr.withCredentials = false; },
        crossOrigin: true,
        forceMediaSource: true
      });
      hls.loadSource(url);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, async () => {
        await requestFullscreenAndLockOrientation(playerContainer);
        await video.play().catch(e => console.warn(e));
        setupQualityLevelsHLS();
      });
    }
    return;
  }

  if ((isMp4Stream || url.startsWith('http://')) && !drmData && !lowerUrl.includes('.m3u8')) {
    video.removeAttribute('crossorigin'); 
    video.src = url;
    video.load();
    await requestFullscreenAndLockOrientation(playerContainer);
    video.play().catch(err => {
      video.muted = true;
      video.play().catch(e => console.error(e));
    });
    return;
  }

  video.setAttribute('crossorigin', 'anonymous');
  player = new shaka.Player(video);

  try {
    if (lowerUrl.includes('.m3u8') && !drmData) {
      await player.unload();
      player.detach();

      if (video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = url;
        video.load();
        await requestFullscreenAndLockOrientation(playerContainer);
        await video.play();
      } else if (Hls.isSupported()) {
        hls = new Hls({
          xhrSetup: function(xhr) { xhr.withCredentials = false; },
          crossOrigin: true
        });
        hls.loadSource(url);
        hls.attachMedia(video);
        hls.on(Hls.Events.MANIFEST_PARSED, async () => {
          await requestFullscreenAndLockOrientation(playerContainer);
          await video.play();
          setupQualityLevelsHLS();
        });
      }
    } else {
      player.configure({
        drm: drmData ? { clearKeys: { [drmData.keyId]: drmData.key } } : {}
      });
      await player.load(url);
      await requestFullscreenAndLockOrientation(playerContainer);
      await video.play();
      setupQualityLevelsShaka();
    }
  } catch (error) {
    console.error('Playback error:', error);
    video.removeAttribute('crossorigin');
    video.src = url;
    video.load();
    video.play().catch(e => console.error(e));
  }
}

function updateTitleAndFormat(url, name) {
  const titleEl = document.getElementById('videoTitle');
  const badgeEl = document.getElementById('formatBadge');
  if (titleEl) titleEl.textContent = name || "Live Stream";

  const lower = url.toLowerCase();
  if (badgeEl) {
    if (lower.includes('.m3u8')) badgeEl.textContent = 'HLS';
    else if (lower.includes('.mpd')) badgeEl.textContent = 'DASH';
    else if (lower.includes('.ts')) badgeEl.textContent = 'MPEG-TS';
    else if (lower.includes('.mp4')) badgeEl.textContent = 'MP4';
    else badgeEl.textContent = 'LIVE';
  }
}

function handlePlayerBackAction() {
  closePlayer();
}

async function closePlayer() {
  const video = document.getElementById('tv-player');
  if (video) {
    video.pause();
    video.src = "";
    video.load();
  }
  
  if (hls) { hls.destroy(); hls = null; }
  if (player) { await player.destroy(); player = null; }
  
  const container = document.getElementById('video-container');
  if (container) container.style.display = 'none';

  if (document.fullscreenElement || document.webkitFullscreenElement) {
    if (document.exitFullscreen) document.exitFullscreen().catch(err => {});
  }
  if (screen.orientation && screen.orientation.unlock) {
    screen.orientation.unlock();
  }
}

window.addEventListener('popstate', function (event) {
  const container = document.getElementById('video-container');
  const detailView = document.getElementById('detail-view');
  const allContainer = document.getElementById('category-all-container');

  if (container && container.style.display === 'flex') {
    closePlayer();
  } else if (detailView && detailView.style.display === 'block') {
    goBackToCategoryAll();
  } else if (allContainer && !allContainer.classList.contains('hidden')) {
    showMainHome();
  }
});

window.addEventListener('keydown', function(e) {
  const container = document.getElementById('video-container');
  if (container && container.style.display === 'flex' && (e.key === 'Escape' || e.keyCode === 27)) {
    closePlayer();
  }
});

document.addEventListener('contextmenu', function(e) {
  const container = document.getElementById('video-container');
  const detailView = document.getElementById('detail-view');
  const allContainer = document.getElementById('category-all-container');

  if (container && container.style.display === 'flex') {
    e.preventDefault();
    if (document.fullscreenElement || document.webkitFullscreenElement) {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(err => {});
      } else if (document.webkitExitFullscreen) {
        document.webkitExitFullscreen().catch(err => {});
      }
    } else {
      closePlayer();
    }
    return false;
  } else if (detailView && detailView.style.display === 'block') {
    e.preventDefault();
    goBackToCategoryAll();
    return false;
  } else if (allContainer && !allContainer.classList.contains('hidden')) {
    e.preventDefault();
    showMainHome();
    return false;
  }
});

function setupCustomPlayerControls() {
  const video = document.getElementById('tv-player');
  if (!video) return;

  const playBtn = document.getElementById('playBtn');
  const centerPlayBtn = document.getElementById('centerPlayBtn');
  const clickOverlay = document.getElementById('clickOverlay');
  const playIcon = document.getElementById('playIcon');
  const centerPlayIcon = document.getElementById('centerPlayIcon');
  
  const muteBtn = document.getElementById('muteBtn');
  const muteIcon = document.getElementById('muteIcon');
  const volumeSlider = document.getElementById('volumeSlider');
  
  const rewind15Btn = document.getElementById('rewind15Btn');
  const forward15Btn = document.getElementById('forward15Btn');
  
  const seekBar = document.getElementById('seekBar');
  const progressBar = document.getElementById('progressBar');
  const bufferBar = document.getElementById('bufferBar');
  
  const currentTimeEl = document.getElementById('currentTime');
  const durationEl = document.getElementById('duration');
  const fullscreenBtn = document.getElementById('fullscreenBtn');
  const qualitySelect = document.getElementById('qualitySelect');

  function togglePlay() {
    if (video.paused) video.play().catch(e => {});
    else video.pause();
  }

  if (playBtn) playBtn.addEventListener('click', togglePlay);
  if (centerPlayBtn) centerPlayBtn.addEventListener('click', togglePlay);
  if (clickOverlay) clickOverlay.addEventListener('click', togglePlay);

  video.addEventListener('play', () => {
    if (playIcon) playIcon.className = 'fa-solid fa-pause text-sm w-4 text-center';
    if (centerPlayIcon) centerPlayIcon.className = 'fa-solid fa-pause text-lg sm:text-2xl ml-0.5';
  });

  video.addEventListener('pause', () => {
    if (playIcon) playIcon.className = 'fa-solid fa-play text-sm w-4 text-center';
    if (centerPlayIcon) centerPlayIcon.className = 'fa-solid fa-play text-lg sm:text-2xl ml-0.5';
  });

  if (rewind15Btn) rewind15Btn.addEventListener('click', () => { video.currentTime = Math.max(0, video.currentTime - 15); });
  if (forward15Btn) forward15Btn.addEventListener('click', () => { video.currentTime = Math.min(video.duration || 0, video.currentTime + 15); });

  function formatTime(seconds) {
    if (isNaN(seconds) || !isFinite(seconds)) return "0:00";
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  }

  video.addEventListener('timeupdate', () => {
    if (!isNaN(video.duration) && isFinite(video.duration) && video.duration > 0) {
      const pct = (video.currentTime / video.duration) * 100;
      if (seekBar) seekBar.value = pct;
      if (progressBar) progressBar.style.width = `${pct}%`;
      if (currentTimeEl) currentTimeEl.textContent = formatTime(video.currentTime);
      if (durationEl) durationEl.textContent = formatTime(video.duration);
    } else {
      if (seekBar) seekBar.value = 100;
      if (progressBar) progressBar.style.width = '100%';
      if (currentTimeEl) currentTimeEl.textContent = formatTime(video.currentTime);
      if (durationEl) durationEl.textContent = "LIVE";
    }

    if (video.buffered.length > 0 && video.duration && bufferBar) {
      const bufferedEnd = video.buffered.end(video.buffered.length - 1);
      bufferBar.style.width = `${(bufferedEnd / video.duration) * 100}%`;
    }
  });

  if (seekBar) {
    seekBar.addEventListener('input', (e) => {
      if (video.duration && isFinite(video.duration)) {
        video.currentTime = (e.target.value / 100) * video.duration;
      }
    });
  }

  if (muteBtn && muteIcon) {
    muteBtn.addEventListener('click', () => {
      video.muted = !video.muted;
      muteIcon.className = video.muted ? 'fa-solid fa-volume-xmark text-xs w-4 text-center text-red-400' : 'fa-solid fa-volume-high text-xs w-4 text-center';
    });
  }

  if (volumeSlider) {
    volumeSlider.addEventListener('input', (e) => {
      video.volume = e.target.value;
      video.muted = (e.target.value == 0);
    });
  }

  if (fullscreenBtn) {
    fullscreenBtn.addEventListener('click', () => {
      const container = document.getElementById('playerContainer');
      if (!document.fullscreenElement && !document.webkitFullscreenElement) {
        requestFullscreenAndLockOrientation(container);
      } else {
        if (document.exitFullscreen) document.exitFullscreen();
      }
    });
  }

  if (qualitySelect) {
    qualitySelect.addEventListener('change', (e) => {
      const val = e.target.value;
      if (hls) {
        hls.currentLevel = parseInt(val, 10);
      } else if (player) {
        if (val === 'auto') {
          player.configure({ abr: { enabled: true } });
        } else {
          player.configure({ abr: { enabled: false } });
          const tracks = player.getVariantTracks();
          const track = tracks.find(t => t.id == val);
          if (track) player.selectVariantTrack(track, true);
        }
      }
    });
  }
}

function setupQualityLevelsHLS() {
  const select = document.getElementById('qualitySelect');
  if (!select) return;
  select.innerHTML = '<option value="-1">Auto</option>';
  if (hls && hls.levels) {
    hls.levels.forEach((level, index) => {
      const opt = document.createElement('option');
      opt.value = index;
      opt.textContent = `${level.height || 'SD'}p`;
      select.appendChild(opt);
    });
  }
}

function setupQualityLevelsShaka() {
  const select = document.getElementById('qualitySelect');
  if (!select) return;
  select.innerHTML = '<option value="auto">Auto</option>';
  if (player) {
    const tracks = player.getVariantTracks();
    const addedHeights = new Set();
    tracks.forEach(track => {
      if (track.height && !addedHeights.has(track.height)) {
        addedHeights.add(track.height);
        const opt = document.createElement('option');
        opt.value = track.id;
        opt.textContent = `${track.height}p`;
        select.appendChild(opt);
      }
    });
  }
}