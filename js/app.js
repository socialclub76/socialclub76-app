// ══════════════════════════════════════════════════════════
// SOCIAL CLUB 76 — App Logic v7
// Neon Rainbow Edition — Dynamic Data, Reviews, Particles
// ══════════════════════════════════════════════════════════

const CONFIG = {
  telegram: 'https://t.me/socialclub76',
  signal:   'https://signal.me/#eu/9qdkMgh1Q4H00k4wTUAUXpMrS5GBfUObWj_NX-e2qJEeZ51WFbJLKZ_KGB08dJQd',
  potatos:  'https://t.me/canalpotatos',
  luffa:   'https://t.me/canalluffa',
  dataUrl:  'data/',           // Relative path to data folder
  serverUrl: null,             // Set to server URL when bot is running (e.g. 'http://localhost:3076/')
};

// ── Fallback Catalogue (used if JSON can't load) ─────────
const FALLBACK_CATALOGUE = [
  {
    id: 'jaune-mousseux', name: 'Jaune Mousseux', type: 'Exclusif',
    specs: { origin: 'Indoor Control', grade: 'Artisanal', thc: 'Très Élevé', terpene: 'Agrumes / Terreux' },
    desc: 'Une sélection dorée aux arômes complexes et lumineux.',
    heroImg: null, images: [], video: null,
  },
  {
    id: 'calimousse', name: 'Calimousse', type: 'Rare',
    specs: { origin: 'California', grade: 'Sélection', thc: 'Élevé', terpene: 'Fruité / Musqué' },
    desc: 'La douceur californienne rencontre la mousse européenne.',
    heroImg: null, images: [], video: null,
  },
  {
    id: 'weed-hollandaise', name: 'Weed Hollandaise', type: 'Classic',
    specs: { origin: 'Amsterdam', grade: 'Premium', thc: 'Modéré', terpene: 'Floral / Épicé' },
    desc: 'Héritage hollandais, parfum floral délicat et équilibre parfait.',
    heroImg: null, images: [], video: null,
  },
  {
    id: 'cali-usa', name: 'Cali USA', type: 'Top Shelf',
    specs: { origin: 'Los Angeles', grade: 'Elite', thc: 'Maximum', terpene: 'Exotique / Gas' },
    desc: 'Inspirée du soleil californien, profil exotique et sucré.',
    heroImg: null, images: [], video: null,
  },
  {
    id: 'dry-sift', name: 'Dry-Sift 120u', type: 'Concentré',
    specs: { origin: 'Dihram Farm', grade: 'Full Melt', thc: 'Extrême', terpene: 'Résine / Pin' },
    desc: 'Concentré de pureté extrême, riche en terpènes résineux.',
    heroImg: null, images: [], video: null,
  },
];

let CATALOGUE = [];
let REVIEWS = {};
let current = null;
let carouselN = 0;

// ── SVG Templates ─────────────────────────────────────────
const STAR_SVG = `<svg class="star" viewBox="0 0 24 24"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26"/></svg>`;
const STAR_EMPTY_SVG = `<svg class="star empty" viewBox="0 0 24 24"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26"/></svg>`;

function starsHTML(rating, maxSize) {
  let html = '';
  for (let i = 1; i <= 5; i++) {
    html += i <= rating ? STAR_SVG : STAR_EMPTY_SVG;
  }
  return html;
}

// ══════════════════════════════════════════════════════════
// TELEGRAM SDK
// ══════════════════════════════════════════════════════════
const tg = window.Telegram?.WebApp ?? null;
if (tg) {
  tg.ready(); tg.expand();
  try { tg.setHeaderColor('#030108'); tg.setBackgroundColor('#030108'); } catch(_) {}
}

// ══════════════════════════════════════════════════════════
// DOM ELEMENTS
// ══════════════════════════════════════════════════════════
let $cards, $backdrop, $sheet, $fab, $toast, $sheetTabs, $sheetPanels, $menuList;

