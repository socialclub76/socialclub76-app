// ══════════════════════════════════════════════════════════
// SOCIAL CLUB 76 — Admin Telegram Bot + API Server
// Gestion complète : Produits, Images, Vidéos, Avis
// ══════════════════════════════════════════════════════════

const TelegramBot = require('node-telegram-bot-api');
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

// ══════════════════════════════════════════════════════════
// CONFIGURATION — À MODIFIER
// ══════════════════════════════════════════════════════════
const BOT_TOKEN = 'TON_TOKEN_ICI';       // <-- Remplace par ton token @BotFather
const ADMIN_IDS = [];                     // <-- Ajoute ton ID Telegram (ex: [123456789])
const PORT = 3076;

// Paths
const ROOT_DIR = path.resolve(__dirname, '..');
const DATA_DIR = path.join(ROOT_DIR, 'data');
const IMAGES_DIR = path.join(ROOT_DIR, 'assets', 'images');
const VIDEOS_DIR = path.join(ROOT_DIR, 'assets', 'videos');
const CATALOGUE_FILE = path.join(DATA_DIR, 'catalogue.json');
const REVIEWS_FILE = path.join(DATA_DIR, 'reviews.json');

// Ensure directories exist
[DATA_DIR, IMAGES_DIR, VIDEOS_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// ══════════════════════════════════════════════════════════
// DATA HELPERS
// ══════════════════════════════════════════════════════════
function loadJSON(filepath) {
  try {
    return JSON.parse(fs.readFileSync(filepath, 'utf-8'));
  } catch (e) {
    return filepath.includes('catalogue') ? [] : {};
  }
}

function saveJSON(filepath, data) {
  fs.writeFileSync(filepath, JSON.stringify(data, null, 2), 'utf-8');
}

function getCatalogue() { return loadJSON(CATALOGUE_FILE); }
function saveCatalogue(data) { saveJSON(CATALOGUE_FILE, data); }
function getReviews() { return loadJSON(REVIEWS_FILE); }
function saveReviews(data) { saveJSON(REVIEWS_FILE, data); }

function slugify(text) {
  return text.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

// ══════════════════════════════════════════════════════════
// FILE DOWNLOAD HELPER
// ══════════════════════════════════════════════════════════
function downloadFile(url, destPath) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    const file = fs.createWriteStream(destPath);
    client.get(url, (response) => {
      if (response.statusCode === 301 || response.statusCode === 302) {
        downloadFile(response.headers.location, destPath).then(resolve).catch(reject);
        return;
      }
      response.pipe(file);
      file.on('finish', () => { file.close(); resolve(); });
    }).on('error', (err) => {
      fs.unlink(destPath, () => {});
      reject(err);
    });
  });
}

// ══════════════════════════════════════════════════════════
// EXPRESS API SERVER
// ══════════════════════════════════════════════════════════
const app = express();
app.use(cors());
app.use(express.json());

// Serve data files
app.use('/data', express.static(DATA_DIR));

// Serve assets
app.use('/assets', express.static(path.join(ROOT_DIR, 'assets')));

// Serve frontend
app.use(express.static(ROOT_DIR));

// API: Submit review
app.post('/api/reviews', (req, res) => {
  const { productId, review } = req.body;
  if (!productId || !review) return res.status(400).json({ error: 'Missing data' });
  
  const reviews = getReviews();
  if (!reviews[productId]) reviews[productId] = [];
  reviews[productId].push({
    name: (review.name || 'Anonyme').substring(0, 30),
    rating: Math.max(1, Math.min(5, parseInt(review.rating) || 5)),
    comment: (review.comment || '').substring(0, 500),
    date: review.date || new Date().toISOString().split('T')[0],
  });
  saveReviews(reviews);
  res.json({ success: true });
});

