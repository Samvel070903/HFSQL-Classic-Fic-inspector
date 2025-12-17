# Data Flow

Diagrammes de flux de données pour les scénarios principaux.

---

## Lecture d'une table

```
Client (Frontend)
    │
    ├─► API Client (Axios)
    │       │
    │       └─► Requête HTTP GET /tables/CLIENT/records
    │
    ├─► Backend API (Axum)
    │       │
    │       ├─► Handler: list_records()
    │       │       │
    │       │       └─► StorageEngine::select()
    │       │               │
    │       │               ├─► FicFile::open()
    │       │               │       │
    │       │               │       └─► read_all_records()
    │       │               │               │
    │       │               │               └─► Parse binaire
    │       │               │
    │       │               └─► MmoFile::open() (si mémo)
    │       │                       │
    │       │                       └─► read_block(offset)
    │       │
    │       └─► Réponse JSON
    │
    └─► Affichage dans l'UI
```

---

## Exécution SQL

```
Client (Frontend)
    │
    ├─► API Client
    │       │
    │       └─► POST /sql { sql: "SELECT ..." }
    │
    ├─► Backend API
    │       │
    │       ├─► Handler: execute_sql()
    │       │       │
    │       │       ├─► SQL Parser
    │       │       │       │
    │       │       │       └─► Parse AST
    │       │       │
    │       │       ├─► SQL Executor
    │       │       │       │
    │       │       │       └─► StorageEngine
    │       │       │
    │       │       └─► Réponse JSON
    │
    └─► Affichage des résultats
```

---

## Upload de fichiers

```
Client (Frontend)
    │
    ├─► FormData avec fichiers
    │       │
    │       └─► POST /upload (multipart/form-data)
    │
    ├─► Backend API
    │       │
    │       ├─► Handler: upload_files()
    │       │       │
    │       │       ├─► Écriture streaming
    │       │       │       │
    │       │       │       └─► Fichiers dans data_dir
    │       │       │
    │       │       └─► scan_tables() (rescan)
    │       │
    │       └─► Réponse: { success: true, files: [...] }
    │
    └─► Notification dans l'UI
```

---

<div align="center">

✅ **Data Flow compris ?** Consultez le [Troubleshooting](troubleshooting.md) pour résoudre les problèmes !

</div>

