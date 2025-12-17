# Storage Engine

Le Storage Engine est la couche haut niveau qui gère l'accès aux données HFSQL. Il fournit des opérations CRUD, des requêtes avec filtres, et la conversion des données brutes en structures typées.

---

## Vue d'ensemble

Le `StorageEngine` agit comme une abstraction entre l'API REST et les fichiers binaires parsés par le module Core.

### Responsabilités

- **Détection automatique des tables** : Scan d'un dossier pour trouver les fichiers HFSQL
- **Cache des tables** : Maintient un cache thread-safe des tables détectées
- **Lecture d'enregistrements** : Avec décodage selon le schéma
- **Filtrage et pagination** : Requêtes avec filtres par champ
- **Conversion de types** : FicRecord → Record typé avec FieldValue

---

## Architecture

```
StorageEngine
├── data_dir: PathBuf              # Dossier contenant les fichiers
├── tables: Arc<RwLock<HashMap>>   # Cache des tables (thread-safe)
└── read_only: bool                # Mode lecture seule
```

---

## Détection des tables

### Étape 1 : Scan du dossier

```rust
pub fn scan_tables(&self) -> Result<Vec<String>> {
    // 1. Lire le contenu du dossier
    let entries = std::fs::read_dir(&self.data_dir)?;
    
    // 2. Détecter les fichiers .fic
    for entry in entries {
        if ext == "fic" {
            fic_files.insert(name, path);
        }
    }
    
    // 3. Associer avec .mmo et .ndx
    for (name, fic_path) in fic_files {
        let mmo_path = ...;
        let ndx_paths = ...;
        
        // 4. Mettre à jour le cache
        self.tables.write().unwrap().insert(name, TableFiles { ... });
    }
}
```

---

## Lecture d'enregistrements

### Étape 1 : Localiser le fichier

Le cache permet de trouver rapidement le fichier `.fic` correspondant à une table.

### Étape 2 : Lire via FicFile

```rust
let mut fic = FicFile::open(&table_files.fic_path)?;
let fic_record = fic.read_record(id)?;
```

### Étape 3 : Décoder selon le schéma

```rust
fn record_from_fic(fic_record: FicRecord, schema: &TableSchema, ...) -> Record {
    // Décode chaque champ selon son type
    // Integer → FieldValue::Integer
    // String → FieldValue::String (avec décodage Windows-1252)
    // ...
}
```

---

## Types de champs et décodage

### Integer

```rust
FieldType::Integer => {
    if length == 4 {
        let mut cursor = Cursor::new(field_data);
        FieldValue::integer(cursor.read_i32::<LittleEndian>()? as i64)
    }
}
```

### String

```rust
FieldType::String => {
    // Trouver la fin (null byte)
    let null_pos = field_data.iter().position(|&b| b == 0)?;
    let string_bytes = &field_data[..null_pos];
    
    // Décoder Windows-1252 ou UTF-8
    let (decoded, _, _) = WINDOWS_1252.decode(string_bytes);
    FieldValue::string(decoded.into_owned())
}
```

### Memo

```rust
FieldType::Memo => {
    let pointer = cursor.read_u32::<LittleEndian>()?;
    if let Some(ref mut mmo_file) = mmo {
        if let Ok(text) = mmo_file.read_text(pointer) {
            memo_data.insert(field.name.clone(), text);
        }
    }
}
```

---

## Filtrage et pagination

### QueryFilters

```rust
pub struct QueryFilters {
    pub limit: Option<u32>,
    pub offset: Option<u32>,
    pub field_filters: HashMap<String, String>,
}
```

### Application des filtres

```rust
let records: Vec<Record> = all_records
    .into_iter()
    .filter(|r| apply_filters(r, &filters))  // Filtres par champ
    .skip(offset as usize)                    // Pagination
    .take(limit as usize)
    .collect();
```

---

## Thread Safety

Le `StorageEngine` est thread-safe grâce à :

- **Arc** : Partage entre threads
- **RwLock** : Lectures concurrentes, écriture exclusive

```rust
let tables = self.tables.read().unwrap();  // Plusieurs readers OK
// ...
let mut tables = self.tables.write().unwrap();  // Un seul writer
```

---

## Prochaines étapes

1. **[API Server](api-server.md)** - Comment le StorageEngine est utilisé par l'API
2. **[Guides pas à pas](../guides/step-by-step-backend.md)** - Guide complet

---

<div align="center">

✅ **Storage Engine compris ?** Explorez l'[API Server](api-server.md) pour voir comment tout est exposé !

</div>

