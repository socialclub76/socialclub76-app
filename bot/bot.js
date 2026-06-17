require('dotenv').config();

const TelegramBot = require('node-telegram-bot-api');
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const crypto = require('crypto');

// ══════════════════════════════════════════════════════════
// CONFIGURATION SÉCURISÉE (.env)
// ══════════════════════════════════════════════════════════
const BOT_TOKEN = process.env.BOT_TOKEN;
const ADMIN_IDS = process.env.ADMIN_IDS ? process.env.ADMIN_IDS.split(',').map(id => parseInt(id.trim())) : [8585398317, 8799821161];
const PORT = process.env.PORT || 3076;

if (!BOT_TOKEN) {
  console.error("❌ BOT_TOKEN manquant dans le fichier .env");
  process.exit(1);
}

console.log("✅ Bot chargé avec configuration sécurisée (.env)");

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

// Liens dynamiques
const LINKS_FILE = path.join(DATA_DIR, 'links.json');

function getLinks() {
  try {
    return loadJSON(LINKS_FILE);
  } catch(e) {
    return {
      potatos: "https://t.me/canalpotatos",
      luffa: "https://t.me/canalluffa",
      telegram: "https://t.me/socialclub76",
      signal: "https://signal.me/#eu/9qdkMgh1Q4H00k4wTUAUXpMrS5GBfUObWj_NX-e2qJEeZ51WFbJLKZ_KGB08dJQd"
    };
  }
}

function saveLinks(data) {
  saveJSON(LINKS_FILE, data);
}

// Users tracking pour /message all
const USERS_FILE = path.join(DATA_DIR, 'users.json');

function getUsers() {
  try {
    return JSON.parse(fs.readFileSync(USERS_FILE, 'utf-8'));
  } catch (e) {
    return [];
  }
}

