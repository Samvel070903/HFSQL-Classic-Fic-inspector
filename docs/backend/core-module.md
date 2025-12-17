# Core Module : Parsing des fichiers HFSQL

Le module Core est le cœur de FIC Engine. C'est ici que se fait la lecture et l'interprétation des fichiers binaires HFSQL. Ce guide vous explique, étape par étape, comment chaque type de fichier est parsé, depuis les bytes bruts jusqu'aux structures de données utilisables.

---

## Vue d'ensemble

Le module Core (`src/core/`) est responsable de :

- **Lecture des fichiers `.fic`** : Enregistrements structurés avec header binaire
- **Lecture des fichiers `.mmo`** : Blocs mémo pour données texte et binaires  
- **Lecture des fichiers `.ndx`** : Index B-tree pour recherche rapide
- **Détection des schémas** : Analyse de la structure des enregistrements

Chaque type de fichier a son propre parser, mais ils travaillent ensemble pour fournir un accès complet aux données.

---

## Structure d'un fichier .fic

Avant de comprendre le parsing, visualisons la structure d'un fichier `.fic` :

```
┌─────────────────────────────────────────────────────────┐
│              Header (20+ bytes)                         │
├─────────────────────────────────────────────────────────┤
│ Offset │ Taille │ Description                           │
├────────┼────────┼────────────────────────────────────────┤
│ 0x00   │ 4      │ Magic bytes: "PCS\0" ou "FIC\0"      │
│ 0x04   │ 2      │ Version du format                    │
│ 0x06   │ 2      │ Padding                              │
│ 0x08   │ 2      │ Record length (u16)                  │
│ 0x0A   │ 2      │ Record count (u16)                   │
│ 0x0C   │ 2      │ Padding                              │
│ 0x0E   │ 2      │ Deleted count (u16)                  │
│ 0x10   │ 2      │ Padding                              │
│ 0x12   │ 2      │ Flags                                │
│ 0x14   │ ...    │ Données supplémentaires (optionnel)   │
└────────┴────────┴────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────┐
│            Records (à partir de data_offset)            │
├─────────────────────────────────────────────────────────┤
│ Record 0:                                               │
│   ┌─────────────────────────────────────────────────┐  │
│   │ Flag (1 byte): 0 = actif, 1 = supprimé        │  │
│   │ Data (record_length - 1 bytes)                 │  │
│   │ Memo pointers (optionnel)                      │  │
│   └─────────────────────────────────────────────────┘  │
│                                                         │
│ Record 1:                                               │
│   ┌─────────────────────────────────────────────────┐  │
│   │ ...                                             │  │
│   └─────────────────────────────────────────────────┘  │
│                                                         │
│ Record N:                                               │
│   ...                                                   │
└─────────────────────────────────────────────────────────┘
```

---

## Étape 1 : Structure d'un fichier .fic

Commençons par comprendre la structure complète d'un fichier `.fic`.

### Format binaire

Un fichier `.fic` est un fichier binaire avec :

- **Header fixe** : Métadonnées au début du fichier (20+ bytes)
- **Enregistrements de taille fixe** : Chaque enregistrement fait exactement `record_length` bytes
- **Flag de suppression** : Le premier byte de chaque enregistrement indique s'il est supprimé

### Exemple visuel

```
Fichier: CLIENT.FIC (taille: 51,456 bytes)

Header (20 bytes):
  [50 43 53 00] [01 00] [00 00] [00 01] [2D 00] [00 00] [00 00] [00 00] [00 00] [00 00]
   └─PCS─┘      └─v1─┘          └─256─┘ └─45─┘                  └─0─┘

Records (à partir de l'offset 20):
  Record 0: [00] [01 00 00 00] ["Dupont        "...] [données...]
             └─┘  └───id───┘    └───────nom────────┘
           actif

  Record 1: [00] [02 00 00 00] ["Martin        "...] [données...]
           actif

  Record 2: [01] [03 00 00 00] [données...]  ← supprimé
             └─┘
           supprimé

  ...
```

---

## Étape 2 : Comment le parser lit le header

Voici comment le code lit et parse le header d'un fichier `.fic`.

### Code commenté ligne par ligne

