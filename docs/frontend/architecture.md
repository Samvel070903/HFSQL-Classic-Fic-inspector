# Architecture Frontend

Le frontend FIC Inspector est une application Electron moderne construite avec React et TypeScript.

---

## Vue d'ensemble

```
┌─────────────────────────────────────────────┐
│      FIC Inspector (Electron)              │
├─────────────────────────────────────────────┤
│                                             │
│  ┌─────────────────────────────────────┐   │
│  │  React Application                  │   │
│  │  - React 18                         │   │
│  │  - TypeScript                       │   │
│  │  - Tailwind CSS                     │   │
│  │  - React Router                     │   │
│  └─────────────────────────────────────┘   │
│                                             │
│  Pages:                                     │
│  - Dashboard                                │
│  - Tables                                   │
│  - SQL/ODBC                                 │
│  - Logs                                     │
│  - Settings                                 │
│                                             │
│  Services:                                  │
│  - API Client (Axios)                      │
│  - Context (React Context)                 │
│                                             │
└─────────────────────────────────────────────┘
```

---

## Technologies

- **Electron** : Framework pour applications desktop
- **React 18** : Bibliothèque UI
- **TypeScript** : Typage statique
- **Tailwind CSS** : Styles
- **Axios** : Client HTTP
- **React Router** : Navigation

---

## Structure

```
fic-inspector/src/
├── pages/              # Pages principales
│   ├── Dashboard.tsx
│   ├── Tables.tsx
│   ├── Odbc.tsx
│   ├── Logs.tsx
│   └── Settings.tsx
│
├── components/         # Composants réutilisables
│   ├── Layout.tsx
│   ├── Sidebar.tsx
│   ├── TableView.tsx
│   └── ...
│
├── context/            # State management
│   └── AppContext.tsx
│
├── services/           # API Client
│   └── apiClient.ts
│
└── types/              # Types TypeScript
    └── api.ts
```

---

## Flux de données

1. **Utilisateur** → Action dans l'UI
2. **Composant** → Appel à `apiClient`
3. **API Client** → Requête HTTP au backend
4. **Backend** → Réponse JSON
5. **Context** → Mise à jour de l'état
6. **Composant** → Re-render avec nouvelles données

---

## Prochaines étapes

1. **[Pages Overview](pages-overview.md)** - Toutes les pages expliquées
2. **[Components Guide](components-guide.md)** - Composants React détaillés
3. **[State Management](state-management.md)** - Gestion de l'état

---

<div align="center">

✅ **Architecture comprise ?** Explorez les [Pages](pages-overview.md) pour comprendre chaque partie de l'interface !

</div>

