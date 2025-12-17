/**
 * Support ODBC pour FIC Engine.
 * 
 * Ce fichier contient les fonctions pour interroger des bases de données
 * externes via ODBC. Il permet d'exécuter des requêtes SQL, de récupérer
 * la liste des tables et des relations depuis n'importe quelle source
 * de données ODBC.
 * 
 * Fonctionnalités :
 * - Exécution de requêtes SQL (SELECT, INSERT, UPDATE, DELETE)
 * - Récupération de la liste des tables
 * - Récupération des relations (clés étrangères)
 * - Gestion des connexions et des lifetimes ODBC
 * 
 * Liens avec d'autres modules :
 * - Utilisé par src/sql/server.rs pour les endpoints HTTP ODBC
 */

use crate::logger::{get_logger, LogLevel};
use anyhow::{Context, Result};
use odbc_api::{Connection, Cursor, Environment};
use serde::Serialize;
use std::sync::Mutex;
use widestring::U16String;

// Mutex global pour synchroniser l'accès aux opérations ODBC
// Cela évite les conflits lorsque plusieurs requêtes sont exécutées en parallèle
static ODBC_MUTEX: Mutex<()> = Mutex::new(());

/// Crée un environnement ODBC en essayant différentes versions si nécessaire
fn create_odbc_environment() -> Result<Environment> {
    // Essayer d'abord avec la version par défaut (ODBC 3.x)
    match unsafe { Environment::new() } {
        Ok(env) => {
            get_logger().log_with_source(LogLevel::Info, "Environnement ODBC 3.x créé avec succès".to_string(), Some("ODBC".to_string()));
            return Ok(env);
        }
        Err(e) => {
            get_logger().log_with_source(LogLevel::Error, format!("Erreur lors de la création de l'environnement ODBC 3.x: {}", e), Some("ODBC".to_string()));
            // Certains drivers peuvent nécessiter ODBC 2.x, mais odbc-api ne le supporte pas directement
            // On retourne l'erreur pour l'instant
            return Err(anyhow::anyhow!("Impossible de créer l'environnement ODBC: {}", e));
        }
    }
}

/**
 * Exécute une requête SQL via ODBC.
 * 
 * Se connecte à une source de données ODBC via le DSN spécifié,
 * exécute la requête SQL et retourne les résultats. Gère correctement
 * les lifetimes de l'environnement et de la connexion ODBC.
 * 
 * @param dsn - Nom du DSN ODBC
 * @param sql - Requête SQL à exécuter
 * @returns Result<OdbcResult> - Résultats de la requête ou erreur
 * 
 * Effets de bord :
 * - Se connecte à la base de données ODBC
 * - Exécute la requête SQL sur la base de données distante
 */
pub fn execute_odbc_query(dsn: &str, sql: &str) -> Result<OdbcResult> {
    // Acquérir le verrou pour synchroniser l'accès ODBC
    let _guard = ODBC_MUTEX.lock().unwrap();
    
    get_logger().log_with_source(LogLevel::Info, format!("Début de execute_odbc_query pour DSN: {}", dsn), Some("ODBC".to_string()));
    
    // Créer l'environnement et la connexion dans la même portée
    let environment = create_odbc_environment()?;
    
    // Essayer d'abord avec DSN= simple
    let mut connection = match environment.connect_with_connection_string(&format!("DSN={}", dsn)) {
        Ok(conn) => {
            conn
        }
        Err(e) => {
            let error_msg = e.to_string();
            
            // Vérifier si l'erreur concerne la version ODBC
            if error_msg.contains("version du comportement ODBC") || 
               error_msg.contains("SQLSetEnvAttr") ||
               error_msg.contains("ne gère pas la version") {
                return Err(e).with_context(|| format!(
                    "⚠️ Le driver ODBC pour le DSN '{}' ne supporte pas la version ODBC 3.x requise.\n\n\
                    🔧 Solutions possibles:\n\
                    1. Mettez à jour le driver ODBC vers une version compatible ODBC 3.x\n\
                    2. Utilisez un autre driver ODBC compatible (ex: HFSQL moderne)\n\
                    3. Vérifiez la configuration du DSN dans l'Administrateur de sources de données ODBC\n\
                    4. Contactez le fournisseur du driver pour une version compatible ODBC 3.x\n\n\
                    ℹ️ Note: Certains drivers anciens (comme dBASE Files, certains drivers HFSQL anciens) \
                    ne supportent que ODBC 2.x et ne peuvent pas être utilisés avec cette application.",
                    dsn
                ));
            }
            
            // Essayer avec une chaîne de connexion alternative
            match environment.connect_with_connection_string(&format!("DSN={};", dsn)) {
                Ok(conn) => {
                    conn
                }
                Err(e2) => {
                    return Err(e).with_context(|| format!("Impossible de se connecter au DSN: {}. Erreur alternative: {}", dsn, e2));
                }
            }
        }
    };
    
    // Exécuter la requête
    let sql_upper = sql.trim().to_uppercase();
    if sql_upper.starts_with("SELECT") {
        execute_query(&mut connection, sql)
    } else {
        execute_update(&mut connection, sql)
    }
}