// ══════════════════════════════════════════════════════════
// FLOATING PARTICLES — Rainbow Ambiance
// ══════════════════════════════════════════════════════════
function createParticles() {
  const container = document.getElementById('particles');
  if (!container) return;
  const colors = [
    'rgba(255, 45, 149, 0.65)',
    'rgba(255, 217, 91, 0.55)',
    'rgba(132, 210, 255, 0.5)',
    'rgba(161, 86, 255, 0.45)',
    'rgba(34, 160, 255, 0.45)'
  ];

  // denser, larger, glowy particles for a Rockstar neon ambiance
  for (let i = 0; i < 48; i++) {
    const p = document.createElement('div');
    p.className = 'particle';
    const size = Math.random() * 14 + 4; // larger
    const color = colors[Math.floor(Math.random() * colors.length)];
    const duration = Math.random() * 30 + 20;
    const delay = Math.random() * 20;
    const left = Math.random() * 110 - 5;
    const opacity = 0.2 + Math.random() * 0.9;

    p.style.cssText = `
      width:${size}px; height:${size}px;
      background:${color};
      left:${left}%; top:${Math.random() * 100}%;
      opacity:${opacity};
      box-shadow: 0 0 ${size * 2}px ${color};
      animation-duration:${duration}s;
      animation-delay:${delay}s;
      transform: translateY(0) scale(${0.6 + Math.random() * 1.2});
    `;
    container.appendChild(p);
  }
}

// ══════════════════════════════════════════════════════════
// 3D TILT EFFECT
// ══════════════════════════════════════════════════════════
function initTilt(el) {
  el.addEventListener('mousemove', (e) => {
    const rect = el.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    const rotateX = ((y - centerY) / centerY) * -6;
    const rotateY = ((x - centerX) / centerX) * 6;
    el.style.transform = `perspective(800px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(1.02, 1.02, 1.02)`;
    const glare = el.querySelector('.glare');
    if (glare) { glare.style.left = `${x}px`; glare.style.top = `${y}px`; glare.style.opacity = 1; }
  });
  el.addEventListener('mouseleave', () => {
    el.style.transform = `perspective(800px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)`;
    const glare = el.querySelector('.glare');
    if (glare) glare.style.opacity = 0;
  });
}

// ══════════════════════════════════════════════════════════
// DATA LOADING
// ══════════════════════════════════════════════════════════
async function loadCatalogue() {
  try {
    const base = CONFIG.serverUrl || CONFIG.dataUrl;
    const res = await fetch(`${base}catalogue.json?t=${Date.now()}`);
    if (!res.ok) throw new Error('HTTP error');
    CATALOGUE = await res.json();
  } catch(e) {
    console.log('Using fallback catalogue:', e.message);
    CATALOGUE = [...FALLBACK_CATALOGUE];
  }
}

async function loadReviews() {
  try {
    const base = CONFIG.serverUrl || CONFIG.dataUrl;
    const res = await fetch(`${base}reviews.json?t=${Date.now()}`);
    if (!res.ok) throw new Error('HTTP error');
    REVIEWS = await res.json();
  } catch(e) {
    console.log('Using localStorage reviews:', e.message);
    const stored = localStorage.getItem('sc76_reviews');
    REVIEWS = stored ? JSON.parse(stored) : {};
  }
}

function saveReviewsLocal() {
  localStorage.setItem('sc76_reviews', JSON.stringify(REVIEWS));
}

async function submitReviewToServer(productId, review) {
  if (!CONFIG.serverUrl) return false;
  try {
    const res = await fetch(`${CONFIG.serverUrl}api/reviews`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productId, review }),
    });
    return res.ok;
  } catch(e) {
    return false;
  }
}

// ══════════════════════════════════════════════════════════
// NAVIGATION
// ══════════════════════════════════════════════════════════
function show(id) {
  document.querySelectorAll('.view').forEach(v => {
    v.classList.remove('active');
    v.style.display = 'none';
  });
  const el = document.getElementById(id);
  el.style.display = 'block';
  el.offsetHeight;
  el.classList.add('active');
}

function openProduct(id) {
  current   = CATALOGUE.find(p => p.id === id);
  carouselN = 0;
  if (!current) return;
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
}

// ══════════════════════════════════════════════════════════
// PRODUCT CARDS — Immersive Grid
// ══════════════════════════════════════════════════════════
function getProductRating(productId) {
  const reviews = REVIEWS[productId] || [];
  if (!reviews.length) return { avg: 0, count: 0 };
  const sum = reviews.reduce((a, r) => a + r.rating, 0);
  return { avg: Math.round((sum / reviews.length) * 10) / 10, count: reviews.length };
}

