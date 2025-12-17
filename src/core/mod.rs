/**
 * Module core pour le traitement bas niveau des fichiers HFSQL.
 * 
 * Ce module contient les structures et fonctions pour lire et analyser
 * les fichiers HFSQL au format binaire :
 * 
 * - fic.rs : Gestion des fichiers .fic (données principales)
 * - mmo.rs : Gestion des fichiers .mmo (données mémo/blobs)
 * - ndx.rs : Gestion des fichiers .ndx (index)
 * 
 * Il définit également les structures de schéma (TableSchema, FieldInfo)
 * utilisées pour représenter la structure des tables.
 * 
 * Exports :
 * - FicFile, FicHeader, FicRecord : Structures pour les fichiers .fic
 * - MmoFile, MmoBlock : Structures pour les fichiers .mmo
 * - NdxFile, NdxEntry : Structures pour les fichiers .ndx
 * - TableSchema, FieldInfo, FieldType : Structures de schéma
 * - TableFiles : Représentation d'un ensemble de fichiers liés
 */

pub mod fic;
pub mod mmo;
pub mod ndx;

pub use fic::{FicFile, FicHeader, FicRecord};
pub use mmo::{MmoFile, MmoBlock};
pub use ndx::{NdxFile, NdxEntry};

use serde::{Deserialize, Serialize};
use std::path::PathBuf;

/// Représente le schéma complet d'une table HFSQL
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TableSchema {
    /// Nom de la table
    pub name: String,
    /// Longueur d'un enregistrement en bytes
    pub record_length: u32,
    /// Nombre de champs dans la table
    pub field_count: u32,
    /// Liste des champs avec leurs métadonnées
    pub fields: Vec<FieldInfo>,
}

/// Informations sur un champ d'une table
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FieldInfo {
    /// Nom du champ
    pub name: String,
    /// Offset du champ dans l'enregistrement (en bytes)
    pub offset: u32,
    /// Longueur du champ (en bytes)
    pub length: u32,
    /// Type de données du champ
    pub field_type: FieldType,
}

/// Types de données supportés pour les champs
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum FieldType {
    /// Chaîne de caractères
    String,
    /// Nombre entier
    Integer,
    /// Nombre décimal
    Float,
    /// Date
    Date,
    /// Mémo (pointeur vers fichier .mmo)
    Memo,
    /// Données binaires
    Binary,
    /// Type inconnu
    Unknown,
}

/// Représente un ensemble de fichiers liés formant une table HFSQL
#[derive(Debug, Clone)]
pub struct TableFiles {
    /// Nom de la table
    pub name: String,
    /// Chemin vers le fichier .fic principal
    pub fic_path: PathBuf,
    /// Chemin vers le fichier .mmo (optionnel)
    pub mmo_path: Option<PathBuf>,
    /// Chemins vers les fichiers d'index .ndx (peut y en avoir plusieurs)
    pub ndx_paths: Vec<PathBuf>,
}