app.listen(PORT, () => {
  console.log(`\n🌐 Serveur SC76 démarré sur http://localhost:${PORT}`);
  console.log(`📂 Données : ${DATA_DIR}`);
  console.log(`🖼️  Images  : ${IMAGES_DIR}`);
  console.log(`🎬 Vidéos  : ${VIDEOS_DIR}\n`);
});

// ══════════════════════════════════════════════════════════
// TELEGRAM BOT
// ══════════════════════════════════════════════════════════
const bot = new TelegramBot(BOT_TOKEN, { polling: true });

function isAdmin(msg) {
  if (ADMIN_IDS.length === 0) return true; // Si pas d'IDs configurés, tout le monde est admin
  return ADMIN_IDS.includes(msg.from.id);
}

function deny(msg) {
  bot.sendMessage(msg.chat.id, '⛔ Accès refusé. Tu n\'es pas administrateur.');
}

// ── /start & /help ──────────────────────────────────────
bot.onText(/\/start/, (msg) => {
  if (!isAdmin(msg)) return deny(msg);
  const text = `
🌿 *Social Club 76 — Admin Bot*

Bienvenue ! Voici tes commandes :

📦 *PRODUITS*
/produits — Liste tous les produits
/ajout \\<nom\\> — Ajouter un produit
/supprimer \\<id\\> — Supprimer un produit
/modifier \\<id\\> \\<champ\\> \\<valeur\\> — Modifier

📝 *CHAMPS MODIFIABLES*
\`nom\`, \`desc\`, \`type\`, \`origin\`, \`grade\`, \`thc\`, \`terpene\`

🖼️ *IMAGES*
/image \\<id\\> — Ajouter une image \\(en caption d'une photo\\)
/heroimg \\<id\\> — Définir l'image principale \\(en caption\\)
/supprimg \\<id\\> \\<index\\> — Supprimer une image
/images \\<id\\> — Voir les images d'un produit

🎬 *VIDÉO*
/video \\<id\\> — Ajouter une vidéo \\(en caption d'une vidéo\\)

⭐ *AVIS*
/avis — Voir les avis récents
/avis \\<id\\> — Voir les avis d'un produit
/suppriravis \\<id\\> \\<index\\> — Supprimer un avis

ℹ️ *DIVERS*
/monid — Afficher ton ID Telegram
/help — Réafficher ce message

_Ton ID: ${msg.from.id}_
  `;
  bot.sendMessage(msg.chat.id, text, { parse_mode: 'MarkdownV2' }).catch(() => {
    // Fallback without markdown if parsing fails
    bot.sendMessage(msg.chat.id, text.replace(/[\\*_`]/g, ''));
  });
});

bot.onText(/\/help/, (msg) => {
  bot.emit('text', '/start', msg);
});

// ── /monid ──────────────────────────────────────────────
bot.onText(/\/monid/, (msg) => {
  bot.sendMessage(msg.chat.id, `🆔 Ton ID Telegram : \`${msg.from.id}\``, { parse_mode: 'Markdown' });
});

// ── /produits ───────────────────────────────────────────
bot.onText(/\/produits/, (msg) => {
  if (!isAdmin(msg)) return deny(msg);
  const catalogue = getCatalogue();
  if (catalogue.length === 0) {
    return bot.sendMessage(msg.chat.id, '📦 Catalogue vide. Utilise /ajout <nom> pour ajouter un produit.');
  }
  const lines = catalogue.map((p, i) => {
    const imgs = p.images ? p.images.length : 0;
    const hasVideo = p.video ? '🎬' : '';
    const hasHero = p.heroImg ? '🖼️' : '';
    return `${i + 1}. *${p.name}* (${p.type})\n   ID: \`${p.id}\` ${hasHero}${hasVideo} 📷${imgs}`;
  });
  bot.sendMessage(msg.chat.id, `📦 *Catalogue (${catalogue.length} produits)*\n\n${lines.join('\n\n')}`, { parse_mode: 'Markdown' });
});

// ── /ajout <nom> ────────────────────────────────────────
bot.onText(/\/ajout (.+)/, (msg, match) => {
  if (!isAdmin(msg)) return deny(msg);
  const name = match[1].trim();
  const id = slugify(name);
  const catalogue = getCatalogue();
  
  if (catalogue.find(p => p.id === id)) {
    return bot.sendMessage(msg.chat.id, `⚠️ Un produit avec l'ID \`${id}\` existe déjà.`, { parse_mode: 'Markdown' });
  }

  const newProduct = {
    id,
    name,
    type: 'Nouveau',
    specs: { origin: 'À définir', grade: 'À définir', thc: 'À définir', terpene: 'À définir' },
    desc: 'Description à ajouter.',
    heroImg: null,
    images: [],
    video: null,
  };

  catalogue.push(newProduct);
  saveCatalogue(catalogue);

  // Initialize reviews for this product
  const reviews = getReviews();
  if (!reviews[id]) { reviews[id] = []; saveReviews(reviews); }

  bot.sendMessage(msg.chat.id, `✅ Produit *${name}* ajouté !\nID: \`${id}\`\n\nUtilise /modifier ${id} <champ> <valeur> pour le configurer.`, { parse_mode: 'Markdown' });
});

// ── /supprimer <id> ─────────────────────────────────────
bot.onText(/\/supprimer (.+)/, (msg, match) => {
  if (!isAdmin(msg)) return deny(msg);
  const id = match[1].trim();
  let catalogue = getCatalogue();
  const product = catalogue.find(p => p.id === id);
  
  if (!product) {
    return bot.sendMessage(msg.chat.id, `❌ Produit \`${id}\` non trouvé.\nUtilise /produits pour voir les IDs.`, { parse_mode: 'Markdown' });
  }

  catalogue = catalogue.filter(p => p.id !== id);
  saveCatalogue(catalogue);

  bot.sendMessage(msg.chat.id, `🗑️ Produit *${product.name}* supprimé.`, { parse_mode: 'Markdown' });
});

// ── /modifier <id> <champ> <valeur> ─────────────────────
bot.onText(/\/modifier (\S+)\s+(\S+)\s+(.+)/, (msg, match) => {
  if (!isAdmin(msg)) return deny(msg);
  const id = match[1].trim();
  const field = match[2].trim().toLowerCase();
  const value = match[3].trim();

  const catalogue = getCatalogue();
  const product = catalogue.find(p => p.id === id);

  if (!product) {
    return bot.sendMessage(msg.chat.id, `❌ Produit \`${id}\` non trouvé.`, { parse_mode: 'Markdown' });
  }

  const specFields = ['origin', 'grade', 'thc', 'terpene'];
  
  if (field === 'nom' || field === 'name') {
    product.name = value;
  } else if (field === 'desc' || field === 'description') {
    product.desc = value;
  } else if (field === 'type') {
    product.type = value;
  } else if (specFields.includes(field)) {
    product.specs[field] = value;
  } else {
    return bot.sendMessage(msg.chat.id, `⚠️ Champ inconnu: \`${field}\`\nChamps valides: nom, desc, type, origin, grade, thc, terpene`, { parse_mode: 'Markdown' });
  }

  saveCatalogue(catalogue);
  bot.sendMessage(msg.chat.id, `✅ *${product.name}* mis à jour !\n\`${field}\` → ${value}`, { parse_mode: 'Markdown' });
});

// ── /image <id> (en caption d'une photo) ────────────────
bot.on('photo', async (msg) => {
  if (!isAdmin(msg)) return;
  const caption = msg.caption || '';
  
  let match = caption.match(/\/image\s+(\S+)/);
  let isHero = false;
  if (!match) {
    match = caption.match(/\/heroimg\s+(\S+)/);
    if (match) isHero = true;
  }
  if (!match) return;

  const id = match[1].trim();
  const catalogue = getCatalogue();
  const product = catalogue.find(p => p.id === id);
  if (!product) {
    return bot.sendMessage(msg.chat.id, `❌ Produit \`${id}\` non trouvé.`, { parse_mode: 'Markdown' });
  }

  try {
    const photo = msg.photo[msg.photo.length - 1]; // Highest resolution
    const file = await bot.getFile(photo.file_id);
    const fileUrl = `https://api.telegram.org/file/bot${BOT_TOKEN}/${file.file_path}`;
    const ext = path.extname(file.file_path) || '.jpg';
    const filename = `${id}_${Date.now()}${ext}`;
    const destPath = path.join(IMAGES_DIR, filename);

    await downloadFile(fileUrl, destPath);

    const relativePath = `assets/images/${filename}`;

    if (isHero) {
      product.heroImg = relativePath;
      saveCatalogue(catalogue);
      bot.sendMessage(msg.chat.id, `🖼️ Image principale de *${product.name}* définie !`, { parse_mode: 'Markdown' });
    } else {
      if (!product.images) product.images = [];
      product.images.push(relativePath);
      saveCatalogue(catalogue);
      bot.sendMessage(msg.chat.id, `📷 Image ajoutée à *${product.name}* (${product.images.length} total)`, { parse_mode: 'Markdown' });
    }
  } catch (e) {
    bot.sendMessage(msg.chat.id, `❌ Erreur lors du téléchargement: ${e.message}`);
  }
});

// ── /video <id> (en caption d'une vidéo) ────────────────
bot.on('video', async (msg) => {
  if (!isAdmin(msg)) return;
  const caption = msg.caption || '';
  const match = caption.match(/\/video\s+(\S+)/);
  if (!match) return;

  const id = match[1].trim();
  const catalogue = getCatalogue();
  const product = catalogue.find(p => p.id === id);
  if (!product) {
    return bot.sendMessage(msg.chat.id, `❌ Produit \`${id}\` non trouvé.`, { parse_mode: 'Markdown' });
  }

  try {
    const file = await bot.getFile(msg.video.file_id);
    const fileUrl = `https://api.telegram.org/file/bot${BOT_TOKEN}/${file.file_path}`;
    const ext = path.extname(file.file_path) || '.mp4';
    const filename = `${id}_${Date.now()}${ext}`;
    const destPath = path.join(VIDEOS_DIR, filename);

    await downloadFile(fileUrl, destPath);

    product.video = `assets/videos/${filename}`;
    saveCatalogue(catalogue);
    bot.sendMessage(msg.chat.id, `🎬 Vidéo ajoutée à *${product.name}* !`, { parse_mode: 'Markdown' });
  } catch (e) {
    bot.sendMessage(msg.chat.id, `❌ Erreur lors du téléchargement: ${e.message}`);
  }
});

// ── /images <id> ────────────────────────────────────────
bot.onText(/\/images (\S+)/, (msg, match) => {
  if (!isAdmin(msg)) return deny(msg);
  const id = match[1].trim();
  const catalogue = getCatalogue();
  const product = catalogue.find(p => p.id === id);
  if (!product) {
    return bot.sendMessage(msg.chat.id, `❌ Produit \`${id}\` non trouvé.`, { parse_mode: 'Markdown' });
  }

  let text = `🖼️ *Images de ${product.name}*\n\n`;
  text += `Hero: ${product.heroImg ? product.heroImg : 'Aucune'}\n\n`;
  
  if (product.images && product.images.length > 0) {
    product.images.forEach((img, i) => {
      text += `${i + 1}. ${img}\n`;
    });
  } else {
    text += 'Aucune image dans la galerie.';
  }
  
  bot.sendMessage(msg.chat.id, text, { parse_mode: 'Markdown' });
});

// ── /supprimg <id> <index> ──────────────────────────────
bot.onText(/\/supprimg (\S+)\s+(\d+)/, (msg, match) => {
  if (!isAdmin(msg)) return deny(msg);
  const id = match[1].trim();
  const index = parseInt(match[2]) - 1; // 1-indexed to 0-indexed
  const catalogue = getCatalogue();
  const product = catalogue.find(p => p.id === id);

  if (!product) {
    return bot.sendMessage(msg.chat.id, `❌ Produit \`${id}\` non trouvé.`, { parse_mode: 'Markdown' });
  }
  if (!product.images || index < 0 || index >= product.images.length) {
    return bot.sendMessage(msg.chat.id, `⚠️ Index invalide. Le produit a ${product.images ? product.images.length : 0} image(s).`);
  }

  const removed = product.images.splice(index, 1)[0];
  saveCatalogue(catalogue);

  // Try to delete the file too
  const filePath = path.join(ROOT_DIR, removed);
  try { fs.unlinkSync(filePath); } catch(e) {}

  bot.sendMessage(msg.chat.id, `🗑️ Image supprimée de *${product.name}* (${removed})`, { parse_mode: 'Markdown' });
});

// ── /avis [id] ──────────────────────────────────────────
bot.onText(/\/avis\s*(\S*)/, (msg, match) => {
  if (!isAdmin(msg)) return deny(msg);
  const id = match[1]?.trim();
  const reviews = getReviews();

  if (id) {
    // Reviews for a specific product
    const productReviews = reviews[id] || [];
    if (productReviews.length === 0) {
      return bot.sendMessage(msg.chat.id, `⭐ Aucun avis pour \`${id}\``, { parse_mode: 'Markdown' });
    }
    const lines = productReviews.map((r, i) => 
      `${i + 1}. ${'⭐'.repeat(r.rating)} — *${r.name || 'Anonyme'}* (${r.date || '?'})\n   "${r.comment}"`
    );
    bot.sendMessage(msg.chat.id, `⭐ *Avis pour ${id}* (${productReviews.length})\n\n${lines.join('\n\n')}`, { parse_mode: 'Markdown' });
  } else {
    // All recent reviews
    let allReviews = [];
    for (const [pid, revs] of Object.entries(reviews)) {
      revs.forEach((r, i) => allReviews.push({ ...r, productId: pid, index: i }));
    }
    allReviews.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    allReviews = allReviews.slice(0, 15); // Last 15

    if (allReviews.length === 0) {
      return bot.sendMessage(msg.chat.id, '⭐ Aucun avis pour le moment.');
    }
    const lines = allReviews.map(r =>
      `${'⭐'.repeat(r.rating)} *${r.name || 'Anonyme'}* sur \`${r.productId}\`\n"${r.comment}" _(${r.date || '?'})_`
    );
    bot.sendMessage(msg.chat.id, `⭐ *Derniers avis*\n\n${lines.join('\n\n')}`, { parse_mode: 'Markdown' });
  }
});

// ── /suppriravis <id> <index> ───────────────────────────
bot.onText(/\/suppriravis (\S+)\s+(\d+)/, (msg, match) => {
  if (!isAdmin(msg)) return deny(msg);
  const id = match[1].trim();
  const index = parseInt(match[2]) - 1;
  const reviews = getReviews();

  if (!reviews[id] || index < 0 || index >= reviews[id].length) {
    return bot.sendMessage(msg.chat.id, `⚠️ Avis non trouvé (${id}, index ${index + 1}).`);
  }

  const removed = reviews[id].splice(index, 1)[0];
  saveReviews(reviews);
  bot.sendMessage(msg.chat.id, `🗑️ Avis supprimé — "${removed.comment.substring(0, 50)}..." de ${removed.name || 'Anonyme'}`);
});

// ══════════════════════════════════════════════════════════
console.log('🤖 Bot SC76 Admin démarré... En attente de commandes.');
console.log('💡 Pour connaître ton ID, envoie /monid au bot.');
