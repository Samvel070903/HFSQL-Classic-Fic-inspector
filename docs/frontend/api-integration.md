# API Integration

Communication avec le backend via Axios.

---

## ApiClient

Le service `apiClient` encapsule tous les appels API :

```typescript
class ApiClient {
  async getTables(): Promise<string[]>
  async getTableSchema(table: string): Promise<TableSchema>
  async getTableRecords(table: string, filters?: QueryFilters): Promise<QueryResult>
  // ...
}
```

---

## Configuration

```typescript
const client = axios.create({
  baseURL: 'http://127.0.0.1:8080',
  timeout: 24 * 60 * 60 * 1000,  // 24 heures
});
```

---

## Gestion des erreurs

Les erreurs sont interceptées et gérées de manière centralisée via les intercepteurs Axios.

---

<div align="center">

✅ **Frontend compris ?** Explorez les [Guides pratiques](../guides/step-by-step-frontend.md) !

</div>

