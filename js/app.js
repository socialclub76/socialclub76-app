// ══════════════════════════════════════════════════════════
// SOCIAL CLUB 76 — App Logic v8.0 (Full & Fixed)
// ══════════════════════════════════════════════════════════

const CONFIG = {
  dataUrl: 'data/',
  serverUrl: null,
  apiUrl: null, // Ex: 'http://localhost:3076'
};

let LINKS = {
  potatos: "https://t.me/canalpotatos",
  luffa:   "https://t.me/canalluffa",
  telegram: "https://t.me/socialclub76",
  signal:  "https://signal.me/#eu/9qdkMgh1Q4H00k4wTUAUXpMrS5GBfUObWj_NX-e2qJEeZ51WFbJLKZ_KGB08dJQd"
};

async function loadLinks() {
  try {
    const base = CONFIG.serverUrl || CONFIG.dataUrl;
    const res = await fetch(`${base}links.json?t=${Date.now()}`);
    if (res.ok) LINKS = await res.json();
  } catch(e) {
    console.log("Using default links");
  }
}

function applyLinks() {
  // Bottom sheet links
  const btnSignal   = document.getElementById('btn-signal');
  const btnTelegram = document.getElementById('btn-telegram');
  if (btnSignal)   btnSignal.href   = LINKS.signal   || '#';
  if (btnTelegram) btnTelegram.href = LINKS.telegram  || '#';

  // Hub inline links
  const hubTg  = document.getElementById('hub-telegram-link');
  const hubSig = document.getElementById('hub-signal-link');
  if (hubTg)  hubTg.href  = LINKS.telegram || '#';
  if (hubSig) hubSig.href = LINKS.signal   || '#';
}

// Catalogue & reviews
let CATALOGUE = [];
let REVIEWS   = {};
let current   = null;
let carouselN = 0;
let currentCategory = null;

// ── SVG Stars ─────────────────────────────────────────────
const STAR_SVG       = `<svg class="star" viewBox="0 0 24 24"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26"/></svg>`;
const STAR_EMPTY_SVG = `<svg class="star empty" viewBox="0 0 24 24"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26"/></svg>`;

function starsHTML(rating) {
  let html = '';
  for (let i = 1; i <= 5; i++) html += i <= rating ? STAR_SVG : STAR_EMPTY_SVG;
  return html;
}

