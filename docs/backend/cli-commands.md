# CLI Commands

Documentation complète des commandes en ligne de commande.

---

## Commande : scan

Scanne un dossier et détecte les tables HFSQL.

```bash
cargo run --release -- scan ./data
```

**Sortie** :
```
Tables trouvées: 3
  - CLIENT
    Record length: 256 bytes
    Fields: 10
  - PRODUIT
    Record length: 128 bytes
    Fields: 8
```

---

## Commande : export

Exporte une table vers JSON ou CSV.

```bash
# Export JSON
cargo run --release -- export CLIENT --format json --output client.json

# Export CSV
cargo run --release -- export CLIENT --format csv --output client.csv

# Vers stdout
cargo run --release -- export CLIENT --format json
```

---

## Commande : serve

Démarre le serveur API HTTP.

```bash
# Avec valeurs par défaut
cargo run --release -- serve

# Avec port personnalisé
cargo run --release -- serve --port 9000

# Avec host personnalisé
cargo run --release -- serve --host 0.0.0.0 --port 8080
```

---

## Commande : debug

Affiche des informations de debug sur un fichier.

```bash
# Header
cargo run --release -- debug CLIENT.FIC --dump header

# Hex dump
cargo run --release -- debug CLIENT.FIC --dump hex

# Records
cargo run --release -- debug CLIENT.FIC --dump records
```

---

## Options globales

### --data-dir

Spécifie le dossier contenant les fichiers HFSQL.

```bash
cargo run --release -- --data-dir ./mes-fichiers scan
```

### --config

Spécifie le fichier de configuration.

```bash
cargo run --release -- --config config.toml serve
```

---

<div align="center">

✅ **CLI compris ?** Consultez [Getting Started](../getting-started/first-steps.md) pour des exemples pratiques !

</div>

