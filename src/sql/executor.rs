/**
 * Exécuteur SQL pour FIC Engine.
 * 
 * Ce fichier contient l'exécuteur SQL qui traduit les requêtes SQL parsées
 * en opérations sur le StorageEngine. Il convertit les structures SqlStatement
 * en appels aux méthodes du moteur de stockage.
 * 
 * Fonctionnalités :
 * - Exécution de SELECT avec filtres et pagination
 * - Exécution de INSERT, UPDATE, DELETE
 * - Conversion des valeurs SQL en FieldValue
 * - Filtrage des colonnes pour SELECT
 * 
 * Liens avec d'autres modules :
 * - Utilise src/sql/parser.rs pour les structures de requêtes
 * - Utilise src/storage/StorageEngine pour accéder aux données
 * - Utilisé par src/sql/server.rs pour exécuter les requêtes HTTP
 */

use crate::storage::{QueryFilters, Record, StorageEngine};
use crate::storage::engine::FieldValue;
use crate::sql::parser::*;
use anyhow::{Context, Result};
use std::collections::HashMap;
use std::sync::Arc;

/// Exécuteur SQL qui traduit les requêtes SQL en opérations sur StorageEngine
pub struct SqlExecutor {
    /// Moteur de stockage partagé
    engine: Arc<StorageEngine>,
}

impl SqlExecutor {
    /**
     * Crée un nouvel exécuteur SQL.
     * 
     * @param engine - Moteur de stockage partagé
     * @returns SqlExecutor - Exécuteur créé
     */
    pub fn new(engine: Arc<StorageEngine>) -> Self {
        Self { engine }
    }

    /**
     * Exécute une requête SQL parsée.
     * 
     * Déroute vers la méthode d'exécution appropriée selon le type
     * de requête (SELECT, INSERT, UPDATE, DELETE).
     * 
     * @param statement - Requête SQL parsée
     * @returns Result<SqlResult> - Résultat de l'exécution ou erreur
     * 
     * Effets de bord :
     * - Peut lire/écrire des données selon le type de requête
     */
    pub fn execute(&self, statement: &SqlStatement) -> Result<SqlResult> {
        match statement {
            SqlStatement::Select(select) => self.execute_select(select),
            SqlStatement::Insert(insert) => self.execute_insert(insert),
            SqlStatement::Update(update) => self.execute_update(update),
            SqlStatement::Delete(delete) => self.execute_delete(delete),
        }
    }

    fn execute_select(&self, select: &SelectStatement) -> Result<SqlResult> {
        // Convertir la clause WHERE en QueryFilters
        let mut filters = QueryFilters {
            limit: select.limit,
            offset: select.offset,
            field_filters: HashMap::new(),
        };

        if let Some(where_clause) = &select.where_clause {
            for condition in &where_clause.conditions {
                let value = match &condition.value {
                    SqlValue::String(s) => s.clone(),
                    SqlValue::Integer(i) => i.to_string(),
                    SqlValue::Float(f) => f.to_string(),
                    SqlValue::Boolean(b) => b.to_string(),
                    SqlValue::Null => "".to_string(),
                };
                filters.field_filters.insert(condition.column.clone(), value);
            }
        }

        let query_result = self.engine.select(&select.table, filters)
            .with_context(|| format!("Erreur lors de la sélection depuis la table {}", select.table))?;

        // Filtrer les colonnes si nécessaire
        let records = if select.columns.is_empty() {
            query_result.records
        } else {
            query_result.records
                .into_iter()
                .map(|record| {
                    let mut filtered_fields = HashMap::new();
                    for col in &select.columns {
                        if let Some(value) = record.fields.get(col) {
                            filtered_fields.insert(col.clone(), value.clone());
                        }
                    }
                    Record {
                        id: record.id,
                        fields: filtered_fields,
                        memo_data: record.memo_data,
                    }
                })
                .collect()
        };

        Ok(SqlResult::Select {
            columns: if select.columns.is_empty() {
                // Récupérer toutes les colonnes du schéma
                self.engine.get_schema(&select.table)
                    .map(|s| s.fields.iter().map(|f| f.name.clone()).collect())
                    .unwrap_or_else(|_| vec!["id".to_string()])
            } else {
                select.columns.clone()
            },
            rows: records,
        })
    }