```rust
// Dans src/core/fic.rs, fonction read_header()

fn read_header<R: Read + Seek>(reader: &mut R) -> Result<FicHeader> {
    // Étape 1 : Se positionner au début du fichier
    reader.seek(SeekFrom::Start(0))?;
    // ↑ On s'assure d'être à l'offset 0

    // Étape 2 : Lire les magic bytes (4 bytes)
    let mut magic_bytes = [0u8; 4];
    reader.read_exact(&mut magic_bytes)?;
    // ↑ Lit exactement 4 bytes dans le tableau
    
    let magic = u32::from_le_bytes(magic_bytes);
    // ↑ Convertit les 4 bytes en u32 (little-endian)
    // Exemple: [0x50, 0x43, 0x53, 0x00] → 0x00534350
    
    // Étape 3 : Vérifier que c'est un fichier valide
    if &magic_bytes[0..3] != b"PCS" {
        if &magic_bytes[0..3] != b"FIC" {
            // Erreur si ce n'est ni "PCS" ni "FIC"
            anyhow::bail!("Magic bytes invalides");
        }
    }
    
    // Étape 4 : Lire la version (2 bytes, u16)
    let version = reader.read_u16::<LittleEndian>()?;
    // ↑ Lit 2 bytes et les convertit en u16 little-endian
    // Exemple: [0x01, 0x00] → 1
    
    // Étape 5 : Ignorer le padding (2 bytes)
    let _padding1 = reader.read_u16::<LittleEndian>()?;
    
    // Étape 6 : Lire la longueur d'un enregistrement (2 bytes)
    let record_length_u16 = reader.read_u16::<LittleEndian>()?;
    // Exemple: [0x00, 0x01] → 256
    
    // Étape 7 : Lire le nombre d'enregistrements (2 bytes)
    let record_count = reader.read_u16::<LittleEndian>()?;
    // Exemple: [0x2D, 0x00] → 45
    
    // ... (lecture du reste du header)
    
    // Étape 8 : Calculer la longueur réelle si nécessaire
    let record_length = if record_length_u16 == 1 {
        // Si record_length = 1, c'est suspect
        // On calcule à partir de la taille du fichier
        let file_size = reader.seek(SeekFrom::End(0))?;
        let available_data = file_size - header_size;
        let calculated_length = available_data / record_count as u64;
        calculated_length as u32
    } else {
        record_length_u16 as u32
    };
    
    // Étape 9 : Construire et retourner le header
    Ok(FicHeader {
        magic,
        version,
        record_length,
        record_count: record_count as u32,
        deleted_count: deleted_count as u32,
        flags,
        header_size: min_header_size,
        data_offset: header_size,
    })
}
```

**Ce qui se passe** : Le parser lit byte par byte depuis le début du fichier, en respectant le format binaire exact. Chaque valeur est lue dans le bon ordre (little-endian) et convertie au type Rust approprié.

---

## Étape 3 : Comment les enregistrements sont parsés

Maintenant, voyons comment un enregistrement spécifique est lu.

### Calcul de l'offset

Pour lire l'enregistrement à l'index `i` :

```
offset = data_offset + (i * record_length)
```

**Exemple** :
- `data_offset` = 20 bytes
- `record_length` = 256 bytes
- Enregistrement #5 :
  ```
  offset = 20 + (5 * 256) = 20 + 1280 = 1300 bytes
  ```

### Code commenté

```rust
// Dans src/core/fic.rs, fonction read_record()

pub fn read_record(&mut self, index: u32) -> Result<FicRecord> {
    // Étape 1 : Vérifier que l'index est valide
    if index >= self.header.record_count {
        anyhow::bail!("Index {} hors limites", index);
    }
    
    // Étape 2 : Calculer l'offset de l'enregistrement
    let offset = self.header.data_offset as u64 
                 + (index * self.header.record_length) as u64;
    // ↑ Exemple: offset = 20 + (5 * 256) = 1300
    
    // Étape 3 : Se positionner à cet offset dans le fichier
    file.seek(SeekFrom::Start(offset))?;
    // ↑ Le curseur du fichier est maintenant à l'offset 1300
    
    // Étape 4 : Lire l'enregistrement complet
    let mut record_buffer = vec![0u8; self.header.record_length as usize];
    // ↑ Crée un buffer de 256 bytes (record_length)
    
    let bytes_read = file.read(&mut record_buffer)?;
    // ↑ Lit exactement 256 bytes dans le buffer
    
    // Étape 5 : Extraire le flag de suppression
    let flags_byte = record_buffer[0];
    let deleted = (flags_byte & 0x01) != 0;
    // ↑ Si le bit 0 est à 1, l'enregistrement est supprimé
    
    // Étape 6 : Extraire les données (sans le flag byte)
    let data = record_buffer[1..bytes_read].to_vec();
    // ↑ Prend tous les bytes sauf le premier
    
    // Étape 7 : Extraire les pointeurs mémo (si présents)
    let memo_pointers = Self::extract_memo_pointers(&data);
    
    // Étape 8 : Construire et retourner le FicRecord
    Ok(FicRecord {
        id: index,
        deleted,
        data,
        memo_pointers,
    })
}
```

