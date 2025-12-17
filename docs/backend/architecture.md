# Architecture Backend

Cette page vous présente l'architecture complète du backend FIC Engine, depuis la structure des fichiers binaires jusqu'à l'exposition de l'API REST. Nous allons explorer chaque composant, comprendre leurs interactions, et voir pourquoi ces choix techniques ont été faits.

---

## Vue d'ensemble

Le backend FIC Engine est construit en Rust et suit une architecture en couches claire et modulaire :

```
┌─────────────────────────────────────────────────────────────┐
│                   API REST (Axum)                           │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐    │
│  │ Tables   │  │ Records  │  │   SQL    │  │   ODBC   │    │
│  │ Handlers │  │ Handlers │  │ Handlers │  │ Handlers │    │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘    │
└───────┼─────────────┼─────────────┼─────────────┼──────────┘
        │             │             │             │
┌───────▼─────────────▼─────────────▼─────────────▼──────────┐
│              Storage Engine                                 │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Table Management & Query Engine                     │  │
│  │  - scan_tables()                                     │  │
│  │  - select(), get_by_id()                             │  │
│  │  - filter(), paginate()                              │  │
│  └──────────────────────────────────────────────────────┘  │
└───────┬─────────────────────┬─────────────────────┬─────────┘
        │                     │                     │
┌───────▼──────────┐  ┌───────▼──────────┐  ┌───────▼──────────┐
│   FIC Parser     │  │   MMO Parser     │  │   NDX Parser     │
│   (.fic)         │  │   (.mmo)         │  │   (.ndx)         │
│                  │  │                  │  │                  │
│  - Header        │  │  - Blocks        │  │  - Index         │
│  - Records       │  │  - Text/Binary   │  │  - Entries       │
└───────┬──────────┘  └───────┬──────────┘  └───────┬──────────┘
        │                     │                     │
        └─────────────────────┼─────────────────────┘
                              │
                    ┌─────────▼─────────┐
                    │  Fichiers HFSQL   │
                    │  *.fic, *.mmo,    │
                    │  *.ndx            │
                    └───────────────────┘
```

---

## Pourquoi Rust ?

Le choix de Rust pour le backend n'est pas anodin. Voici les raisons principales :

### Performance

- **Vitesse native** : Compilé en code machine, pas d'interprétation
- **Pas de garbage collector** : Contrôle total sur la mémoire
- **Optimisations du compilateur** : Rust optimise agressivement le code

### Sécurité mémoire

- **Pas de segfaults** : Le système de types empêche les erreurs courantes
- **Pas de fuites mémoire** : Gestion automatique avec RAII
- **Thread-safety** : Le système de propriété garantit la sécurité des threads

### Interopérabilité

- **C FFI** : Peut être intégré dans d'autres langages
- **Pas de runtime** : Pas de dépendances externes lourdes
- **Multi-plateforme** : Fonctionne sur Windows, Linux, macOS

### Écosystème

- **Cargo** : Gestionnaire de paquets excellent
- **Axum** : Framework HTTP moderne et performant
- **Serde** : Sérialisation/désérialisation ultra-rapide

---

## Structure des modules

Le backend est organisé en modules logiques :

```
src/
├── main.rs              # Point d'entrée CLI
├── lib.rs               # Bibliothèque principale
│
├── core/                # Parsing binaire (bas niveau)
│   ├── mod.rs           # Types communs
│   ├── fic.rs           # Parser .fic
│   ├── mmo.rs           # Parser .mmo
│   └── ndx.rs           # Parser .ndx
│
├── storage/             # Moteur de stockage (haut niveau)
│   ├── mod.rs
│   └── engine.rs        # CRUD, requêtes, décodage
│
├── api/                 # Serveur HTTP
│   ├── mod.rs
│   ├── server.rs        # Configuration Axum, routes
│   └── handlers.rs      # Handlers REST
│
├── sql/                 # Support SQL
│   ├── mod.rs
│   ├── parser.rs        # Parser SQL
│   ├── executor.rs      # Exécuteur SQL
│   ├── server.rs        # API SQL
│   └── odbc.rs          # Intégration ODBC
│
├── cli/                 # Interface ligne de commande
│   ├── mod.rs
│   └── commands.rs      # Commandes CLI
│
└── config/              # Configuration
    ├── mod.rs
    └── settings.rs      # Structures config
```

---

## 🔄 Flux de données principal

Voici comment une requête passe de l'API jusqu'aux fichiers binaires :

### 1. Requête HTTP arrive

```
Client HTTP
    │
    ├─► Requête: GET /tables/CLIENT/records/42
    │
    └─► Serveur Axum
```

### 2. Routage et extraction

```rust
// Dans src/api/server.rs
.route("/tables/:table/records/:id", get(handlers::get_record))

// Axum extrait automatiquement les paramètres
Path((table, id)): Path<(String, u32)>
// → table = "CLIENT", id = 42
```

### 3. Handler traite la requête

```rust
// Dans src/api/handlers.rs
pub async fn get_record(
    State(engine): State<Arc<StorageEngine>>,
    Path((table, id)): Path<(String, u32)>,
) -> Result<Json<Record>, ...>
```

