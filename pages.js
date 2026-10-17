document.addEventListener('DOMContentLoaded', () => {
  const games = window.NexusGaming.games;
  const page = document.body.dataset.page;
  const favoriteKey = 'favorites';
  const recentKey = 'nexus.recent.v1';
  const comparisonKey = 'nexus.compare.v1';
  const wishlistKey = 'nexus.wishlist.v1';
  const viewKey = 'nexus.view.v1';
  const personalKey = 'nexus.library.v1';
  const personalRecoveryKey = 'nexus.library.recovery.v1';
  const comparisonLimit = 4;
  const personalStatuses = [
    ['wishlist', 'Wishlist'],
    ['want-to-play', 'Want to Play'],
    ['playing', 'Currently Playing'],
    ['completed', 'Completed'],
    ['abandoned', 'Abandoned']
  ];
  const validIds = new Set(games.map(game => game.id));
  const byId = id => games.find(game => game.id === id);
  const queryParams = new URLSearchParams(window.location.search);
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let libraryApplyFilters = null;
  let libraryFavoritesOnly = false;
  let personalDataInvalid = false;
  let personalDataWarningShown = false;

  function safeRead(key) {
    try {
      return localStorage.getItem(key);
    } catch (error) {
      console.warn(`Could not read local setting "${key}".`, error);
      return null;
    }
  }

  function readIds(key) {
    try {
      const parsed = JSON.parse(localStorage.getItem(key) || '[]');
      if (!Array.isArray(parsed)) return [];
      return [...new Set(parsed.filter(id => Number.isInteger(id) && validIds.has(id)))];
    } catch (error) {
      console.warn(`Stored list "${key}" could not be read; keeping it unchanged.`, error);
      return [];
    }
  }

  function readComparisonIds() {
    return readIds(comparisonKey).slice(0, comparisonLimit);
  }

  function writeIds(key, ids) {
    try {
      localStorage.setItem(key, JSON.stringify([...new Set(ids.filter(id => validIds.has(id)))]));
      return true;
    } catch (error) {
      console.error(`Could not save "${key}" in this browser.`, error);
      announce('Your change could not be saved in this browser.');
      return false;
    }
  }

  function readPersonalEntries() {
    try {
      const raw = localStorage.getItem(personalKey);
      if (raw === null) {
        personalDataInvalid = false;
        return [];
      }
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) {
        personalDataInvalid = true;
        warnPersonalData();
        return [];
      }
      const seen = new Set();
      const entries = parsed.filter(entry => {
        if (!entry || typeof entry !== 'object' || !Number.isInteger(entry.id) ||
            !validIds.has(entry.id) || seen.has(entry.id) ||
            !personalStatuses.some(([status]) => status === entry.status) ||
            (entry.rating !== null && (!Number.isInteger(entry.rating) || entry.rating < 1 || entry.rating > 5)) ||
            typeof entry.note !== 'string' || entry.note.length > 500) return false;
        seen.add(entry.id);
        return true;
      }).map(entry => ({
        id: entry.id,
        status: entry.status,
        rating: entry.rating,
        note: entry.note
      }));
      personalDataInvalid = entries.length !== parsed.length;
      if (personalDataInvalid) warnPersonalData();
      return entries;
    } catch (error) {
      console.warn(`Stored personal library "${personalKey}" could not be read; keeping it unchanged.`, error);
      personalDataInvalid = true;
      warnPersonalData();
      return [];
    }
  }

  function warnPersonalData() {
    if (personalDataWarningShown) return;
    personalDataWarningShown = true;
    announce('Saved personal-library data is malformed and has been left untouched. Export it for safekeeping or import a valid backup to recover.');
  }

  function storedIdListIsValid(key, limit = games.length) {
    const raw = safeRead(key);
    if (raw === null) return true;
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) && parsed.length <= limit &&
      parsed.every(id => Number.isInteger(id) && validIds.has(id));
    } catch (error) {
      console.warn(`Stored list "${key}" is malformed and cannot be safely merged.`, error);
      return false;
    }
  }

  function announce(message) {
    const toast = document.getElementById('toastRegion');
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add('visible');
    window.clearTimeout(announce.timer);
    announce.timer = window.setTimeout(() => {
      toast.classList.remove('visible');
      toast.textContent = '';
    }, 2600);
  }

  function imageUrl(game) {
    return new URL(game.artworkPath || `${game.appId}/header.jpg`,
      'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/').href;
  }

  function makeArtwork(game, className, loading = 'lazy') {
    const image = document.createElement('img');
    image.className = className;
    image.src = imageUrl(game);
    image.alt = game.alt || `${game.title} artwork`;
    image.loading = loading;
    image.decoding = 'async';
    image.addEventListener('error', () => {
      image.hidden = true;
    }, { once: true });
    return image;
  }

  function makeCard(game, options = {}) {
    const article = document.createElement('article');
    article.className = 'game-card';
    article.dataset.gameId = String(game.id);
    const link = document.createElement('a');
    link.className = 'page-card-link';
    link.href = `game.html?id=${encodeURIComponent(game.id)}`;
    link.setAttribute('aria-label', `View details for ${game.title}`);
    const cover = document.createElement('div');
    cover.className = 'game-cover';
    cover.append(makeArtwork(game, 'card-art'));
    const content = document.createElement('div');
    content.className = 'card-content';
    const genre = document.createElement('span');
    genre.className = 'game-genre';
    genre.textContent = game.genre;
    const title = document.createElement('h3');
    title.textContent = game.title;
    const meta = document.createElement('div');
    meta.className = 'card-meta';
    if (Number.isFinite(game.year)) {
      const year = document.createElement('span');
      year.textContent = String(game.year);
      meta.append(year);
    }
    if (Number.isFinite(game.rating)) {
      const rating = document.createElement('span');
      rating.className = 'game-rating';
      rating.textContent = `★ ${game.rating.toFixed(1)} / 5`;
      meta.append(rating);
    }
    content.append(genre, title, meta);
    link.append(cover, content);

    const actions = document.createElement('div');
    actions.className = 'card-actions';
    const isFavorite = readIds(favoriteKey).includes(game.id);
    const favorite = document.createElement('button');
    favorite.className = 'favorite-btn';
    favorite.type = 'button';
    favorite.dataset.action = options.removeFavorite ? 'remove-favorite' : 'favorite';
    favorite.dataset.gameId = String(game.id);
    favorite.setAttribute('aria-pressed', String(isFavorite));
    favorite.setAttribute('aria-label', `${isFavorite ? 'Remove' : 'Add'} ${game.title} ${isFavorite ? 'from' : 'to'} favourites`);
    favorite.textContent = isFavorite ? '♥ Saved' : '♡ Favourite';
    actions.append(favorite);
    const comparison = document.createElement('button');
    comparison.className = 'details-button compare-card-button';
    comparison.type = 'button';
    comparison.dataset.action = 'compare-toggle';
    comparison.dataset.gameId = String(game.id);
    const isCompared = readComparisonIds().includes(game.id);
    comparison.setAttribute('aria-pressed', String(isCompared));
    comparison.setAttribute('aria-label', `${isCompared ? 'Remove' : 'Add'} ${game.title} ${isCompared ? 'from' : 'to'} comparison`);
    comparison.textContent = isCompared ? '✓ Compare' : '＋ Compare';
    comparison.disabled = !isCompared && readComparisonIds().length >= comparisonLimit;
    actions.append(comparison);
    if (options.removeRecent) {
      const remove = document.createElement('button');
      remove.className = 'details-button';
      remove.type = 'button';
      remove.dataset.action = 'remove-recent';
      remove.dataset.gameId = String(game.id);
      remove.setAttribute('aria-label', `Remove ${game.title} from recently viewed`);
      remove.textContent = 'Remove';
      actions.append(remove);
    }
    article.append(link, actions);
    return article;
  }

  function validOffers(game) {
    const offers = game.purchaseOffers === undefined ? [] : game.purchaseOffers;
    if (!Array.isArray(offers)) {
      console.warn(`Purchase offers for "${game.title}" must be an array.`);
      return [];
    }
    return offers.filter((offer, index) => {
      if (!offer || typeof offer !== 'object' || Array.isArray(offer) ||
          offer.verified !== true || typeof offer.retailer !== 'string' ||
          !offer.retailer.trim() || typeof offer.url !== 'string' ||
          offer.url.trim() !== offer.url || /[\u0000-\u001f\u007f]/.test(offer.url) ||
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
  }

  function renderOffers(container, game) {
    const offers = validOffers(game);
    container.replaceChildren();
    if (!offers.length) {
      const empty = document.createElement('p');
      empty.className = 'purchase-empty';
      empty.textContent = 'Offers coming soon. No verified retailer offers are configured for this game.';
      container.append(empty);
      return 0;
    }
    offers.forEach(offer => {
      const item = document.createElement('article');
      item.className = 'purchase-offer';
      const link = document.createElement('a');
      link.className = 'purchase-button';
      link.href = offer.url;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.textContent = `Visit ${offer.retailer.trim()}`;
      item.append(link);
      const type = document.createElement('span');
      type.className = 'purchase-type';
      type.textContent = offer.type === 'affiliate' ? 'Affiliate link' : 'Retailer link';
      item.append(type);
      if (typeof offer.price === 'string' && offer.price.trim()) {
        const price = document.createElement('strong');
        price.className = 'purchase-price';
        price.textContent = offer.price.trim();
        item.append(price);
      }
      if (typeof offer.availability === 'string' && offer.availability.trim()) {
        const availability = document.createElement('span');
        availability.className = 'purchase-availability';
        availability.textContent = offer.availability.trim();
        item.append(availability);
      }
      if (offer.type === 'affiliate') {
        const disclosure = document.createElement('p');
        disclosure.className = 'affiliate-disclosure';
        disclosure.textContent = offer.commission === true
          ? 'We may earn a commission from purchases made through this affiliate link.'
          : 'Affiliate link. Commission eligibility is not confirmed.';
        item.append(disclosure);
      }
      container.append(item);
    });
    return offers.length;
  }

  function updateFavoriteCount() {
    const count = readIds(favoriteKey).length;
    document.querySelectorAll('[data-favorite-count]').forEach(element => {
      element.textContent = String(count);
    });
  }

  function updateComparisonCount() {
    const count = readComparisonIds().length;
    document.querySelectorAll('[data-compare-count]').forEach(element => {
      element.textContent = String(count);
      element.setAttribute('aria-label', `${count} ${count === 1 ? 'game' : 'games'} selected for comparison`);
    });
  }

  function updateComparisonButtons() {
    const selected = new Set(readComparisonIds());
    document.querySelectorAll('[data-action="compare-toggle"]').forEach(button => {
      const id = Number(button.dataset.gameId);
      const isSelected = selected.has(id);
      button.textContent = isSelected ? '✓ Compare' : '＋ Compare';
      button.setAttribute('aria-pressed', String(isSelected));
      button.setAttribute('aria-label', `${isSelected ? 'Remove' : 'Add'} ${byId(id)?.title || 'game'} ${isSelected ? 'from' : 'to'} comparison`);
      button.disabled = !isSelected && selected.size >= comparisonLimit;
    });
  }

  function toggleComparison(id) {
    const current = readComparisonIds();
    if (!validIds.has(id)) {
      announce('That game is not in the current catalog.');
      return;
    }
    if (!current.includes(id) && current.length >= comparisonLimit) {
      announce(`Compare up to ${comparisonLimit} games at a time.`);
      return;
    }
    const next = current.includes(id) ? current.filter(item => item !== id) : [...current, id];
    if (!writeIds(comparisonKey, next)) return;
    updateComparisonCount();
    updateComparisonButtons();
    if (page === 'compare') renderComparisonPage();
    if (page === 'game') updateDetailComparison(id);
    announce(current.includes(id) ? 'Removed from comparison.' : 'Added to comparison.');
  }

  function addRecent(id) {
    const next = [id, ...readIds(recentKey).filter(item => item !== id)].slice(0, 12);
    writeIds(recentKey, next);
  }

  function updateUrl(values, push = false) {
    const params = new URLSearchParams(window.location.search);
    Object.entries(values).forEach(([key, value]) => {
      if (value === '' || value === 'all' || value === '0') params.delete(key);
      else params.set(key, value);
    });
    const search = params.toString();
    const url = `${window.location.pathname}${search ? `?${search}` : ''}${window.location.hash}`;
    if (push) history.pushState(null, '', url);
    else history.replaceState(null, '', url);
  }

  function renderGenres() {
    const container = document.getElementById('genreTiles');
    if (!container) return;
    const search = document.getElementById('genreSearch');
    const sort = document.getElementById('genreSort');
    const countLabel = document.getElementById('genreCount');
    const clear = document.getElementById('clearGenreSearch');
    const genres = [...new Set(games.map(game => game.genre))].map(genre => ({
      name: genre,
      games: games.filter(game => game.genre === genre)
    }));
    const render = () => {
      const term = search.value.trim().toLocaleLowerCase();
      const visible = genres
        .filter(genre => genre.name.toLocaleLowerCase().includes(term))
        .sort((first, second) => {
          if (sort.value === 'count-desc') return second.games.length - first.games.length || first.name.localeCompare(second.name);
          if (sort.value === 'count-asc') return first.games.length - second.games.length || first.name.localeCompare(second.name);
          return first.name.localeCompare(second.name);
        });
      container.replaceChildren(...(visible.length ? visible.map(genre => {
        const { name, games: genreGames } = genre;
        const game = genreGames[0];
        const link = document.createElement('a');
        link.className = 'genre-tile page-genre-tile';
        link.href = `games.html?genre=${encodeURIComponent(name)}`;
        link.setAttribute('aria-label', `Explore ${name}, ${genreGames.length} ${genreGames.length === 1 ? 'game' : 'games'}`);
        const artworkFrame = document.createElement('span');
        artworkFrame.className = 'page-genre-artwork';
        artworkFrame.setAttribute('aria-hidden', 'true');
        const artwork = makeArtwork(game, 'genre-art');
        artwork.alt = '';
        artworkFrame.append(artwork);
        const content = document.createElement('span');
        content.className = 'page-genre-content';
        const copy = document.createElement('span');
        copy.className = 'page-genre-copy';
        const title = document.createElement('span');
        title.className = 'page-genre-name';
        title.textContent = name;
        const total = document.createElement('span');
        total.className = 'genre-count';
        total.textContent = `${genreGames.length} ${genreGames.length === 1 ? 'game' : 'games'}`;
        copy.append(title, total);
        const action = document.createElement('span');
        action.className = 'page-genre-action';
        action.setAttribute('aria-hidden', 'true');
        action.textContent = 'Explore ↗';
        content.append(copy, action);
        link.append(artworkFrame, content);
        return link;
      }) : [makeEmpty('No genres match your search', 'Clear search', 'clear-genres', 'Try another genre name.')]));
      countLabel.textContent = `${visible.length} ${visible.length === 1 ? 'genre' : 'genres'}`;
      clear.hidden = !search.value;
    };
    search.addEventListener('input', render);
    sort.addEventListener('change', render);
    clear.addEventListener('click', () => {
      search.value = '';
      sort.value = 'name-asc';
      render();
      search.focus();
    });
    render();
  }

  function renderFreeGames() {
    const games = [
      {
        title: 'Brawlhalla',
        genre: 'Platform fighter',
        access: 'Free-to-play · confirmed by official site',
        verifiedFree: true,
        website: 'https://www.brawlhalla.com/',
        artwork: 'https://www.brawlhalla.com/img/Logo_BrawlhallaHammer.png',
        alt: 'Brawlhalla official game logo artwork'
      },
      {
        title: "Tom Clancy's Rainbow Six Siege",
        genre: '',
        access: 'Free-access status needs verification',
        verifiedFree: false,
        website: 'https://www.ubisoft.com/en-us/game/rainbow-six/siege',
        artwork: 'https://staticctf.ubisoft.com/J3yJr34U2pZ2Ieem48Dwy9uqj5PNUQTn/4IZecJyhvcIUxxu0Rd1vjX/99fe1a724d46a4d9ca70c76c7a78496f/r6s-homepage-meta__1_.jpg',
        alt: "Tom Clancy's Rainbow Six Siege official key art"
      },
      {
        title: 'Roller Champions',
        genre: 'Sports',
        access: 'Free-to-play · confirmed by official site',
        verifiedFree: true,
        website: 'https://www.ubisoft.com/en-us/games/roller-champions',
        artwork: 'https://staticctf.ubisoft.com/J3yJr34U2pZ2Ieem48Dwy9uqj5PNUQTn/5tNmP0Ssg2BMbjZ2ppMvuA/ebd2b09fe1dd64c886a5332b257d0415/5cf15f4f39798c0870c076e7-5.jpg',
        alt: 'Roller Champions official game artwork'
      },
      {
        title: 'Trackmania Starter Access',
        genre: 'Racing',
        access: 'Free-to-play · confirmed by official site',
        verifiedFree: true,
        website: 'https://www.ubisoft.com/en-gb/games/trackmania',
        artwork: 'https://staticctf.ubisoft.com/J3yJr34U2pZ2Ieem48Dwy9uqj5PNUQTn/V1ppi7x8Z4zUk58NnKIrs/fe593cc06d7139b9ad181ef061c43100/5e8b58345cdf9a12c868c878-1.jpg',
        alt: 'Trackmania official racing game artwork'
      },
      {
        title: 'The Division Resurgence',
        genre: '',
        access: 'Free-access status needs verification',
        verifiedFree: false,
        website: 'https://www.ubisoft.com/en-us/game/the-division/resurgence',
        artwork: 'https://staticctf.ubisoft.com/J3yJr34U2pZ2Ieem48Dwy9uqj5PNUQTn/5EScWLoHhqf8Hj6Lel529F/74d8275a5590a382d4f70df3d5cd08c9/The_Division_Resurgence_Thumbnail_FINAL.jpg',
        alt: 'The Division Resurgence official game artwork'
      }
    ];
    const container = document.getElementById('freeGamesCards');
    const search = document.getElementById('freeGamesSearch');
    const genre = document.getElementById('freeGamesGenre');
    const count = document.getElementById('freeGamesCount');
    const empty = document.getElementById('freeGamesEmpty');
    const filters = document.getElementById('freeGamesFilters');
    if (!container || !search || !genre || !count || !empty || !filters) return;

    [...new Set(games.map(game => game.genre).filter(Boolean))].sort().forEach(value => {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = value;
      genre.append(option);
    });

    const render = () => {
      const term = search.value.trim().toLocaleLowerCase();
      const selectedGenre = genre.value;
      const matching = games.filter(game =>
        (selectedGenre === 'all' || game.genre === selectedGenre) &&
        (!term || `${game.title} ${game.genre} ${game.access}`.toLocaleLowerCase().includes(term)));
      container.replaceChildren();
      matching.forEach(game => {
        const card = document.createElement('article');
        card.className = 'free-game-card';
        const art = document.createElement('div');
        art.className = 'free-game-art';
        const image = document.createElement('img');
        image.src = game.artwork;
        image.alt = game.alt;
        image.loading = 'lazy';
        image.decoding = 'async';
        image.addEventListener('error', () => {
          image.hidden = true;
        }, { once: true });
        art.append(image);

        const content = document.createElement('div');
        content.className = 'free-game-content';
        const access = document.createElement('p');
        access.className = game.verifiedFree ? 'free-game-status' : 'free-game-status needs-verification';
        access.textContent = game.access;
        const title = document.createElement('h2');
        title.textContent = game.title;
        const genreLine = document.createElement('p');
        genreLine.className = 'free-game-genre';
        genreLine.textContent = game.genre ? `Genre · ${game.genre}` : 'Genre · Not verified';
        const website = document.createElement('a');
        website.className = 'details-button free-game-link';
        website.href = game.website;
        website.target = '_blank';
        website.rel = 'noopener noreferrer';
        website.textContent = 'Official Website';
        content.append(access, title, genreLine, website);
        card.append(art, content);
        container.append(card);
      });
      count.textContent = `Showing ${matching.length} of ${games.length} games`;
      empty.hidden = matching.length > 0;
    };

    search.addEventListener('input', render);
    genre.addEventListener('change', render);
    filters.addEventListener('submit', event => event.preventDefault());
    document.getElementById('clearFreeGamesFilters').addEventListener('click', () => {
      search.value = '';
      genre.value = 'all';
      render();
      search.focus();
    });
    render();
  }

  function renderLibrary() {
    const cards = document.getElementById('libraryCards');
    const search = document.getElementById('librarySearch');
    const genreSelect = document.getElementById('libraryGenre');
    const sort = document.getElementById('librarySort');
    const rating = document.getElementById('libraryRating');
    const year = document.getElementById('libraryYear');
    const platform = document.getElementById('libraryPlatform');
    const count = document.getElementById('libraryCount');
    if (!cards || !search || !genreSelect || !sort || !rating || !count) return;

    const genres = [...new Set(games.map(game => game.genre))].sort((a, b) => a.localeCompare(b));
    genreSelect.replaceChildren(new Option('All genres', 'all'), ...genres.map(item => new Option(item, item)));
    const years = [...new Set(games.map(game => game.year).filter(Number.isFinite))].sort((a, b) => b - a);
    year.replaceChildren(new Option('All years', 'all'), ...years.map(item => new Option(String(item), String(item))));
    const platforms = [...new Set(games.flatMap(game => Array.isArray(game.platforms) ? game.platforms : []))]
      .filter(item => typeof item === 'string' && item.trim())
      .sort((a, b) => a.localeCompare(b));
    platform.replaceChildren(new Option('All platforms', 'all'), ...platforms.map(item => new Option(item, item)));
    platform.closest('label').hidden = platforms.length === 0;
    const params = new URLSearchParams(window.location.search);
    const requestedGenre = params.get('genre') || 'all';
    const genre = genres.includes(requestedGenre) ? requestedGenre : 'all';
    search.value = params.get('q') || '';
    genreSelect.value = genre;
    year.value = years.includes(Number(params.get('year'))) ? params.get('year') : 'all';
    platform.value = platforms.includes(params.get('platform')) ? params.get('platform') : 'all';
    sort.value = ['title-asc', 'title-desc', 'year-asc', 'year-desc', 'rating-desc'].includes(params.get('sort'))
      ? params.get('sort')
      : 'rating-desc';
    rating.value = ['0', '4.5', '4.8'].includes(params.get('rating')) ? params.get('rating') : '0';

    const applyFilters = (sync = true) => {
      const term = search.value.trim().toLocaleLowerCase();
      const minimum = Number(rating.value);
      const favoriteIds = libraryFavoritesOnly ? new Set(readIds(favoriteKey)) : null;
      let results = games.filter(game => {
        const searchable = [game.title, game.genre, game.description, game.year]
          .filter(value => value !== undefined && value !== null)
          .join(' ')
          .toLocaleLowerCase();
        return (!term || searchable.includes(term)) &&
          (genreSelect.value === 'all' || game.genre === genreSelect.value) &&
          (year.value === 'all' || game.year === Number(year.value)) &&
          (platform.value === 'all' || (Array.isArray(game.platforms) && game.platforms.includes(platform.value))) &&
          (minimum === 0 || (Number.isFinite(game.rating) && game.rating >= minimum)) &&
          (!favoriteIds || favoriteIds.has(game.id));
      });
      results = [...results].sort((a, b) => {
        if (sort.value === 'title-asc') return a.title.localeCompare(b.title);
        if (sort.value === 'title-desc') return b.title.localeCompare(a.title);
        if (sort.value === 'year-asc' || sort.value === 'year-desc') {
          const direction = sort.value === 'year-asc' ? 1 : -1;
          const missing = !Number.isFinite(a.year) || !Number.isFinite(b.year);
          if (missing && Number.isFinite(a.year) !== Number.isFinite(b.year)) return Number.isFinite(a.year) ? -1 : 1;
          return missing ? a.title.localeCompare(b.title) : direction * (a.year - b.year) || a.title.localeCompare(b.title);
        }
        if (Number.isFinite(a.rating) !== Number.isFinite(b.rating)) return Number.isFinite(a.rating) ? -1 : 1;
        return (Number.isFinite(b.rating) ? b.rating - a.rating : 0) || a.title.localeCompare(b.title);
      });
      cards.replaceChildren(...(results.length
        ? results.map(game => makeCard(game))
        : [makeEmpty('No games match these filters', 'Clear filters', 'clear-library')]));
      cards.classList.toggle('list-view', safeRead(viewKey) === 'list');
      count.textContent = `${results.length} of ${games.length} ${results.length === 1 ? 'game' : 'games'}${libraryFavoritesOnly ? ' · favourites' : ''}`;
      const active = [];
      if (search.value.trim()) active.push(`Search: “${search.value.trim()}”`);
      if (genreSelect.value !== 'all') active.push(`Genre: ${genreSelect.value}`);
      if (year.value !== 'all') active.push(`Year: ${year.value}`);
      if (platform.value !== 'all') active.push(`Platform: ${platform.value}`);
      if (rating.value !== '0') active.push(`Rating: ${rating.value}+`);
      document.getElementById('activeLibraryFilters').textContent = active.length
        ? `Active filters: ${active.join(' · ')}`
        : 'No active filters';
      if (sync) updateUrl({
        q: search.value.trim(),
        genre: genreSelect.value,
        year: year.value,
        platform: platform.value,
        sort: sort.value === 'rating-desc' ? '' : sort.value,
        rating: rating.value
      });
    };
    search.addEventListener('input', () => applyFilters());
    genreSelect.addEventListener('change', () => applyFilters(true));
    year.addEventListener('change', () => applyFilters(true));
    platform.addEventListener('change', () => applyFilters(true));
    sort.addEventListener('change', () => applyFilters(true));
    rating.addEventListener('change', () => applyFilters(true));
    document.getElementById('clearLibraryFilters')?.addEventListener('click', () => {
      search.value = '';
      genreSelect.value = 'all';
      year.value = 'all';
      platform.value = 'all';
      sort.value = 'rating-desc';
      rating.value = '0';
      updateUrl({ q: '', genre: '', year: '', platform: '', sort: '', rating: '' });
      applyFilters(false);
    });
    document.getElementById('favoritesOnly')?.addEventListener('click', event => {
      libraryFavoritesOnly = !libraryFavoritesOnly;
      event.currentTarget.setAttribute('aria-pressed', String(libraryFavoritesOnly));
      applyFilters(false);
    });
    document.querySelectorAll('[data-library-view]').forEach(button => {
      button.setAttribute('aria-pressed', String(button.dataset.libraryView === (safeRead(viewKey) === 'list' ? 'list' : 'grid')));
      button.addEventListener('click', () => {
        const nextView = button.dataset.libraryView === 'list' ? 'list' : 'grid';
        try {
          localStorage.setItem(viewKey, nextView);
        } catch (error) {
          console.warn(`Could not persist "${viewKey}".`, error);
        }
        document.querySelectorAll('[data-library-view]').forEach(item => {
          item.setAttribute('aria-pressed', String(item === button));
        });
        cards.classList.toggle('list-view', nextView === 'list');
      });
    });
    window.addEventListener('popstate', () => window.location.reload());
    libraryApplyFilters = applyFilters;
    applyFilters(false);
  }

  function makeEmpty(titleText, actionText, actionName, helpText = 'Try a different search or clear your filters.') {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    const title = document.createElement('h2');
    title.textContent = titleText;
    const message = document.createElement('p');
    message.textContent = helpText;
    empty.append(title, message);
    if (actionText) {
      const button = document.createElement('button');
      button.className = 'clear-filters';
      button.type = 'button';
      button.dataset.action = actionName;
      button.textContent = actionText;
      empty.append(button);
    }
    return empty;
  }

  function filterPersonalGames(list) {
    const term = (document.getElementById('personalLibrarySearch')?.value || '').trim().toLocaleLowerCase();
    const sort = document.getElementById('personalLibrarySort')?.value || 'saved';
    const entries = new Map(readPersonalEntries().map(entry => [entry.id, entry]));
    const filtered = list.filter(game => !term ||
      [game.title, game.genre, game.description, entries.get(game.id)?.note || '']
        .join(' ').toLocaleLowerCase().includes(term));
    if (sort === 'title') filtered.sort((first, second) => first.title.localeCompare(second.title));
    if (sort === 'year') filtered.sort((first, second) =>
      (Number.isFinite(second.year) ? second.year : -Infinity) -
      (Number.isFinite(first.year) ? first.year : -Infinity) || first.title.localeCompare(second.title));
    if (sort === 'rating') filtered.sort((first, second) =>
      (Number.isFinite(second.rating) ? second.rating : -Infinity) -
      (Number.isFinite(first.rating) ? first.rating : -Infinity) || first.title.localeCompare(second.title));
    return filtered;
  }

  function renderPersonalStatuses() {
    const container = document.getElementById('personalStatusSections');
    if (!container) return;
    const entries = readPersonalEntries();
    const legacyWishlist = readIds(wishlistKey);
    container.replaceChildren(...personalStatuses.filter(([status]) => status !== 'wishlist' || legacyWishlist.length || entries.some(entry => entry.status === status)).map(([status, label]) => {
      const section = document.createElement('section');
      section.className = 'personal-status-section';
      const heading = document.createElement('h3');
      const listed = entries.filter(entry => entry.status === status);
      const ids = status === 'wishlist'
        ? [...new Set([...legacyWishlist, ...listed.map(entry => entry.id)])]
        : listed.map(entry => entry.id);
      const listedGames = filterPersonalGames(ids.map(byId).filter(Boolean));
      heading.textContent = `${label} (${listedGames.length})`;
      section.append(heading);
      if (!listedGames.length) {
        const empty = document.createElement('p');
        empty.className = 'muted';
        empty.textContent = ids.length ? 'No games in this list match your search.' : 'No games in this list yet.';
        section.append(empty);
      } else {
        const list = document.createElement('div');
        list.className = 'personal-status-list';
        listedGames.forEach(game => {
          const entry = listed.find(item => item.id === game.id);
          const card = makeCard(game);
          const details = document.createElement('div');
          details.className = 'personal-entry-details';
          if (entry?.rating) {
            const rating = document.createElement('p');
            rating.textContent = `Your rating: ${entry.rating} / 5`;
            details.append(rating);
          }
          if (entry?.note) {
            const note = document.createElement('p');
            note.textContent = entry.note;
            details.append(note);
          }
          const remove = document.createElement('button');
          remove.type = 'button';
          remove.className = 'details-button';
          remove.dataset.action = 'remove-personal';
          remove.dataset.gameId = String(game.id);
          remove.dataset.status = status;
          remove.textContent = `Remove from ${label}`;
          details.append(remove);
          card.append(details);
          list.append(card);
        });
        section.append(list);
      }
      return section;
    }));
  }

  function renderMyGames() {
    const favorites = document.getElementById('favoriteCards');
    const recent = document.getElementById('recentCards');
    if (!favorites || !recent) return;
    const favoriteGames = filterPersonalGames(readIds(favoriteKey).map(byId).filter(Boolean));
    const recentGames = filterPersonalGames(readIds(recentKey).map(byId).filter(Boolean));
    favorites.replaceChildren(...(favoriteGames.length
      ? favoriteGames.map(game => makeCard(game, { removeFavorite: true }))
      : [makeEmpty(readIds(favoriteKey).length ? 'No favourites match your search' : 'Your favourites will appear here', 'Browse the library', 'go-library', 'Save a game from the catalog to keep it here.')]));
    recent.replaceChildren(...(recentGames.length
      ? recentGames.map(game => makeCard(game, { removeRecent: true }))
      : [makeEmpty(readIds(recentKey).length ? 'No recent games match your search' : 'No recently viewed games yet', 'Explore games', 'go-library', 'Games you open will appear here on this device.')]));
    document.getElementById('favoritePageCount').textContent = String(favoriteGames.length);
    document.getElementById('recentPageCount').textContent = String(recentGames.length);
    updateFavoriteCount();
    updateComparisonCount();
    renderPersonalStatuses();
  }

  function initializePersonalLibrary() {
    const select = document.getElementById('personalGame');
    const form = document.getElementById('personalEntryForm');
    const exportButton = document.getElementById('exportLibrary');
    const importButton = document.getElementById('importLibraryButton');
    const importInput = document.getElementById('importLibrary');
    if (!select || !form || !exportButton || !importButton || !importInput) return;
    document.getElementById('personalLibrarySearch').addEventListener('input', renderMyGames);
    document.getElementById('personalLibrarySort').addEventListener('change', renderMyGames);
    select.replaceChildren(...games.map(game => new Option(game.title, String(game.id))));
    form.addEventListener('submit', event => {
      event.preventDefault();
      const id = Number(select.value);
      if (!validIds.has(id)) {
        announce('Choose a game from the current catalog.');
        return;
      }
      const status = document.getElementById('personalStatus').value;
      if (!personalStatuses.some(([value]) => value === status)) {
        announce('Choose a valid personal list.');
        return;
      }
      const ratingInput = document.getElementById('personalRating').value;
      const note = document.getElementById('personalNote').value.trim();
      const entries = readPersonalEntries();
      if (personalDataInvalid) return;
      const next = entries.filter(entry => entry.id !== id);
      next.push({ id, status, rating: ratingInput ? Number(ratingInput) : null, note });
      const previous = new Map();
      try {
        previous.set(personalKey, localStorage.getItem(personalKey));
        previous.set(wishlistKey, localStorage.getItem(wishlistKey));
        const wishlist = readIds(wishlistKey);
        const nextWishlist = status === 'wishlist'
          ? [...new Set([...wishlist, id])]
          : wishlist.filter(item => item !== id);
        localStorage.setItem(personalKey, JSON.stringify(next));
        localStorage.setItem(wishlistKey, JSON.stringify(nextWishlist));
      } catch (error) {
        console.error('Could not save personal list changes; restoring their previous values.', error);
        previous.forEach((value, key) => {
          try {
            if (value === null) localStorage.removeItem(key);
            else localStorage.setItem(key, value);
          } catch (rollbackError) {
            console.error(`Could not restore "${key}" after a failed personal-list update.`, rollbackError);
          }
        });
        announce('Your personal list could not be saved; previous data was restored where possible.');
        return;
      }
      document.getElementById('personalNote').value = '';
      document.getElementById('personalRating').value = '';
      renderMyGames();
      announce('Saved to your personal library.');
    });
    exportButton.addEventListener('click', () => {
      const personalEntries = readPersonalEntries();
      const backup = {
        format: 'nexus-gaming-library',
        version: 1,
        exportedAt: new Date().toISOString(),
        favorites: readIds(favoriteKey),
        wishlist: readIds(wishlistKey),
        recentlyViewed: readIds(recentKey),
        comparison: readComparisonIds(),
        view: safeRead(viewKey) === 'list' ? 'list' : 'grid',
        personalEntries,
        recoveryData: personalDataInvalid ? safeRead(personalKey) : safeRead(personalRecoveryKey)
      };
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'nexus-gaming-library.json';
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      announce('Library backup exported.');
    });
    importButton.addEventListener('click', () => importInput.click());
    importInput.addEventListener('change', async () => {
      const file = importInput.files?.[0];
      importInput.value = '';
      if (!file) return;
      if (file.size > 1024 * 1024) {
        announce('Backup files must be no larger than 1 MB.');
        return;
      }
      let backup;
      try {
        backup = JSON.parse(await file.text());
      } catch (error) {
        console.warn('Library backup could not be parsed.', error);
        announce('That file is not valid JSON; no library data was changed.');
        return;
      }
      const validList = value => Array.isArray(value) && value.every(id => Number.isInteger(id) && validIds.has(id));
      const validPersonal = value => Array.isArray(value) && value.every(entry =>
        entry && typeof entry === 'object' && Number.isInteger(entry.id) && validIds.has(entry.id) &&
        personalStatuses.some(([status]) => status === entry.status) &&
        (entry.rating === null || (Number.isInteger(entry.rating) && entry.rating >= 1 && entry.rating <= 5)) &&
        typeof entry.note === 'string' && entry.note.length <= 500);
      if (!backup || backup.format !== 'nexus-gaming-library' || backup.version !== 1 ||
          !validList(backup.favorites) || !validList(backup.wishlist) ||
          !validList(backup.recentlyViewed) || !validList(backup.comparison) ||
          backup.comparison.length > comparisonLimit || !validPersonal(backup.personalEntries) ||
          !['grid', 'list'].includes(backup.view) ||
          (backup.recoveryData !== undefined &&
            backup.recoveryData !== null &&
            (typeof backup.recoveryData !== 'string' || backup.recoveryData.length > 1024 * 1024))) {
        announce('This backup has unsupported or invalid data; no library data was changed.');
        return;
      }
      const currentPersonalEntries = readPersonalEntries();
      if (!storedIdListIsValid(favoriteKey) ||
          !storedIdListIsValid(wishlistKey) || !storedIdListIsValid(recentKey) ||
          !storedIdListIsValid(comparisonKey, comparisonLimit) ||
          (safeRead(viewKey) !== null && !['grid', 'list'].includes(safeRead(viewKey)))) {
        announce('Existing browser data is malformed and was left untouched. Restore or export a valid backup before importing.');
        return;
      }
      const hadMalformedPersonalData = personalDataInvalid;
      const keys = [favoriteKey, wishlistKey, recentKey, comparisonKey, viewKey, personalKey, personalRecoveryKey];
      const previous = new Map();
      try {
        keys.forEach(key => previous.set(key, localStorage.getItem(key)));
        if (previous.get(personalRecoveryKey) === null) {
          const recovery = hadMalformedPersonalData
            ? previous.get(personalKey)
            : backup.recoveryData;
          if (typeof recovery === 'string' && recovery) localStorage.setItem(personalRecoveryKey, recovery);
        }
        const mergeIds = (key, imported) => [...new Set([...readIds(key), ...imported])];
        const mergedEntries = new Map(currentPersonalEntries.map(entry => [entry.id, entry]));
        backup.personalEntries.forEach(entry => mergedEntries.set(entry.id, {
          id: entry.id, status: entry.status, rating: entry.rating, note: entry.note
        }));
        localStorage.setItem(favoriteKey, JSON.stringify(mergeIds(favoriteKey, backup.favorites)));
        localStorage.setItem(wishlistKey, JSON.stringify(mergeIds(wishlistKey, backup.wishlist)));
        localStorage.setItem(recentKey, JSON.stringify([...new Set([...backup.recentlyViewed, ...readIds(recentKey)])].slice(0, 12)));
        localStorage.setItem(comparisonKey, JSON.stringify([...new Set([...readComparisonIds(), ...backup.comparison])].slice(0, comparisonLimit)));
        localStorage.setItem(viewKey, backup.view);
        localStorage.setItem(personalKey, JSON.stringify([...mergedEntries.values()]));
      } catch (error) {
        console.error('Library import failed; restoring the original browser data.', error);
        keys.forEach(key => {
          try {
            const value = previous.get(key);
            if (value === null) localStorage.removeItem(key);
            else if (value !== undefined) localStorage.setItem(key, value);
          } catch (rollbackError) {
            console.error(`Could not restore "${key}" after a failed import.`, rollbackError);
          }
        });
        announce('Import failed while saving; the original library was restored where possible.');
        return;
      }
      renderMyGames();
      updateFavoriteCount();
      updateComparisonCount();
      announce(hadMalformedPersonalData
        ? 'Backup merged; the original malformed personal data was retained in the local recovery record.'
        : 'Backup merged into this browser’s library.');
    });
  }

  function renderGameDetail() {
    const id = Number(queryParams.get('id'));
    const game = Number.isSafeInteger(id) && id > 0 ? byId(id) : null;
    const detail = document.getElementById('gameDetail');
    const notFound = document.getElementById('gameNotFound');
    if (!game || !detail || !notFound) {
      if (detail) detail.hidden = true;
      if (notFound) notFound.hidden = false;
      document.querySelector('.related-section')?.setAttribute('hidden', '');
      document.title = 'Game not found | Nexus Gaming';
      return;
    }
    addRecent(game.id);
    detail.hidden = false;
    notFound.hidden = true;
    document.querySelector('.related-section')?.removeAttribute('hidden');
    document.title = `${game.title} | Nexus Gaming`;
    document.querySelector('meta[name="description"]')?.setAttribute('content', game.description);
    document.querySelector('meta[property="og:title"]')?.setAttribute('content', `${game.title} | Nexus Gaming`);
    document.querySelector('meta[property="og:description"]')?.setAttribute('content', game.description);
    const canonical = document.querySelector('link[rel="canonical"]');
    if (canonical) canonical.href = `${window.location.origin}${window.location.pathname}?id=${game.id}`;
    document.querySelector('meta[property="og:url"]')?.setAttribute('content', canonical?.href || window.location.href);
    document.querySelector('meta[name="twitter:title"]')?.setAttribute('content', `${game.title} | Nexus Gaming`);
    document.querySelector('meta[name="twitter:description"]')?.setAttribute('content', game.description);
    const detailArtwork = makeArtwork(game, 'detail-art', 'eager');
    detailArtwork.id = 'detailArtwork';
    document.getElementById('detailArtwork').replaceWith(detailArtwork);
    document.getElementById('detailGenre').textContent = game.genre;
    document.getElementById('detailTitle').textContent = game.title;
    document.getElementById('detailDescription').textContent = game.description;
    const meta = document.getElementById('detailMeta');
    meta.replaceChildren();
    if (Number.isFinite(game.year)) {
      const year = document.createElement('span');
      year.textContent = `Released ${game.year}`;
      meta.append(year);
    }
    if (Number.isFinite(game.rating)) {
      const score = document.createElement('span');
      score.className = 'game-rating';
      score.textContent = `★ ${game.rating.toFixed(1)} / 5 · catalog value, source unverified`;
      meta.append(score);
    } else {
      const unrated = document.createElement('span');
      unrated.className = 'muted';
      unrated.textContent = 'No rating available';
      meta.append(unrated);
    }
    const favorite = document.getElementById('detailFavorite');
    const renderFavorite = () => {
      const isFavorite = readIds(favoriteKey).includes(game.id);
      favorite.textContent = isFavorite ? '♥ Saved to favourites' : '♡ Add to favourites';
      favorite.setAttribute('aria-pressed', String(isFavorite));
      updateFavoriteCount();
    };
    favorite.addEventListener('click', () => {
      const current = readIds(favoriteKey);
      const next = current.includes(game.id) ? current.filter(item => item !== game.id) : [...current, game.id];
      if (writeIds(favoriteKey, next)) renderFavorite();
    });
    renderFavorite();
    const compare = document.getElementById('detailCompare');
    if (compare) {
      compare.dataset.gameId = String(game.id);
      updateDetailComparison(game.id);
    }
    const extraMetadata = [
      ['Platforms', Array.isArray(game.platforms) ? game.platforms.filter(item => typeof item === 'string' && item.trim()).join(', ') : ''],
      ['Developer', typeof game.developer === 'string' ? game.developer.trim() : ''],
      ['Publisher', typeof game.publisher === 'string' ? game.publisher.trim() : ''],
      ['Player modes', Array.isArray(game.playerModes) ? game.playerModes.filter(item => typeof item === 'string' && item.trim()).join(', ') : '']
    ].filter(([, value]) => value);
    const metadataList = document.getElementById('detailExtraMetadata');
    if (metadataList) {
      metadataList.replaceChildren(...extraMetadata.map(([label, value]) => {
        const item = document.createElement('div');
        const term = document.createElement('dt');
        term.textContent = label;
        const description = document.createElement('dd');
        description.textContent = value;
        item.append(term, description);
        return item;
      }));
      metadataList.hidden = extraMetadata.length === 0;
    }
    const requirements = document.getElementById('detailRequirements');
    if (requirements) {
      const values = game.systemRequirements && typeof game.systemRequirements === 'object'
        ? Object.entries(game.systemRequirements).filter(([, value]) => typeof value === 'string' && value.trim())
        : [];
      requirements.hidden = values.length === 0;
      requirements.replaceChildren(...values.flatMap(([label, value]) => {
        const heading = document.createElement('h3');
        heading.textContent = label;
        const text = document.createElement('p');
        text.textContent = value;
        return [heading, text];
      }));
    }
    renderOffers(document.getElementById('detailOffers'), game);
    const related = games.filter(item => item.id !== game.id && item.genre === game.genre).slice(0, 4);
    const relatedContainer = document.getElementById('relatedGames');
    relatedContainer.replaceChildren(...related.map(item => makeCard(item)));
    document.getElementById('shareGame')?.addEventListener('click', async () => {
      const shareUrl = new URL(`game.html?id=${encodeURIComponent(game.id)}`, window.location.href).href;
      try {
        if (navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(shareUrl);
        } else {
          const textarea = document.createElement('textarea');
          textarea.value = shareUrl;
          textarea.setAttribute('readonly', '');
          textarea.style.position = 'fixed';
          textarea.style.opacity = '0';
          document.body.append(textarea);
          textarea.select();
          const copied = document.execCommand('copy');
          textarea.remove();
          if (!copied) throw new Error('Clipboard copy was not permitted.');
        }
        announce('Game link copied.');
      } catch (error) {
        console.error('Could not copy the game link.', error);
        announce('Could not copy automatically. Use the address bar to share this page.');
      }
    }, { once: true });
  }

  function updateDetailComparison(id) {
    const button = document.getElementById('detailCompare');
    if (!button) return;
    const isSelected = readComparisonIds().includes(id);
    button.textContent = isSelected ? '✓ Added to comparison' : '＋ Add to comparison';
    button.setAttribute('aria-pressed', String(isSelected));
    button.setAttribute('aria-label', `${isSelected ? 'Remove' : 'Add'} ${byId(id)?.title || 'game'} ${isSelected ? 'from' : 'to'} comparison`);
    button.disabled = !isSelected && readComparisonIds().length >= comparisonLimit;
  }

  function renderComparisonPage() {
    const container = document.getElementById('comparisonTableArea');
    if (!container) return;
    const selected = readComparisonIds().map(byId).filter(Boolean);
    document.getElementById('comparisonCount').textContent = `${selected.length} of ${comparisonLimit} games selected`;
    document.getElementById('clearComparisonPage').hidden = !selected.length;
    if (!selected.length) {
      container.replaceChildren(makeEmpty(
        'Your comparison is empty',
        'Browse the library',
        'go-library',
        `Choose up to ${comparisonLimit} games from the Library to compare their available details.`
      ));
      return;
    }
    const table = document.createElement('table');
    table.className = 'compare-table';
    const caption = document.createElement('caption');
    caption.className = 'visually-hidden';
    caption.textContent = 'Side-by-side comparison of selected games';
    const head = document.createElement('thead');
    const headRow = document.createElement('tr');
    const labelHead = document.createElement('th');
    labelHead.scope = 'col';
    labelHead.textContent = 'DETAIL';
    headRow.append(labelHead);
    selected.forEach(game => {
      const th = document.createElement('th');
      th.scope = 'col';
      const link = document.createElement('a');
      link.href = `game.html?id=${encodeURIComponent(game.id)}`;
      link.textContent = game.title;
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.dataset.action = 'compare-toggle';
      remove.dataset.gameId = String(game.id);
      remove.className = 'compare-remove';
      remove.setAttribute('aria-label', `Remove ${game.title} from comparison`);
      remove.textContent = '×';
      th.append(link, remove);
      headRow.append(th);
    });
    head.append(headRow);
    const body = document.createElement('tbody');
    const rows = [
      ['Genre', game => game.genre],
      ['Release year', game => Number.isFinite(game.year) ? String(game.year) : 'Not available'],
      ['Rating', game => Number.isFinite(game.rating) ? `${game.rating.toFixed(1)} / 5 (source unverified)` : 'Not available'],
      ['Description', game => game.description || 'Not available']
    ];
    if (selected.some(game => Array.isArray(game.platforms) && game.platforms.length)) {
      rows.push(['Platforms', game => Array.isArray(game.platforms) && game.platforms.length ? game.platforms.join(', ') : 'Not available']);
    }
    if (selected.some(game => typeof game.developer === 'string' || typeof game.publisher === 'string')) {
      rows.push(['Developer', game => typeof game.developer === 'string' && game.developer.trim() ? game.developer : 'Not available']);
      rows.push(['Publisher', game => typeof game.publisher === 'string' && game.publisher.trim() ? game.publisher : 'Not available']);
    }
    if (selected.some(game => game.systemRequirements && typeof game.systemRequirements === 'object')) {
      rows.push(['System requirements', game => {
        const requirements = game.systemRequirements;
        return requirements && typeof requirements === 'object'
          ? Object.entries(requirements).map(([label, value]) => `${label}: ${value}`).join('; ') || 'Not available'
          : 'Not available';
      }]);
    }
    if (selected.some(game => validOffers(game).length)) {
      rows.push(['Verified offers', game => {
        const offers = validOffers(game);
        return offers.length
          ? offers.map(offer => `${offer.retailer.trim()}: ${typeof offer.price === 'string' && offer.price.trim() ? offer.price.trim() : 'Price not supplied'}`).join('; ')
          : 'Not available';
      }]);
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
    table.append(caption, head, body);
    container.replaceChildren(table);
  }

  function renderStore() {
    const container = document.getElementById('storeOffers');
    if (!container) return;
    const entries = games.flatMap(game => validOffers(game).map(offer => ({ game, offer })));
    if (!entries.length) {
      const empty = document.createElement('section');
      empty.className = 'store-empty';
      const heading = document.createElement('h2');
      heading.textContent = 'Verified offers are coming soon';
      const text = document.createElement('p');
      text.textContent = 'Retailer and affiliate links appear here only after their destination and offer details are verified. Green Man Gaming approval for this site is pending; no offers are active.';
      const link = document.createElement('a');
      link.className = 'cta-button';
      link.href = 'games.html';
      link.textContent = 'Explore the game library';
      empty.append(heading, text, link);
      container.replaceChildren(empty);
      return;
    }
    container.replaceChildren(...entries.map(({ game, offer }) => {
      const card = document.createElement('article');
      card.className = 'store-offer-card';
      const gameLink = document.createElement('a');
      gameLink.href = `game.html?id=${game.id}`;
      gameLink.textContent = game.title;
      const heading = document.createElement('h2');
      heading.append(gameLink);
      const retailer = document.createElement('p');
      retailer.textContent = offer.retailer.trim();
      card.append(heading, retailer);
      const list = document.createElement('div');
      renderOffers(list, { ...game, purchaseOffers: [offer] });
      card.append(list);
      container.append(card);
      return card;
    }));
  }

  function initializeGlobalSearch() {
    document.querySelectorAll('.search-container input[name="q"]').forEach(input => {
      const form = input.closest('form');
      if (!form) return;
      const results = document.createElement('div');
      results.className = 'global-search-results';
      results.id = `${input.id || 'globalSearch'}Results`;
      results.setAttribute('role', 'listbox');
      results.setAttribute('aria-label', 'Matching games');
      results.hidden = true;
      input.setAttribute('aria-autocomplete', 'list');
      input.setAttribute('aria-controls', results.id);
      input.setAttribute('aria-expanded', 'false');
      form.append(results);
      let activeIndex = -1;

      const close = () => {
        results.hidden = true;
        input.setAttribute('aria-expanded', 'false');
        input.removeAttribute('aria-activedescendant');
        activeIndex = -1;
      };
      const render = () => {
        const term = input.value.trim().toLocaleLowerCase();
        results.replaceChildren();
        activeIndex = -1;
        if (!term) {
          close();
          return;
        }
        const matches = games.filter(game =>
          [game.title, game.genre, game.description, game.year,
            ...(Array.isArray(game.platforms) ? game.platforms : [])]
            .filter(value => value !== undefined && value !== null)
            .join(' ').toLocaleLowerCase().includes(term)).slice(0, 6);
        if (!matches.length) {
          const empty = document.createElement('p');
          empty.className = 'global-search-empty';
          empty.textContent = 'No games match that search.';
          results.append(empty);
        } else {
          matches.forEach((game, index) => {
            const link = document.createElement('a');
            link.id = `${results.id}-${index}`;
            link.className = 'global-search-option';
            link.href = `game.html?id=${encodeURIComponent(game.id)}`;
            link.setAttribute('role', 'option');
            link.setAttribute('aria-selected', 'false');
            const title = document.createElement('strong');
            title.textContent = game.title;
            const detail = document.createElement('span');
            detail.textContent = `${game.genre}${Number.isFinite(game.year) ? ` · ${game.year}` : ''}`;
            link.append(title, detail);
            results.append(link);
          });
        }
        results.hidden = false;
        input.setAttribute('aria-expanded', 'true');
      };
      const activate = nextIndex => {
        const options = [...results.querySelectorAll('[role="option"]')];
        if (!options.length) return;
        activeIndex = (nextIndex + options.length) % options.length;
        options.forEach((option, index) => option.setAttribute('aria-selected', String(index === activeIndex)));
        input.setAttribute('aria-activedescendant', options[activeIndex].id);
      };
      input.addEventListener('input', render);
      input.addEventListener('keydown', event => {
        if (event.key === 'Escape' && !results.hidden) {
          event.preventDefault();
          close();
        } else if (event.key === 'ArrowDown' && !results.hidden) {
          event.preventDefault();
          activate(activeIndex + 1);
        } else if (event.key === 'ArrowUp' && !results.hidden) {
          event.preventDefault();
          activate(activeIndex < 0 ? results.children.length - 1 : activeIndex - 1);
        } else if (event.key === 'Enter' && activeIndex >= 0) {
          const option = results.querySelectorAll('[role="option"]')[activeIndex];
          if (option) {
            event.preventDefault();
            window.location.href = option.href;
          }
        }
      });
      results.addEventListener('mousedown', event => event.preventDefault());
      results.addEventListener('click', event => {
        const option = event.target.closest('[role="option"]');
        if (option) window.location.href = option.href;
      });
      form.addEventListener('submit', close);
      document.addEventListener('click', event => {
        if (!form.contains(event.target)) close();
      });
      input.addEventListener('blur', () => window.setTimeout(() => {
        if (!results.contains(document.activeElement)) close();
      }, 0));
    });
  }

  function initializeSharedChrome() {
    const nav = document.getElementById('mainNavigation');
    const toggle = document.getElementById('menuToggle');
    if (nav && toggle && page !== 'home') {
      toggle.addEventListener('click', () => {
        const open = toggle.getAttribute('aria-expanded') !== 'true';
        toggle.setAttribute('aria-expanded', String(open));
        toggle.setAttribute('aria-label', open ? 'Close navigation' : 'Open navigation');
        nav.classList.toggle('open', open);
      });
      nav.addEventListener('click', event => {
        if (!event.target.closest('a')) return;
        nav.classList.remove('open');
        toggle.setAttribute('aria-expanded', 'false');
        toggle.setAttribute('aria-label', 'Open navigation');
      });
      document.addEventListener('keydown', event => {
        if (event.key === 'Escape' && toggle.getAttribute('aria-expanded') === 'true') {
          nav.classList.remove('open');
          toggle.setAttribute('aria-expanded', 'false');
          toggle.setAttribute('aria-label', 'Open navigation');
          toggle.focus();
        }
      });
    }
    const currentFile = window.location.pathname.split('/').pop() || 'index.html';
    document.querySelectorAll('.nav-links a, .footer-nav a').forEach(link => {
      const linkFile = new URL(link.href).pathname.split('/').pop();
      if (linkFile === currentFile || (page === 'game' && linkFile === 'games.html')) {
        link.setAttribute('aria-current', 'page');
      }
    });
    if (page !== 'home') {
      document.querySelectorAll('input[name="q"]').forEach(input => {
        input.value = queryParams.get('q') || '';
      });
    }
    document.querySelectorAll('[data-current-year]').forEach(element => {
      element.textContent = String(new Date().getFullYear());
    });
    updateFavoriteCount();
    updateComparisonCount();
    initializeGlobalSearch();
    window.addEventListener('storage', event => {
      if (event.key === favoriteKey || event.key === null) {
        updateFavoriteCount();
        if (page === 'my-games') renderMyGames();
      }
      if ((event.key === recentKey || event.key === wishlistKey || event.key === personalKey || event.key === null) && page === 'my-games') renderMyGames();
      if (event.key === comparisonKey || event.key === null) {
        updateComparisonCount();
        updateComparisonButtons();
        if (page === 'compare') renderComparisonPage();
        if (page === 'game') updateDetailComparison(Number(queryParams.get('id')));
      }
    });
  }

  document.addEventListener('click', event => {
    const action = event.target.closest('[data-action]');
    if (!action) return;
    const id = Number(action.dataset.gameId);
    const game = byId(id);
    if (action.dataset.action === 'clear-library') {
      document.getElementById('clearLibraryFilters')?.click();
      return;
    }
    if (action.dataset.action === 'go-library') {
      window.location.href = 'games.html';
      return;
    }
    if (action.dataset.action === 'clear-genres') {
      document.getElementById('clearGenreSearch')?.click();
      return;
    }
    if (action.dataset.action === 'clear-comparison') {
      if (!writeIds(comparisonKey, [])) return;
      updateComparisonCount();
      updateComparisonButtons();
      renderComparisonPage();
      announce('Comparison cleared.');
      return;
    }
    if (!game) return;
    if (action.dataset.action === 'favorite' || action.dataset.action === 'remove-favorite') {
      const current = readIds(favoriteKey);
      const next = current.includes(id) ? current.filter(item => item !== id) : [...current, id];
      if (!writeIds(favoriteKey, next)) return;
      updateFavoriteCount();
      if (page === 'my-games') renderMyGames();
      else if (page === 'games') libraryApplyFilters?.(false);
      announce(current.includes(id) ? 'Removed from favourites.' : 'Added to favourites.');
    }
    if (action.dataset.action === 'compare-toggle') toggleComparison(id);
    if (action.dataset.action === 'remove-recent') {
      if (writeIds(recentKey, readIds(recentKey).filter(item => item !== id))) {
        renderMyGames();
        announce('Removed from recently viewed.');
      }
    }
    if (action.dataset.action === 'remove-personal') {
      const status = action.dataset.status;
      const currentEntries = readPersonalEntries();
      if (personalDataInvalid) return;
      const nextEntries = currentEntries.filter(entry => entry.id !== id);
      const previous = new Map();
      try {
        previous.set(personalKey, localStorage.getItem(personalKey));
        if (status === 'wishlist') previous.set(wishlistKey, localStorage.getItem(wishlistKey));
        localStorage.setItem(personalKey, JSON.stringify(nextEntries));
        if (status === 'wishlist') {
          localStorage.setItem(wishlistKey, JSON.stringify(readIds(wishlistKey).filter(item => item !== id)));
        }
      } catch (error) {
        console.error('Could not remove the personal-list entry; restoring its previous values.', error);
        previous.forEach((value, key) => {
          try {
            if (value === null) localStorage.removeItem(key);
            else localStorage.setItem(key, value);
          } catch (rollbackError) {
            console.error(`Could not restore "${key}" after a failed personal-list removal.`, rollbackError);
          }
        });
        announce('The list item could not be removed; previous data was restored where possible.');
        return;
      }
      renderMyGames();
      announce('Removed from your personal library.');
    }
  });

  initializeSharedChrome();
  if (page === 'genres') renderGenres();
  if (page === 'free-games') renderFreeGames();
  if (page === 'games') renderLibrary();
  if (page === 'game') renderGameDetail();
  if (page === 'my-games') {
    initializePersonalLibrary();
    renderMyGames();
  }
  if (page === 'games') libraryApplyFilters?.(false);
  if (page === 'store') renderStore();
  if (page === 'compare') renderComparisonPage();
});
