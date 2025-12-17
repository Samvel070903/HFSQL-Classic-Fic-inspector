# Premiers pas

Bienvenue ! Ce guide vous accompagne dans vos premières utilisations de FIC Engine & Inspector. Nous allons découvrir ensemble comment démarrer le serveur, scanner vos fichiers et utiliser l'interface graphique.

---

## Objectifs de ce guide

À la fin de ce guide, vous saurez :

- ✅ Démarrer le serveur API
- ✅ Scanner vos fichiers HFSQL
- ✅ Utiliser l'interface graphique
- ✅ Effectuer votre première requête API
- ✅ Interpréter les résultats

---

## Étape 1 : Préparer vos fichiers

Avant de commencer, assurez-vous d'avoir vos fichiers HFSQL prêts.

### Structure recommandée

Créez un dossier pour vos fichiers (par exemple `data/`) :

```
mon-projet/
├── data/
│   ├── CLIENT.FIC
│   ├── CLIENT.MMO
│   ├── CLIENT.NDX0
│   ├── PRODUIT.FIC
│   └── COMMANDE.FIC
├── config.toml
└── fic-engine/
```

**Note** : Les fichiers peuvent être en majuscules ou minuscules, FIC Engine les détecte automatiquement.

---

## Étape 2 : Démarrer le serveur API

### Option 1 : Sans configuration (valeurs par défaut)

```bash
# Depuis la racine du projet
cargo run --release -- serve
```

Le serveur démarre sur `http://127.0.0.1:8080` par défaut.

Vous devriez voir :

```
🚀 Serveur API démarré sur http://127.0.0.1:8080
📋 Endpoints disponibles:
   GET  /health
   GET  /tables
   GET  /tables/:table/schema
   GET  /tables/:table/records
   GET  /tables/:table/records/:id
   POST /upload
   POST /sql - Exécuter des requêtes SQL
```

### Option 2 : Avec paramètres personnalisés

```bash
# Spécifier le port et l'adresse
cargo run --release -- serve --port 9000 --host 0.0.0.0

# Spécifier le dossier de données
cargo run --release -- serve --data-dir ./mes-fichiers
```

### Option 3 : Avec fichier de configuration

Créez un fichier `config.toml` à la racine :

```toml
data_dir = "./data"

[api]
host = "127.0.0.1"
port = 8080
cors_enabled = true

[storage]
read_only = true
```

Puis lancez :

```bash
cargo run --release -- serve --config config.toml
```

Pour plus de détails sur la configuration, consultez [Configuration](configuration.md).

---

## Étape 3 : Scanner vos fichiers

Avant de pouvoir utiliser vos données, il faut scanner le dossier pour détecter les tables.

### Scanner depuis le CLI