function saveUsers(data) {
  fs.writeFileSync(USERS_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

function trackUser(msg) {
  const users = getUsers();
  if (!users.find(u => u.id === msg.from.id)) {
    users.push({
      id: msg.from.id,
      first_name: msg.from.first_name,
      username: msg.from.username || null,
      last_seen: new Date().toISOString()
    });
    saveUsers(users);
  }
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
app.post('/api/reviews', async (req, res) => {
  const { productId, review } = req.body;
  if (!productId || !review || !review.initData) return res.status(400).json({ error: 'Missing data' });
  
  // Validation cryptographique du token Telegram (initData)
  const urlParams = new URLSearchParams(review.initData);
  const hash = urlParams.get('hash');
  urlParams.delete('hash');
  urlParams.sort();
  let dataCheckString = '';
  for (const [key, value] of urlParams.entries()) {
    dataCheckString += `${key}=${value}\n`;
  }
  dataCheckString = dataCheckString.slice(0, -1);
  const secret = crypto.createHmac('sha256', 'WebAppData').update(BOT_TOKEN).digest();
  const _hash = crypto.createHmac('sha256', secret).update(dataCheckString).digest('hex');
  
  if (_hash !== hash) {
    return res.status(401).json({ error: 'Unauthorized: Invalid token' });
  }

  const user = JSON.parse(urlParams.get('user'));
  let photoUrl = null;

  // Récupérer la photo de profil via le bot Telegram
  try {
    const photos = await bot.getUserProfilePhotos(user.id, { limit: 1 });
    if (photos.total_count > 0) {
      // Index 0 est la résolution la plus petite (avatar), parfait pour la web app
      const fileId = photos.photos[0][0].file_id;
      const file = await bot.getFile(fileId);
      photoUrl = `https://api.telegram.org/file/bot${BOT_TOKEN}/${file.file_path}`;
    }
  } catch (e) {
    console.error("Erreur récupération photo:", e.message);
  }

  const reviews = getReviews();
  if (!reviews[productId]) reviews[productId] = [];
  
  // Sauvegarde anonymisée
  reviews[productId].push({
    name: user.first_name || 'Anonyme',
    userId: user.id,
    userPhotoUrl: photoUrl,
    rating: Math.max(1, Math.min(5, parseInt(review.rating) || 5)),
    comment: (review.comment || '').substring(0, 500),
    date: review.date || new Date().toISOString().split('T')[0],
  });
  saveReviews(reviews);
  
  res.json({ success: true, name: user.first_name, userPhotoUrl: photoUrl });
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

const adminStates = {};
const STATES = {
  AJOUT_CAT: 'AJOUT_CAT',
  AJOUT_NAME: 'AJOUT_NAME',
  AJOUT_HERO: 'AJOUT_HERO',
  AJOUT_DESC: 'AJOUT_DESC',
  AJOUT_ORIGIN: 'AJOUT_ORIGIN',
  AJOUT_TASTING: 'AJOUT_TASTING',
  AJOUT_GALLERY: 'AJOUT_GALLERY',
};

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
/ajout — Lancer l'assistant d'ajout de produit
/annuler — Annuler l'ajout en cours
/supprimer \\<id\\> — Supprimer un produit
/modifier \\<id\\> \\<champ\\> \\<valeur\\> — Modifier

📝 *CHAMPS MODIFIABLES*
\`nom\`, \`desc\`, \`type\`, \`origin\`, \`tasting\`

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

📢 *NOUVEAUTÉ*
/message <ID> <texte> — Envoyer à une personne
/message all <texte> — Envoyer à tout le monde


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

// ── /lien <nom> <url> ─────────────────────────────────────
bot.onText(/\/lien (\S+)\s+(.+)/, (msg, match) => {
  if (!isAdmin(msg)) return deny(msg);
  
  const key = match[1].toLowerCase();
  const url = match[2].trim();
  
  const validKeys = ['potatos', 'luffa', 'telegram', 'signal'];
  
  if (!validKeys.includes(key)) {
    return bot.sendMessage(msg.chat.id, `❌ Clé invalide. Utilise : potatos, luffa, telegram ou signal`);
  }
  
  if (!url.startsWith('http')) {
    return bot.sendMessage(msg.chat.id, `⚠️ L'URL doit commencer par http/https`);
  }
  
  const links = getLinks();
  links[key] = url;
  saveLinks(links);
  
  bot.sendMessage(msg.chat.id, `✅ Lien mis à jour !\n\n**${key}** → ${url}`, { parse_mode: 'Markdown' });
});

// ── /message <ID> <texte> ou /message all <texte> ─────────────────
bot.onText(/\/message(?:\s+(\S+))?\s+(.+)/, (msg, match) => {
  if (!isAdmin(msg)) return deny(msg);
  
  const target = match[1];
  const text = match[2];

  if (!target || !text) {
    return bot.sendMessage(msg.chat.id, "📌 Usage :\n/message <ID> <texte>\n/message all <texte>");
  }

  const users = getUsers();

  if (target.toLowerCase() === 'all') {
    let sent = 0;
    users.forEach(user => {
      bot.sendMessage(user.id, `📢 *Message du Social Club 76*\n\n${text}`, { parse_mode: 'Markdown' })
        .then(() => sent++)
        .catch(() => {});
    });
    bot.sendMessage(msg.chat.id, `✅ Message envoyé à ${users.length} utilisateurs.`);
  } else {
    const userId = parseInt(target);
    bot.sendMessage(userId, `📢 *Message du Social Club 76*\n\n${text}`, { parse_mode: 'Markdown' })
      .then(() => bot.sendMessage(msg.chat.id, `✅ Message envoyé à ${userId}`))
      .catch(err => bot.sendMessage(msg.chat.id, `❌ Impossible d'envoyer : ${err.message}`));
  }
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

// ── /ajout (Assistant) ──────────────────────────────────
bot.onText(/^\/ajout(?:\s|$)/, (msg) => {
  if (!isAdmin(msg)) return deny(msg);
  adminStates[msg.chat.id] = { state: STATES.AJOUT_CAT, data: {} };
  
  const opts = {
    reply_markup: {
      inline_keyboard: [
        [{ text: 'Weed 🌿', callback_data: 'CAT_Weed' }, { text: 'Hash 🍫', callback_data: 'CAT_Hash' }]
      ]
    }
  };
  bot.sendMessage(msg.chat.id, "Assistant d'ajout de produit lancé !\n\nÉtape 1/7 : Quelle est la catégorie du produit ?\n\n(Tapez /annuler à tout moment pour arrêter)", opts);
});

// Remplace le handler callback_query par ça (lignes ~270-287)
bot.on('callback_query', (query) => {
  const chatId = query.message.chat.id;
  const fromId = query.from.id;  // ← Correction ici

  if (!ADMIN_IDS.length === 0 && !ADMIN_IDS.includes(fromId)) {
    return bot.answerCallbackQuery(query.id, { text: "⛔ Accès refusé." });
  }
  
  if (query.data.startsWith('CAT_')) {
    const cat = query.data.split('_')[1];
    const session = adminStates[chatId];
    
    if (session && session.state === STATES.AJOUT_CAT) {
      session.data.type = cat;
      session.state = STATES.AJOUT_NAME;
      
      bot.editMessageText(`✅ Catégorie choisie : **${cat}**\n\nÉtape 2/7 : Quel est le nom du produit ?`, {
        chat_id: chatId,
        message_id: query.message.message_id,
        parse_mode: 'Markdown'
      }).catch(console.error);
      
      // Répondre au callback pour enlever le "chargement"
      bot.answerCallbackQuery(query.id);
    }
  }
});

// ── Machine d'état pour les réponses textuelles / médias
bot.on('message', async (msg) => {
  if (!isAdmin(msg)) return;
  const chatId = msg.chat.id;
  const text = msg.text || '';
  
  if (text.startsWith('/')) return; // ignoré (géré par les commandes)

  const session = adminStates[chatId];
  if (!session) return;

  if (session.state === STATES.AJOUT_NAME) {
    session.data.name = text.trim();
    session.data.id = slugify(session.data.name);
    session.state = STATES.AJOUT_HERO;
    bot.sendMessage(chatId, `Nom enregistré: *${session.data.name}*\n\nÉtape 3/7 : Envoie l'image principale (Hero) du produit.`, { parse_mode: 'Markdown' });
  }
  else if (session.state === STATES.AJOUT_HERO) {
    if (!msg.photo) return bot.sendMessage(chatId, "⚠️ Merci d'envoyer une photo pour l'image principale.");
    try {
      const photo = msg.photo[msg.photo.length - 1];
      const file = await bot.getFile(photo.file_id);
      const fileUrl = `https://api.telegram.org/file/bot${BOT_TOKEN}/${file.file_path}`;
      const ext = path.extname(file.file_path) || '.jpg';
      const filename = `hero_${session.data.id}_${Date.now()}${ext}`;
      const destPath = path.join(IMAGES_DIR, filename);
      await downloadFile(fileUrl, destPath);
      session.data.heroImg = `assets/images/${filename}`;
      
      session.state = STATES.AJOUT_DESC;
      bot.sendMessage(chatId, "Image principale enregistrée !\n\nÉtape 4/7 : Quelle est la description du produit ?");
    } catch(e) {
      bot.sendMessage(chatId, `Erreur lors du téléchargement : ${e.message}`);
    }
  }
  else if (session.state === STATES.AJOUT_DESC) {
    session.data.desc = text.trim();
    session.state = STATES.AJOUT_ORIGIN;
    bot.sendMessage(chatId, "Description enregistrée.\n\nÉtape 5/7 : Quelle est l'origine ou l'arôme principal ? (ex: Indoor / Terreux)");
  }
  else if (session.state === STATES.AJOUT_ORIGIN) {
    if (!session.data.specs) session.data.specs = {};
    session.data.specs.origin = text.trim();
    session.state = STATES.AJOUT_TASTING;
    bot.sendMessage(chatId, "Origine/Arôme enregistré.\n\nÉtape 6/7 : Quelles sont les notes de dégustation ?");
  }
  else if (session.state === STATES.AJOUT_TASTING) {
    session.data.specs.tasting = text.trim();
    session.state = STATES.AJOUT_GALLERY;
    session.data.images = [];
    bot.sendMessage(chatId, "Notes enregistrées.\n\nÉtape 7/7 : Veux-tu ajouter d'autres images ou une vidéo pour la galerie ?\nEnvoie-les maintenant une par une.\n\nQuand tu as terminé, tape /fin_ajout pour valider et publier le produit.");
  }
  else if (session.state === STATES.AJOUT_GALLERY) {
    if (msg.photo || msg.video) {
      try {
        let fileId, ext, isVideo = false;
        if (msg.photo) {
          fileId = msg.photo[msg.photo.length - 1].file_id;
          ext = '.jpg';
        } else {
          fileId = msg.video.file_id;
          ext = '.mp4';
          isVideo = true;
        }
        const file = await bot.getFile(fileId);
        const fileUrl = `https://api.telegram.org/file/bot${BOT_TOKEN}/${file.file_path}`;
        const filename = `gal_${session.data.id}_${Date.now()}${ext}`;
        const destPath = path.join(isVideo ? VIDEOS_DIR : IMAGES_DIR, filename);
        await downloadFile(fileUrl, destPath);
        
        if (isVideo) {
          session.data.video = `assets/videos/${filename}`;
          bot.sendMessage(chatId, "🎬 Vidéo ajoutée à la galerie ! (Tape /fin_ajout pour terminer)");
        } else {
          session.data.images.push(`assets/images/${filename}`);
          bot.sendMessage(chatId, `📷 Image ajoutée (${session.data.images.length} images). (Tape /fin_ajout pour terminer)`);
        }
      } catch(e) {
        bot.sendMessage(chatId, `Erreur lors de l'ajout : ${e.message}`);
      }
    } else {
      bot.sendMessage(chatId, "⚠️ Envoie une photo ou une vidéo, ou tape /fin_ajout pour terminer.");
    }
  }
});

// ── /fin_ajout ──────────────────────────────────────────
bot.onText(/\/fin_ajout/, (msg) => {
  if (!isAdmin(msg)) return deny(msg);
  const chatId = msg.chat.id;
  const session = adminStates[chatId];
  
  if (!session || session.state !== STATES.AJOUT_GALLERY) {
    return bot.sendMessage(chatId, "⚠️ Aucun ajout en cours ou étape invalide. Assure-toi d'être à la dernière étape (Galerie).");
  }
  
  const catalogue = getCatalogue();
  if (catalogue.find(p => p.id === session.data.id)) {
    session.data.id += '-' + Math.floor(Math.random()*1000);
  }
  
  catalogue.push(session.data);
  saveCatalogue(catalogue);
  
  const reviews = getReviews();
  if (!reviews[session.data.id]) { reviews[session.data.id] = []; saveReviews(reviews); }
  
  bot.sendMessage(chatId, `✅ Produit *${session.data.name}* ajouté avec succès au catalogue !\nID: \`${session.data.id}\``, { parse_mode: 'Markdown' });
  
  delete adminStates[chatId];
});

// ── /annuler ────────────────────────────────────────────
bot.onText(/\/annuler/, (msg) => {
  if (!isAdmin(msg)) return deny(msg);
  const chatId = msg.chat.id;
  if (adminStates[chatId]) {
    delete adminStates[chatId];
    bot.sendMessage(chatId, "❌ Création de produit annulée.");
  } else {
    bot.sendMessage(chatId, "Aucune action en cours.");
  }
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

  const specFields = ['origin', 'tasting'];
  
  if (field === 'nom' || field === 'name') {
    product.name = value;
  } else if (field === 'desc' || field === 'description') {
    product.desc = value;
  } else if (field === 'type') {
    product.type = value;
  } else if (specFields.includes(field)) {
    if (!product.specs) product.specs = {};
    product.specs[field] = value;
  } else {
    return bot.sendMessage(msg.chat.id, `⚠️ Champ inconnu: \`${field}\`\nChamps valides: nom, desc, type, origin, tasting`, { parse_mode: 'Markdown' });
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
