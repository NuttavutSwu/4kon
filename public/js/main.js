// ===== USER MENU TOGGLE =====
function toggleMenu() {
  const menu = document.getElementById('userMenu');
  if (menu) menu.classList.toggle('show');
}

document.addEventListener('click', (e) => {
  const menu = document.getElementById('userMenu');
  if (menu && !e.target.closest('.nav-user-wrap')) {
    menu.classList.remove('show');
  }
});

// ===== TOAST =====
function showToast(msg, type = 'success') {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const icons = { success: 'OK', error: 'X', info: 'i' };
  const el = document.createElement('div');
  el.className = `toast ${type !== 'success' ? type : ''}`;
  el.innerHTML = `<span>${icons[type] || 'OK'}</span> ${msg}`;
  container.appendChild(el);
  setTimeout(() => el.remove(), 3200);
}

(function showToastFromQuery() {
  const params = new URLSearchParams(window.location.search);
  if (params.get('success')) showToast(decodeURIComponent(params.get('success')));
  if (params.get('error')) showToast(decodeURIComponent(params.get('error')), 'error');
})();

// ===== CONFIRM DELETES =====
document.addEventListener('submit', (e) => {
  const form = e.target;
  if (form.dataset.confirm && !confirm(form.dataset.confirm)) {
    e.preventDefault();
  }
});

// ===== FAVORITES =====
function getWishlistUserId() {
  return document.body?.dataset?.userId || 'guest';
}

function getFavoriteStorageKey() {
  return `starwish:favorites:${getWishlistUserId()}`;
}

