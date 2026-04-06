# 🚀 CRM Pro - Application React + Supabase

## ✅ Installation (5 minutes)

### Étape 1 : Ouvrir un terminal dans le dossier du projet

**Sur Windows :**
1. Ouvrez l'explorateur de fichiers
2. Allez dans votre dossier `crm-pro`
3. Dans la barre d'adresse (en haut), tapez `cmd` puis Entrée
4. Un terminal s'ouvre dans ce dossier

**Sur Mac :**
1. Ouvrez le dossier dans Finder
2. Clic droit sur le dossier → Services → Nouveau terminal au dossier

### Étape 2 : Installer les dépendances

Dans le terminal, tapez :

```bash
npm install
```

⏱️ **Temps d'attente : 1-2 minutes**

Vous verrez plein de lignes défiler. C'est normal ! npm télécharge les bibliothèques React, Supabase, etc.

### Étape 3 : Configurer vos clés Supabase

1. Ouvrez le fichier `.env.local` avec un éditeur de texte (Notepad, VS Code, etc.)
2. Remplacez la clé `VITE_SUPABASE_ANON_KEY` par votre VRAIE clé publique
   (celle que vous avez copiée depuis Supabase > Settings > API)
3. Sauvegardez le fichier

**Exemple :**
```
VITE_SUPABASE_URL=https://yyksbqwjryaraueydufw.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3M... (votre vraie clé complète)
```

### Étape 4 : Lancer l'application

Dans le terminal, tapez :

```bash
npm run dev
```

✅ **Votre navigateur va s'ouvrir automatiquement sur http://localhost:5173**

---

## 🎯 Utilisation

### Première connexion

1. Cliquez sur "Pas de compte ? Créer un compte"
2. Entrez votre email et un mot de passe (minimum 6 caractères)
3. Vérifiez votre boîte mail et confirmez votre inscription
4. Connectez-vous avec vos identifiants

### Navigation

- **Dashboard** : Vue d'ensemble de vos statistiques
- **Contacts** : Liste de vos contacts (avec ajout/modification/suppression)
- **Opportunités** : Pipeline de vos affaires en cours
- **Candidats** : Base de vos consultants

---

## 📝 Commandes utiles

```bash
# Lancer l'application en mode développement
npm run dev

# Compiler l'application pour la production
npm run build

# Prévisualiser la version de production
npm run preview
```

---

## 🚀 Déploiement sur Vercel (GRATUIT)

### Méthode 1 : Via interface web (RECOMMANDÉ)

1. Allez sur https://vercel.com
2. Créez un compte (gratuit)
3. Cliquez sur "Add New..." → "Project"
4. Importez votre dossier `crm-pro` (glissez-déposez ou via Git)
5. Vercel détecte automatiquement React + Vite
6. Ajoutez vos variables d'environnement :
   - `VITE_SUPABASE_URL` = https://yyksbqwjryaraueydufw.supabase.co
   - `VITE_SUPABASE_ANON_KEY` = (votre clé publique)
7. Cliquez sur "Deploy"

⏱️ **Temps : ~2 minutes**

✅ **Votre CRM est en ligne** sur une URL type : `https://votre-crm.vercel.app`

### Méthode 2 : Via CLI

```bash
npm i -g vercel
vercel login
vercel
```

---

## 🔧 Dépannage

### Erreur "Cannot find module"
```bash
rm -rf node_modules
npm install
```

### Erreur de connexion Supabase
Vérifiez que :
1. Votre fichier `.env.local` contient les bonnes clés
2. La clé `VITE_SUPABASE_ANON_KEY` est complète (très longue chaîne)
3. Vous avez bien sauvegardé le fichier `.env.local`

Ensuite :
- Arrêtez le serveur (Ctrl+C dans le terminal)
- Relancez : `npm run dev`

### Le site ne s'ouvre pas automatiquement
Ouvrez manuellement : http://localhost:5173

---

## 📞 Support

En cas de problème :
1. Vérifiez la console du navigateur (F12)
2. Vérifiez les logs dans le terminal
3. Contactez Milan pour assistance

---

## 🎉 Félicitations !

Votre CRM est maintenant :
- ✅ Dans le cloud (Supabase)
- ✅ Accessible depuis n'importe où
- ✅ Sauvegardé automatiquement
- ✅ Sécurisé avec authentification
- ✅ Prêt pour le multi-utilisateurs

**Prochaines étapes :**
- Inviter des collaborateurs
- Personnaliser les fonctionnalités
- Ajouter des modules (reporting, exports, etc.)
- Activer le mode on-premise pour vos clients

---

Made with ❤️ by Milan Calic