/**
 * Exécute une requête SELECT et retourne les résultats.
 * 
 * @param connection - Connexion ODBC active
 * @param sql - Requête SQL SELECT
 * @returns Result<OdbcResult> - Résultats de la requête ou erreur
 * 
 * Effets de bord :
 * - Exécute la requête sur la base de données
 * - Lit les résultats ligne par ligne
     */
fn execute_query(connection: &mut Connection, sql: &str) -> Result<OdbcResult> {
        let mut statement = connection
            .prepare(sql)
            .with_context(|| format!("Erreur lors de la préparation de la requête SQL.\nRequête: {}\n\nVérifiez que:\n- Le nom de la table existe\n- Vous avez les permissions nécessaires\n- Le nom de table ne nécessite pas de guillemets (essayez \"TABLE\" ou `TABLE`)", sql))?;

        let result_set = statement
            .execute(())
            .with_context(|| format!("Erreur lors de l'exécution de la requête SQL.\nRequête: {}\n\nVérifiez que:\n- La table existe et est accessible\n- Vous avez les permissions nécessaires\n- Le nom de table ne nécessite pas de guillemets (essayez \"TABLE\" ou `TABLE`)", sql))?;

        // Récupérer les noms de colonnes
        let mut columns: Vec<String> = Vec::new();
        if let Some(cursor) = result_set.as_ref() {
            match cursor.column_names() {
                Ok(column_names_iter) => {
                    for name_result in column_names_iter {
                        if let Ok(name) = name_result {
                            columns.push(name.to_string());
                        }
                    }
                }
                Err(_) => {
                    // Si on ne peut pas récupérer les noms, essayer via col_name
                    if let Some(cursor_ref) = result_set.as_ref() {
                        let mut col_num = 1u16;
                        loop {
                            let mut name_buf = vec![0u16; 256];
                            match cursor_ref.col_name(col_num, &mut name_buf) {
                                Ok(()) => {
                                    let name = U16String::from_vec(name_buf);
                                    let name_str = name.to_string_lossy();
                                    if name_str.is_empty() {
                                        break;
                                    }
                                    columns.push(name_str);
                                    col_num += 1;
                                }
                                Err(_) => break,
                            }
                        }
                    }
                }
            }
        }

        // Récupérer les données ligne par ligne pour éviter les allocations massives
        let mut rows = Vec::new();
        if let Some(mut cursor) = result_set {
            // Lire les données ligne par ligne
            loop {
                match cursor.next_row() {
                    Ok(Some(mut row)) => {
                        let mut row_data = std::collections::HashMap::new();
                        
                        // Lire chaque colonne avec un buffer de taille limitée
                        for (col_idx, col_name) in columns.iter().enumerate() {
                            let col_num = (col_idx + 1) as u16;
                            let value = {
                                // Utiliser un buffer de taille raisonnable (8KB par colonne)
                                // Si les données sont plus grandes, on les tronque
                                let mut buffer = vec![0u8; 8192];
                                
                                match row.get_text(col_num, &mut buffer) {
                                    Ok(true) => {
                                        // Les données ont été lues, trouver la fin de la chaîne
                                        let text_len = buffer.iter()
                                            .position(|&b| b == 0)
                                            .unwrap_or_else(|| {
                                                // Si pas de 0, chercher la première position où on a des données valides
                                                buffer.iter().rposition(|&b| b != 0)
                                                    .map(|pos| pos + 1)
                                                    .unwrap_or(0)
                                            });
                                        if text_len > 0 {
                                            String::from_utf8_lossy(&buffer[..text_len]).to_string()
                                        } else {
                                            "NULL".to_string()
                                        }
                                    }
                                    Ok(false) | Err(_) => "NULL".to_string(),
                                }
                            };
                            row_data.insert(col_name.clone(), value);
                        }
                        
                        rows.push(row_data);
                    }
                    Ok(None) => break, // Fin des résultats
                    Err(e) => return Err(anyhow::anyhow!("Erreur lors de la lecture des données: {}", e)),
                }
            }
        }

        Ok(OdbcResult {
            columns,
            rows,
            rows_affected: None,
        })
}

