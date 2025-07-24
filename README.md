# Job Scraper Dashboard

Une application web moderne pour scraper et analyser les offres d'emploi depuis plusieurs plateformes (Indeed, LinkedIn, et sites propriétaires).

## 🚀 Fonctionnalités

- **Multi-plateformes** : Scraping depuis Indeed, LinkedIn et sites propriétaires
- **Interface moderne** : Dashboard React avec Tailwind CSS
- **Scraping intelligent** : Détection automatique des sites et adaptation du scraping
- **Résultats en temps réel** : Affichage immédiat des résultats
- **Export des données** : Sauvegarde automatique en JSON/JSONL
- **Déploiement cloud** : Compatible Railway, Vercel, et autres plateformes

## 🛠️ Technologies

- **Frontend** : Next.js 15, React 19, TypeScript
- **Styling** : Tailwind CSS, shadcn/ui
- **Scraping** : Puppeteer, Playwright
- **Backend** : API Routes Next.js
- **Déploiement** : Docker, Railway

## 📦 Installation

### Prérequis
- Node.js 18+
- npm ou yarn

### Installation locale

```bash
# Cloner le repository
git clone <votre-repo>
cd job-scraper-app

# Installer les dépendances
npm install

# Démarrer en mode développement
npm run dev
```

L'application sera disponible sur `http://localhost:3000`

## 🚀 Déploiement

### Railway

1. Connectez votre repository GitHub à Railway
2. Railway détectera automatiquement le Dockerfile
3. L'application sera déployée automatiquement

### Variables d'environnement

Créez un fichier `.env.local` :

```env
# Configuration Puppeteer
PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

# Configuration de l'application
NODE_ENV=production
```

## 📊 Utilisation

1. **Sélection des plateformes** : Choisissez Indeed, LinkedIn, ou les deux
2. **Upload du CSV** : Téléchargez votre fichier CSV avec les entreprises
3. **Lancement du scraping** : Cliquez sur "Lancer le scraping"
4. **Consultation des résultats** : Les résultats s'affichent en temps réel

## 🔧 Configuration

### Format du CSV

Le fichier CSV doit contenir une colonne avec les noms d'entreprises :

```csv
entreprise
ACCESSITE
ORANGE
SFR
```

### Personnalisation des scrapers

Les scrapers sont modulaires et peuvent être facilement étendus dans le dossier `scrapers/`.

## 📁 Structure du projet

```
job-scraper-app/
├── app/                    # Pages et API Next.js
│   ├── api/               # Routes API
│   ├── globals.css        # Styles globaux
│   ├── layout.tsx         # Layout principal
│   └── page.tsx           # Page d'accueil
├── components/            # Composants React
│   └── ui/               # Composants UI (shadcn/ui)
├── scrapers/             # Scripts de scraping
├── Dockerfile            # Configuration Docker
├── next.config.mjs       # Configuration Next.js
└── package.json          # Dépendances
```

## 🤝 Contribution

1. Fork le projet
2. Créez une branche feature (`git checkout -b feature/AmazingFeature`)
3. Committez vos changements (`git commit -m 'Add some AmazingFeature'`)
4. Push vers la branche (`git push origin feature/AmazingFeature`)
5. Ouvrez une Pull Request

## 📄 Licence

Ce projet est sous licence MIT. Voir le fichier `LICENSE` pour plus de détails.

## ⚠️ Avertissement légal

Ce projet est destiné à un usage éducatif et personnel uniquement. Assurez-vous de respecter les conditions d'utilisation des sites web que vous scrapez et les lois locales sur la collecte de données.

## 🆘 Support

Pour toute question ou problème, ouvrez une issue sur GitHub. 