function buildCards() {
  $cards.innerHTML = '';
  CATALOGUE.forEach((p, i) => {
    const card = document.createElement('article');
    card.className = 'card glass-card';
    card.setAttribute('role', 'listitem');
    card.setAttribute('tabindex', '0');
    card.id = `card-${p.id}`;

    const thumb = p.heroImg
      ? `<img src="${p.heroImg}" alt="${p.name}" loading="lazy"/>`
      : `<div class="card-thumb-ph"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg></div>`;

    const { avg, count } = getProductRating(p.id);
    const ratingHTML = count > 0
      ? `<div class="card-rating">${starsHTML(Math.round(avg))}<span class="card-rating-count">(${count})</span></div>`
      : '';

    card.innerHTML = `
      <div class="card-inner">
        <div class="card-thumb">${thumb}</div>
        <div class="card-body">
          <div class="card-name">${p.name}</div>
          <div class="card-tags">
            <span class="c-tag primary"><span class="c-tag-dot"></span>${p.type}</span>
          </div>
          ${ratingHTML}
        </div>
      </div>
    `;
    
    // Stagger animation
    card.style.animationDelay = `${i * 0.1}s`;
    card.classList.add('animate-in');
    
    card.addEventListener('click', () => openProduct(p.id));
    $cards.appendChild(card);
  });
}

// ══════════════════════════════════════════════════════════
// PRODUCT DETAIL
// ══════════════════════════════════════════════════════════
function renderDetail(p) {
  document.getElementById('dn-name').textContent = p.name;
  document.getElementById('d-name').textContent = p.name;
  document.getElementById('d-type').textContent = p.type;
  document.getElementById('d-desc').textContent = p.desc;
  
  document.getElementById('s-origin').textContent = p.specs.origin;
  document.getElementById('s-grade').textContent = p.specs.grade;
  document.getElementById('s-thc').textContent = p.specs.thc;
  document.getElementById('s-terpene').textContent = p.specs.terpene;

  // Hero Image
  const hero = document.getElementById('d-hero');
  if (p.heroImg || p.images[0]) {
    hero.innerHTML = `<img src="${p.heroImg || p.images[0]}" alt="${p.name}"/>`;
  } else {
    hero.innerHTML = `<div class="det-hero-ph"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg></div>`;
  }

  // Average Rating
  renderProductRating(p.id);

  renderCarousel(p);
  renderVideo(p);
  renderReviews(p.id);
  resetReviewForm();
}

function renderProductRating(productId) {
  const { avg, count } = getProductRating(productId);
  const starsContainer = document.getElementById('d-rating-stars');
  const avgEl = document.getElementById('d-rating-avg');
  const textEl = document.getElementById('d-rating-text');

  if (count === 0) {
    starsContainer.innerHTML = starsHTML(0);
    avgEl.textContent = '';
    textEl.textContent = 'Aucun avis';
  } else {
    starsContainer.innerHTML = starsHTML(Math.round(avg));
    avgEl.textContent = avg.toFixed(1);
    textEl.textContent = `(${count} avis)`;
  }
}

// ══════════════════════════════════════════════════════════
// CAROUSEL
// ══════════════════════════════════════════════════════════
function renderCarousel(p) {
  const track = document.getElementById('carousel-track');
  const dots = document.getElementById('carousel-dots');
  track.innerHTML = dots.innerHTML = '';

  if (!p.images?.length) {
    track.innerHTML = `<div class="carousel-slide"><div class="carousel-empty"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg><p>Galerie Confidentielle</p></div></div>`;
    dots.innerHTML = `<div class="cdot on"></div>`;
    return;
  }

  p.images.forEach((src, i) => {
    const slide = document.createElement('div');
    slide.className = 'carousel-slide';
    slide.innerHTML = `<img src="${src}" alt="${p.name} ${i + 1}" loading="lazy"/>`;
    track.appendChild(slide);
    
    const d = document.createElement('div');
    d.className = 'cdot' + (i === 0 ? ' on' : '');
    d.addEventListener('click', () => goSlide(i));
    dots.appendChild(d);
  });

  updateCarousel();
  
  let sx = 0;
  track.addEventListener('touchstart', e => { sx = e.touches[0].clientX; }, { passive: true });
  track.addEventListener('touchend', e => {
    const dx = sx - e.changedTouches[0].clientX;
    if (Math.abs(dx) > 40) goSlide(carouselN + (dx > 0 ? 1 : -1));
  }, { passive: true });
}

