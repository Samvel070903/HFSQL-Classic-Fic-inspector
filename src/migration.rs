/**
 * Module de migration (export) des données HFSQL vers des bases externes.
 *
 * NOTE: Ce module était référencé par l'API (endpoints `GET/POST /migration/...`) mais manquait
 * dans le code source, ce qui empêchait la compilation.
 *
 * L'implémentation ci-dessous fournit une API stable (types + `Migrator`)
 * et un test de connexion ODBC basique. La logique complète de migration
 * (création de schéma, transfert des enregistrements, etc.) pourra être
 * implémentée progressivement.
 */

use anyhow::Context;
use std::sync::{Arc, Mutex};
use std::time::Instant;

use crate::storage::StorageEngine;

/// Types partagés (API / migration)
pub mod types {
    use serde::{Deserialize, Serialize};
    use std::collections::HashMap;

    /// Types de bases supportés par l'API de migration.
    #[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
    #[serde(rename_all = "lowercase")]
    pub enum DatabaseType {
        Postgresql,
        Mysql,
        Sqlite,
        SqlServer,
        Oracle,
        Odbc,
    }

    /// Paramètres de connexion pour une base cible.
    #[derive(Debug, Clone, Serialize, Deserialize)]
    pub struct DatabaseConnection {
        pub db_type: DatabaseType,
        pub connection_string: String,
        pub params: Option<HashMap<String, String>>,
    }

    /// Statut global d'une migration.
    #[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
    #[serde(rename_all = "snake_case")]
    pub enum MigrationStatus {
        Pending,
        Running,
        Completed,
        Failed,
    }

    /// Détails par table (facultatif mais utile côté UI).
    #[derive(Debug, Clone, Serialize, Deserialize)]
    pub struct TableMigrationDetail {
        pub table_name: String,
        pub status: MigrationStatus,
        pub records_migrated: u64,
        pub error: Option<String>,
    }

    /// Résultat final (ou intermédiaire) d'une migration.
    #[derive(Debug, Clone, Serialize, Deserialize)]
    pub struct MigrationResult {
        pub status: MigrationStatus,
        pub tables_migrated: u64,
        pub records_migrated: u64,
        pub duration_ms: u64,
        pub error: Option<String>,
        pub table_details: Vec<TableMigrationDetail>,
    }

    /// Options de migration fournies par le client.
    ///
    /// Les champs sont volontairement permissifs pour assurer la compatibilité
    /// avec le frontend/inspector pendant l'évolution de la fonctionnalité.
    #[derive(Debug, Clone, Serialize, Deserialize)]
    pub struct MigrationOptions {
        /// Liste blanche de tables à migrer (None = toutes)
        pub tables: Option<Vec<String>>,
        /// Taille de lot lors de l'insertion (si applicable)
        pub batch_size: Option<usize>,
        /// Créer les tables côté cible si elles n'existent pas
        pub create_tables: Option<bool>,
        /// Vider les tables avant insertion
        pub truncate_before_insert: Option<bool>,
    }

    impl Default for MigrationOptions {
        fn default() -> Self {
            Self {
                tables: None,
                batch_size: Some(1000),
                create_tables: Some(true),
                truncate_before_insert: Some(false),
            }
        }
    }
}

use types::{DatabaseConnection, DatabaseType, MigrationResult, MigrationStatus, TableMigrationDetail};

// Mutex global pour synchroniser l'accès aux opérations ODBC.
static ODBC_MUTEX: Mutex<()> = Mutex::new(());

/// Migrator = orchestrateur de la migration.
#[derive(Clone)]
pub struct Migrator {
    engine: Arc<StorageEngine>,
    connection: DatabaseConnection,
    options: types::MigrationOptions,
}

impl Migrator {
    pub fn new(
        engine: Arc<StorageEngine>,
        connection: DatabaseConnection,
        options: types::MigrationOptions,
    ) -> anyhow::Result<Self> {
        Ok(Self {
            engine,
            connection,
            options,
        })
    }

    /// Teste la connectivité vers la base cible.
    pub fn test_connection(&self) -> anyhow::Result<()> {
        match self.connection.db_type {
            DatabaseType::Odbc => test_odbc_connection(&self.connection.connection_string),
            other => anyhow::bail!(
                "Test de connexion non implémenté pour {:?} (utilisez ODBC ou ajoutez un connecteur spécifique)",
                other
            ),
        }
    }

    /// Démarre une migration.
    ///
    /// Pour l'instant, la migration complète n'est pas implémentée.
    /// On retourne un `MigrationResult` en échec afin que l'API puisse
    /// afficher un statut plutôt que `None`.
    pub fn migrate(&mut self) -> anyhow::Result<MigrationResult> {
        let start = Instant::now();

        // Valider la connexion d'abord.
        if let Err(e) = self.test_connection() {
            return Ok(MigrationResult {
                status: MigrationStatus::Failed,
                tables_migrated: 0,
                records_migrated: 0,
                duration_ms: start.elapsed().as_millis() as u64,
                error: Some(format!("Erreur de connexion: {}", e)),
                table_details: Vec::new(),
            });
        }

        // TODO: implémenter export réel depuis `self.engine`.
        let _ = &self.engine;
        let _ = &self.options;

        Ok(MigrationResult {
            status: MigrationStatus::Failed,
            tables_migrated: 0,
            records_migrated: 0,
            duration_ms: start.elapsed().as_millis() as u64,
            error: Some("Migration non implémentée (module ajouté pour corriger la compilation)".to_string()),
            table_details: Vec::<TableMigrationDetail>::new(),
        })
    }
}

fn test_odbc_connection(connection_string_or_dsn: &str) -> anyhow::Result<()> {
    // Acquérir le verrou pour éviter les conflits ODBC en parallèle.
    let _guard = ODBC_MUTEX.lock().unwrap();

    use odbc_api::Environment;

    let env = unsafe { Environment::new() }.context("Impossible de créer l'environnement ODBC")?;

    // Si l'utilisateur fournit déjà une chaîne ODBC (contient '=') on l'utilise telle quelle.
    // Sinon, on considère que c'est un DSN.
    let conn_str = if connection_string_or_dsn.contains('=') {
        connection_string_or_dsn.to_string()
    } else {
        format!("DSN={}", connection_string_or_dsn)
    };

    // Essayer d'abord tel quel.
    let res = match env.connect_with_connection_string(&conn_str) {
        Ok(_conn) => Ok(()),
        Err(e1) => {
            // Essayer avec ';' final (certains drivers sont stricts)
            let conn_str2 = if conn_str.ends_with(';') {
                conn_str.clone()
            } else {
                format!("{};", conn_str)
            };
            match env.connect_with_connection_string(&conn_str2) {
                Ok(_conn) => Ok(()),
                Err(e2) => Err(anyhow::anyhow!(
                    "Impossible de se connecter via ODBC.\n\
                    - tentative 1: '{}' -> {}\n\
                    - tentative 2: '{}' -> {}",
                    conn_str,
                    e1,
                    conn_str2,
                    e2
                )),
            }
        }
    };
    res
}
