# Extensibilité

Guide pour étendre et personnaliser FIC Engine.

---

## Ajouter un nouveau format de fichier

1. Créer `src/core/new_format.rs`
2. Implémenter les traits nécessaires
3. Intégrer dans `StorageEngine`

---

## Ajouter un endpoint API

1. Ajouter la route dans `src/api/server.rs`
2. Créer le handler dans `src/api/handlers.rs`
3. Utiliser le `StorageEngine` pour les données

---

## Ajouter un nouveau type de champ

1. Ajouter au enum `FieldType` dans `src/core/mod.rs`
2. Implémenter le décodage dans `StorageEngine::record_from_fic()`
3. Mettre à jour la sérialisation JSON

---

## Contribuer

Les contributions sont les bienvenues ! Consultez le guide de contribution sur GitHub.

---

<div align="center">

✅ Consultez [Security](security.md) et [Performance](performance.md) pour plus d'informations.

</div>

