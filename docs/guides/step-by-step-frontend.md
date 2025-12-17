# Guide pas à pas : Frontend

Guide complet expliquant le flux depuis une action utilisateur jusqu'à l'affichage dans l'interface.

---

## Vue d'ensemble du flux

```
Clic utilisateur
    ↓
Événement React
    ↓
Appel apiClient
    ↓
Requête HTTP (Axios)
    ↓
Backend API
    ↓
Réponse JSON
    ↓
Mise à jour Context
    ↓
Re-render composants
    ↓
Affichage dans UI
```

---

## Exemple : Clic sur une table

1. **Clic** sur "CLIENT" dans la sidebar
2. **Événement** : `onClick` déclenché
3. **Action** : `setSelectedTable("CLIENT")`
4. **Effet** : `useEffect` détecte le changement
5. **Appel API** : `apiClient.getTableRecords("CLIENT")`
6. **Requête HTTP** : `GET /tables/CLIENT/records`
7. **Réponse** : JSON avec les enregistrements
8. **Mise à jour** : État mis à jour dans le Context
9. **Re-render** : TableView affiche les nouvelles données

---

<div align="center">

✅ **Flux compris ?** Consultez le [Data Flow](data-flow.md) pour les diagrammes complets !

</div>

