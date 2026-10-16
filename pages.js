document.addEventListener('DOMContentLoaded', () => {
  const games = window.NexusGaming.games;
  const page = document.body.dataset.page;
  const favoriteKey = 'favorites';
  const recentKey = 'nexus.recent.v1';
  const comparisonKey = 'nexus.compare.v1';
  const comparisonLimit = 3;
  const validIds = new Set(games.map(game => game.id));
  const byId = id => games.find(game => game.id === id);
  const queryParams = new URLSearchParams(window.location.search);
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let libraryApplyFilters = null;
  let libraryFavoritesOnly = false;

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
        disclosure.textContent = 'We may earn a commission from purchases made through this affiliate link.';
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

  function renderLibrary() {
    const cards = document.getElementById('libraryCards');
    const search = document.getElementById('librarySearch');
    const genreSelect = document.getElementById('libraryGenre');
    const sort = document.getElementById('librarySort');
    const rating = document.getElementById('libraryRating');
    const count = document.getElementById('libraryCount');
    if (!cards || !search || !genreSelect || !sort || !rating || !count) return;

    const genres = [...new Set(games.map(game => game.genre))].sort((a, b) => a.localeCompare(b));
    genreSelect.replaceChildren(new Option('All genres', 'all'), ...genres.map(item => new Option(item, item)));
    const params = new URLSearchParams(window.location.search);
    const requestedGenre = params.get('genre') || 'all';
    const genre = genres.includes(requestedGenre) ? requestedGenre : 'all';
    search.value = params.get('q') || '';
    genreSelect.value = genre;
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
      count.textContent = `${results.length} ${results.length === 1 ? 'game' : 'games'}${libraryFavoritesOnly ? ' · favourites' : ''}`;
      if (sync) updateUrl({
        q: search.value.trim(),
        genre: genreSelect.value,
        sort: sort.value === 'rating-desc' ? '' : sort.value,
        rating: rating.value
      });
    };
    search.addEventListener('input', () => applyFilters());
    genreSelect.addEventListener('change', () => applyFilters(true));
    sort.addEventListener('change', () => applyFilters(true));
    rating.addEventListener('change', () => applyFilters(true));
    document.getElementById('clearLibraryFilters')?.addEventListener('click', () => {
      search.value = '';
      genreSelect.value = 'all';
      sort.value = 'rating-desc';
      rating.value = '0';
      updateUrl({ q: '', genre: '', sort: '', rating: '' });
      applyFilters(false);
    });
    document.getElementById('favoritesOnly')?.addEventListener('click', event => {
      libraryFavoritesOnly = !libraryFavoritesOnly;
      event.currentTarget.setAttribute('aria-pressed', String(libraryFavoritesOnly));
      applyFilters(false);
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

  function renderMyGames() {
    const favorites = document.getElementById('favoriteCards');
    const recent = document.getElementById('recentCards');
    if (!favorites || !recent) return;
    const favoriteGames = readIds(favoriteKey).map(byId).filter(Boolean);
    const recentGames = readIds(recentKey).map(byId).filter(Boolean);
    favorites.replaceChildren(...(favoriteGames.length
      ? favoriteGames.map(game => makeCard(game, { removeFavorite: true }))
      : [makeEmpty('Your favourites will appear here', 'Browse the library', 'go-library', 'Save a game from the catalog to keep it here.')]));
    recent.replaceChildren(...(recentGames.length
      ? recentGames.map(game => makeCard(game, { removeRecent: true }))
      : [makeEmpty('No recently viewed games yet', 'Explore games', 'go-library', 'Games you open will appear here on this device.')]));
    document.getElementById('favoritePageCount').textContent = String(favoriteGames.length);
    document.getElementById('recentPageCount').textContent = String(recentGames.length);
    updateFavoriteCount();
    updateComparisonCount();
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
    document.getElementById('detailArtwork').replaceWith(makeArtwork(game, 'detail-art', 'eager'));
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
      score.textContent = `★ ${game.rating.toFixed(1)} / 5`;
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
    renderOffers(document.getElementById('detailOffers'), game);
    const related = games.filter(item => item.id !== game.id && item.genre === game.genre).slice(0, 4);
    const relatedContainer = document.getElementById('relatedGames');
    relatedContainer.replaceChildren(...related.map(item => makeCard(item)));
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
        'Choose up to three games from the Library to compare their available details.'
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
      ['Rating', game => Number.isFinite(game.rating) ? `${game.rating.toFixed(1)} / 5` : 'Not available'],
      ['Description', game => game.description || 'Not available']
    ];
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
    window.addEventListener('storage', event => {
      if (event.key === favoriteKey || event.key === null) {
        updateFavoriteCount();
        if (page === 'my-games') renderMyGames();
      }
      if ((event.key === recentKey || event.key === null) && page === 'my-games') renderMyGames();
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
      writeIds(recentKey, readIds(recentKey).filter(item => item !== id));
      renderMyGames();
    }
  });

  initializeSharedChrome();
  if (page === 'genres') renderGenres();
  if (page === 'games') renderLibrary();
  if (page === 'game') renderGameDetail();
  if (page === 'my-games') renderMyGames();
  if (page === 'games') libraryApplyFilters?.(false);
  if (page === 'store') renderStore();
  if (page === 'compare') renderComparisonPage();
});
