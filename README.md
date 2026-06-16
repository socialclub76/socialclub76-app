# Social Club 76 - Telegram Admin Bot & Mini-App

Ce projet contient un bot d'administration Telegram ainsi qu'une Mini-App (Web App) pour gérer votre catalogue de produits et afficher les avis de manière sécurisée.

## 🚀 Démarrage Rapide

1. **Prérequis** : Vous devez avoir [Node.js](https://nodejs.org/) installé sur votre machine/serveur.
2. **Configuration** : 
   - Ouvrez le fichier `bot/bot.js`
   - Remplacez `TON_TOKEN_ICI` par le token de votre bot fourni par [@BotFather](https://t.me/BotFather) sur Telegram.
   - (Optionnel) Modifiez la variable `ADMIN_IDS` en y ajoutant votre ID Telegram pour restreindre l'administration à vous-même (ex: `const ADMIN_IDS = [123456789];`). Obtenez votre ID en envoyant `/monid` au bot.
3. **Installation des dépendances** :
   Dans le dossier `bot`, lancez un terminal et exécutez :
   ```bash
   npm install
   ```
4. **Lancement du serveur** :
   Toujours dans le dossier `bot`, lancez :
   ```bash
   npm start
   ```

## 📦 Commandes du Bot d'Administration

Depuis votre conversation avec le bot sur Telegram, utilisez ces commandes pour gérer votre catalogue. Le bot agit comme votre tableau de bord.

### Gestion des Produits
*   `/start` ou `/help` : Affiche le menu d'aide.
*   `/produits` : Liste tous les produits actuels du catalogue.
*   `/ajout <nom>` : Crée un nouveau produit. L'ID unique (utilisé pour les autres commandes) est généré automatiquement.
*   `/supprimer <id>` : Supprime complètement un produit du catalogue.
*   `/modifier <id> <champ> <valeur>` : Modifie les informations d'un produit.
    *   **Champs disponibles :** `nom`, `desc`, `type`, `origin`, `grade`, `thc`, `terpene`
    *   *Exemple :* `/modifier jaquemousse origin Californie`

### Gestion des Images & Vidéos
Pour utiliser ces commandes, vous devez **envoyer l'image ou la vidéo au bot** en plaçant la commande directement dans la **légende (caption)** du message :

*   `/heroimg <id>` : (En légende) Définit l'image envoyée comme image principale du produit.
*   `/image <id>` : (En légende) Ajoute l'image envoyée à la galerie du produit.
*   `/video <id>` : (En légende) Ajoute la vidéo envoyée au produit.

Autres commandes d'image :
*   `/images <id>` : Liste les images d'un produit avec leur numéro d'index.
*   `/supprimg <id> <index>` : Supprime une image spécifique de la galerie en utilisant son numéro d'index.

### Gestion des Avis Clients
L'application Web permet aux utilisateurs de laisser des avis de façon anonyme mais sécurisée.

*   `/avis` : Affiche la liste des derniers avis tous produits confondus.
*   `/avis <id>` : Affiche les avis pour un produit spécifique.
*   `/suppriravis <id> <index>` : Supprime un avis spécifique selon son index.

### Divers
*   `/monid` : Affiche votre identifiant unique Telegram (ID numérique).

## 🛡️ Fonctionnalités Techniques

- **Avis Vérifiés :** L'interface utilisateur Web (Mini-App) transmet automatiquement le token cryptographique Telegram (`initData`) de l'utilisateur au bot lorsqu'il poste un avis. Le bot le valide, puis récupère automatiquement sa **photo de profil** via l'API Telegram.
- **Anonymisation :** Le nom de l'utilisateur n'est pas affiché publiquement (seule la première lettre de son pseudo est affichée, ex: "M.").
- **Stockage local :** Les fichiers uploadés sont stockés dans le dossier `/assets/` et les données produits/avis dans `/data/`.
