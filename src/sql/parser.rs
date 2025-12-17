/**
 * Parser SQL simple pour FIC Engine.
 * 
 * Ce fichier contient un parser SQL basique qui supporte les requêtes
 * SELECT, INSERT, UPDATE et DELETE. Le parser utilise des expressions
 * régulières pour analyser la syntaxe SQL et construit des structures
 * de données typées représentant la requête.
 * 
 * Fonctionnalités supportées :
 * - SELECT avec colonnes, WHERE, LIMIT, OFFSET
 * - INSERT avec colonnes et valeurs
 * - UPDATE avec SET et WHERE
 * - DELETE avec WHERE
 * 
 * Limitations :
 * - Parser basique (pas de sous-requêtes, JOIN, etc.)
 * - Support limité des opérateurs (AND uniquement dans WHERE)
 * 
 * Liens avec d'autres modules :
 * - Utilisé par src/sql/executor.rs pour exécuter les requêtes
 * - Utilisé par src/sql/server.rs pour parser les requêtes HTTP
 */

use anyhow::Result;
use serde::{Deserialize, Serialize};

/// Représente une requête SQL parsée sous forme d'arbre syntaxique
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum SqlStatement {
    /// Requête SELECT
    Select(SelectStatement),
    /// Requête INSERT
    Insert(InsertStatement),
    /// Requête UPDATE
    Update(UpdateStatement),
    /// Requête DELETE
    Delete(DeleteStatement),
}

/// Requête SELECT
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SelectStatement {
    pub table: String,
    pub columns: Vec<String>, // Vide = SELECT *
    pub where_clause: Option<WhereClause>,
    pub limit: Option<u32>,
    pub offset: Option<u32>,
}

/// Requête INSERT
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InsertStatement {
    pub table: String,
    pub columns: Vec<String>,
    pub values: Vec<SqlValue>,
}

/// Requête UPDATE
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateStatement {
    pub table: String,
    pub set_clauses: Vec<SetClause>,
    pub where_clause: Option<WhereClause>,
}

/// Requête DELETE
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeleteStatement {
    pub table: String,
    pub where_clause: Option<WhereClause>,
}

/// Clause WHERE
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WhereClause {
    pub conditions: Vec<Condition>,
}

/// Condition dans WHERE
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Condition {
    pub column: String,
    pub operator: ComparisonOperator,
    pub value: SqlValue,
}

/// Opérateur de comparaison
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ComparisonOperator {
    Equal,
    NotEqual,
    GreaterThan,
    LessThan,
    GreaterThanOrEqual,
    LessThanOrEqual,
    Like,
}

/// Clause SET dans UPDATE
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SetClause {
    pub column: String,
    pub value: SqlValue,
}

/// Valeur SQL
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum SqlValue {
    String(String),
    Integer(i64),
    Float(f64),
    Boolean(bool),
    Null,
}

/// Parser SQL simple utilisant des expressions régulières
pub struct SqlParser;

impl SqlParser {
    /**
     * Parse une requête SQL et retourne une structure typée.
     * 
     * Analyse la requête SQL fournie et la convertit en structure
     * SqlStatement. Supporte SELECT, INSERT, UPDATE et DELETE.
     * 
     * @param sql - Requête SQL à parser
     * @returns Result<SqlStatement> - Requête parsée ou erreur de syntaxe
     * 
     * Effets de bord : Aucun
     */
    pub fn parse(sql: &str) -> Result<SqlStatement> {
        // Nettoyer la requête : supprimer les espaces et le point-virgule final
        let sql = sql.trim().trim_end_matches(';').trim();
        
        if sql.is_empty() {
            anyhow::bail!("Requête SQL vide");
        }

        let upper = sql.to_uppercase();
        
        if upper.starts_with("SELECT") {
            Self::parse_select(sql)
        } else if upper.starts_with("INSERT") {
            Self::parse_insert(sql)
        } else if upper.starts_with("UPDATE") {
            Self::parse_update(sql)
        } else if upper.starts_with("DELETE") {
            Self::parse_delete(sql)
        } else {
            anyhow::bail!("Type de requête non supporté: {}", sql)
        }
    }

