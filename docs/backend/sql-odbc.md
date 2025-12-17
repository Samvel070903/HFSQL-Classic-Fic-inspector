# SQL & ODBC

Support SQL et intégration ODBC dans FIC Engine.

---

## Support SQL

FIC Engine inclut un parser SQL simple permettant d'exécuter des requêtes directement sur les fichiers .fic.

### Requêtes supportées

- **SELECT** : Lecture avec WHERE, ORDER BY, LIMIT, OFFSET
- **INSERT** : Création d'enregistrements (en développement)
- **UPDATE** : Mise à jour d'enregistrements (en développement)
- **DELETE** : Suppression d'enregistrements (en développement)

---

## Parser SQL

### Étape 1 : Parsing de la requête

```rust
// Dans src/sql/parser.rs
pub fn parse(sql: &str) -> Result<SqlStatement> {
    // Analyse la syntaxe SQL
    // Construit un AST (Abstract Syntax Tree)
}
```

### Étape 2 : Conversion en opérations StorageEngine

```rust
// Dans src/sql/executor.rs
pub fn execute(&self, statement: &SqlStatement) -> Result<SqlResult> {
    match statement {
        SqlStatement::Select(select) => self.execute_select(select),
        // ...
    }
}
```

---

## Support ODBC

L'intégration ODBC permet de se connecter à des bases de données externes via un DSN.

### Configuration DSN

Sur Windows, configurez un DSN via "Sources de données ODBC".

### Utilisation

```json
POST /sql
{
  "sql": "SELECT * FROM CLIENT",
  "dsn": "NewNaxiData"
}
```

Si un DSN est fourni, la requête est exécutée via ODBC au lieu du moteur FIC.

---

## Exemples

### SELECT simple

```sql
SELECT * FROM CLIENT LIMIT 10
```

### SELECT avec filtre

```sql
SELECT * FROM CLIENT WHERE nom = 'Dupont'
```

### SELECT avec pagination

```sql
SELECT * FROM CLIENT LIMIT 10 OFFSET 20
```

---

<div align="center">

✅ **SQL/ODBC compris ?** Consultez l'[API Reference](../api-reference/rest-api.md) pour tous les détails !

</div>

