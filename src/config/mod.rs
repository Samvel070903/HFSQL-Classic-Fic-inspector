/**
 * Module de configuration de l'application.
 * 
 * Ce module gère la configuration de l'application FIC Engine, incluant :
 * - Les paramètres du serveur API (host, port, CORS)
 * - Les paramètres de stockage (dossier de données, mode lecture seule)
 * - Les paramètres de logging (niveau de log)
 * 
 * La configuration peut être chargée depuis :
 * - Un fichier TOML (config.toml par défaut)
 * - Des variables d'environnement (préfixe FIC__)
 * - Des valeurs par défaut si aucune configuration n'est trouvée
 * 
 * Exports :
 * - Settings : Structure principale de configuration
 */

pub mod settings;

pub use settings::Settings;