    fn parse_select(sql: &str) -> Result<SqlStatement> {
        // Parser simple pour SELECT * FROM table [WHERE ...] [LIMIT ...] [OFFSET ...]
        // Note: regex plus flexible pour gérer les cas simples
        let re = regex::Regex::new(
            r"(?i)^SELECT\s+(.+?)\s+FROM\s+(\w+)(?:\s+WHERE\s+(.+?))?(?:\s+LIMIT\s+(\d+))?(?:\s+OFFSET\s+(\d+))?$"
        ).map_err(|e| anyhow::anyhow!("Erreur de regex: {}", e))?;
        
        if let Some(caps) = re.captures(sql) {
            let columns_str = caps.get(1).unwrap().as_str().trim();
            let table = caps.get(2).unwrap().as_str().to_string();
            let columns = if columns_str == "*" {
                Vec::new()
            } else {
                columns_str.split(',').map(|s| s.trim().to_string()).collect()
            };
            
            let where_clause = caps.get(3).map(|m| Self::parse_where(m.as_str())).transpose()?;
            let limit = caps.get(4).and_then(|m| m.as_str().parse().ok());
            let offset = caps.get(5).and_then(|m| m.as_str().parse().ok());
            
            Ok(SqlStatement::Select(SelectStatement {
                table,
                columns,
                where_clause,
                limit,
                offset,
            }))
        } else {
            anyhow::bail!("Syntaxe SELECT invalide: {}", sql)
        }
    }

    fn parse_insert(sql: &str) -> Result<SqlStatement> {
        // INSERT INTO table (col1, col2) VALUES (val1, val2)
        let re = regex::Regex::new(
            r"(?i)^INSERT\s+INTO\s+(\w+)\s*\((.+?)\)\s+VALUES\s*\((.+?)\)$"
        ).map_err(|e| anyhow::anyhow!("Erreur de regex: {}", e))?;
        
        if let Some(caps) = re.captures(sql) {
            let table = caps.get(1).unwrap().as_str().to_string();
            let columns: Vec<String> = caps.get(2).unwrap()
                .as_str()
                .split(',')
                .map(|s| s.trim().to_string())
                .collect();
            let values_str = caps.get(3).unwrap().as_str();
            let values = Self::parse_values(values_str)?;
            
            if columns.len() != values.len() {
                anyhow::bail!("Le nombre de colonnes ne correspond pas au nombre de valeurs");
            }
            
            Ok(SqlStatement::Insert(InsertStatement {
                table,
                columns,
                values,
            }))
        } else {
            anyhow::bail!("Syntaxe INSERT invalide: {}", sql)
        }
    }

    fn parse_update(sql: &str) -> Result<SqlStatement> {
        // UPDATE table SET col1=val1, col2=val2 [WHERE ...]
        let re = regex::Regex::new(
            r"(?i)^UPDATE\s+(\w+)\s+SET\s+(.+?)(?:\s+WHERE\s+(.+?))?$"
        ).map_err(|e| anyhow::anyhow!("Erreur de regex: {}", e))?;
        
        if let Some(caps) = re.captures(sql) {
            let table = caps.get(1).unwrap().as_str().to_string();
            let set_str = caps.get(2).unwrap().as_str();
            let set_clauses = Self::parse_set_clauses(set_str)?;
            let where_clause = caps.get(3).map(|m| Self::parse_where(m.as_str())).transpose()?;
            
            Ok(SqlStatement::Update(UpdateStatement {
                table,
                set_clauses,
                where_clause,
            }))
        } else {
            anyhow::bail!("Syntaxe UPDATE invalide: {}", sql)
        }
    }