/**
 * Exécute une requête INSERT, UPDATE ou DELETE.
 * 
 * @param connection - Connexion ODBC active
 * @param sql - Requête SQL INSERT/UPDATE/DELETE
 * @returns Result<OdbcResult> - Résultat avec nombre de lignes affectées ou erreur
 * 
 * Effets de bord :
 * - Exécute la requête sur la base de données
 * - Modifie les données dans la base de données
 */
fn execute_update(connection: &mut Connection, sql: &str) -> Result<OdbcResult> {
        let mut statement = connection
            .prepare(sql)
            .with_context(|| format!("Erreur lors de la préparation de la requête: {}", sql))?;

        // Pour les requêtes UPDATE/DELETE, on ne peut pas facilement obtenir le nombre de lignes affectées
        // avec cette version d'odbc-api. On retourne 0 pour l'instant.
        let _ = statement
            .execute(())
            .with_context(|| format!("Erreur lors de l'exécution de la requête: {}", sql))?;
        
        let rows_affected = 0; // TODO: Implémenter la récupération du nombre de lignes affectées

        Ok(OdbcResult {
            columns: Vec::new(),
            rows: Vec::new(),
            rows_affected: Some(rows_affected as usize),
        })
    }


/// Résultat d'une requête ODBC
#[derive(Debug, Clone)]
pub struct OdbcResult {
    pub columns: Vec<String>,
    pub rows: Vec<std::collections::HashMap<String, String>>,
    pub rows_affected: Option<usize>,
}

/**
 * Récupère la liste des tables depuis une source de données ODBC.
 * 
 * Essaie d'abord avec INFORMATION_SCHEMA (standard SQL), puis avec
 * les tables système spécifiques au driver si nécessaire.
 * 
 * @param dsn - Nom du DSN ODBC
 * @returns Result<Vec<String>> - Liste des noms de tables ou erreur
 * 
 * Effets de bord :
 * - Se connecte à la base de données ODBC
 * - Interroge les métadonnées de la base de données
 */
pub fn get_tables(dsn: &str) -> Result<Vec<String>> {
    // Acquérir le verrou pour synchroniser l'accès ODBC
    let _guard = ODBC_MUTEX.lock().unwrap();
    
    get_logger().log_with_source(LogLevel::Info, format!("Début de get_tables pour DSN: {}", dsn), Some("ODBC".to_string()));
        let environment = create_odbc_environment()?;
        
    // Essayer d'abord avec DSN= simple
    let mut connection = match environment.connect_with_connection_string(&format!("DSN={}", dsn)) {
        Ok(conn) => {
            conn
        }
        Err(e) => {
            let error_msg = e.to_string();
            
            // Vérifier si l'erreur concerne la version ODBC
            if error_msg.contains("version du comportement ODBC") || 
               error_msg.contains("SQLSetEnvAttr") ||
               error_msg.contains("ne gère pas la version") {
                return Err(e).with_context(|| format!(
                    "⚠️ Le driver ODBC pour le DSN '{}' ne supporte pas la version ODBC 3.x requise.\n\n\
                    🔧 Solutions possibles:\n\
                    1. Mettez à jour le driver ODBC vers une version compatible ODBC 3.x\n\
                    2. Utilisez un autre driver ODBC compatible (ex: HFSQL moderne)\n\
                    3. Vérifiez la configuration du DSN dans l'Administrateur de sources de données ODBC\n\
                    4. Contactez le fournisseur du driver pour une version compatible ODBC 3.x\n\n\
                    ℹ️ Note: Certains drivers anciens (comme dBASE Files, certains drivers HFSQL anciens) \
                    ne supportent que ODBC 2.x et ne peuvent pas être utilisés avec cette application.",
                    dsn
                ));
            }
            
            // Essayer avec une chaîne de connexion alternative
            match environment.connect_with_connection_string(&format!("DSN={};", dsn)) {
                Ok(conn) => {
                    conn
                }
                Err(e2) => {
                    return Err(e).with_context(|| format!("Impossible de se connecter au DSN: {}. Erreur alternative: {}", dsn, e2));
                }
            }
        }
    };
    
    // Essayer d'abord avec INFORMATION_SCHEMA (standard SQL)
    let query = "SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE = 'BASE TABLE' ORDER BY TABLE_NAME";
    match execute_query(&mut connection, query) {
        Ok(result) => {
            let tables: Vec<String> = result.rows
                .into_iter()
                .filter_map(|row| row.get("TABLE_NAME").cloned())
                .collect();
            if !tables.is_empty() {
                return Ok(tables);
            }
        }
        Err(_) => {}
    }
    
    // Fallback: utiliser les tables système ODBC
    // Note: Cette approche peut varier selon le driver ODBC
    let query = "SELECT name FROM sysobjects WHERE type='U' ORDER BY name";
    match execute_query(&mut connection, query) {
        Ok(result) => {
            let tables: Vec<String> = result.rows
                .into_iter()
                .filter_map(|row| row.get("name").cloned())
                .collect();
            if !tables.is_empty() {
                return Ok(tables);
            }
        }
        Err(_) => {}
    }
    
    Ok(Vec::new())
}

