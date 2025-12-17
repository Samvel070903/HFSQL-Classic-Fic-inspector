/**
 * Module SQL pour FIC Engine.
 * 
 * Ce module fournit un parser et un exécuteur SQL permettant d'interroger
 * les données HFSQL via des requêtes SQL standard. Il supporte également
 * l'accès via ODBC pour interroger d'autres bases de données.
 * 
 * Structure :
 * - parser.rs : Parser SQL simple pour SELECT, INSERT, UPDATE, DELETE
 * - executor.rs : Exécuteur SQL qui traduit les requêtes en opérations StorageEngine
 * - server.rs : Handlers HTTP pour les endpoints SQL
 * - odbc.rs : Support ODBC pour interroger d'autres bases de données
 * 
 * Exports :
 * - SqlParser : Parser de requêtes SQL
 * - SqlExecutor : Exécuteur de requêtes SQL
 * - SqlServer : Serveur SQL (structure)
 * - OdbcResult : Résultat de requête ODBC
 */

pub mod parser;
pub mod executor;
pub mod server;
pub mod odbc;

pub use parser::SqlParser;
pub use executor::SqlExecutor;
pub use server::SqlServer;
pub use odbc::OdbcResult;