    fn parse_delete(sql: &str) -> Result<SqlStatement> {
        // DELETE FROM table [WHERE ...]
        let re = regex::Regex::new(
            r"(?i)^DELETE\s+FROM\s+(\w+)(?:\s+WHERE\s+(.+?))?$"
        ).map_err(|e| anyhow::anyhow!("Erreur de regex: {}", e))?;
        
        if let Some(caps) = re.captures(sql) {
            let table = caps.get(1).unwrap().as_str().to_string();
            let where_clause = caps.get(2).map(|m| Self::parse_where(m.as_str())).transpose()?;
            
            Ok(SqlStatement::Delete(DeleteStatement {
                table,
                where_clause,
            }))
        } else {
            anyhow::bail!("Syntaxe DELETE invalide: {}", sql)
        }
    }

    fn parse_where(where_str: &str) -> Result<WhereClause> {
        // Parser simple: col = val AND col2 = val2
        let conditions: Result<Vec<Condition>> = where_str
            .split("AND")
            .map(|cond| {
                let cond = cond.trim();
                // Support: col = val, col != val, col > val, etc.
                for op in ["!=", ">=", "<=", "=", ">", "<", "LIKE"] {
                    if cond.contains(op) {
                        let parts: Vec<&str> = cond.split(op).collect();
                        if parts.len() == 2 {
                            let column = parts[0].trim().to_string();
                            let value_str = parts[1].trim();
                            let value = Self::parse_value(value_str)?;
                            let operator = match op {
                                "=" => ComparisonOperator::Equal,
                                "!=" => ComparisonOperator::NotEqual,
                                ">" => ComparisonOperator::GreaterThan,
                                "<" => ComparisonOperator::LessThan,
                                ">=" => ComparisonOperator::GreaterThanOrEqual,
                                "<=" => ComparisonOperator::LessThanOrEqual,
                                "LIKE" => ComparisonOperator::Like,
                                _ => ComparisonOperator::Equal,
                            };
                            return Ok(Condition { column, operator, value });
                        }
                    }
                }
                anyhow::bail!("Condition invalide: {}", cond)
            })
            .collect();
        
        Ok(WhereClause {
            conditions: conditions?,
        })
    }

    fn parse_set_clauses(set_str: &str) -> Result<Vec<SetClause>> {
        set_str
            .split(',')
            .map(|clause| {
                let clause = clause.trim();
                let parts: Vec<&str> = clause.split('=').collect();
                if parts.len() == 2 {
                    let column = parts[0].trim().to_string();
                    let value = Self::parse_value(parts[1].trim())?;
                    Ok(SetClause { column, value })
                } else {
                    anyhow::bail!("Clause SET invalide: {}", clause)
                }
            })
            .collect()
    }

    fn parse_values(values_str: &str) -> Result<Vec<SqlValue>> {
        values_str
            .split(',')
            .map(|v| Self::parse_value(v.trim()))
            .collect()
    }

    fn parse_value(value_str: &str) -> Result<SqlValue> {
        let value_str = value_str.trim();
        
        if value_str.eq_ignore_ascii_case("NULL") {
            Ok(SqlValue::Null)
        } else if value_str.eq_ignore_ascii_case("TRUE") {
            Ok(SqlValue::Boolean(true))
        } else if value_str.eq_ignore_ascii_case("FALSE") {
            Ok(SqlValue::Boolean(false))
        } else if let Some(s) = value_str.strip_prefix('\'').and_then(|s| s.strip_suffix('\'')) {
            Ok(SqlValue::String(s.to_string()))
        } else if let Some(s) = value_str.strip_prefix('"').and_then(|s| s.strip_suffix('"')) {
            Ok(SqlValue::String(s.to_string()))
        } else if let Ok(i) = value_str.parse::<i64>() {
            Ok(SqlValue::Integer(i))
        } else if let Ok(f) = value_str.parse::<f64>() {
            Ok(SqlValue::Float(f))
        } else {
            // Par défaut, traiter comme string
            Ok(SqlValue::String(value_str.to_string()))
        }
    }
}