function escapeHTML(str) {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

// ── Telegram SDK ─────────────────────────────────────────
const tg = window.Telegram?.WebApp ?? null;
let TG_USER = { id: null, firstName: '', initData: null };

if (tg) {
  tg.ready(); tg.expand();
  try { tg.setHeaderColor('#030108'); tg.setBackgroundColor('#030108'); } catch(_) {}
  if (tg.initDataUnsafe?.user) {
    const u = tg.initDataUnsafe.user;
    TG_USER.id        = u.id;
    TG_USER.firstName = u.first_name || 'User';
    TG_USER.initData  = tg.initData;
  }
}

// ── DOM refs ─────────────────────────────────────────────
let $cards, $backdrop, $sheet, $toast, $sheetTabs, $sheetPanels;

// ── Particles ─────────────────────────────────────────────
function createParticles() {
  const container = document.getElementById('particles');
  if (!container) return;
  const colors = [
    'rgba(255,45,149,0.65)', 'rgba(255,217,91,0.55)',
    'rgba(132,210,255,0.5)', 'rgba(161,86,255,0.45)',
    'rgba(34,160,255,0.45)'
  ];
  for (let i = 0; i < 48; i++) {
    const p = document.createElement('div');
    p.className = 'particle';
    const size     = Math.random() * 14 + 4;
    const color    = colors[Math.floor(Math.random() * colors.length)];
    const duration = Math.random() * 30 + 20;
    const delay    = Math.random() * 20;
    p.style.cssText = `width:${size}px;height:${size}px;background:${color};left:${Math.random()*110-5}%;top:${Math.random()*100}%;opacity:${0.2+Math.random()*0.9};box-shadow:0 0 ${size*2}px ${color};animation-duration:${duration}s;animation-delay:${delay}s;`;
    container.appendChild(p);
  }
}

// ── Data Loading ─────────────────────────────────────────
async function loadCatalogue() {
  try {
    const base = CONFIG.serverUrl || CONFIG.dataUrl;
    const res  = await fetch(`${base}catalogue.json?t=${Date.now()}`);
    if (res.ok) {
      const data = await res.json();
      CATALOGUE  = Array.isArray(data) ? data : [];
    } else {
      CATALOGUE = [];
    }
  } catch(e) {
    console.log('Catalogue JSON non trouvé → démarrage vide');
    CATALOGUE = [];
  }
}

async function loadReviews() {
  try {
    const base = CONFIG.serverUrl || CONFIG.dataUrl;
    const res  = await fetch(`${base}reviews.json?t=${Date.now()}`);
    if (res.ok) REVIEWS = await res.json();
    else throw new Error();
  } catch(e) {
    const stored = localStorage.getItem('sc76_reviews');
    REVIEWS = stored ? JSON.parse(stored) : {};
  }
}

function saveReviewsLocal() {
  localStorage.setItem('sc76_reviews', JSON.stringify(REVIEWS));
}

// ── Navigation ───────────────────────────────────────────
function show(id) {
  document.querySelectorAll('.view').forEach(v => {
    v.classList.remove('active');
    v.style.display = 'none';
  });
  const el = document.getElementById(id);
  if (el) {
    el.style.display = 'block';
    el.offsetHeight; // force reflow
    el.classList.add('active');
  }
}

function openProduct(id) {
  current = CATALOGUE.find(p => p.id === id);
  if (!current) return;
  carouselN = 0;
  renderDetail(current);
  show('view-product');
  window.scrollTo({ top: 0, behavior: 'smooth' });

  if (tg?.BackButton) {
    tg.BackButton.show();
    tg.BackButton.offClick(goHome);
    tg.BackButton.onClick(goHome);
  }
}

function goHome() {
  show('view-home');
  if (tg?.BackButton) tg.BackButton.hide();

  // Remettre le footer hub sur l'onglet Liens
  document.querySelectorAll('.hub-btn').forEach(h => h.classList.remove('active'));
  const linksBtn = document.getElementById('hub-links');
  if (linksBtn) linksBtn.classList.add('active');

  // Remettre le bon hub panel visible
  document.querySelectorAll('.hub-panel').forEach(panel => {
    panel.style.display = panel.id === 'hub-panel-links' ? 'block' : 'none';
  });
}

// ── Product Rating Helper ─────────────────────────────────
function getProductRating(productId) {
  const reviews = REVIEWS[productId] || [];
  if (!reviews.length) return { avg: 0, count: 0 };
  const sum = reviews.reduce((a, r) => a + (r.rating || 0), 0);
  return { avg: Math.round((sum / reviews.length) * 10) / 10, count: reviews.length };
}

// ── Product Cards ─────────────────────────────────────────
function buildCards() {
  if (!$cards) return;
  $cards.innerHTML = '';

  let filtered = CATALOGUE;
  if (currentCategory) {
    filtered = CATALOGUE.filter(p => (p.type || '').toLowerCase() === currentCategory.toLowerCase());
  }

  if (filtered.length === 0) {
    $cards.innerHTML = `
      <p style="padding:60px 20px;text-align:center;color:#888;font-size:1.1em;">
        Aucun produit disponible pour le moment.<br>
        <small>Ajoutez des produits via le bot Admin.</small>
      </p>`;
    return;
  }

  filtered.forEach((p, i) => {
    const card = document.createElement('article');
    card.className = 'card glass-card';
    card.setAttribute('role', 'listitem');
    card.setAttribute('tabindex', '0');
    card.id = `card-${p.id}`;

    const heroSrc = p.heroImg || (p.images && p.images[0]) || '';
    const thumb = heroSrc
      ? `<img src="${heroSrc}" alt="${escapeHTML(p.name)}" loading="lazy"/>`
      : `<div class="card-thumb-ph"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg></div>`;

    const { avg, count } = getProductRating(p.id);
    const ratingHTML = count > 0
      ? `<div class="card-rating">${starsHTML(Math.round(avg))}<span class="card-rating-count">(${count})</span></div>`
      : '';

    card.innerHTML = `
      <div class="card-inner">
        <div class="card-thumb">${thumb}</div>
        <div class="card-body">
          <div class="card-name">${escapeHTML(p.name || 'Sans nom')}</div>
          <div class="card-tags">
            <span class="c-tag primary"><span class="c-tag-dot"></span>${escapeHTML(p.type || 'Inconnu')}</span>
          </div>
          ${ratingHTML}
        </div>
        <div class="card-right">
          <div class="card-arrow">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
          </div>
        </div>
      </div>`;

    card.style.animationDelay = `${i * 0.08}s`;
    card.classList.add('animate-in');

    // CLICK → ouvrir la page produit
    card.addEventListener('click', () => openProduct(p.id));
    card.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') openProduct(p.id); });

    $cards.appendChild(card);
  });
}

// ── Product Detail ─────────────────────────────────────────
function renderDetail(p) {
  // Nav & title
  const dnName = document.getElementById('dn-name');
  const dName  = document.getElementById('d-name');
  const dType  = document.getElementById('d-type');

  if (dnName) dnName.textContent = p.name || '';
  if (dName)  dName.textContent  = p.name || '';
  if (dType)  dType.textContent  = p.type || '';

  // Hero image
  const hero = document.getElementById('d-hero');
  if (hero) {
    const src = p.heroImg || (p.images && p.images[0]);
    hero.innerHTML = src
      ? `<img src="${src}" alt="${escapeHTML(p.name)}" />`
      : `<div class="det-hero-ph">Aucune image</div>`;
  }

  // Specs
  const sOrigin  = document.getElementById('s-origin');
  const sTasting = document.getElementById('s-tasting');
  if (sOrigin)  sOrigin.textContent  = p.specs?.origin  || '—';
  if (sTasting) sTasting.textContent = p.specs?.tasting || '—';

  renderProductRating(p.id);
  renderCarousel(p);
  renderVideo(p);
  renderReviews(p.id);
  resetReviewForm();
}

function renderProductRating(productId) {
  const { avg, count } = getProductRating(productId);
  const starsContainer = document.getElementById('d-rating-stars');
  const avgEl          = document.getElementById('d-rating-avg');
  const textEl         = document.getElementById('d-rating-text');

  if (!starsContainer) return;
  if (count === 0) {
    starsContainer.innerHTML = starsHTML(0);
    if (avgEl)  avgEl.textContent  = '';
    if (textEl) textEl.textContent = 'Aucun avis';
  } else {
    starsContainer.innerHTML = starsHTML(Math.round(avg));
    if (avgEl)  avgEl.textContent  = avg.toFixed(1);
    if (textEl) textEl.textContent = `(${count} avis)`;
  }
}

// ── Carousel ─────────────────────────────────────────────
function renderCarousel(p) {
  const track = document.getElementById('carousel-track');
  const dots  = document.getElementById('carousel-dots');
  if (!track || !dots) return;
  track.innerHTML = dots.innerHTML = '';

  if (!p.images || !p.images.length) {
    track.innerHTML = `<div class="carousel-slide"><div class="carousel-empty">Galerie Confidentielle</div></div>`;
    dots.innerHTML  = `<div class="cdot on"></div>`;
    return;
  }

  p.images.forEach((src, i) => {
    const slide = document.createElement('div');
    slide.className = 'carousel-slide';
    slide.innerHTML = `<img src="${src}" alt="${escapeHTML(p.name)} ${i + 1}" loading="lazy"/>`;
    track.appendChild(slide);

    const d = document.createElement('div');
    d.className = 'cdot' + (i === 0 ? ' on' : '');
    d.addEventListener('click', () => goSlide(i));
    dots.appendChild(d);
  });

  // Swipe support
  let touchStartX = 0;
  track.addEventListener('touchstart', e => { touchStartX = e.changedTouches[0].clientX; }, { passive: true });
  track.addEventListener('touchend',   e => {
    const dx = e.changedTouches[0].clientX - touchStartX;
    if (Math.abs(dx) > 40) goSlide(carouselN + (dx < 0 ? 1 : -1));
  });

  updateCarousel();
}

function goSlide(i) {
  if (!current?.images?.length) return;
  carouselN = Math.max(0, Math.min(i, current.images.length - 1));
  updateCarousel();
}

function updateCarousel() {
  const track = document.getElementById('carousel-track');
  if (track) track.style.transform = `translateX(-${carouselN * 100}%)`;
  document.querySelectorAll('#carousel-dots .cdot').forEach((d, i) => d.classList.toggle('on', i === carouselN));
}

// ── Video ──────────────────────────────────────────────────
function renderVideo(p) {
  const sec = document.getElementById('det-video-sec');
  const box = document.getElementById('video-box');
  if (!sec || !box) return;
  if (p.video) {
    sec.style.display = 'block';
    box.innerHTML = `<video src="${p.video}" controls preload="metadata" playsinline></video>`;
  } else {
    sec.style.display = 'none';
    box.innerHTML = '';
  }
}

// ── Reviews ────────────────────────────────────────────────
function renderReviews(productId) {
  const list    = document.getElementById('reviews-list');
  const countEl = document.getElementById('reviews-count');
  if (!list) return;

  const reviews = REVIEWS[productId] || [];

  if (countEl) countEl.textContent = reviews.length > 0
    ? `${reviews.length} avis client${reviews.length > 1 ? 's' : ''}`
    : 'Aucun avis pour l\'instant';

  if (reviews.length === 0) {
    list.innerHTML = '';
    return;
  }

  list.innerHTML = reviews.map(r => {
    const avatar = r.userPhotoUrl
      ? `<img src="${r.userPhotoUrl}" alt="${escapeHTML(r.name || 'User')}" class="review-avatar"/>`
      : `<div class="review-avatar-ph">${(r.name || 'A')[0].toUpperCase()}</div>`;

    return `
      <div class="review-item glass-card">
        <div class="review-header">
          <div class="review-user">
            ${avatar}
            <div class="review-user-info">
              <div class="review-name">${escapeHTML(r.name || 'Anonyme')}</div>
              <div class="review-date">${r.date || ''}</div>
            </div>
          </div>
          <div class="review-stars">${starsHTML(r.rating || 0)}</div>
        </div>
        ${r.comment ? `<div class="review-comment">${escapeHTML(r.comment)}</div>` : ''}
      </div>`;
  }).join('');
}

// ── Review Form ────────────────────────────────────────────
function resetReviewForm() {
  const commentInput = document.getElementById('review-comment-input');
  if (commentInput) commentInput.value = '';
  document.querySelectorAll('#star-selector input').forEach(i => i.checked = false);
}

function getSelectedRating() {
  const checked = document.querySelector('#star-selector input:checked');
  return checked ? parseInt(checked.value) : 0;
}

async function handleReviewSubmit() {
  if (!current) return showToast('❌ Aucun produit sélectionné.');

  const rating  = getSelectedRating();
  const comment = (document.getElementById('review-comment-input')?.value || '').trim();

  if (!rating)   return showToast('⭐ Choisis une note !');
  if (!comment)  return showToast('✏️ Écris un commentaire.');

  // Offline mode (sans Telegram initData)
  if (!TG_USER.initData) {
    if (!REVIEWS[current.id]) REVIEWS[current.id] = [];
    REVIEWS[current.id].push({
      name:    TG_USER.firstName || 'Anonyme',
      rating,
      comment,
      date:    new Date().toISOString().split('T')[0],
    });
    saveReviewsLocal();
    renderReviews(current.id);
    renderProductRating(current.id);
    resetReviewForm();
    return showToast('✅ Avis publié !');
  }

  // Online mode avec Telegram auth
  const btn = document.getElementById('review-submit-btn');
  if (btn) { btn.disabled = true; btn.textContent = 'Envoi...'; }

  try {
    const apiBase = CONFIG.apiUrl || CONFIG.serverUrl || '';
    const res = await fetch(`${apiBase}/api/reviews`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        productId: current.id,
        review: {
          rating,
          comment,
          date: new Date().toISOString().split('T')[0],
          initData: TG_USER.initData,
        },
      }),
    });

    const data = await res.json();
    if (res.ok && data.success) {
      await loadReviews();
      renderReviews(current.id);
      renderProductRating(current.id);
      resetReviewForm();
      showToast(`✅ Avis publié, ${data.name || 'merci'} !`);
    } else {
      showToast(`❌ ${data.error || 'Erreur lors de l\'envoi.'}`);
    }
  } catch(e) {
    // Fallback local
    if (!REVIEWS[current.id]) REVIEWS[current.id] = [];
    REVIEWS[current.id].push({
      name: TG_USER.firstName || 'Anonyme',
      rating, comment,
      date: new Date().toISOString().split('T')[0],
    });
    saveReviewsLocal();
    renderReviews(current.id);
    renderProductRating(current.id);
    resetReviewForm();
    showToast('✅ Avis enregistré localement.');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Publier mon avis'; }
  }
}

