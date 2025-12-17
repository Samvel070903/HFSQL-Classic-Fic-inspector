# Configuration

Ce guide explique comment configurer FIC Engine & Inspector selon vos besoins. Nous allons explorer toutes les options de configuration disponibles, l'ordre de priorité, et des exemples concrets pour différents cas d'usage.

---

## Vue d'ensemble

FIC Engine peut être configuré de plusieurs façons :

1. **Fichier de configuration** (`config.toml`) - Recommandé pour la production
2. **Variables d'environnement** - Pratique pour le développement
3. **Paramètres en ligne de commande** - Utile pour les tests rapides
4. **Valeurs par défaut** - Fonctionne out of the box

**Ordre de priorité** (du plus prioritaire au moins prioritaire) :

1. Variables d'environnement
2. Paramètres CLI
3. Fichier `config.toml`
4. Valeurs par défaut

---

## ⚙️ Structure de configuration

### Fichier config.toml

Créez un fichier `config.toml` à la racine du projet :

```toml
# Dossier contenant les fichiers .fic, .mmo, .ndx
data_dir = "./data"

[api]
# Adresse d'écoute du serveur
host = "127.0.0.1"
# Port HTTP
port = 8080
# Activer CORS (nécessaire pour l'interface web)
cors_enabled = true

[storage]
# Mode lecture seule (sécurité)
read_only = false
# Activer les opérations d'écriture
enable_write = true

[logging]
# Niveau de logs : trace, debug, info, warn, error
level = "info"
```

---

## Paramètres par section

### Section `[api]` - Configuration du serveur HTTP

| Paramètre | Type | Défaut | Description |
|-----------|------|--------|-------------|
| `host` | string | `"127.0.0.1"` | Adresse IP ou hostname d'écoute |
| `port` | u16 | `8080` | Port HTTP du serveur |
| `cors_enabled` | bool | `true` | Active CORS pour l'interface web |

#### Exemples

**Développement local** :
```toml
[api]
host = "127.0.0.1"
port = 8080
cors_enabled = true
```

**Production (accessible depuis le réseau)** :
```toml
[api]
host = "0.0.0.0"  # Écoute sur toutes les interfaces
port = 8080
cors_enabled = false  # Désactiver CORS si vous utilisez un reverse proxy
```

**Derrière un reverse proxy** :
```toml
[api]
host = "127.0.0.1"  # Écoute seulement en local
port = 8080
cors_enabled = true
```

### Section `[storage]` - Configuration du moteur de stockage

| Paramètre | Type | Défaut | Description |
|-----------|------|--------|-------------|
| `read_only` | bool | `false` | Active le mode lecture seule |
| `enable_write` | bool | `true` | Active les opérations d'écriture |

#### Exemples

**Mode lecture seule (sécurité maximale)** :
```toml
[storage]
read_only = true
enable_write = false
```

**Mode lecture/écriture** :
```toml
[storage]
read_only = false
enable_write = true
```

!!! warning "Attention"
    Le mode lecture seule est recommandé pour la production, surtout lors de la première utilisation, pour éviter les modifications accidentelles de vos fichiers HFSQL.

### Section `[logging]` - Configuration des logs

| Paramètre | Type | Défaut | Description |
|-----------|------|--------|-------------|
| `level` | string | `"info"` | Niveau de log (`trace`, `debug`, `info`, `warn`, `error`) |

#### Exemples

**Production (logs minimaux)** :
```toml
[logging]
level = "warn"  # Seulement les avertissements et erreurs
```

**Développement (logs détaillés)** :
```toml
[logging]
level = "debug"  # Beaucoup de détails pour le débogage
```

**Diagnostic (logs très détaillés)** :
```toml
[logging]
level = "trace"  # Tous les détails possibles
```

---

## 🌍 Variables d'environnement

Vous pouvez surcharger toute configuration avec des variables d'environnement.

### Format des variables

Les variables utilisent le préfixe `FIC__` avec des underscores doubles (`__`) pour séparer les niveaux.

**Format** : `FIC__SECTION__PARAMETRE`

### Exemples

```bash
# Windows (PowerShell)
$env:FIC__DATA_DIR = "./mes-fichiers"
$env:FIC__API__PORT = "9000"
$env:FIC__STORAGE__READ_ONLY = "true"
$env:FIC__LOGGING__LEVEL = "debug"

# Linux/macOS
export FIC__DATA_DIR=./mes-fichiers
export FIC__API__PORT=9000
export FIC__STORAGE__READ_ONLY=true
export FIC__LOGGING__LEVEL=debug
```

### Table de correspondance

| Fichier TOML | Variable d'environnement |
|--------------|--------------------------|
| `data_dir` | `FIC__DATA_DIR` |
| `api.host` | `FIC__API__HOST` |
| `api.port` | `FIC__API__PORT` |
| `api.cors_enabled` | `FIC__API__CORS_ENABLED` |
| `storage.read_only` | `FIC__STORAGE__READ_ONLY` |
| `storage.enable_write` | `FIC__STORAGE__ENABLE_WRITE` |
| `logging.level` | `FIC__LOGGING__LEVEL` |

---

## Cas d'usage

### Cas 1 : Développement local

**Configuration** : `config.toml`

```toml
data_dir = "./data"

[api]
host = "127.0.0.1"
port = 8080
cors_enabled = true

[storage]
read_only = true

[logging]
level = "debug"
```

**Commande** :
```bash
cargo run --release -- serve
```

### Cas 2 : Production avec reverse proxy

**Configuration** : `config.prod.toml`

```toml
data_dir = "/var/lib/fic-engine/data"

[api]
host = "127.0.0.1"  # Écoute seulement en local
port = 8080
cors_enabled = false  # CORS géré par nginx

[storage]
read_only = true  # Sécurité maximale

[logging]
level = "info"
```

