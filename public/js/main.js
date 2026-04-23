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

// Show toast from query param (e.g. after redirect)
(function () {
  const params = new URLSearchParams(window.location.search);
  if (params.get('success')) showToast(decodeURIComponent(params.get('success')));
  if (params.get('error')) showToast(decodeURIComponent(params.get('error')), 'error');
})();

// ===== CONFIRM DELETES (extra safety) =====
document.addEventListener('submit', (e) => {
  const form = e.target;
  if (form.dataset.confirm) {
    if (!confirm(form.dataset.confirm)) e.preventDefault();
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
    return JSON.parse(localStorage.getItem(getFavoriteStorageKey()) || '[]');
  } catch (_err) {
    return [];
  }
}

function writeFavoriteIds(ids) {
  localStorage.setItem(getFavoriteStorageKey(), JSON.stringify(ids));
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
  if (icon) icon.textContent = isFavorite ? '★' : '☆';

  const text = button.querySelector('[data-favorite-text]');
  if (text) text.textContent = isFavorite ? 'Favorited' : 'Favorite';

  const label = button.dataset.favoriteLabel || 'wishlist item';
  button.setAttribute('aria-label', isFavorite ? `Remove ${label} from favorites` : `Add ${label} to favorites`);
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

function sortWishlistCards() {
  const grid = document.querySelector('[data-products-grid]');
  if (!grid) return;

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
  const showOnlyFavorites = toggle?.dataset.active === 'true';

  let visibleCount = 0;
  document.querySelectorAll('[data-product-card]').forEach((card) => {
    const shouldShow = !showOnlyFavorites || card.dataset.favorite === 'true';
    card.hidden = !shouldShow;
    if (shouldShow) visibleCount += 1;
  });

  if (emptyState) {
    emptyState.hidden = !(showOnlyFavorites && visibleCount === 0);
  }

  if (toggle) {
    toggle.setAttribute('aria-pressed', showOnlyFavorites ? 'true' : 'false');
    toggle.classList.toggle('is-active', showOnlyFavorites);
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
  favoritesToggle.dataset.active = favoritesToggle.dataset.active === 'true' ? 'false' : 'true';
  applyFavoritesOnlyFilter();
});

// Guard against redeclaring the client
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

  try {
    const { data: { user } } = await supabase.auth.getUser();

    if (user) {
      await fetch('/auth/sync-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: user.email,
          name: user.user_metadata?.name
        })
      });

      if (window.location.pathname === '/login') {
        window.location.href = '/wishlist';
        return;
      }

      if (!sessionStorage.getItem('wasSynced')) {
        sessionStorage.setItem('wasSynced', 'true');
        window.location.reload();
        return;
      }
    } else {
      if (window.location.pathname === '/wishlist') {
        window.location.href = '/login';
        return;
      }

      sessionStorage.removeItem('wasSynced');
    }
  } catch (err) {
    console.error('Auth error:', err);
  } finally {
    if (overlay) {
      overlay.style.opacity = '0';
      setTimeout(() => {
        overlay.style.display = 'none';
      }, 500);
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  refreshFavoriteUI();
});

handleAuth();