function goSlide(i) {
  if (!current?.images?.length) return;
  carouselN = Math.max(0, Math.min(i, current.images.length - 1));
  updateCarousel();
}

function updateCarousel() {
  document.getElementById('carousel-track').style.transform = `translateX(-${carouselN * 100}%)`;
  document.querySelectorAll('#carousel-dots .cdot').forEach((d, i) => d.classList.toggle('on', i === carouselN));
}

// ══════════════════════════════════════════════════════════
// VIDEO
// ══════════════════════════════════════════════════════════
function renderVideo(p) {
  const sec = document.getElementById('det-video-sec');
  const box = document.getElementById('video-box');
  if (p.video) {
    sec.style.display = 'block';
    box.innerHTML = `<video src="${p.video}" controls preload="metadata" playsinline></video>`;
  } else {
    sec.style.display = 'none';
  }
}

// ══════════════════════════════════════════════════════════
// REVIEWS SYSTEM
// ══════════════════════════════════════════════════════════
function renderReviews(productId) {
  const list = document.getElementById('reviews-list');
  const countEl = document.getElementById('reviews-count');
  const reviews = REVIEWS[productId] || [];

  countEl.textContent = reviews.length > 0 ? `${reviews.length} avis` : '';

  if (reviews.length === 0) {
    list.innerHTML = `
      <div class="reviews-empty">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
        </svg>
        <p>Soyez le premier à laisser un avis</p>
      </div>
    `;
    return;
  }

  list.innerHTML = reviews.map((r, i) => {
    const initial = (r.name || 'A')[0].toUpperCase();
    const dateStr = r.date ? new Date(r.date).toLocaleDateString('fr-FR', { day:'numeric', month:'short', year:'numeric' }) : '';
    return `
      <div class="review-card" style="animation-delay:${i * 0.08}s">
        <div class="review-top">
          <div class="review-author">
            <div class="review-avatar">${initial}</div>
            <span class="review-name">${escapeHTML(r.name || 'Anonyme')}</span>
          </div>
          <span class="review-date">${dateStr}</span>
        </div>
        <div class="review-stars">${starsHTML(r.rating)}</div>
        <div class="review-comment">${escapeHTML(r.comment)}</div>
      </div>
    `;
  }).join('');
}

function resetReviewForm() {
  document.getElementById('review-name-input').value = '';
  document.getElementById('review-comment-input').value = '';
  document.querySelectorAll('#star-selector input').forEach(i => i.checked = false);
}

function getSelectedRating() {
  const checked = document.querySelector('#star-selector input:checked');
  return checked ? parseInt(checked.value) : 0;
}

function renderSheetMenu() {
  if (!$menuList) return;
  $menuList.innerHTML = CATALOGUE.map(p => `
    <button class="menu-item" type="button" data-product="${p.id}">
      ${p.name} · ${p.type}
    </button>
  `).join('');

  $menuList.querySelectorAll('.menu-item').forEach(button => {
    button.addEventListener('click', () => {
      const productId = button.dataset.product;
      closeSheet();
      openProduct(productId);
    });
  });
}


async function handleReviewSubmit() {
  if (!current) return;

  const name = document.getElementById('review-name-input').value.trim() || 'Anonyme';
  const rating = getSelectedRating();
  const comment = document.getElementById('review-comment-input').value.trim();

  if (rating === 0) {
    showToast('Sélectionnez une note ⭐');
    return;
  }
  if (!comment) {
    showToast('Écrivez un commentaire 💬');
    return;
  }

  const review = {
    name,
    rating,
    comment,
    date: new Date().toISOString().split('T')[0],
  };

  // Add to local data
  if (!REVIEWS[current.id]) REVIEWS[current.id] = [];
  REVIEWS[current.id].push(review);
  saveReviewsLocal();

  // Try to submit to server
  await submitReviewToServer(current.id, review);

  // Re-render
  renderReviews(current.id);
  renderProductRating(current.id);
  resetReviewForm();
  showToast('Avis publié avec succès ✨');
}

function escapeHTML(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ══════════════════════════════════════════════════════════
// TOAST NOTIFICATIONS
// ══════════════════════════════════════════════════════════
let toastTimeout = null;
function showToast(msg) {
  $toast.textContent = msg;
  $toast.classList.add('show');
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => $toast.classList.remove('show'), 3000);
}