/// Relation entre deux tables (clé étrangère)
#[derive(Debug, Clone, Serialize)]
pub struct TableRelation {
    pub from_table: String,
    pub from_column: String,
    pub to_table: String,
    pub to_column: String,
}

/**
 * Récupère les relations (clés étrangères) entre les tables depuis ODBC.
 * 
 * Utilise INFORMATION_SCHEMA pour récupérer les relations standard SQL.
 * 
 * @param dsn - Nom du DSN ODBC
 * @returns Result<Vec<TableRelation>> - Liste des relations ou erreur
 * 
 * Effets de bord :
 * - Se connecte à la base de données ODBC
 * - Interroge les métadonnées de relations de la base de données
 */
pub fn get_relations(dsn: &str) -> Result<Vec<TableRelation>> {
    // Acquérir le verrou pour synchroniser l'accès ODBC
    let _guard = ODBC_MUTEX.lock().unwrap();
    
    get_logger().log_with_source(LogLevel::Info, format!("Début de get_relations pour DSN: {}", dsn), Some("ODBC".to_string()));
    
    let environment = create_odbc_environment()?;
    
    
    // Essayer d'abord avec DSN= simple
    let mut connection = match environment.connect_with_connection_string(&format!("DSN={}", dsn)) {
        Ok(conn) => {
            conn
        }
        Err(e) => {
            let error_msg = e.to_string();
            
            // Vérifier si l'erreur concerne la version ODBC
            if error_msg.contains("version du comportement ODBC") || 
               error_msg.contains("SQLSetEnvAttr") ||
               error_msg.contains("ne gère pas la version") {
                return Err(e).with_context(|| format!(
                    "⚠️ Le driver ODBC pour le DSN '{}' ne supporte pas la version ODBC 3.x requise.\n\n\
                    🔧 Solutions possibles:\n\
                    1. Mettez à jour le driver ODBC vers une version compatible ODBC 3.x\n\
                    2. Utilisez un autre driver ODBC compatible (ex: HFSQL moderne)\n\
                    3. Vérifiez la configuration du DSN dans l'Administrateur de sources de données ODBC\n\
                    4. Contactez le fournisseur du driver pour une version compatible ODBC 3.x\n\n\
                    ℹ️ Note: Certains drivers anciens (comme dBASE Files, certains drivers HFSQL anciens) \
                    ne supportent que ODBC 2.x et ne peuvent pas être utilisés avec cette application.",
                    dsn
                ));
            }
            
            // Essayer avec une chaîne de connexion alternative
            match environment.connect_with_connection_string(&format!("DSN={};", dsn)) {
                Ok(conn) => {
                    conn
                }
                Err(e2) => {
                    return Err(e).with_context(|| format!("Impossible de se connecter au DSN: {}. Erreur alternative: {}", dsn, e2));
                }
            }
        }
    };
    
    // Essayer avec INFORMATION_SCHEMA (standard SQL)
    let query = r#"
        SELECT 
            kcu.TABLE_NAME as from_table,
            kcu.COLUMN_NAME as from_column,
            kcu.REFERENCED_TABLE_NAME as to_table,
            kcu.REFERENCED_COLUMN_NAME as to_column
        FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE kcu
        WHERE kcu.REFERENCED_TABLE_NAME IS NOT NULL
        ORDER BY kcu.TABLE_NAME, kcu.COLUMN_NAME
    "#;
    
    match execute_query(&mut connection, query) {
        Ok(result) => {
            let relations: Vec<TableRelation> = result.rows
                .into_iter()
                .filter_map(|row| {
                    Some(TableRelation {
                        from_table: row.get("from_table")?.clone(),
                        from_column: row.get("from_column")?.clone(),
                        to_table: row.get("to_table")?.clone(),
                        to_column: row.get("to_column")?.clone(),
                    })
                })
                .collect();
            if !relations.is_empty() {
                return Ok(relations);
            }
        }
        Err(_) => {}
    }
    
    Ok(Vec::new())
}