function readFavoriteIds() {
  try {
    const raw = localStorage.getItem(getFavoriteStorageKey()) || '[]';
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch (_err) {
    return [];
  }
}

function writeFavoriteIds(ids) {
  localStorage.setItem(getFavoriteStorageKey(), JSON.stringify(ids.map(String)));
}

function isFavoriteProduct(productId) {
  return readFavoriteIds().includes(String(productId));
}

function setFavoriteButtonState(button, isFavorite) {
  if (!button) return;

  button.dataset.favoriteActive = isFavorite ? 'true' : 'false';
  button.setAttribute('aria-pressed', isFavorite ? 'true' : 'false');
  button.classList.toggle('is-active', isFavorite);

  const icon = button.querySelector('[data-favorite-icon]');
  if (icon) icon.innerHTML = isFavorite ? '&starf;' : '&star;';

  const text = button.querySelector('[data-favorite-text]');
  if (text) text.textContent = isFavorite ? 'Favorited' : 'Favorite';

  const label = button.dataset.favoriteLabel || 'wishlist item';
  button.setAttribute(
    'aria-label',
    isFavorite ? `Remove ${label} from favorites` : `Add ${label} to favorites`
  );
  button.setAttribute('title', isFavorite ? 'Remove from favorites' : 'Add to favorites');
}

function syncFavoriteButtons() {
  document.querySelectorAll('[data-favorite-button]').forEach((button) => {
    setFavoriteButtonState(button, isFavoriteProduct(button.dataset.productId));
  });
}

function syncFavoriteCards() {
  document.querySelectorAll('[data-product-card]').forEach((card) => {
    const isFavorite = isFavoriteProduct(card.dataset.productId);
    card.dataset.favorite = isFavorite ? 'true' : 'false';
    card.classList.toggle('is-favorite', isFavorite);
  });
}

function isFavoritesOnlyEnabled() {
  const input = document.querySelector('[data-favorites-input]');
  return input ? input.value === '1' : false;
}

function setFavoritesOnlyEnabled(enabled) {
  const input = document.querySelector('[data-favorites-input]');
  const toggle = document.querySelector('[data-favorites-toggle]');
  if (input) input.value = enabled ? '1' : '0';
  if (toggle) toggle.dataset.active = enabled ? 'true' : 'false';
}

function sortWishlistCards() {
  const grid = document.querySelector('[data-products-grid]');
  if (!grid) return;

  const hasExplicitSort = new URLSearchParams(window.location.search).get('sort');
  if (hasExplicitSort || isFavoritesOnlyEnabled()) return;

  const cards = Array.from(grid.querySelectorAll('[data-product-card]'));
  cards
    .sort((a, b) => {
      const aFav = a.dataset.favorite === 'true' ? 1 : 0;
      const bFav = b.dataset.favorite === 'true' ? 1 : 0;
      return bFav - aFav;
    })
    .forEach((card) => grid.appendChild(card));
}

function applyFavoritesOnlyFilter() {
  const toggle = document.querySelector('[data-favorites-toggle]');
  const emptyState = document.querySelector('[data-favorites-empty]');
  const showOnlyFavorites = isFavoritesOnlyEnabled();

  document.querySelectorAll('[data-nonfavorite-card]').forEach((card) => {
    card.hidden = showOnlyFavorites;
    card.style.display = showOnlyFavorites ? 'none' : '';
  });

  let visibleCount = 0;
  document.querySelectorAll('[data-product-card]').forEach((card) => {
    const isFavorite = isFavoriteProduct(card.dataset.productId);
    card.dataset.favorite = isFavorite ? 'true' : 'false';
    const shouldShow = !showOnlyFavorites || isFavorite;
    card.hidden = !shouldShow;
    card.style.display = shouldShow ? '' : 'none';
    if (shouldShow) visibleCount += 1;
  });

  if (emptyState) {
    emptyState.hidden = !(showOnlyFavorites && visibleCount === 0);
  }

  if (toggle) {
    toggle.setAttribute('aria-pressed', showOnlyFavorites ? 'true' : 'false');
    toggle.classList.toggle('is-active', showOnlyFavorites);
    toggle.dataset.active = showOnlyFavorites ? 'true' : 'false';
    toggle.textContent = showOnlyFavorites ? 'Show All Items' : 'Show Favorites';
  }
}

function refreshFavoriteUI() {
  syncFavoriteButtons();
  syncFavoriteCards();
  sortWishlistCards();
  applyFavoritesOnlyFilter();
}

function toggleFavorite(productId, options) {
  const opts = options || {};
  const productName = opts.productName || 'Item';
  const ids = new Set(readFavoriteIds());
  const normalizedId = String(productId);

  if (ids.has(normalizedId)) {
    ids.delete(normalizedId);
    writeFavoriteIds(Array.from(ids));
    refreshFavoriteUI();
    if (opts.showToast !== false) showToast(`${productName} removed from favorites`, 'info');
    return false;
  }

  ids.add(normalizedId);
  writeFavoriteIds(Array.from(ids));
  refreshFavoriteUI();
  if (opts.showToast !== false) showToast(`${productName} added to favorites`);
  return true;
}

document.addEventListener('click', (e) => {
  const favoriteButton = e.target.closest('[data-favorite-button]');
  if (!favoriteButton) return;

  e.preventDefault();
  e.stopPropagation();

  toggleFavorite(favoriteButton.dataset.productId, {
    productName: favoriteButton.dataset.productName
  });
});

document.addEventListener('click', (e) => {
  const favoritesToggle = e.target.closest('[data-favorites-toggle]');
  if (!favoritesToggle) return;

  e.preventDefault();
  setFavoritesOnlyEnabled(favoritesToggle.dataset.active !== 'true');
  applyFavoritesOnlyFilter();
});

// ===== SUPABASE =====
if (!window.supabaseClient) {
  window.supabaseClient = window.supabase.createClient(
    'https://bpchdlmfjcbuehrhvkzg.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJwY2hkbG1mamNidWVocmh2a3pnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUyOTA5MTUsImV4cCI6MjA5MDg2NjkxNX0.7qhSHu9xAm9IOVgIln9YtiHwSCafzV_xUgahnLcVDkY'
  );
}

var supabase = window.supabaseClient;

async function handleLogout(e) {
  if (e) e.preventDefault();

  try {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    window.location.replace('/auth/logout');
  } catch (err) {
    console.error('Logout Error:', err);
    window.location.replace('/auth/logout');
  }
}

async function handleAuth() {
  const overlay = document.getElementById('auth-loading-overlay');
  const path = window.location.pathname;
  const isLoginPage = path === '/login';
  const hasServerSession = document.body?.dataset?.hasSessionUser === 'true';
  const loginRedirectTarget = (() => {
    const candidate = new URLSearchParams(window.location.search).get('redirect');
    return candidate && candidate.startsWith('/') ? candidate : '/';
  })();
  const requiresAuth = path === '/wishlist'
    || path.startsWith('/product/')
    || path.startsWith('/products/')
    || path.startsWith('/admin');

  const hideOverlay = () => {
    if (!overlay) return;
    overlay.style.opacity = '0';
    setTimeout(() => {
      overlay.style.display = 'none';
    }, 500);
  };

  // Public pages shouldn't block on Supabase network calls.
  if (!requiresAuth && !isLoginPage) {
    hideOverlay();
  }

  try {
    const { data: { user } } = requiresAuth || isLoginPage
      ? await supabase.auth.getUser()
      : await Promise.race([
          supabase.auth.getUser(),
          new Promise((resolve) => setTimeout(() => resolve({ data: { user: null } }), 400))
        ]);

    if (user) {
      const syncPromise = fetch('/auth/sync-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: user.email,
          name: user.user_metadata?.name
        })
      });

      if (isLoginPage) {
        await syncPromise;
        sessionStorage.setItem('wasSynced', 'true');
        window.location.href = loginRedirectTarget;
        return;
      }

      if (requiresAuth && !sessionStorage.getItem('wasSynced')) {
        await syncPromise;
        sessionStorage.setItem('wasSynced', 'true');
        window.location.reload();
        return;
      }

      syncPromise.catch((err) => {
        console.error('Sync user error:', err);
      });
    } else {
      // Admin (or any server-session user) can access protected pages without Google auth.
      if (requiresAuth && !hasServerSession) {
        window.location.href = '/login';
        return;
      }

      sessionStorage.removeItem('wasSynced');
    }
  } catch (err) {
    console.error('Auth error:', err);
  } finally {
    // On protected pages, keep overlay until auth completes.
    if (requiresAuth || isLoginPage) hideOverlay();
  }
}

document.addEventListener('DOMContentLoaded', () => {
  if (window.location.pathname === '/wishlist') {
    const navEntries = performance.getEntriesByType ? performance.getEntriesByType('navigation') : [];
    const navType = navEntries[0]?.type;
    if (navType === 'reload' && window.location.search) {
      window.location.replace('/wishlist');
      return;
    }
  }

  refreshFavoriteUI();
});

handleAuth();
