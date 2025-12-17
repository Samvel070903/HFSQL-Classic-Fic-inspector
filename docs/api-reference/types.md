# Types de données

Documentation complète de tous les types de données utilisés dans l'API.

---

## Record

Représente un enregistrement avec ses champs décodés.

```typescript
interface Record {
  id: number;
  fields: Record<string, FieldValue>;
  memo_data: Record<string, string>;
}
```

---

## FieldValue

Valeur typée d'un champ.

```typescript
type FieldValue =
  | { type: "string"; value: string }
  | { type: "integer"; value: number }
  | { type: "float"; value: number }
  | { type: "binary"; value: string }  // hex string
  | { type: "null"; value: null };
```

---

## TableSchema

Schéma complet d'une table.

```typescript
interface TableSchema {
  name: string;
  record_length: number;
  field_count: number;
  fields: FieldInfo[];
}
```

---

## FieldInfo

Informations sur un champ.

```typescript
interface FieldInfo {
  name: string;
  offset: number;
  length: number;
  field_type: FieldType;
}

type FieldType = 
  | "String"
  | "Integer"
  | "Float"
  | "Date"
  | "Memo"
  | "Binary"
  | "Unknown";
```

---

## QueryResult

Résultat d'une requête avec pagination.

```typescript
interface QueryResult {
  records: Record[];
  total: number;
  offset: number;
  limit: number;
}
```

---

## ErrorResponse

Réponse d'erreur standardisée.

```typescript
interface ErrorResponse {
  error: string;
  code: number;
  details?: string;
}
```

---

<div align="center">

📚 Consultez [REST API](rest-api.md) pour les endpoints et [Examples](examples.md) pour des exemples.

</div>

