document.addEventListener('DOMContentLoaded', () => {
  const games = window.NexusGaming.games;

  const featuredGameIds = [1, 4, 7, 10, 14];
  const featuredGames = featuredGameIds
    .map(id => games.find(game => game.id === id))
    .filter(game => game && typeof game.title === 'string' && game.title.trim() &&
      typeof game.genre === 'string' && typeof game.description === 'string');
  const featuredRotationDelay = 6000;
  const storageKeys = {
    wishlist: 'nexus.wishlist.v1',
    recent: 'nexus.recent.v1',
    view: 'nexus.view.v1',
    comparison: 'nexus.compare.v1'
  };
  const elements = {
    gameCards: document.getElementById('gameCards'),
    trendingCards: document.getElementById('trendingCards'),
    newReleases: document.getElementById('newReleaseCards'),
    topRated: document.getElementById('topRatedGames'),
    recommended: document.getElementById('recommendedGames'),
    search: document.getElementById('searchBar'),
    clearSearch: document.getElementById('clearSearch'),
    genreFilters: document.getElementById('genreFilters'),
    genreBrowser: document.getElementById('genreBrowser'),
    results: document.getElementById('resultsCount'),
    sort: document.getElementById('sortGames'),
    year: document.getElementById('yearFilter'),
    rating: document.getElementById('ratingFilter'),
    favoritesFilter: document.getElementById('favoritesFilter'),
    savedGames: document.getElementById('savedGamesButton'),
    savedCount: document.getElementById('savedCount'),
    myFavorites: document.getElementById('myFavorites'),
    myWishlist: document.getElementById('myWishlist'),
    recent: document.getElementById('recentlyViewed'),
    compareTray: document.getElementById('compareTray'),
    compareContent: document.getElementById('comparisonContent'),
    dialog: document.getElementById('gameDialog'),
    toast: document.getElementById('toastRegion'),
    nav: document.getElementById('mainNavigation'),
    menuToggle: document.getElementById('menuToggle'),
    heroArtwork: document.getElementById('heroArtwork'),
    heroArtworkSecondary: document.getElementById('heroArtworkSecondary'),
    heroDots: document.getElementById('heroDots'),
    heroProgress: document.getElementById('heroProgress'),
    heroProgressFill: document.getElementById('heroProgressFill'),
    heroSlideStatus: document.getElementById('heroSlideStatus'),
    heroRotationToggle: document.getElementById('toggleFeaturedRotation')
  };
  const validIds = new Set(games.map(game => game.id));
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const heroArtworkCache = new Map();
  let state = {
    genre: 'all',
    favoritesOnly: false,
    featuredIndex: 0,
    heroTimer: 0,
    heroDeadline: 0,
    heroRemaining: featuredRotationDelay,
    heroPausedByUser: false,
    heroPointerInside: false,
    heroFocusInside: false,
    heroArtworkCurrent: elements.heroArtwork,
    heroRotationInitialized: false,
    heroAdvancing: false,
    heroRequest: 0,
    view: readView(),
    comparison: readIdList(storageKeys.comparison).slice(0, 3),
    favorites: readIdList('favorites'),
    wishlist: readIdList(storageKeys.wishlist),
    recentlyViewed: readIdList(storageKeys.recent).slice(0, 6),
    dialogGame: null,
    dialogOpener: null,
    toastTimer: 0,
    toastGeneration: 0
  };

  function gameById(id) {
    return games.find(game => game.id === id);
  }

  function withMissingLast(first, second, compare) {
    const missingFirst = !Number.isFinite(first);
    const missingSecond = !Number.isFinite(second);
    if (missingFirst !== missingSecond) return missingFirst ? 1 : -1;
    return missingFirst ? 0 : compare(first, second);
  }

  function safeRead(key) {
    try {
      return localStorage.getItem(key);
    } catch (error) {
      console.warn(`Could not read local setting "${key}".`, error);
      return null;
    }
  }

  function readIdList(key) {
    try {
      const parsed = JSON.parse(safeRead(key) || '[]');
      if (!Array.isArray(parsed)) return [];
      return [...new Set(parsed.filter(id => Number.isInteger(id) && validIds.has(id)))];
    } catch (error) {
      console.warn(`Stored list "${key}" could not be read; keeping it unchanged.`, error);
      return [];
    }
  }

  function writeIdList(key, ids) {
    try {
      localStorage.setItem(key, JSON.stringify([...new Set(ids.filter(id => validIds.has(id)))]));
      return true;
    } catch (error) {
      console.error(`Could not save "${key}" in this browser.`, error);
      announce('Your change could not be saved in this browser.');
      return false;
    }
  }

  function captureCardActionFocus() {
    const active = document.activeElement;
    const card = active?.closest('[data-game-id]');
    if (!card || !active.dataset.action) return null;
    return { id: card.dataset.gameId, action: active.dataset.action, container: card.parentElement };
  }

  function restoreCardActionFocus(target) {
    if (!target) return;
    requestAnimationFrame(() => {
      const card = [...target.container.children].find(item => item.dataset.gameId === target.id);
      const button = card?.querySelector(`[data-action="${target.action}"]`);
      (button || elements.search).focus();
    });
    window.addEventListener('storage', event => {
      if (event.key !== storageKeys.comparison && event.key !== null) return;
      state.comparison = readIdList(storageKeys.comparison).slice(0, 3);
      renderComparison();
      renderGames();
      renderStaticDiscovery();
      renderDialogState();
    });
  }

  function scrollBehavior() {
    return reducedMotion.matches ? 'auto' : 'smooth';
  }

  function readView() {
    return safeRead(storageKeys.view) === 'list' ? 'list' : 'grid';
  }

  function imageUrl(game) {
    const imagePath = game.artworkPath || `${game.appId}/header.jpg`;
    return new URL(imagePath, 'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/').href;
  }

  function setArtwork(image, game) {
    const source = imageUrl(game);
    image.hidden = false;
    image.alt = game.alt;
    image.onerror = () => {
      if (image.src === source) image.hidden = true;
    };
    image.src = source;
  }

  function makeArtwork(game, className, loading = 'lazy') {
    const image = document.createElement('img');
    image.className = className;
    image.loading = loading;
    image.decoding = 'async';
    setArtwork(image, game);
    return image;
  }

  function preloadHeroArtwork(game) {
    if (!game || !Number.isInteger(game.appId)) return Promise.resolve(false);
    const url = imageUrl(game);
    if (heroArtworkCache.has(url)) return heroArtworkCache.get(url);

    const image = new Image();
    const result = new Promise(resolve => {
      image.addEventListener('load', () => resolve(image.naturalWidth > 0), { once: true });
      image.addEventListener('error', () => resolve(false), { once: true });
      image.src = url;
      if (image.complete) resolve(image.naturalWidth > 0);
    }).then(loaded => {
      if (!loaded) heroArtworkCache.delete(url);
      return loaded;
    });
    heroArtworkCache.set(url, result);
    return result;
  }

  function renderFeaturedContent() {
    const game = featuredGames[state.featuredIndex];
    if (!game) return;

    document.getElementById('heroGenre').textContent = game.genre;
    document.getElementById('heroTitle').textContent = game.title;
    document.getElementById('heroDescription').textContent = game.description;
    const rating = document.getElementById('heroRating');
    rating.textContent = Number.isFinite(game.rating) ? `★ ${game.rating.toFixed(1)} / 5` : '';
    rating.hidden = !Number.isFinite(game.rating);
    const year = document.getElementById('heroYear');
    year.textContent = Number.isFinite(game.year) ? String(game.year) : '';
    year.hidden = !Number.isFinite(game.year);
    document.querySelector('.hero-meta').hidden = !Number.isFinite(game.rating) && !Number.isFinite(game.year);
    document.querySelector('.meta-divider').hidden = !Number.isFinite(game.rating) || !Number.isFinite(game.year);

    const saveButton = document.getElementById('saveFeatured');
    const saved = state.favorites.includes(game.id);
    saveButton.textContent = saved ? '♥ Saved' : '♡ Save game';
    saveButton.setAttribute('aria-pressed', String(saved));
    elements.heroSlideStatus.textContent = `Slide ${state.featuredIndex + 1} of ${featuredGames.length}: ${game.title}`;

    const dots = featuredGames.map((item, index) => {
      const dot = document.createElement('button');
      dot.type = 'button';
      dot.className = 'hero-dot';
      dot.dataset.featuredIndex = String(index);
      dot.setAttribute('aria-label', `Show featured game ${index + 1}: ${item.title}`);
      dot.setAttribute('aria-pressed', String(index === state.featuredIndex));
      return dot;
    });
    elements.heroDots.replaceChildren(...dots);
  }

  function updateFeaturedArtwork(game) {
    if (state.heroArtworkCurrent.dataset.gameId !== String(game.id)) {
      const previous = state.heroArtworkCurrent;
      const next = previous === elements.heroArtwork ? elements.heroArtworkSecondary : elements.heroArtwork;
      next.hidden = false;
      setArtwork(next, game);
      next.dataset.gameId = String(game.id);
      next.classList.remove('is-current');
      next.setAttribute('aria-hidden', 'true');
      next.alt = '';
      next.addEventListener('error', () => {
        if (state.heroArtworkCurrent !== next) return;
        state.heroArtworkCurrent = previous;
      }, { once: true });
      if (reducedMotion.matches) {
        previous.classList.remove('is-current');
        previous.hidden = true;
        previous.alt = '';
        previous.setAttribute('aria-hidden', 'true');
        next.classList.add('is-current');
        next.removeAttribute('aria-hidden');
        next.alt = game.alt || `${game.title} artwork`;
      } else {
        state.heroArtworkCurrent = next;
        requestAnimationFrame(() => requestAnimationFrame(() => {
          if (state.heroArtworkCurrent !== next) return;
          previous.classList.remove('is-current');
          next.classList.add('is-current');
          next.removeAttribute('aria-hidden');
          next.alt = game.alt || `${game.title} artwork`;
        }));
        next.addEventListener('transitionend', event => {
          if (event.propertyName !== 'opacity' || previous === state.heroArtworkCurrent) return;
          previous.hidden = true;
          previous.alt = '';
          previous.setAttribute('aria-hidden', 'true');
        }, { once: true });
      }
      if (reducedMotion.matches) state.heroArtworkCurrent = next;
    } else {
      state.heroArtworkCurrent.alt = game.alt || `${game.title} artwork`;
      state.heroArtworkCurrent.removeAttribute('aria-hidden');
      state.heroArtworkCurrent.hidden = false;
    }
  }

  function updateFeatured() {
    const game = featuredGames[state.featuredIndex];
    if (!game) return;
    renderFeaturedContent();
    if (!state.heroArtworkCurrent.dataset.gameId) {
      setArtwork(state.heroArtworkCurrent, game);
      state.heroArtworkCurrent.dataset.gameId = String(game.id);
      state.heroArtworkCurrent.classList.add('is-current');
    } else {
      updateFeaturedArtwork(game);
    }
  }

  async function showFeatured(index, automatic = false) {
    const game = featuredGames[index];
    if (!game) return false;
    const request = ++state.heroRequest;
    if (index !== state.featuredIndex && !(await preloadHeroArtwork(game))) return false;
    if (request !== state.heroRequest || (automatic && !canRotateFeatured())) return false;

    state.featuredIndex = index;
    renderFeaturedContent();
    updateFeaturedArtwork(game);
    const nextGame = featuredGames[(index + 1) % featuredGames.length];
    if (nextGame && nextGame.id !== game.id) preloadHeroArtwork(nextGame);
    return true;
  }

  function canRotateFeatured() {
    return featuredGames.length > 1 && !state.heroPausedByUser &&
      !state.heroPointerInside && !state.heroFocusInside &&
      !document.hidden && !reducedMotion.matches;
  }

  function updateFeaturedProgress(remaining, transition = 0) {
    const elapsed = Math.min(featuredRotationDelay, Math.max(0, featuredRotationDelay - remaining));
    elements.heroProgress.setAttribute('aria-valuenow', (elapsed / 1000).toFixed(1));
    elements.heroProgress.setAttribute('aria-valuetext', `${Math.ceil(remaining / 1000)} seconds until next featured game`);
    elements.heroProgressFill.style.transitionDuration = `${transition}ms`;
    elements.heroProgressFill.style.transform = `scaleX(${elapsed / featuredRotationDelay})`;
  }

  function clearFeaturedTimer() {
    if (!state.heroTimer) return;
    window.clearTimeout(state.heroTimer);
    state.heroTimer = 0;
  }

  function pauseFeaturedRotation() {
    if (state.heroTimer) {
      state.heroRemaining = Math.max(0, state.heroDeadline - Date.now());
      clearFeaturedTimer();
      state.heroDeadline = 0;
    }
    if (state.heroAdvancing) state.heroRequest += 1;
    updateFeaturedProgress(state.heroRemaining);
  }

  function advanceFeaturedAutomatically() {
    if (state.heroAdvancing || !canRotateFeatured()) return;
    state.heroAdvancing = true;
    const startIndex = state.featuredIndex;
    (async () => {
      for (let offset = 1; offset < featuredGames.length; offset += 1) {
        if (!canRotateFeatured()) break;
        const nextIndex = (startIndex + offset) % featuredGames.length;
        if (await showFeatured(nextIndex, true)) break;
      }
    })().finally(() => {
      state.heroAdvancing = false;
      state.heroRemaining = featuredRotationDelay;
      state.heroDeadline = 0;
      scheduleFeaturedRotation();
    });
  }

  function scheduleFeaturedRotation() {
    clearFeaturedTimer();
    if (!canRotateFeatured()) {
      updateFeaturedProgress(state.heroRemaining);
      return;
    }
    if (state.heroRemaining <= 0 || state.heroRemaining > featuredRotationDelay) {
      state.heroRemaining = featuredRotationDelay;
    }
    state.heroDeadline = Date.now() + state.heroRemaining;

    const tick = () => {
      const remaining = Math.max(0, state.heroDeadline - Date.now());
      updateFeaturedProgress(remaining, Math.min(1000, state.heroRemaining - remaining));
      if (remaining <= 0) {
        state.heroRemaining = 0;
        state.heroDeadline = 0;
        advanceFeaturedAutomatically();
        return;
      }
      state.heroRemaining = remaining;
      state.heroTimer = window.setTimeout(tick, Math.min(1000, remaining));
    };
    state.heroTimer = window.setTimeout(tick, Math.min(1000, state.heroRemaining));
  }

  function updateFeaturedRotationState() {
    const paused = !canRotateFeatured();
    if (paused) {
      pauseFeaturedRotation();
    } else {
      scheduleFeaturedRotation();
    }
    elements.heroRotationToggle.hidden = reducedMotion.matches || featuredGames.length < 2;
    elements.heroProgress.hidden = reducedMotion.matches || featuredGames.length < 2;
    elements.heroRotationToggle.setAttribute('aria-label', state.heroPausedByUser
      ? 'Resume automatic slide rotation'
      : 'Pause automatic slide rotation');
    elements.heroRotationToggle.setAttribute('aria-pressed', String(state.heroPausedByUser));
    elements.heroRotationToggle.textContent = state.heroPausedByUser ? '▶' : 'Ⅱ';
  }

  function initializeFeaturedCarousel() {
    if (state.heroRotationInitialized || !featuredGames.length) return;
    state.heroRotationInitialized = true;
    state.featuredIndex = 0;
    updateFeatured();
    preloadHeroArtwork(featuredGames[(state.featuredIndex + 1) % featuredGames.length]);
    updateFeaturedRotationState();
  }

  function announce(message) {
    const currentGeneration = ++state.toastGeneration;
    window.clearTimeout(state.toastTimer);
    elements.toast.textContent = message;
    elements.toast.classList.add('visible');
    state.toastTimer = window.setTimeout(() => {
      if (currentGeneration === state.toastGeneration) {
        elements.toast.classList.remove('visible');
        elements.toast.textContent = '';
      }
    }, 2600);
  }

  function setFavorite(id) {
    const focusTarget = captureCardActionFocus();
    const isFavorite = state.favorites.includes(id);
    const next = isFavorite ? state.favorites.filter(item => item !== id) : [...state.favorites, id];
    if (!writeIdList('favorites', next)) return;
    state.favorites = [...new Set(next)];
    renderAll();
    restoreCardActionFocus(focusTarget);
    announce(isFavorite ? 'Removed from favourites.' : 'Added to favourites.');
  }

  function setWishlist(id) {
    const focusTarget = captureCardActionFocus();
    const isListed = state.wishlist.includes(id);
    const next = isListed ? state.wishlist.filter(item => item !== id) : [...state.wishlist, id];
    if (!writeIdList(storageKeys.wishlist, next)) return;
    state.wishlist = [...new Set(next)];
    renderGames();
    renderStaticDiscovery();
    renderPersonal();
    renderDialogState();
    restoreCardActionFocus(focusTarget);
    announce(isListed ? 'Removed from your wishlist.' : 'Added to your wishlist.');
  }

  function addRecentlyViewed(id) {
    const next = [id, ...state.recentlyViewed.filter(item => item !== id)].slice(0, 6);
    if (writeIdList(storageKeys.recent, next)) {
      state.recentlyViewed = next;
      renderPersonal();
    }
  }

  function removeRecentlyViewed(id) {
    const next = state.recentlyViewed.filter(item => item !== id);
    if (writeIdList(storageKeys.recent, next)) {
      state.recentlyViewed = next;
      renderPersonal();
      announce('Removed from recently viewed.');
    }
  }

  function clearRecentlyViewed() {
    if (writeIdList(storageKeys.recent, [])) {
      state.recentlyViewed = [];
      renderPersonal();
      announce('Recently viewed history cleared.');
    }
  }

  function makeActionButton(label, className, action, pressed, ariaLabel) {
    const button = document.createElement('button');
    button.className = className;
    button.type = 'button';
    button.dataset.action = action;
    button.setAttribute('aria-label', ariaLabel);
    if (pressed !== null) button.setAttribute('aria-pressed', String(pressed));
    button.textContent = label;
    return button;
  }

  function makeCard(game, options = {}) {
    const card = document.createElement('article');
    card.className = `game-card${options.compact ? ' trending-card' : ''}`;
    card.dataset.gameId = String(game.id);
    card.tabIndex = 0;
    const ratingDescription = Number.isFinite(game.rating) ? `, rating ${game.rating.toFixed(1)} out of 5` : '';
    card.setAttribute('aria-label', `${game.title}, ${game.genre}${ratingDescription}. Press Enter for details.`);
    const cover = document.createElement('div');
    cover.className = 'game-cover';
    cover.append(makeArtwork(game, 'card-art'));

    const content = document.createElement('div');
    content.className = 'card-content';
    const genre = document.createElement('span');
    genre.className = 'game-genre';
    genre.textContent = game.genre;
    const title = document.createElement('h3');
    const titleLink = document.createElement('a');
    titleLink.href = `game.html?id=${encodeURIComponent(game.id)}`;
    titleLink.textContent = game.title;
    title.append(titleLink);
    const metadata = document.createElement('div');
    metadata.className = 'card-meta';
    const year = document.createElement('span');
    year.textContent = String(game.year);
    metadata.append(year);
    if (Number.isFinite(game.rating)) {
      const rating = document.createElement('span');
      rating.className = 'game-rating';
      rating.textContent = `★ ${game.rating.toFixed(1)} / 5`;
      metadata.append(rating);
    }

    const actions = document.createElement('div');
    actions.className = 'card-actions';
    const compareButton = makeActionButton(
      state.comparison.includes(game.id) ? '✓ Compare' : '＋ Compare',
      'details-button compare-card-button',
      'compare',
      state.comparison.includes(game.id),
      `${state.comparison.includes(game.id) ? 'Remove' : 'Add'} ${game.title} ${state.comparison.includes(game.id) ? 'from' : 'to'} comparison`
    );
    compareButton.disabled = !state.comparison.includes(game.id) && state.comparison.length >= 3;
    actions.append(
      makeActionButton(
        state.favorites.includes(game.id) ? '♥ Saved' : '♡ Favourite',
        'favorite-btn',
        'favorite',
        state.favorites.includes(game.id),
        `${state.favorites.includes(game.id) ? 'Remove' : 'Add'} ${game.title} ${state.favorites.includes(game.id) ? 'from' : 'to'} favourites`
      ),
      makeActionButton(
        state.wishlist.includes(game.id) ? '✓ Wishlist' : '＋ Wishlist',
        'details-button wishlist-card-button',
        'wishlist',
        state.wishlist.includes(game.id),
        `${state.wishlist.includes(game.id) ? 'Remove' : 'Add'} ${game.title} ${state.wishlist.includes(game.id) ? 'from' : 'to'} wishlist`
      ),
      makeActionButton('Details', 'details-button', 'details', null, `View details for ${game.title}`),
      compareButton
    );
    content.append(genre, title, metadata, actions);
    card.append(cover, content);
    return card;
  }

  function makeEmpty(message, actionLabel, action) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    const icon = document.createElement('span');
    icon.className = 'empty-icon';
    icon.setAttribute('aria-hidden', 'true');
    icon.textContent = '⌕';
    const title = document.createElement('h3');
    title.textContent = message;
    const help = document.createElement('p');
    help.textContent = 'Your collection is stored in this browser on this device.';
    empty.append(icon, title, help);
    if (actionLabel && action) {
      const button = document.createElement('button');
      button.className = 'clear-filters';
      button.type = 'button';
      button.dataset.action = action;
      button.textContent = actionLabel;
      empty.append(button);
    }
    return empty;
  }

  function makeMiniGame(game, options = {}) {
    const item = document.createElement('article');
    item.className = 'mini-game';
    item.dataset.gameId = String(game.id);
    const image = makeArtwork(game, 'mini-art');
    image.alt = '';
    const info = document.createElement('button');
    info.className = 'mini-game-info';
    info.type = 'button';
    info.dataset.action = 'details';
    info.setAttribute('aria-label', `View details for ${game.title}`);
    const name = document.createElement('span');
    name.className = 'mini-game-title';
    name.textContent = game.title;
    const detail = document.createElement('span');
    detail.className = 'mini-game-detail';
    detail.textContent = `${game.genre} · ${game.year}`;
    info.append(name, detail);
    item.append(image, info);
    if (options.removeAction) {
      const remove = document.createElement('button');
      remove.className = 'mini-remove';
      remove.type = 'button';
      remove.dataset.action = options.removeAction;
      remove.setAttribute('aria-label', `Remove ${game.title}`);
      remove.textContent = '×';
      item.append(remove);
    }
    return item;
  }

  function sortGames(list) {
    const sorted = [...list];
    const mode = elements.sort.value;
    const compareTitle = (a, b) => a.title.localeCompare(b.title);
    sorted.sort((first, second) => {
      if (mode === 'title-asc') return compareTitle(first, second);
      if (mode === 'title-desc') return compareTitle(second, first);
      if (mode === 'year-asc') return withMissingLast(first.year, second.year, (a, b) => a - b) || compareTitle(first, second);
      if (mode === 'year-desc') return withMissingLast(first.year, second.year, (a, b) => b - a) || compareTitle(first, second);
      return withMissingLast(first.rating, second.rating, (a, b) => b - a) || compareTitle(first, second);
    });
    return sorted;
  }

  function filteredGames() {
    const query = elements.search.value.trim().toLocaleLowerCase();
    const year = elements.year.value;
    const minimumRating = Number(elements.rating.value);
    return sortGames(games.filter(game => {
      const matchesQuery = !query || [game.title, game.genre, game.description, game.year, ...(game.platforms || [])]
        .filter(value => value !== undefined && value !== null)
        .join(' ')
        .toLocaleLowerCase()
        .includes(query);
      const matchesGenre = state.genre === 'all' || game.genre.toLowerCase() === state.genre;
      const matchesYear = year === 'all' || game.year === Number(year);
      const matchesRating = minimumRating === 0 || (Number.isFinite(game.rating) && game.rating >= minimumRating);
      const matchesFavorite = !state.favoritesOnly || state.favorites.includes(game.id);
      return matchesQuery && matchesGenre && matchesYear && matchesRating && matchesFavorite;
    }));
  }

  function renderGenreControls() {
    const genres = [...new Set(games.map(game => game.genre))].sort((a, b) => a.localeCompare(b));
    const allButton = makeGenreButton('all', 'All games', games.length);
    const buttons = [allButton, ...genres.map(genre => makeGenreButton(genre.toLowerCase(), genre, games.filter(game => game.genre === genre).length))];
    elements.genreFilters.replaceChildren(...buttons);
    elements.genreBrowser.replaceChildren(...genres.map(genre => {
      const count = games.filter(game => game.genre === genre).length;
      const button = makeGenreButton(genre.toLowerCase(), genre, count);
      button.classList.add('genre-tile');
      button.setAttribute('aria-label', `Show ${count} ${genre} ${count === 1 ? 'game' : 'games'}`);
      return button;
    }));
    const years = [...new Set(games.map(game => game.year).filter(Number.isFinite))].sort((a, b) => b - a);
    elements.year.replaceChildren(new Option('All years', 'all'), ...years.map(year => new Option(String(year), String(year))));
  }

  function makeGenreButton(value, label, count) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'filter-btn';
    button.dataset.genreValue = value;
    button.setAttribute('aria-pressed', String(state.genre === value));
    button.textContent = `${label} · ${count}`;
    if (value === state.genre && elements.genreFilters.children.length) button.classList.add('active');
    return button;
  }

  function renderGames() {
    const visibleGames = filteredGames();
    if (visibleGames.length) {
      elements.gameCards.replaceChildren(...visibleGames.map(game => makeCard(game)));
    } else {
      const empty = makeEmpty('No games match your filters', 'Clear filters', 'clear-filters');
      elements.gameCards.replaceChildren(empty);
    }
    elements.gameCards.classList.toggle('list-view', state.view === 'list');
    elements.results.textContent = `${visibleGames.length} ${visibleGames.length === 1 ? 'game' : 'games'}${state.favoritesOnly ? ' · favourites' : ''}`;
    elements.clearSearch.hidden = !elements.search.value;
    elements.favoritesFilter.classList.toggle('active', state.favoritesOnly);
    elements.favoritesFilter.setAttribute('aria-pressed', String(state.favoritesOnly));
    elements.savedGames.setAttribute('aria-label', `Show saved games, ${state.favorites.length} saved`);
    elements.savedCount.textContent = String(state.favorites.length);
    document.querySelector('.year-control').classList.toggle('has-value', elements.year.value !== 'all');
    document.querySelector('.rating-control').classList.toggle('has-value', elements.rating.value !== '0');
    document.querySelectorAll('[data-view]').forEach(button => {
      const active = button.dataset.view === state.view;
      button.setAttribute('aria-pressed', String(active));
    });
    document.querySelectorAll('#genreFilters [data-genre-value], #genreBrowser [data-genre-value]').forEach(button => {
      const active = button.dataset.genreValue === state.genre;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', String(active));
    });
  }

  function renderStaticDiscovery() {
    const sorted = [...games].sort((a, b) => {
      const ratingOrder = withMissingLast(a.rating, b.rating, (first, second) => second - first);
      return ratingOrder || a.title.localeCompare(b.title);
    });
    elements.trendingCards.replaceChildren(...sorted.slice(0, 4).map(game => makeCard(game, { compact: true })));
    elements.topRated.replaceChildren(...sorted.filter(game => Number.isFinite(game.rating)).slice(0, 4).map(game => makeMiniGame(game)));
    const recentReleases = [...games]
      .filter(game => Number.isFinite(game.year))
      .sort((first, second) => second.year - first.year || first.title.localeCompare(second.title))
      .slice(0, 4);
    elements.newReleases.replaceChildren(...recentReleases.map(game => makeCard(game, { compact: true })));
  }

  function renderRecommendations() {
    const favoriteGenres = new Set(state.favorites.map(id => gameById(id)?.genre).filter(Boolean));
    const suggestions = state.favorites.length
      ? games.filter(game => !state.favorites.includes(game.id) && favoriteGenres.has(game.genre)).slice(0, 3)
      : [];
    if (!suggestions.length) {
      elements.recommended.replaceChildren(makeEmpty(
        state.favorites.length ? 'No similar games in this library yet' : 'Save a favourite to get recommendations',
        state.favorites.length ? 'Browse games' : 'Explore library',
        'go-games'
      ));
      return;
    }
    elements.recommended.replaceChildren(...suggestions.map(game => makeMiniGame(game)));
  }

  function renderPersonal() {
    const favoriteGames = state.favorites.map(gameById).filter(Boolean);
    const wishlistGames = state.wishlist.map(gameById).filter(Boolean);
    const recentGames = state.recentlyViewed.map(gameById).filter(Boolean);
    document.getElementById('myFavoriteCount').textContent = String(favoriteGames.length);
    document.getElementById('wishlistCount').textContent = String(wishlistGames.length);
    document.getElementById('recentCount').textContent = String(recentGames.length);
    elements.myFavorites.replaceChildren(...(favoriteGames.length ? favoriteGames.map(game => makeMiniGame(game, { removeAction: 'remove-favorite' })) : [makeEmpty('No favourites saved yet', 'Browse games', 'go-games')]));
    elements.myWishlist.replaceChildren(...(wishlistGames.length ? wishlistGames.map(game => makeMiniGame(game, { removeAction: 'remove-wishlist' })) : [makeEmpty('Your wishlist is empty', 'Browse games', 'go-games')]));
    elements.recent.replaceChildren(...(recentGames.length ? recentGames.map(game => makeMiniGame(game, { removeAction: 'remove-recent' })) : [makeEmpty('No recently viewed games', 'Browse games', 'go-games')]));
    elements.savedCount.textContent = String(favoriteGames.length);
    renderRecommendations();
  }

  function renderComparison() {
    const selected = state.comparison.map(gameById).filter(Boolean);
    document.querySelectorAll('[data-compare-count]').forEach(element => {
      element.textContent = String(selected.length);
      element.setAttribute('aria-label', `${selected.length} ${selected.length === 1 ? 'game' : 'games'} selected for comparison`);
    });
    elements.compareTray.hidden = !selected.length;
    elements.compareTray.textContent = '';
    if (selected.length) {
      const message = document.createElement('span');
      message.textContent = `${selected.length} selected for comparison`;
      const jump = document.createElement('a');
      jump.href = 'compare.html';
      jump.textContent = 'Open comparison →';
      elements.compareTray.append(message, jump);
    }
    if (selected.length < 2) {
      elements.compareContent.replaceChildren(makeEmpty('Select at least two games to compare', 'Browse games', 'go-games'));
      return;
    }
    const table = document.createElement('table');
    table.className = 'compare-table';
    const head = document.createElement('thead');
    const headRow = document.createElement('tr');
    const labelHead = document.createElement('th');
    labelHead.scope = 'col';
    labelHead.textContent = 'DETAIL';
    headRow.append(labelHead);
    selected.forEach(game => {
      const th = document.createElement('th');
      th.scope = 'col';
      th.textContent = game.title;
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.dataset.action = 'remove-compare';
      remove.dataset.gameId = String(game.id);
      remove.className = 'compare-remove';
      remove.setAttribute('aria-label', `Remove ${game.title} from comparison`);
      remove.textContent = '×';
      th.append(remove);
      headRow.append(th);
    });
    head.append(headRow);
    const body = document.createElement('tbody');
    const rows = [
      ['Genre', game => game.genre],
      ['Release year', game => Number.isFinite(game.year) ? String(game.year) : 'Not available'],
      ['Rating', game => Number.isFinite(game.rating) ? `${game.rating.toFixed(1)} / 5` : 'Not available']
    ];
    if (selected.some(game => Array.isArray(game.platforms) && game.platforms.length)) {
      rows.push(['Platforms', game => Array.isArray(game.platforms) && game.platforms.length ? game.platforms.join(', ') : 'Not available']);
    }
    rows.forEach(([label, valueFor]) => {
      const row = document.createElement('tr');
      const labelCell = document.createElement('th');
      labelCell.scope = 'row';
      labelCell.textContent = label;
      row.append(labelCell);
      const values = selected.map(valueFor);
      const differs = new Set(values).size > 1;
      values.forEach(value => {
        const cell = document.createElement('td');
        cell.textContent = value;
        if (differs) cell.className = 'compare-different';
        row.append(cell);
      });
      body.append(row);
    });
    table.append(head, body);
    elements.compareContent.replaceChildren(table);
  }

  function renderDialogState() {
    if (!state.dialogGame) return;
    const game = state.dialogGame;
    const favorite = state.favorites.includes(game.id);
    const wishlisted = state.wishlist.includes(game.id);
    const favoriteButton = document.getElementById('dialogFavorite');
    favoriteButton.textContent = favorite ? '♥ Saved to favourites' : '♡ Add to favourites';
    favoriteButton.setAttribute('aria-pressed', String(favorite));
    document.getElementById('dialogRating').classList.toggle('unrated', !Number.isFinite(game.rating));
    document.getElementById('dialogWishlist').textContent = wishlisted ? '✓ In wishlist' : '＋ Add to wishlist';
    document.getElementById('dialogWishlist').setAttribute('aria-pressed', String(wishlisted));
    document.getElementById('dialogCompare').textContent = state.comparison.includes(game.id) ? '✓ Comparing' : '＋ Compare';
    document.getElementById('dialogCompare').setAttribute('aria-pressed', String(state.comparison.includes(game.id)));
    document.getElementById('dialogCompare').disabled = !state.comparison.includes(game.id) && state.comparison.length >= 3;
  }

  function renderPurchaseOffers(game) {
    const container = document.getElementById('purchaseOffers');
    const emptyMessage = document.getElementById('purchaseEmpty');
    const candidates = game.purchaseOffers === undefined ? [] : game.purchaseOffers;
    if (!Array.isArray(candidates)) {
      console.warn(`Purchase offers for "${game.title}" must be an array.`);
      container.replaceChildren();
      emptyMessage.hidden = false;
      return;
    }

    const offers = candidates.filter((offer, index) => {
      if (!offer || typeof offer !== 'object' || Array.isArray(offer) || offer.verified !== true ||
          typeof offer.retailer !== 'string' || !offer.retailer.trim() ||
          typeof offer.url !== 'string' || offer.url.trim() !== offer.url ||
          /[\u0000-\u001f\u007f]/.test(offer.url) ||
          !['retailer', 'affiliate'].includes(offer.type) ||
          (offer.type === 'affiliate' && offer.approved !== true)) {
        console.warn(`Ignoring unverified or invalid purchase offer ${index + 1} for "${game.title}".`);
        return false;
      }

      try {
        const destination = new URL(offer.url);
        if (destination.protocol !== 'https:' || !destination.hostname ||
            destination.username || destination.password) {
          console.warn(`Ignoring unsafe purchase URL ${index + 1} for "${game.title}".`);
          return false;
        }
      } catch (error) {
        console.warn(`Ignoring invalid purchase URL ${index + 1} for "${game.title}".`, error);
        return false;
      }
      return true;
    });

    container.replaceChildren(...offers.map(offer => {
      const item = document.createElement('div');
      item.className = 'purchase-offer';
      const link = document.createElement('a');
      link.className = 'purchase-button';
      link.setAttribute('href', offer.url);
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.textContent = `Buy Game · ${offer.retailer.trim()}`;
      const type = document.createElement('span');
      type.className = 'purchase-type';
      type.textContent = offer.type === 'affiliate' ? 'Affiliate link' : 'Retailer link';
      item.append(link, type);

      if (typeof offer.price === 'string' && offer.price.trim()) {
        const price = document.createElement('span');
        price.className = 'purchase-price';
        price.textContent = offer.price.trim();
        item.append(price);
      } else if (offer.price !== undefined) {
        console.warn(`Ignoring invalid price for purchase offer at "${game.title}".`);
      }

      if (typeof offer.availability === 'string' && offer.availability.trim()) {
        const availability = document.createElement('span');
        availability.className = 'purchase-availability';
        availability.textContent = offer.availability.trim();
        item.append(availability);
      } else if (offer.availability !== undefined) {
        console.warn(`Ignoring invalid availability for purchase offer at "${game.title}".`);
      }

      if (offer.type === 'affiliate') {
        const disclosure = document.createElement('p');
        disclosure.className = 'affiliate-disclosure';
        disclosure.textContent = 'We may earn a commission from purchases made through this affiliate link.';
        item.append(disclosure);
      }
      return item;
    }));
    emptyMessage.hidden = offers.length > 0;
  }

  function openDetails(game, opener) {
    if (elements.dialog.open) elements.dialog.close();
    state.dialogGame = game;
    state.dialogOpener = opener || document.activeElement;
    const artwork = document.getElementById('dialogArtwork');
    artwork.loading = 'eager';
    setArtwork(artwork, game);
    document.getElementById('dialogGenre').textContent = game.genre;
    document.getElementById('dialogTitle').textContent = game.title;
    document.getElementById('dialogRating').textContent = Number.isFinite(game.rating)
      ? `★ ${game.rating.toFixed(1)} / 5 · Released ${game.year}`
      : `Released ${game.year}`;
    document.getElementById('dialogDescription').textContent = game.description;
    renderPurchaseOffers(game);
    renderDialogState();
    elements.dialog.showModal();
    addRecentlyViewed(game.id);
    document.getElementById('closeDialog').focus();
  }

  function closeDialog() {
    if (elements.dialog.open) elements.dialog.close();
  }

  function toggleComparison(id) {
    const focusTarget = captureCardActionFocus();
    const current = readIdList(storageKeys.comparison);
    if (!current.includes(id) && current.length >= 3) {
      announce('Compare up to three games at a time.');
      return;
    }
    const next = current.includes(id) ? current.filter(item => item !== id) : [...current, id];
    if (!writeIdList(storageKeys.comparison, next)) return;
    state.comparison = next;
    announce(current.includes(id) ? 'Removed from comparison.' : 'Added to comparison.');
    renderComparison();
    renderGames();
    renderStaticDiscovery();
    renderDialogState();
    restoreCardActionFocus(focusTarget);
  }

  function handleCardAction(event) {
    const button = event.target.closest('[data-action]');
    if (button?.dataset.action === 'go-games') {
      document.getElementById('games').scrollIntoView({ behavior: scrollBehavior() });
      return;
    }
    const card = event.target.closest('[data-game-id]');
    if (!card) return;
    const id = Number(button?.dataset.gameId || card.dataset.gameId);
    const game = gameById(id);
    if (button) {
      event.stopPropagation();
      if (button.dataset.action === 'favorite') setFavorite(id);
      else if (button.dataset.action === 'wishlist') setWishlist(id);
      else if (button.dataset.action === 'details') openDetails(game, button);
      else if (button.dataset.action === 'compare') toggleComparison(id);
      else if (button.dataset.action === 'remove-favorite') setFavorite(id);
      else if (button.dataset.action === 'remove-wishlist') setWishlist(id);
      else if (button.dataset.action === 'remove-recent') removeRecentlyViewed(id);
      else if (button.dataset.action === 'remove-compare') toggleComparison(id);
      return;
    }
    if (game) window.location.href = `game.html?id=${encodeURIComponent(game.id)}`;
  }

  function setGenre(genre) {
    state.genre = genre;
    renderGames();
    document.getElementById('games').scrollIntoView({ behavior: scrollBehavior() });
  }

  function clearFilters() {
    elements.search.value = '';
    state.genre = 'all';
    state.favoritesOnly = false;
    elements.sort.value = 'rating-desc';
    elements.year.value = 'all';
    elements.rating.value = '0';
    renderGames();
  }

  function renderAll() {
    renderGames();
    renderStaticDiscovery();
    renderPersonal();
    renderComparison();
    updateFeatured();
    renderDialogState();
  }

  elements.search.addEventListener('input', renderGames);
  elements.clearSearch.addEventListener('click', () => {
    elements.search.value = '';
    renderGames();
    elements.search.focus();
  });
  elements.sort.addEventListener('change', renderGames);
  elements.year.addEventListener('change', renderGames);
  elements.rating.addEventListener('change', renderGames);
  elements.favoritesFilter.addEventListener('click', () => {
    state.favoritesOnly = !state.favoritesOnly;
    renderGames();
  });
  document.getElementById('clearFilters').addEventListener('click', clearFilters);
  elements.genreFilters.addEventListener('click', event => {
    const button = event.target.closest('[data-genre-value]');
    if (button) setGenre(button.dataset.genreValue);
  });
  elements.genreBrowser.addEventListener('click', event => {
    const button = event.target.closest('[data-genre-value]');
    if (button) setGenre(button.dataset.genreValue);
  });
  [elements.gameCards, elements.trendingCards, elements.newReleases, elements.topRated, elements.recommended, elements.myFavorites, elements.myWishlist, elements.recent].forEach(container => {
    container.addEventListener('click', handleCardAction);
    container.addEventListener('keydown', event => {
      if ((event.key === 'Enter' || event.key === ' ') && event.target.matches('.game-card')) {
        event.preventDefault();
        window.location.href = `game.html?id=${encodeURIComponent(event.target.dataset.gameId)}`;
      }
    });
  });
  elements.gameCards.addEventListener('click', event => {
    const action = event.target.closest('[data-action]');
    if (action?.dataset.action === 'clear-filters') clearFilters();
  });
  document.getElementById('clearComparison').addEventListener('click', () => {
    if (!writeIdList(storageKeys.comparison, [])) return;
    state.comparison = [];
    renderComparison();
    renderGames();
    renderStaticDiscovery();
  });
  document.getElementById('clearRecent').addEventListener('click', clearRecentlyViewed);
  elements.compareContent.addEventListener('click', event => {
    const remove = event.target.closest('[data-action="remove-compare"]');
    if (remove) toggleComparison(Number(remove.dataset.gameId));
    const goGames = event.target.closest('[data-action="go-games"]');
    if (goGames) document.getElementById('games').scrollIntoView({ behavior: scrollBehavior() });
  });

  document.getElementById('exploreFeatured').addEventListener('click', event => {
    openDetails(featuredGames[state.featuredIndex], event.currentTarget);
  });
  document.getElementById('saveFeatured').addEventListener('click', () => {
    const game = featuredGames[state.featuredIndex];
    if (game) setFavorite(game.id);
  });
  function selectFeatured(index) {
    if (!featuredGames.length) return;
    state.heroRemaining = featuredRotationDelay;
    state.heroDeadline = 0;
    state.heroRequest += 1;
    clearFeaturedTimer();
    showFeatured((index + featuredGames.length) % featuredGames.length).finally(() => {
      state.heroRemaining = featuredRotationDelay;
      scheduleFeaturedRotation();
    });
  }
  document.getElementById('previousFeatured').addEventListener('click', () => {
    selectFeatured(state.featuredIndex - 1);
  });
  document.getElementById('nextFeatured').addEventListener('click', () => {
    selectFeatured(state.featuredIndex + 1);
  });
  elements.heroDots.addEventListener('click', event => {
    const dot = event.target.closest('[data-featured-index]');
    if (dot) selectFeatured(Number(dot.dataset.featuredIndex));
  });
  elements.heroRotationToggle.addEventListener('click', () => {
    state.heroPausedByUser = !state.heroPausedByUser;
    updateFeaturedRotationState();
  });
  const hero = document.querySelector('.featured-hero');
  hero.addEventListener('pointerenter', () => {
    state.heroPointerInside = true;
    updateFeaturedRotationState();
  });
  hero.addEventListener('pointerleave', () => {
    state.heroPointerInside = false;
    updateFeaturedRotationState();
  });
  hero.addEventListener('focusin', () => {
    state.heroFocusInside = true;
    updateFeaturedRotationState();
  });
  hero.addEventListener('focusout', event => {
    if (hero.contains(event.relatedTarget)) return;
    state.heroFocusInside = false;
    updateFeaturedRotationState();
  });
  document.addEventListener('visibilitychange', updateFeaturedRotationState);
  if (typeof reducedMotion.addEventListener === 'function') {
    reducedMotion.addEventListener('change', updateFeaturedRotationState);
  } else {
    reducedMotion.addListener(updateFeaturedRotationState);
  }
  document.getElementById('dialogFavorite').addEventListener('click', () => {
    if (state.dialogGame) setFavorite(state.dialogGame.id);
  });
  document.getElementById('dialogWishlist').addEventListener('click', () => {
    if (state.dialogGame) setWishlist(state.dialogGame.id);
  });
  document.getElementById('dialogCompare').addEventListener('click', () => {
    if (state.dialogGame) toggleComparison(state.dialogGame.id);
  });
  document.getElementById('closeDialog').addEventListener('click', closeDialog);
  elements.dialog.addEventListener('click', event => {
    if (event.target === elements.dialog) closeDialog();
  });
  elements.dialog.addEventListener('keydown', event => {
    if (event.key === 'Escape' && elements.dialog.open) {
      event.preventDefault();
      closeDialog();
    }
    if (event.key !== 'Tab') return;
    const focusable = [...elements.dialog.querySelectorAll('button:not([disabled]), a[href]')];
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });
  elements.dialog.addEventListener('close', () => {
    const gameId = state.dialogGame?.id;
    state.dialogGame = null;
    const opener = state.dialogOpener;
    state.dialogOpener = null;
    if (opener?.isConnected) {
      opener.focus();
      return;
    }
    const replacement = gameId
      ? document.querySelector(`#games [data-game-id="${gameId}"]`)
      : null;
    if (replacement) replacement.focus();
    else elements.search.focus();
  });

  document.querySelectorAll('[data-view]').forEach(button => {
    button.addEventListener('click', () => {
      state.view = button.dataset.view;
      try {
        localStorage.setItem(storageKeys.view, state.view);
      } catch (error) {
        console.warn('Could not store the preferred library view.', error);
      }
      renderGames();
    });
  });
  document.querySelectorAll('[data-sort-link]').forEach(link => {
    link.addEventListener('click', () => {
      elements.sort.value = link.dataset.sortLink === 'rating' ? 'rating-desc' : elements.sort.value;
      renderGames();
    });
  });

  elements.menuToggle.addEventListener('click', () => {
    const open = elements.menuToggle.getAttribute('aria-expanded') !== 'true';
    elements.menuToggle.setAttribute('aria-expanded', String(open));
    elements.menuToggle.setAttribute('aria-label', open ? 'Close navigation' : 'Open navigation');
    elements.nav.classList.toggle('open', open);
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && elements.menuToggle.getAttribute('aria-expanded') === 'true') {
      elements.nav.classList.remove('open');
      elements.menuToggle.setAttribute('aria-expanded', 'false');
      elements.menuToggle.setAttribute('aria-label', 'Open navigation');
      elements.menuToggle.focus();
    }
  });
  elements.nav.addEventListener('click', event => {
    if (event.target.closest('a')) {
      elements.nav.classList.remove('open');
      elements.menuToggle.setAttribute('aria-expanded', 'false');
      elements.menuToggle.setAttribute('aria-label', 'Open navigation');
    }
  });

  const navLinks = [...elements.nav.querySelectorAll('a')];
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        const link = navLinks.find(item => item.hash === `#${entry.target.id}`);
        if (!link) return;
        navLinks.forEach(item => item.classList.toggle('active', item === link));
      });
    }, { rootMargin: '-20% 0px -65% 0px' });
    ['discover', 'trending', 'topRated', 'games', 'myGames'].forEach(id => {
      const section = document.getElementById(id);
      if (section) observer.observe(section);
    });
  }

  document.getElementById('currentYear').textContent = String(new Date().getFullYear());
  renderGenreControls();
  elements.gameCards.classList.toggle('list-view', state.view === 'list');
  renderAll();
  initializeFeaturedCarousel();
});