Ouvrez un **nouveau terminal** (gardez le serveur en cours d'exécution) :

```bash
# Scanner un dossier
cargo run --release -- scan ./data

# Ou avec le chemin complet
cargo run --release -- scan /chemin/vers/mes/fichiers
```

**Sortie attendue** :

```
Tables trouvées: 3
  - CLIENT
    Record length: 256 bytes
    Fields: 10
  - PRODUIT
    Record length: 128 bytes
    Fields: 8
  - COMMANDE
    Record length: 512 bytes
    Fields: 15
```

**Ce qui se passe** : Le scanner parcourt le dossier, détecte les fichiers `.fic`, les associe avec leurs fichiers `.mmo` et `.ndx` correspondants, puis met à jour le cache interne du serveur.

### Scanner via l'API

Le scan se fait aussi automatiquement lors de la première requête, ou vous pouvez forcer un scan :

```bash
# Les tables sont automatiquement détectées lors de la première requête GET /tables
curl http://localhost:8080/tables
```

---

## Étape 4 : Tester l'API

Maintenant que le serveur tourne et que les tables sont détectées, testons l'API.

### Test 1 : Vérifier la santé du serveur

```bash
curl http://localhost:8080/health
```

**Réponse attendue** :

```json
{
  "status": "ok",
  "version": "0.1.0"
}
```

### Test 2 : Lister les tables

```bash
curl http://localhost:8080/tables
```

**Réponse attendue** :

```json
["CLIENT", "PRODUIT", "COMMANDE"]
```

### Test 3 : Obtenir le schéma d'une table

```bash
curl http://localhost:8080/tables/CLIENT/schema
```

**Réponse attendue** :

```json
{
  "name": "CLIENT",
  "record_length": 256,
  "field_count": 10,
  "fields": [
    {
      "name": "id",
      "field_type": "Integer",
      "offset": 0,
      "length": 4
    },
    {
      "name": "nom",
      "field_type": "String",
      "offset": 4,
      "length": 50
    }
  ]
}
```

### Test 4 : Lire quelques enregistrements

```bash
curl "http://localhost:8080/tables/CLIENT/records?limit=5"
```

**Réponse attendue** :

```json
{
  "records": [
    {
      "id": 0,
      "fields": {
        "id": { "type": "integer", "value": 1 },
        "nom": { "type": "string", "value": "Dupont" },
        "prenom": { "type": "string", "value": "Jean" }
      },
      "memo_data": {}
    }
  ],
  "total": 150,
  "offset": 0,
  "limit": 5
}
```

---

## Étape 5 : Utiliser l'interface graphique

L'interface graphique (FIC Inspector) offre une expérience plus visuelle et intuitive.

### Lancer l'interface

```bash
# Depuis le dossier fic-inspector
cd fic-inspector
npm run dev
```

L'application Electron s'ouvre automatiquement dans une nouvelle fenêtre.

### Première connexion

1. **Vérifier l'URL de l'API** :
   - Par défaut : `http://127.0.0.1:8080`
   - Vous pouvez la modifier dans les paramètres si nécessaire

2. **Cliquer sur "Se connecter"** ou "Actualiser" :
   - L'interface teste la connexion au serveur
   - Si le serveur est accessible, vous verrez un indicateur vert

3. **Scanner les tables** :
   - Cliquez sur le bouton "Scanner les tables" ou "Scan"
   - Les tables détectées apparaissent dans la sidebar

### Explorer les données

1. **Dashboard** :
   - Vue d'ensemble des tables
   - Statistiques (nombre de tables, total d'enregistrements, etc.)

2. **Tables** :
   - Cliquez sur une table dans la sidebar
   - Visualisez les enregistrements dans un tableau
   - Cliquez sur un enregistrement pour voir les détails

3. **SQL/ODBC** :
   - Onglet pour exécuter des requêtes SQL
   - Support ODBC pour connexion aux bases de données externes

4. **Logs** :
   - Visualisation des logs du serveur en temps réel
   - Utile pour le débogage

---

## Exemple complet : De A à Z

Mettons tout ensemble avec un exemple concret.

### Scénario

Vous avez des fichiers HFSQL dans `./data/` et vous voulez voir les clients dans l'interface.

### Étapes

```bash
# 1. Démarrer le serveur (terminal 1)
cd /chemin/vers/fic-engine
cargo run --release -- serve --data-dir ./data

# 2. Lancer l'interface (terminal 2)
cd fic-inspector
npm run dev

# 3. Dans l'interface :
#    - Cliquer sur "Scanner les tables"
#    - Cliquer sur "CLIENT" dans la sidebar
#    - Explorer les enregistrements
```

### Résultats attendus

- ✅ Le serveur démarre sans erreur
- ✅ Les tables sont détectées (CLIENT, PRODUIT, etc.)
- ✅ L'interface affiche les enregistrements
- ✅ Vous pouvez cliquer sur un enregistrement pour voir les détails

---

## Comprendre les résultats

### Structure d'un enregistrement

Quand vous lisez un enregistrement, vous obtenez :

```json
{
  "id": 0,
  "fields": {
    "nom": { "type": "string", "value": "Dupont" },
    "age": { "type": "integer", "value": 30 }
  },
  "memo_data": {
    "notes": "Client VIP"
  }
}
```

**Explications** :

- `id` : Identifiant unique de l'enregistrement (index dans le fichier)
- `fields` : Tous les champs de l'enregistrement avec leur type et valeur
- `memo_data` : Données mémo (texte long) associées à l'enregistrement

### Types de champs

| Type | Description | Exemple |
|------|-------------|---------|
| `string` | Chaîne de caractères | `"Dupont"` |
| `integer` | Nombre entier | `30` |
| `float` | Nombre décimal | `19.99` |
| `binary` | Données binaires (hex) | `"48656c6c6f"` |
| `null` | Valeur nulle | `null` |

---

## Dépannage rapide

### Le serveur ne démarre pas

**Erreur** : "Address already in use"

**Solution** : Un autre processus utilise le port 8080.

```bash
# Trouver le processus (Linux/macOS)
lsof -i :8080

# Tuer le processus
kill -9 <PID>

# Ou changer le port
cargo run --release -- serve --port 9000
```

### Les tables ne sont pas détectées

**Problème** : Le scan ne trouve aucune table.

**Vérifications** :

1. Les fichiers `.fic` sont bien dans le dossier `data/` ?
2. Les extensions sont bien `.fic` (pas `.FIC` ou autre) ?
3. Le chemin spécifié est correct ?

```bash
# Vérifier les fichiers
ls -la data/*.fic

# Scanner avec verbose
cargo run --release -- scan ./data --verbose
```

### L'interface ne se connecte pas au serveur

**Problème** : Erreur de connexion dans l'interface.

**Vérifications** :

1. Le serveur est bien démarré ?
2. L'URL dans l'interface est correcte (`http://127.0.0.1:8080`) ?
3. Le port correspond à celui du serveur ?

```bash
# Tester la connexion manuellement
curl http://localhost:8080/health
```

---

## Prochaines étapes

Maintenant que vous maîtrisez les bases :

1. **[Configuration](configuration.md)** - Personnaliser FIC Engine
2. **[Architecture Backend](../backend/architecture.md)** - Comprendre le fonctionnement interne
3. **[API Reference](../api-reference/rest-api.md)** - Explorer toutes les fonctionnalités de l'API
4. **[Guides pratiques](../guides/step-by-step-backend.md)** - Guides détaillés pas à pas

---

<div align="center">

🎉 **Félicitations !** Vous avez fait vos premiers pas avec FIC Engine & Inspector.

Continuez avec la [Configuration](configuration.md) pour personnaliser votre installation.

</div>

