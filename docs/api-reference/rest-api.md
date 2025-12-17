# REST API Reference

Documentation complète de l'API REST de FIC Engine. Tous les endpoints sont documentés avec des exemples de requêtes et réponses.

---

## Base URL

Par défaut, l'API est disponible sur :

```
http://127.0.0.1:8080
```

---

## Endpoints

### GET /health

Vérifie l'état du serveur.

**Réponse** :
```json
{
  "status": "ok",
  "version": "0.1.0"
}
```

**Exemple** :
```bash
curl http://localhost:8080/health
```

---

### GET /tables

Liste toutes les tables détectées.

**Réponse** :
```json
["CLIENT", "PRODUIT", "COMMANDE"]
```

**Exemple** :
```bash
curl http://localhost:8080/tables
```

---

### GET /tables/:table/schema

Récupère le schéma complet d'une table.

**Paramètres** :
- `table` (path) : Nom de la table

**Réponse** :
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

**Exemple** :
```bash
curl http://localhost:8080/tables/CLIENT/schema
```

---

### GET /tables/:table/records

Liste paginée des enregistrements avec filtres optionnels.

**Paramètres** :
- `table` (path) : Nom de la table
- `limit` (query, optionnel) : Nombre max d'enregistrements (défaut: 100)
- `offset` (query, optionnel) : Décalage pour pagination (défaut: 0)
- `{field_name}` (query, optionnel) : Filtre par champ (ex: `nom=Dupont`)

**Réponse** :
```json
{
  "records": [
    {
      "id": 0,
      "fields": {
        "nom": { "type": "string", "value": "Dupont" },
        "age": { "type": "integer", "value": 30 }
      },
      "memo_data": {}
    }
  ],
  "total": 150,
  "offset": 0,
  "limit": 10
}
```

**Exemples** :
```bash
# Liste les 10 premiers enregistrements
curl "http://localhost:8080/tables/CLIENT/records?limit=10"

# Avec pagination
curl "http://localhost:8080/tables/CLIENT/records?limit=10&offset=20"

# Avec filtre
curl "http://localhost:8080/tables/CLIENT/records?nom=Dupont"
```

---

### GET /tables/:table/records/:id

Récupère un enregistrement spécifique par son ID.

**Paramètres** :
- `table` (path) : Nom de la table
- `id` (path) : ID de l'enregistrement

**Réponse** :
```json
{
  "id": 42,
  "fields": {
    "nom": { "type": "string", "value": "Dupont" },
    "prenom": { "type": "string", "value": "Jean" }
  },
  "memo_data": {
    "notes": "Client VIP"
  }
}
```

**Exemple** :
```bash
curl http://localhost:8080/tables/CLIENT/records/42
```

---

### POST /upload

Upload de fichiers .fic, .mmo, .ndx.

**Content-Type** : `multipart/form-data`

**Corps** :
- `files` : Un ou plusieurs fichiers

**Réponse** :
```json
{
  "success": true,
  "message": "3 fichier(s) uploadé(s) avec succès",
  "files": ["CLIENT.FIC", "PRODUIT.FIC", "COMMANDE.FIC"]
}
```

**Exemple** :
```bash
curl -X POST \
  -F "files=@CLIENT.FIC" \
  -F "files=@PRODUIT.FIC" \
  http://localhost:8080/upload
```

---

### POST /sql

Exécute une requête SQL.

**Corps** :
```json
{
  "sql": "SELECT * FROM CLIENT WHERE age > 18 LIMIT 10",
  "dsn": "NewNaxiData"
}
```

**Réponse (succès)** :
```json
{
  "success": true,
  "data": {
    "columns": ["id", "nom", "age"],
    "rows": [
      { "id": 1, "nom": "Dupont", "age": 30 }
    ]
  },
  "error": null,
  "rows_affected": null
}
```

**Exemple** :
```bash
curl -X POST \
  -H "Content-Type: application/json" \
  -d '{"sql": "SELECT * FROM CLIENT LIMIT 10"}' \
  http://localhost:8080/sql
```

---

## Codes d'erreur

| Code | Description |
|------|-------------|
| 200 | Succès |
| 201 | Créé (pour POST) |
| 400 | Requête invalide |
| 404 | Ressource non trouvée |
| 500 | Erreur serveur |

---

## Formats de réponse d'erreur

```json
{
  "error": "Description de l'erreur",
  "code": 404,
  "details": "Détails supplémentaires (optionnel)"
}
```

---

<div align="center">

📚 Consultez [Types](types.md) pour les structures de données et [Examples](examples.md) pour plus d'exemples.

</div>

