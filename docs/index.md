# FIC Engine & Inspector

[![Version](https://img.shields.io/badge/version-0.1.0-blue.svg)](https://github.com/votre-org/fic-engine) [![License](https://img.shields.io/badge/license-MIT%20OR%20Apache--2.0-green.svg)](LICENSE) [![Rust](https://img.shields.io/badge/rust-1.70%2B-orange.svg)](https://www.rust-lang.org/) [![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20Linux%20%7C%20macOS-lightgrey.svg)]()

**Solution professionnelle pour l'accès, l'inspection et la migration des données HFSQL/HyperFile**

---

## Bienvenue

**FIC Engine & Inspector** est une solution logicielle professionnelle conçue pour permettre l'accès, l'inspection, la migration et la manipulation des données stockées dans les formats propriétaires **HFSQL/HyperFile** (extensions `.fic`, `.mmo`, `.ndx`).

Cette documentation complète vous guidera à travers chaque aspect du projet, du démarrage rapide aux fonctionnalités avancées, en passant par une explication détaillée de l'architecture technique.

---

## Problématique résolue

Les fichiers HFSQL/HyperFile sont des formats binaires propriétaires utilisés par de nombreuses applications métier françaises, notamment dans les secteurs de la gestion, de la comptabilité et de l'administration. Ces formats présentent plusieurs défis :

- **Accès limité** : Format binaire non documenté, difficile à lire sans l'application source
- **Migration complexe** : Pas de solution standard pour exporter vers des formats modernes
- **Maintenance** : Applications obsolètes, dépendances techniques, risques de perte de données
- **Interopérabilité** : Difficulté d'intégration avec les systèmes modernes (APIs, bases de données)

---

## Notre solution

FIC Engine & Inspector offre une solution complète et moderne :

- ✅ **Lecture native** des formats `.fic`, `.mmo`, `.ndx` sans dépendance à l'application source
- ✅ **API REST moderne** pour intégration avec vos systèmes
- ✅ **Interface graphique intuitive** pour inspection et navigation
- ✅ **Support SQL/ODBC** pour requêtes avancées et migration
- ✅ **Export multi-formats** (JSON, CSV) pour migration et archivage
- ✅ **Conformité RGPD/CNIL** pour la protection des données
- ✅ **Multi-plateforme** (Windows, Linux, macOS)

---

## Architecture en bref

FIC Engine & Inspector est composé de deux parties principales :

### Backend (Rust)

Un moteur robuste écrit en Rust qui :

- Parse les fichiers binaires HFSQL au niveau le plus bas
- Expose une API REST complète (Axum)
- Supporte SQL et ODBC pour les requêtes
- Gère efficacement les fichiers volumineux (jusqu'à 10 GB)

### Frontend (Electron + React)

Une interface graphique moderne qui offre :

- Dashboard interactif avec vue d'ensemble
- Inspection détaillée des tables et enregistrements
- Éditeur SQL intégré avec historique
- Visualisation des relations entre tables
- Support ODBC pour connexion aux bases de données externes

---

## Démarrage rapide

### 1. Installation

Consultez le [guide d'installation complet](getting-started/installation.md) pour les détails.

```bash
# Cloner le dépôt
git clone https://github.com/votre-org/fic-engine.git
cd fic-engine

# Compiler le backend
cargo build --release

# Installer le frontend
cd fic-inspector
npm install
```

### 2. Premiers pas

1. **Démarrer le serveur API** :
   ```bash
   cargo run --release -- serve
   ```

2. **Scanner vos fichiers** :
   ```bash
   cargo run --release -- scan ./data
   ```

3. **Lancer l'interface graphique** :
   ```bash
   cd fic-inspector
   npm run dev
   ```

Consultez [First Steps](getting-started/first-steps.md) pour un guide détaillé.

---

## Navigation dans la documentation

### Pour les débutants

Si vous découvrez FIC Engine & Inspector, commencez ici :

1. **[Installation](getting-started/installation.md)** - Installer tous les composants
2. **[First Steps](getting-started/first-steps.md)** - Première utilisation
3. **[Configuration](getting-started/configuration.md)** - Configurer le système

### Pour comprendre l'architecture

Explorez l'architecture technique étape par étape :

**Backend :**

- **[Architecture Backend](backend/architecture.md)** - Vue d'ensemble
- **[Core Module](backend/core-module.md)** - Parsing des fichiers `.fic`, `.mmo`, `.ndx`
- **[Storage Engine](backend/storage-engine.md)** - Moteur de stockage et requêtes
- **[API Server](backend/api-server.md)** - Serveur REST avec Axum
- **[SQL & ODBC](backend/sql-odbc.md)** - Support SQL et intégration ODBC

**Frontend :**

- **[Architecture Frontend](frontend/architecture.md)** - Vue d'ensemble Electron + React
- **[Pages Overview](frontend/pages-overview.md)** - Toutes les pages expliquées
- **[Components Guide](frontend/components-guide.md)** - Composants React détaillés
- **[State Management](frontend/state-management.md)** - Gestion de l'état
- **[API Integration](frontend/api-integration.md)** - Communication avec le backend

### Guides pratiques

- **[Step-by-Step Backend](guides/step-by-step-backend.md)** - Du fichier `.fic` à l'API REST
- **[Step-by-Step Frontend](guides/step-by-step-frontend.md)** - De l'action utilisateur à l'affichage
- **[Data Flow](guides/data-flow.md)** - Diagrammes de flux de données
- **[Troubleshooting](guides/troubleshooting.md)** - Résolution des problèmes courants

### Référence API

- **[REST API](api-reference/rest-api.md)** - Tous les endpoints documentés
- **[Types](api-reference/types.md)** - Structures de données
- **[Examples](api-reference/examples.md)** - Exemples d'utilisation

### Avancé

- **[Performance](advanced/performance.md)** - Optimisations et bonnes pratiques
- **[Security](advanced/security.md)** - Sécurité et conformité RGPD
- **[Extensibility](advanced/extensibility.md)** - Étendre le code

---

## Cas d'usage

### Migration de données legacy

Exporter vos données HFSQL vers PostgreSQL, MySQL ou tout autre système moderne.

### Archivage pérenne

Archiver vos données historiques dans des formats ouverts (JSON, CSV) pour une conservation à long terme.

### Intégration moderne

Intégrer vos données HFSQL dans vos applications modernes via l'API REST.

### Inspection et analyse

Analyser et inspecter vos données sans dépendre de l'application source.

---

## Sécurité et conformité

FIC Engine & Inspector est conçu avec la sécurité et la conformité en tête :

- ✅ **Traitement local** : Toutes les données restent sur votre infrastructure
- ✅ **Pas de télémétrie** : Aucun envoi de données à des serveurs externes
- ✅ **Mode lecture seule** : Protection contre les modifications accidentelles
- ✅ **Conformité RGPD/CNIL** : Respect de la vie privée et des données personnelles

Consultez [Security](advanced/security.md) pour plus de détails.

---

## Support

- **Documentation** : Cette documentation complète
- **Issues** : [GitHub Issues](https://github.com/votre-org/fic-engine/issues)
- **Email** : support@fic-engine.fr

---

## Licence

Ce projet est distribué sous une double licence MIT OR Apache-2.0.

---

## En savoir plus

<div class="grid cards" markdown>

-   :material-rocket-launch:{ .lg .middle } **Démarrage rapide**

    ---

    Apprenez à installer et utiliser FIC Engine & Inspector en quelques minutes

    [:octicons-arrow-right-24: Getting Started](getting-started/installation.md)

-   :material-book-open-page-variant:{ .lg .middle } **Guides pas à pas**

    ---

    Suivez des guides détaillés pour comprendre chaque mécanisme

    [:octicons-arrow-right-24: Guides](guides/step-by-step-backend.md)

-   :material-code-tags:{ .lg .middle } **Référence API**

    ---

    Consultez la documentation complète de l'API REST

    [:octicons-arrow-right-24: API Reference](api-reference/rest-api.md)

-   :material-shield-lock:{ .lg .middle } **Sécurité**

    ---

    Comprenez les aspects sécurité et conformité

    [:octicons-arrow-right-24: Security](advanced/security.md)

</div>

---

**FIC Engine & Inspector** — Solution professionnelle pour l'accès aux données HFSQL

[Installation](getting-started/installation.md) • [Guides](guides/step-by-step-backend.md) • [API](api-reference/rest-api.md)