// ── Toast ─────────────────────────────────────────────────
function showToast(msg) {
  if (!$toast) return;
  $toast.textContent = msg;
  $toast.classList.add('show');
  setTimeout(() => $toast.classList.remove('show'), 3200);
}

// ── Sheet Menu ─────────────────────────────────────────────
function renderSheetMenu() {
  const list = document.getElementById('sheet-menu-list');
  if (!list) return;
  list.innerHTML = '';

  if (!CATALOGUE.length) {
    list.innerHTML = `<div class="menu-note">Aucun produit disponible.</div>`;
    return;
  }

  CATALOGUE.forEach(p => {
    const btn = document.createElement('button');
    btn.className = 'menu-item';
    btn.innerHTML = `
      <div class="menu-item-name">${escapeHTML(p.name || 'Sans nom')}</div>
      <div class="menu-item-meta">${escapeHTML(p.type || '')}${p.specs?.origin ? ' · ' + escapeHTML(p.specs.origin) : ''}</div>`;
    btn.addEventListener('click', () => {
      closeSheet();
      setTimeout(() => openProduct(p.id), 340);
    });
    list.appendChild(btn);
  });
}

// ── Bottom Sheet ─────────────────────────────────────────
function openSheet() {
  if (!$backdrop || !$sheet) return;
  $backdrop.classList.add('open');
  $sheet.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeSheet() {
  if (!$backdrop || !$sheet) return;
  $backdrop.classList.remove('open');
  $sheet.classList.remove('open');
  document.body.style.overflow = '';
}

// ── Sheet Tabs ────────────────────────────────────────────
function autoBindSheetTabs() {
  if (!$sheetTabs) return;
  $sheetTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      $sheetTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      const targetTab = tab.dataset.tab;
      $sheetPanels.forEach(panel => {
        const isActive = panel.id === `sheet-panel-${targetTab}`;
        panel.classList.toggle('active', isActive);
        panel.style.display = isActive ? 'block' : 'none';
      });
    });
  });
}

