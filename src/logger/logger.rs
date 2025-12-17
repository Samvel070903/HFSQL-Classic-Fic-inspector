use serde::{Deserialize, Serialize};
use std::sync::{Arc, Mutex};
use std::time::SystemTime;

/// Niveau de log
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum LogLevel {
    Info,
    Warn,
    Error,
    Debug,
}

impl LogLevel {
    pub fn as_str(&self) -> &'static str {
        match self {
            LogLevel::Info => "info",
            LogLevel::Warn => "warn",
            LogLevel::Error => "error",
            LogLevel::Debug => "debug",
        }
    }
}

/// Entrée de log
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LogEntry {
    pub id: String,
    pub timestamp: SystemTime,
    pub level: LogLevel,
    pub message: String,
    pub source: Option<String>, // Module/source du log (ex: "DSN", "ODBC", "SQL")
    pub details: Option<serde_json::Value>,
}

impl LogEntry {
    pub fn new(level: LogLevel, message: String) -> Self {
        Self {
            id: format!("{}", SystemTime::now().duration_since(SystemTime::UNIX_EPOCH).unwrap_or_default().as_nanos()),
            timestamp: SystemTime::now(),
            level,
            message,
            source: None,
            details: None,
        }
    }

    pub fn with_source(mut self, source: String) -> Self {
        self.source = Some(source);
        self
    }

    pub fn with_details(mut self, details: serde_json::Value) -> Self {
        self.details = Some(details);
        self
    }
}

/// Logger global thread-safe
#[derive(Clone)]
pub struct Logger {
    logs: Arc<Mutex<Vec<LogEntry>>>,
    max_logs: usize,
}

impl Logger {
    /// Crée un nouveau logger
    pub fn new(max_logs: usize) -> Self {
        Self {
            logs: Arc::new(Mutex::new(Vec::new())),
            max_logs,
        }
    }

    /// Ajoute un log
    pub fn log(&self, level: LogLevel, message: String) {
        self.log_with_source(level, message, None)
    }

    /// Ajoute un log avec source
    pub fn log_with_source(&self, level: LogLevel, message: String, source: Option<String>) {
        let entry = LogEntry::new(level, message)
            .with_source(source.unwrap_or_default());
        
        let mut logs = self.logs.lock().unwrap();
        logs.push(entry);
        
        // Garder seulement les N derniers logs
        if logs.len() > self.max_logs {
            logs.remove(0);
        }
    }

    /// Ajoute un log avec détails
    pub fn log_with_details(&self, level: LogLevel, message: String, source: Option<String>, details: serde_json::Value) {
        let entry = LogEntry::new(level, message)
            .with_source(source.unwrap_or_default())
            .with_details(details);
        
        let mut logs = self.logs.lock().unwrap();
        logs.push(entry);
        
        if logs.len() > self.max_logs {
            logs.remove(0);
        }
    }

    /// Récupère tous les logs
    pub fn get_logs(&self) -> Vec<LogEntry> {
        self.logs.lock().unwrap().clone()
    }

    /// Récupère les logs filtrés par niveau
    pub fn get_logs_by_level(&self, level: Option<LogLevel>) -> Vec<LogEntry> {
        let logs = self.logs.lock().unwrap();
        if let Some(level) = level {
            logs.iter()
                .filter(|log| log.level == level)
                .cloned()
                .collect()
        } else {
            logs.clone()
        }
    }

    /// Efface tous les logs
    pub fn clear(&self) {
        let mut logs = self.logs.lock().unwrap();
        logs.clear();
    }

    /// Récupère le nombre de logs
    pub fn count(&self) -> usize {
        self.logs.lock().unwrap().len()
    }
}

/// Logger global (singleton)
static GLOBAL_LOGGER: once_cell::sync::Lazy<Logger> = once_cell::sync::Lazy::new(|| {
    Logger::new(10000) // Garder jusqu'à 10000 logs
});

/// Récupère le logger global
pub fn get_logger() -> &'static Logger {
    &GLOBAL_LOGGER
}

/// Macros pour faciliter l'utilisation
#[macro_export]
macro_rules! log_info {
    ($($arg:tt)*) => {
        $crate::logger::get_logger().log_with_source(
            $crate::logger::LogLevel::Info,
            format!($($arg)*),
            None,
        );
    };
}

#[macro_export]
macro_rules! log_warn {
    ($($arg:tt)*) => {
        $crate::logger::get_logger().log_with_source(
            $crate::logger::LogLevel::Warn,
            format!($($arg)*),
            None,
        );
    };
}

#[macro_export]
macro_rules! log_error {
    ($($arg:tt)*) => {
        $crate::logger::get_logger().log_with_source(
            $crate::logger::LogLevel::Error,
            format!($($arg)*),
            None,
        );
    };
}

#[macro_export]
macro_rules! log_debug {
    ($($arg:tt)*) => {
        $crate::logger::get_logger().log_with_source(
            $crate::logger::LogLevel::Debug,
            format!($($arg)*),
            None,
        );
    };
}

/// Macros avec source
#[macro_export]
macro_rules! log_info_with_source {
    ($source:expr, $($arg:tt)*) => {
        $crate::logger::get_logger().log_with_source(
            $crate::logger::LogLevel::Info,
            format!($($arg)*),
            Some($source.to_string()),
        );
    };
}

#[macro_export]
macro_rules! log_warn_with_source {
    ($source:expr, $($arg:tt)*) => {
        $crate::logger::get_logger().log_with_source(
            $crate::logger::LogLevel::Warn,
            format!($($arg)*),
            Some($source.to_string()),
        );
    };
}

#[macro_export]
macro_rules! log_error_with_source {
    ($source:expr, $($arg:tt)*) => {
        $crate::logger::get_logger().log_with_source(
            $crate::logger::LogLevel::Error,
            format!($($arg)*),
            Some($source.to_string()),
        );
    };
}

