# Performance

Guide des optimisations et bonnes pratiques pour de meilleures performances.

---

## Optimisations implémentées

### Cache des tables

Les tables sont mises en cache après le scan initial. Pas besoin de re-scanner le disque à chaque requête.

### Lecture streaming

Les fichiers volumineux sont lus par chunks pour éviter de charger tout en mémoire.

### Pagination native

Toutes les requêtes supportent la pagination pour limiter la quantité de données transférées.

---

## Bonnes pratiques

### Utiliser la pagination

Toujours utiliser `limit` et `offset` pour les grandes tables :

```bash
curl "http://localhost:8080/tables/CLIENT/records?limit=100&offset=0"
```

### Utiliser les index

Les filtres utilisent automatiquement les index `.ndx` quand disponibles.

### Cache côté client

Mettez en cache les schémas de tables côté client pour éviter les requêtes répétées.

---

## Benchmarks

Sur une table de 10 000 enregistrements (256 bytes/record) :

- Scan complet : ~50ms
- Lecture par ID : ~1ms
- Recherche par index : ~2ms
- Export JSON : ~200ms

---

## Profiling

Pour identifier les goulots d'étranglement :

```bash
# Compiler avec symboles de debug
cargo build --release

# Utiliser un profiler (ex: perf sur Linux)
perf record ./target/release/fic serve
perf report
```

---

<div align="center">

✅ Consultez [Security](security.md) pour la sécurité et [Extensibility](extensibility.md) pour étendre le code.

</div>