// ══════════════════════════════════════════════════════════
// ORDER SHEET
// ══════════════════════════════════════════════════════════
function openSheet() {
  $backdrop.classList.add('open');
  $sheet.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeSheet() {
  $backdrop.classList.remove('open');
  $sheet.classList.remove('open');
  document.body.style.overflow = '';
}
// DOM-dependent bindings are initialized inside DOMContentLoaded

function autoBindSheetTabs() {
  $sheetTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const target = tab.dataset.tab;
      $sheetTabs.forEach(t => t.classList.toggle('active', t === tab));
      $sheetPanels.forEach(panel => panel.classList.toggle('active', panel.id === `sheet-panel-${target}`));
    });
  });
}

function autoBindFooterHub() {
  // Footer buttons now switch inline hub panels instead of opening the sheet
  const btnMenu = document.getElementById('hub-menu');
  const btnInfo = document.getElementById('hub-info');
  const btnLinks = document.getElementById('hub-links');
  const panels = {
    menu: document.getElementById('hub-panel-menu'),
    infos: document.getElementById('hub-panel-infos'),
    links: document.getElementById('hub-panel-links'),
  };

  [btnMenu, btnInfo, btnLinks].forEach(b => {
    if (!b) return;
    b.addEventListener('click', (e) => {
      e.preventDefault();
      const tab = b.dataset.tab;
      // Visual active state on footer
      document.querySelectorAll('.hub-btn').forEach(h => h.classList.toggle('active', h === b));
      // Show the matching inline panel
      Object.keys(panels).forEach(k => {
        const el = panels[k];
        if (!el) return;
        if (k === tab) { el.style.display = ''; el.classList.add('active'); }
        else { el.style.display = 'none'; el.classList.remove('active'); }
      });
    });
  });
}

// ══════════════════════════════════════════════════════════
// INITIALIZATION
// ══════════════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', async () => {
  // Create ambient particles
  createParticles();

  // Load data
  await Promise.all([loadCatalogue(), loadReviews()]);

  // Query DOM elements now that DOM is ready
  $cards = document.getElementById('cards');
  $backdrop = document.getElementById('sheet-backdrop');
  $sheet = document.getElementById('order-sheet');
  $fab = document.getElementById('fab-order');
  $toast = document.getElementById('toast');
  $sheetTabs = document.querySelectorAll('.sheet-tab');
  $sheetPanels = document.querySelectorAll('.sheet-panel');
  $menuList = document.getElementById('sheet-menu-list');

  // Build UI
  renderSheetMenu();
  
  // Apply Tilt to static elements
  document.querySelectorAll('.tilt-element').forEach(initTilt);

  // Setup sheet buttons and bindings (guarded)
  const btnTelegram = document.getElementById('btn-telegram');
  const btnSignal = document.getElementById('btn-signal');
  if (btnTelegram) btnTelegram.href = CONFIG.telegram;
  if (btnSignal) btnSignal.href = CONFIG.signal;
  // Also wire inline hub links
  const hubTele = document.getElementById('hub-telegram-link');
  const hubSignal = document.getElementById('hub-signal-link');
  if (hubTele) hubTele.href = CONFIG.potatos || CONFIG.telegram;
  if (hubSignal) hubSignal.href = CONFIG.signal;

  autoBindSheetTabs();
  autoBindFooterHub();

  if ($backdrop) $backdrop.addEventListener('click', closeSheet);
  const sheetClose = document.getElementById('sheet-close');
  const sheetHandle = document.getElementById('sheet-handle');
  if (sheetClose) sheetClose.addEventListener('click', closeSheet);
  if (sheetHandle) sheetHandle.addEventListener('click', closeSheet);

  let sheetStartY = 0;
  if ($sheet) {
    $sheet.addEventListener('touchstart', e => { sheetStartY = e.touches[0].clientY; }, { passive: true });
    $sheet.addEventListener('touchend', e => {
      if (e.changedTouches[0].clientY - sheetStartY > 80) closeSheet();
    }, { passive: true });
  }

  const backBtn = document.getElementById('back-btn');
  if (backBtn) backBtn.addEventListener('click', goHome);

  const reviewSubmitBtn = document.getElementById('review-submit-btn');
  if (reviewSubmitBtn) reviewSubmitBtn.addEventListener('click', handleReviewSubmit);

  show('view-home');
});