    fn execute_insert(&self, insert: &InsertStatement) -> Result<SqlResult> {
        // Créer un Record à partir des valeurs
        let mut fields = HashMap::new();
        for (i, col) in insert.columns.iter().enumerate() {
            if i < insert.values.len() {
                let value = self.sql_value_to_field_value(&insert.values[i])?;
                fields.insert(col.clone(), value);
            }
        }

        let record = Record {
            id: 0, // Sera assigné par l'engine
            fields,
            memo_data: HashMap::new(),
        };

        let id = self.engine.insert(&insert.table, record)
            .with_context(|| format!("Erreur lors de l'insertion dans la table {}", insert.table))?;

        Ok(SqlResult::Insert { id })
    }

    fn execute_update(&self, update: &UpdateStatement) -> Result<SqlResult> {
        // Pour UPDATE, on doit d'abord trouver les enregistrements à mettre à jour
        let mut filters = QueryFilters {
            limit: None,
            offset: None,
            field_filters: HashMap::new(),
        };

        if let Some(where_clause) = &update.where_clause {
            for condition in &where_clause.conditions {
                let value = match &condition.value {
                    SqlValue::String(s) => s.clone(),
                    SqlValue::Integer(i) => i.to_string(),
                    SqlValue::Float(f) => f.to_string(),
                    SqlValue::Boolean(b) => b.to_string(),
                    SqlValue::Null => "".to_string(),
                };
                filters.field_filters.insert(condition.column.clone(), value);
            }
        }

        let query_result = self.engine.select(&update.table, filters)
            .with_context(|| format!("Erreur lors de la sélection pour UPDATE dans la table {}", update.table))?;

        let mut updated_count = 0;
        for record in query_result.records {
            // Mettre à jour les champs
            let mut updated_record = record.clone();
            for set_clause in &update.set_clauses {
                let value = self.sql_value_to_field_value(&set_clause.value)?;
                updated_record.fields.insert(set_clause.column.clone(), value);
            }

            self.engine.update(&update.table, record.id, updated_record)
                .with_context(|| format!("Erreur lors de la mise à jour de l'enregistrement {}", record.id))?;
            updated_count += 1;
        }

        Ok(SqlResult::Update { count: updated_count })
    }

    fn execute_delete(&self, delete: &DeleteStatement) -> Result<SqlResult> {
        // Pour DELETE, on doit d'abord trouver les enregistrements à supprimer
        let mut filters = QueryFilters {
            limit: None,
            offset: None,
            field_filters: HashMap::new(),
        };

        if let Some(where_clause) = &delete.where_clause {
            for condition in &where_clause.conditions {
                let value = match &condition.value {
                    SqlValue::String(s) => s.clone(),
                    SqlValue::Integer(i) => i.to_string(),
                    SqlValue::Float(f) => f.to_string(),
                    SqlValue::Boolean(b) => b.to_string(),
                    SqlValue::Null => "".to_string(),
                };
                filters.field_filters.insert(condition.column.clone(), value);
            }
        }

        let query_result = self.engine.select(&delete.table, filters)
            .with_context(|| format!("Erreur lors de la sélection pour DELETE dans la table {}", delete.table))?;

        let mut deleted_count = 0;
        for record in query_result.records {
            self.engine.delete(&delete.table, record.id)
                .with_context(|| format!("Erreur lors de la suppression de l'enregistrement {}", record.id))?;
            deleted_count += 1;
        }

        Ok(SqlResult::Delete { count: deleted_count })
    }

    fn sql_value_to_field_value(&self, sql_value: &SqlValue) -> Result<FieldValue> {
        match sql_value {
            SqlValue::String(s) => Ok(FieldValue::string(s.clone())),
            SqlValue::Integer(i) => Ok(FieldValue::integer(*i as i64)),
            SqlValue::Float(f) => Ok(FieldValue::float(*f)),
            SqlValue::Boolean(b) => {
                // Convertir boolean en integer (1 ou 0) car FieldValue n'a pas de type boolean
                Ok(FieldValue::integer(if *b { 1 } else { 0 }))
            }
            SqlValue::Null => Ok(FieldValue::null()),
        }
    }
}

/// Résultat d'une exécution SQL
#[derive(Debug, Clone)]
pub enum SqlResult {
    Select {
        columns: Vec<String>,
        rows: Vec<Record>,
    },
    Insert {
        id: u32,
    },
    Update {
        count: usize,
    },
    Delete {
        count: usize,
    },
}