**Visualisation** :

```
Fichier à l'offset 1300:
┌─────────────────────────────────────────────────┐
│ [00] [01 00 00 00] ["Dupont        "...] [...] │
│  │    └───id───┘    └───────nom────────┘       │
│  │                                               │
│  └─ Flag (0 = actif)                            │
└─────────────────────────────────────────────────┘

Après parsing:
FicRecord {
    id: 5,
    deleted: false,  ← flag byte = 0x00
    data: [01 00 00 00, "Dupont"...],  ← sans le flag byte
    memo_pointers: []
}
```

---

## Étape 4 : Gestion des fichiers .mmo (blocs mémo)

Les fichiers `.mmo` contiennent des données de taille variable (texte long, images, etc.).

### Structure d'un bloc mémo

```
┌─────────────────────────────────────────────────┐
│           MMO Block                             │
├─────────────────────────────────────────────────┤
│ Length (4 bytes): u32                           │
│ Data (Length bytes): [u8; Length]               │
└─────────────────────────────────────────────────┘
```

### Code commenté

```rust
// Dans src/core/mmo.rs, fonction read_block()

pub fn read_block(&mut self, offset: u32) -> Result<MmoBlock> {
    // Étape 1 : Se positionner à l'offset du bloc
    file.seek(SeekFrom::Start(offset as u64))?;
    
    // Étape 2 : Lire la longueur du bloc (4 bytes)
    let length = file.read_u32::<LittleEndian>()?;
    // ↑ Exemple: [0x0A, 0x00, 0x00, 0x00] → 10 bytes
    
    // Étape 3 : Lire les données du bloc
    let mut data = vec![0u8; length as usize];
    file.read_exact(&mut data)?;
    // ↑ Lit exactement 'length' bytes
    
    // Étape 4 : Décoder en texte si possible
    let text = Self::decode_text(&data);
    
    // Étape 5 : Construire et retourner le bloc
    Ok(MmoBlock {
        offset,
        length,
        data,
        text,
    })
}

fn decode_text(data: &[u8]) -> Option<String> {
    // Essayer Windows-1252 d'abord (encodage français standard)
    let (decoded, _, had_errors) = WINDOWS_1252.decode(data);
    
    if had_errors {
        // Essayer UTF-8 si Windows-1252 échoue
        String::from_utf8(data.to_vec()).ok()
    } else {
        Some(decoded.into_owned())
    }
}
```

**Exemple** :

```
Fichier .mmo à l'offset 1024:
┌─────────────────────────────────────────────────┐
│ [0E 00 00 00] ["Client VIP\0\0\0"]             │
│  └───14─┘    └───────texte────────┘            │
└─────────────────────────────────────────────────┘

Après parsing:
MmoBlock {
    offset: 1024,
    length: 14,
    data: [0x43, 0x6C, 0x69, ...],  // "Client VIP\0\0\0"
    text: Some("Client VIP")
}
```

---

## Étape 5 : Utilisation des index .ndx

Les fichiers `.ndx` permettent de rechercher rapidement un enregistrement par clé.

### Structure d'un index

```
┌─────────────────────────────────────────────────┐
│           Index Header                          │
├─────────────────────────────────────────────────┤
│ Magic (4 bytes): u32                            │
│ Entry count (4 bytes): u32                      │
│ Key length (4 bytes): u32                       │
└─────────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────┐
│           Index Entries                         │
├─────────────────────────────────────────────────┤
│ Entry 0:                                        │
│   Key (Key length bytes): [u8; Key length]      │
│   Record ID (4 bytes): u32                      │
│                                                  │
│ Entry 1:                                        │
│   ...                                           │
└─────────────────────────────────────────────────┘
```

