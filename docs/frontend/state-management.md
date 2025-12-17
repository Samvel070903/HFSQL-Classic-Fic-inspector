# State Management

Gestion de l'état dans FIC Inspector avec React Context.

---

## AppContext

L'état global est géré via `AppContext` :

```typescript
interface AppContextType {
  apiUrl: string;
  isConnected: boolean;
  tables: string[];
  selectedTable: string | null;
  tableSchemas: Record<string, TableSchema>;
  // ...
}
```

---

## Hooks personnalisés

- `useApp()` : Accès au contexte global
- `useMenuActions()` : Actions du menu

---

<div align="center">

📚 Consultez [API Integration](api-integration.md) pour la communication avec le backend.

</div>