**Commande** :
```bash
cargo run --release -- serve --config config.prod.toml
```

**Nginx config** (exemple) :
```nginx
server {
    listen 80;
    server_name fic-engine.example.com;

    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        
        # CORS headers
        add_header Access-Control-Allow-Origin *;
        add_header Access-Control-Allow-Methods "GET, POST, PATCH, DELETE, OPTIONS";
    }
}
```

### Cas 3 : Tests avec Docker

**Variables d'environnement** :

```bash
export FIC__DATA_DIR=/app/data
export FIC__API__HOST=0.0.0.0
export FIC__API__PORT=8080
export FIC__STORAGE__READ_ONLY=true
export FIC__LOGGING__LEVEL=info
```

**Dockerfile** (exemple) :
```dockerfile
FROM rust:1.70 as builder
WORKDIR /app
COPY . .
RUN cargo build --release

FROM debian:bookworm-slim
COPY --from=builder /app/target/release/fic /usr/local/bin/fic
ENV FIC__DATA_DIR=/app/data
ENV FIC__API__HOST=0.0.0.0
ENV FIC__API__PORT=8080
CMD ["fic", "serve"]
```

### Cas 4 : Multi-environnements

Créez différents fichiers de configuration :

```
config.dev.toml    # Développement
config.test.toml   # Tests
config.prod.toml   # Production
```

**Utilisation** :
```bash
# Développement
cargo run --release -- serve --config config.dev.toml

# Production
cargo run --release -- serve --config config.prod.toml
```

---

## Vérification de la configuration

### Afficher la configuration chargée

Pour voir quelle configuration est réellement utilisée, consultez les logs au démarrage :

```bash
cargo run --release -- serve
```

Les logs affichent les paramètres chargés (si le niveau de log est `debug` ou plus).

### Tester la configuration

```bash
# Vérifier que le serveur démarre avec votre config
cargo run --release -- serve --config config.toml

# Dans un autre terminal, tester
curl http://localhost:8080/health
```

---

## Exemples de configurations complètes

### Configuration minimale

```toml
data_dir = "./data"
```

Tout le reste utilise les valeurs par défaut.

### Configuration complète avec commentaires

```toml
# ============================================
# Configuration FIC Engine & Inspector
# ============================================

# Dossier contenant les fichiers HFSQL (.fic, .mmo, .ndx)
# Chemin relatif ou absolu
data_dir = "./data"

# ============================================
# Configuration du serveur API HTTP
# ============================================
[api]
# Adresse d'écoute :
# - "127.0.0.1" : Seulement accessible depuis la machine locale
# - "0.0.0.0" : Accessible depuis le réseau
host = "127.0.0.1"

# Port HTTP (1024-65535)
port = 8080

# Activer CORS (Cross-Origin Resource Sharing)
# Nécessaire pour l'interface web si elle est sur un autre port/domaine
cors_enabled = true

# ============================================
# Configuration du moteur de stockage
# ============================================
[storage]
# Mode lecture seule : désactive toutes les modifications
# Recommandé pour la production ou lors de l'exploration initiale
read_only = true

# Activer les opérations d'écriture
# Ignoré si read_only = true
enable_write = false

# ============================================
# Configuration du système de logging
# ============================================
[logging]
# Niveaux disponibles (du moins au plus verbeux) :
# - error : Seulement les erreurs
# - warn  : Erreurs + avertissements
# - info  : Informations générales (défaut)
# - debug : Informations détaillées pour le débogage
# - trace : Toutes les informations possibles
level = "info"
```

---

## Dépannage

### La configuration n'est pas prise en compte

**Problème** : Les changements dans `config.toml` ne sont pas appliqués.

**Solutions** :

1. Vérifier que le fichier est au bon endroit (racine du projet)
2. Vérifier la syntaxe TOML (pas de fautes de frappe)
3. Vérifier qu'aucune variable d'environnement ne surcharge la config
4. Redémarrer le serveur après modification

### Erreur de parsing TOML

**Erreur** : "TOML parse error"

**Solution** : Vérifier la syntaxe TOML. Utilisez un validateur en ligne comme [toml-lint](https://www.toml-lint.com/).

### Variables d'environnement ignorées

**Problème** : Les variables d'environnement ne fonctionnent pas.

**Vérifications** :

1. Le format est correct (`FIC__SECTION__PARAMETRE`)
2. Les underscores doubles (`__`) sont bien présents
3. La casse est correcte (majuscules)
4. Les variables sont exportées dans le bon shell

---

## Bonnes pratiques

### 1. Utiliser des chemins absolus en production

```toml
# ✅ Bon
data_dir = "/var/lib/fic-engine/data"

# ⚠️ Moins fiable (dépend du répertoire de travail)
data_dir = "./data"
```

### 2. Mode lecture seule par défaut

```toml
[storage]
read_only = true  # Sécurité par défaut
```

### 3. Logs adaptés à l'environnement

```toml
# Développement
[logging]
level = "debug"

# Production
[logging]
level = "warn"
```

### 4. Séparer les configurations par environnement

Utilisez des fichiers séparés pour dev/test/prod.

---

## Prochaines étapes

Maintenant que vous maîtrisez la configuration :

1. **[Architecture Backend](../backend/architecture.md)** - Comprendre l'architecture interne
2. **[API Reference](../api-reference/rest-api.md)** - Explorer tous les endpoints
3. **[Guides pratiques](../guides/step-by-step-backend.md)** - Guides détaillés

---

<div align="center">

✅ **Configuration terminée ?** Explorez l'[Architecture Backend](../backend/architecture.md) pour comprendre comment tout fonctionne !

</div>

