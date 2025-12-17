# Exemples d'utilisation

Exemples pratiques d'utilisation de l'API REST de FIC Engine.

---

## JavaScript/TypeScript

### Lister les tables

```javascript
const response = await fetch('http://localhost:8080/tables');
const tables = await response.json();
console.log(tables);  // ["CLIENT", "PRODUIT", ...]
```

### Lire un enregistrement

```javascript
const response = await fetch('http://localhost:8080/tables/CLIENT/records/42');
const record = await response.json();
console.log(record.fields.nom.value);  // "Dupont"
```

### Upload de fichiers

```javascript
const formData = new FormData();
formData.append('files', fileInput.files[0]);

const response = await fetch('http://localhost:8080/upload', {
  method: 'POST',
  body: formData
});
const result = await response.json();
```

---

## Python

### Lister les enregistrements

```python
import requests

response = requests.get('http://localhost:8080/tables/CLIENT/records?limit=10')
data = response.json()

for record in data['records']:
    print(f"ID: {record['id']}")
    print(f"Nom: {record['fields']['nom']['value']}")
```

---

## cURL

### Requêtes de base

```bash
# Health check
curl http://localhost:8080/health

# Lister les tables
curl http://localhost:8080/tables

# Lire un enregistrement
curl http://localhost:8080/tables/CLIENT/records/0

# Exécuter SQL
curl -X POST \
  -H "Content-Type: application/json" \
  -d '{"sql": "SELECT * FROM CLIENT LIMIT 10"}' \
  http://localhost:8080/sql
```

---

<div align="center">

📚 Consultez [REST API](rest-api.md) pour la documentation complète.

</div>