### 4. StorageEngine localise le fichier

```rust
// Dans src/storage/engine.rs
pub fn get_by_id(&self, table: &str, id: u32) -> Result<Record> {
    let tables = self.tables.read().unwrap();  // Cache thread-safe
    let table_files = tables.get(table)?;      // TableFiles pour "CLIENT"
    // → table_files.fic_path = "./data/CLIENT.FIC"
```

### 5. FicFile lit l'enregistrement

```rust
// Dans src/core/fic.rs
let mut fic = FicFile::open(&table_files.fic_path)?;
let record = fic.read_record(id)?;
// → FicRecord avec données brutes
```

### 6. Décodage selon le schéma

```rust
// Dans src/storage/engine.rs
fn record_from_fic(fic_record: FicRecord, schema: &TableSchema, ...) -> Record {
    // Décode chaque champ selon son type
    // → Record avec champs typés
```

### 7. Réponse JSON

```rust
// Sérialisation automatique avec Serde
Json(record)  // → JSON envoyé au client
```

---

## 🔐 Thread Safety

Le backend est conçu pour être thread-safe et peut gérer plusieurs requêtes simultanément :

### Arc pour le partage

```rust
// StorageEngine est wrappé dans Arc pour le partage
let engine = Arc::new(StorageEngine::new(...)?);

// Chaque handler reçoit une référence partagée
State(engine): State<Arc<StorageEngine>>
```

### RwLock pour le cache

```rust
// Le cache des tables utilise RwLock
tables: Arc<RwLock<HashMap<String, TableFiles>>>

// Lecture concurrente autorisée
let tables = self.tables.read().unwrap();  // Plusieurs readers OK

// Écriture exclusive
let mut tables = self.tables.write().unwrap();  // Un seul writer
```

### Tokio pour l'asynchronisme

```rust
// Axum utilise Tokio pour gérer les requêtes asynchrones
pub async fn get_record(...) -> Result<...>  // Fonction asynchrone

// Plusieurs requêtes peuvent être traitées en parallèle
```

---

## 📊 Cache et performance

### Cache des tables

Le `StorageEngine` maintient un cache des tables détectées :

```rust
// Cache mis à jour lors du scan
pub fn scan_tables(&self) -> Result<Vec<String>> {
    // Scan le dossier
    // Met à jour self.tables (cache)
}

// Lecture depuis le cache (rapide)
pub fn list_tables(&self) -> Vec<String> {
    self.tables.read().unwrap().keys().cloned().collect()
}
```

**Avantages** :
- ✅ Pas besoin de scanner le disque à chaque requête
- ✅ Accès rapide aux chemins de fichiers
- ✅ Thread-safe avec RwLock

### Lecture streaming

Les fichiers volumineux sont lus par chunks pour éviter de charger tout en mémoire :

```rust
// Lecture par chunks dans FicFile::read_record()
let mut record_buffer = vec![0u8; self.header.record_length as usize];
file.read(&mut record_buffer)?;
```

---

## 🛡️ Gestion des erreurs

Le backend utilise un système d'erreurs robuste :

### Anyhow pour les erreurs contextuelles

```rust
use anyhow::{Context, Result};

let file = File::open(&path)
    .with_context(|| format!("Impossible d'ouvrir: {:?}", path))?;
```

**Avantages** :
- ✅ Messages d'erreur détaillés avec contexte
- ✅ Chaînage d'erreurs pour traçabilité
- ✅ Conversion facile entre types d'erreurs

### Réponses HTTP standardisées

```rust
// Dans src/api/handlers.rs
#[derive(Serialize)]
pub struct ErrorResponse {
    pub error: String,
    pub code: u16,
    pub details: Option<String>,
}

// Tous les handlers retournent des erreurs standardisées
.map_err(|e| (
    StatusCode::NOT_FOUND,
    Json(ErrorResponse { ... })
))
```

---

## 🔌 Extensibilité

L'architecture est conçue pour être extensible :

### Ajouter un nouveau format de fichier

1. Créer `src/core/new_format.rs`
2. Implémenter les traits nécessaires
3. Intégrer dans `StorageEngine`

### Ajouter un endpoint API

1. Ajouter la route dans `src/api/server.rs`
2. Créer le handler dans `src/api/handlers.rs`
3. Utiliser le `StorageEngine` pour les données

### Ajouter un nouveau type de champ

1. Ajouter au enum `FieldType` dans `src/core/mod.rs`
2. Implémenter le décodage dans `StorageEngine::record_from_fic()`
3. Mettre à jour la sérialisation JSON

---

## Prochaines étapes

Maintenant que vous comprenez l'architecture globale :

1. **[Core Module](core-module.md)** - Détails sur le parsing des fichiers `.fic`, `.mmo`, `.ndx`
2. **[Storage Engine](storage-engine.md)** - Fonctionnement du moteur de stockage
3. **[API Server](api-server.md)** - Configuration et fonctionnement de l'API REST

---

<div align="center">

✅ **Architecture comprise ?** Explorez le [Core Module](core-module.md) pour comprendre comment les fichiers binaires sont parsés !

</div>

