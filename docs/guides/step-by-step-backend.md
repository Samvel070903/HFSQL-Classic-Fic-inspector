# Guide pas à pas : Backend

Guide complet expliquant le flux depuis un fichier `.fic` sur le disque jusqu'à la réponse JSON de l'API.

---

## Vue d'ensemble du flux

```
Fichier .fic
    ↓
FicFile::open()
    ↓
read_header()
    ↓
read_record()
    ↓
StorageEngine::get_by_id()
    ↓
record_from_fic() (décodage)
    ↓
Handler API
    ↓
Réponse JSON
```

---

## Étape 1 : Fichier .fic sur disque

Le fichier `CLIENT.FIC` existe sur le disque avec sa structure binaire.

---

## Étape 2 : Ouverture et parsing

```rust
let mut fic = FicFile::open("CLIENT.FIC")?;
```

Le fichier est ouvert et le header est lu automatiquement.

---

## Étape 3 : Lecture du header

Le header contient toutes les métadonnées nécessaires :
- Record length
- Record count
- Data offset
- etc.

---

## Étape 4 : Lecture d'un enregistrement

```rust
let record = fic.read_record(42)?;
```

L'enregistrement #42 est lu depuis le fichier.

---

## Étape 5 : Décodage selon schéma

Les données brutes sont décodées selon le schéma de la table :
- Integers → nombres
- Strings → texte (Windows-1252)
- Memos → texte depuis .mmo

---

## Étape 6 : Conversion en Record

Le `FicRecord` brut est converti en `Record` typé avec `FieldValue`.

---

## Étape 7 : Handler API

Le handler reçoit la requête HTTP et utilise le StorageEngine.

---

## Étape 8 : Réponse JSON

Le `Record` est sérialisé en JSON et renvoyé au client.

---

<div align="center">

✅ **Flux compris ?** Consultez le [Data Flow](data-flow.md) pour les diagrammes complets !

</div>