### Code commenté

```rust
// Dans src/core/ndx.rs, fonction read_index()

fn read_index<R: Read + Seek>(reader: &mut R) -> Result<Vec<NdxEntry>> {
    // Étape 1 : Se positionner au début
    reader.seek(SeekFrom::Start(0))?;
    
    // Étape 2 : Lire le header
    let _magic = reader.read_u32::<LittleEndian>()?;
    let entry_count = reader.read_u32::<LittleEndian>()?;
    let key_length = reader.read_u32::<LittleEndian>()?;
    
    // Étape 3 : Lire toutes les entrées
    let mut entries = Vec::new();
    
    for i in 0..entry_count {
        // Lire la clé
        let mut key = vec![0u8; key_length as usize];
        reader.read_exact(&mut key)?;
        
        // Lire l'ID d'enregistrement
        let record_id = reader.read_u32::<LittleEndian>()?;
        
        entries.push(NdxEntry {
            key,
            record_id,
            offset: /* calculé */,
        });
    }
    
    Ok(entries)
}
```

**Utilisation** :

Pour trouver l'enregistrement avec la clé "DUPONT" :

```rust
// Chercher dans l'index
let entry = ndx_file.find_by_key(b"DUPONT")?;
// → NdxEntry { key: b"DUPONT", record_id: 5, ... }

// Lire l'enregistrement correspondant
let record = fic_file.read_record(entry.record_id)?;
// → Enregistrement #5
```

---

## Analyse du schéma

Une fonction importante est l'analyse automatique du schéma pour détecter les champs.

### Fonction analyze_schema()

```rust
// Dans src/core/fic.rs

pub fn analyze_schema(&self) -> Vec<FieldInfo> {
    let mut fields = Vec::new();
    let mut offset = 0;

    // Champ ID (toujours présent)
    fields.push(FieldInfo {
        name: "id".to_string(),
        offset,
        length: 4,
        field_type: FieldType::Integer,
    });
    offset += 4;

    // Champ flags
    fields.push(FieldInfo {
        name: "flags".to_string(),
        offset,
        length: 1,
        field_type: FieldType::Integer,
    });
    offset += 1;

    // Reste des données comme champ binaire
    if self.header.record_length > offset as u32 {
        fields.push(FieldInfo {
            name: "data".to_string(),
            offset,
            length: self.header.record_length - offset,
            field_type: FieldType::Binary,
        });
    }

    fields
}
```

**Limitations** : Cette implémentation est basique. Pour une analyse plus poussée, il faudrait :

- Analyser plusieurs enregistrements pour détecter les patterns
- Détecter automatiquement les types (entier, chaîne, date, etc.)
- Utiliser un schéma externe (JSON/YAML) si disponible

---

## Points importants

### Gestion des encodages

Les fichiers HFSQL utilisent souvent **Windows-1252** (CP1252) pour les caractères français :

```rust
use encoding_rs::WINDOWS_1252;

let (decoded, _, had_errors) = WINDOWS_1252.decode(data);
```

**Pourquoi** : Windows-1252 est l'encodage standard utilisé par les applications Windows françaises des années 1990-2000.

### Little-endian

Tous les nombres sont en **little-endian** (le byte le moins significatif en premier) :

```rust
let value = reader.read_u32::<LittleEndian>()?;
```

**Exemple** : `[0x0A, 0x00, 0x00, 0x00]` = 10 en little-endian

### Gestion d'erreurs

Tous les parsers utilisent `anyhow::Result` pour une gestion d'erreurs contextuelle :

```rust
let file = File::open(&path)
    .with_context(|| format!("Impossible d'ouvrir: {:?}", path))?;
```

Cela permet d'avoir des messages d'erreur clairs avec le contexte.

---

## Prochaines étapes

Maintenant que vous comprenez comment les fichiers sont parsés :

1. **[Storage Engine](storage-engine.md)** - Comment les données parsées sont utilisées
2. **[API Server](api-server.md)** - Comment tout est exposé via l'API REST
3. **[Guides pas à pas](../guides/step-by-step-backend.md)** - Guide complet du fichier .fic à l'API

---

<div align="center">

✅ **Parsing compris ?** Explorez le [Storage Engine](storage-engine.md) pour voir comment les données parsées sont utilisées !

</div>