// ── Footer Hub ────────────────────────────────────────────
function autoBindFooterHub() {
  const hubBtns = document.querySelectorAll('.hub-btn');
  const hubPanels = document.querySelectorAll('.hub-panel');
  const catView      = document.getElementById('hub-categories');
  const filteredView = document.getElementById('hub-filtered-view');

  hubBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.tab;
      hubBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      hubPanels.forEach(panel => {
        const isActive = panel.id === `hub-panel-${tab}`;
        panel.classList.toggle('active', isActive);
        panel.style.display = isActive ? 'block' : 'none';
      });

      // Reset category view when switching to menu tab
      if (tab === 'menu' && catView && filteredView) {
        catView.style.display      = 'grid';
        filteredView.style.display = 'none';
        currentCategory = null;
      }
    });
  });
}

// ══════════════════════════════════════════════════════════
// INITIALIZATION
// ══════════════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', async () => {
  createParticles();

  await Promise.all([loadCatalogue(), loadReviews()]);
  await loadLinks();
  applyLinks();

  // DOM refs
  $cards       = document.getElementById('cards');
  $backdrop    = document.getElementById('sheet-backdrop');
  $sheet       = document.getElementById('order-sheet');
  $toast       = document.getElementById('toast');
  $sheetTabs   = document.querySelectorAll('.sheet-tab');
  $sheetPanels = document.querySelectorAll('.sheet-panel');

  renderSheetMenu();

  // ── Category filtering ──────────────────────────────────
  const catBtns      = document.querySelectorAll('.cat-btn');
  const catView      = document.getElementById('hub-categories');
  const filteredView = document.getElementById('hub-filtered-view');
  const backCatBtn   = document.getElementById('btn-back-cat');

  catBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      btn.blur(); // Retire le focus pour enlever le neon au retour
      currentCategory = btn.dataset.cat;
      if (catView)      catView.style.display      = 'none';
      if (filteredView) filteredView.style.display  = 'block';
      buildCards();
    });
  });

  if (backCatBtn) {
    backCatBtn.addEventListener('click', () => {
      currentCategory = null;
      if (catView)      catView.style.display      = 'grid';
      if (filteredView) filteredView.style.display  = 'none';
      buildCards();
    });
  }

  buildCards();

  // ── Nav & Back button ───────────────────────────────────
  const backBtn = document.getElementById('back-btn');
  if (backBtn) backBtn.addEventListener('click', goHome);

  // ── Review submit ───────────────────────────────────────
  const reviewSubmitBtn = document.getElementById('review-submit-btn');
  if (reviewSubmitBtn) reviewSubmitBtn.addEventListener('click', handleReviewSubmit);

  // ── Sheet & Tabs ────────────────────────────────────────
  autoBindSheetTabs();
  autoBindFooterHub();

  if ($backdrop)  $backdrop.addEventListener('click', closeSheet);
  const sheetClose = document.getElementById('sheet-close');
  if (sheetClose) sheetClose.addEventListener('click', closeSheet);

  // Init sheet panels display
  $sheetPanels.forEach((p, i) => { p.style.display = i === 0 ? 'block' : 'none'; });

  // ── Hub panels initial state ─────────────────────────────
  // On utilise style.display directement pour éviter les conflits avec la classe 'active' du HTML
  document.querySelectorAll('.hub-panel').forEach(panel => {
    panel.style.display = panel.id === 'hub-panel-links' ? 'block' : 'none';
  });

  // Keyboard carousel
  document.addEventListener('keydown', e => {
    const vp = document.getElementById('view-product');
    if (!vp || !vp.classList.contains('active')) return;
    if (e.key === 'ArrowLeft')  goSlide(carouselN - 1);
    if (e.key === 'ArrowRight') goSlide(carouselN + 1);
  });

  show('view-home');
});