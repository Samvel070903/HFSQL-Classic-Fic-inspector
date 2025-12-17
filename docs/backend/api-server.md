# API Server

Le serveur API REST utilise Axum pour exposer toutes les fonctionnalités de FIC Engine via HTTP.

---

## Vue d'ensemble

Le serveur API est construit avec **Axum**, un framework HTTP moderne et performant pour Rust.

### Fonctionnalités

- ✅ Routes RESTful complètes
- ✅ Middlewares (CORS, logging, limite de taille)
- ✅ Gestion d'erreurs standardisée
- ✅ Thread-safe avec Arc et RwLock

---

## Configuration du serveur

### Étape 1 : Créer le Router

```rust
let app = Router::new()
    .route("/health", get(handlers::health))
    .route("/tables", get(handlers::list_tables))
    .route("/tables/:table/schema", get(handlers::get_schema))
    // ... autres routes
    .layer(CorsLayer::permissive())
    .layer(RequestBodyLimitLayer::new(10 * 1024 * 1024 * 1024))  // 10 GB
    .layer(TraceLayer::new_for_http())
    .with_state(engine);
```

### Étape 2 : Ajouter les middlewares

- **CORS** : Permet l'accès depuis l'interface web
- **RequestBodyLimit** : Limite la taille des requêtes (10 GB)
- **TraceLayer** : Logging automatique des requêtes

---

## Routes disponibles

### GET /health

Vérification de santé du serveur.

### GET /tables

Liste toutes les tables détectées.

### GET /tables/:table/schema

Schéma complet d'une table.

### GET /tables/:table/records

Liste paginée des enregistrements.

### GET /tables/:table/records/:id

Un enregistrement spécifique.

### POST /upload

Upload de fichiers HFSQL.

### POST /sql

Exécution de requêtes SQL.

---

## Handlers HTTP

### Structure d'un handler

```rust
pub async fn get_record(
    State(engine): State<Arc<StorageEngine>>,
    Path((table, id)): Path<(String, u32)>,
) -> Result<Json<Record>, (StatusCode, Json<ErrorResponse>)> {
    engine.get_by_id(&table, id)
        .map(Json)
        .map_err(|e| (
            StatusCode::NOT_FOUND,
            Json(ErrorResponse {
                error: "Enregistrement non trouvé".to_string(),
                code: 404,
                details: Some(e.to_string()),
            }),
        ))
}
```

**Points importants** :

- `State(engine)` : Injection du StorageEngine (partagé)
- `Path(...)` : Extraction des paramètres depuis l'URL
- Gestion d'erreurs standardisée avec `ErrorResponse`

---

## Gestion des erreurs

### Réponses d'erreur standardisées

```rust
#[derive(Serialize)]
pub struct ErrorResponse {
    pub error: String,
    pub code: u16,
    pub details: Option<String>,
}
```

Tous les handlers retournent des erreurs au même format.

---

## Thread Safety

Le serveur gère plusieurs requêtes simultanément grâce à :

- **Tokio** : Runtime asynchrone
- **Arc<StorageEngine>** : Partage entre threads
- **RwLock** : Accès concurrent sécurisé au cache

---

## Démarrage du serveur

```rust
pub async fn start_server(engine: Arc<StorageEngine>, host: &str, port: u16) -> Result<()> {
    let listener = tokio::net::TcpListener::bind(&addr).await?;
    axum::serve(listener, app).await?;
    Ok(())
}
```

---

## Prochaines étapes

1. **[REST API Reference](../api-reference/rest-api.md)** - Documentation complète de tous les endpoints
2. **[Guides pas à pas](../guides/step-by-step-backend.md)** - Guide complet

---

<div align="center">

✅ **API Server compris ?** Consultez la [REST API Reference](../api-reference/rest-api.md) pour tous les détails !

</div>

