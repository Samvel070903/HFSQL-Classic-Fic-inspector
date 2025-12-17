/**
 * Moteur de stockage principal pour FIC Engine.
 * 
 * Ce fichier contient le moteur de stockage haut niveau qui gère l'accès
 * aux données HFSQL. Il fournit :
 * 
 * - Détection automatique des tables dans un dossier
 * - Lecture et écriture d'enregistrements
 * - Conversion des données brutes en structures typées (Record, FieldValue)
 * - Requêtes avec filtres et pagination
 * - Gestion des schémas de tables
 * - Décodage automatique des champs (entiers, flottants, chaînes, binaires, mémos)
 * 
 * Le moteur maintient un cache des tables détectées et peut fonctionner
 * en mode lecture seule ou avec écriture.
 * 
 * Liens avec d'autres modules :
 * - Utilise src/core/ pour lire les fichiers .fic/.mmo/.ndx
 * - Utilisé par src/api/handlers.rs pour les endpoints REST
 * - Utilisé par src/sql/executor.rs pour les requêtes SQL
 */

use crate::core::{FicFile, FicRecord, MmoFile, TableFiles, TableSchema};
use anyhow::{Context, Result};
use encoding_rs::WINDOWS_1252;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::{Arc, RwLock};
use rayon::prelude::*;

/// Filtres pour les requêtes de sélection
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QueryFilters {
    /// Nombre maximum d'enregistrements à retourner
    pub limit: Option<u32>,
    /// Nombre d'enregistrements à ignorer (pagination)
    pub offset: Option<u32>,
    /// Filtres par champ (nom_champ -> valeur)
    pub field_filters: HashMap<String, String>,
}

/// Résultat d'une requête de sélection
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QueryResult {
    /// Liste des enregistrements retournés
    pub records: Vec<Record>,
    /// Nombre total d'enregistrements (avant pagination)
    pub total: u32,
    /// Offset utilisé
    pub offset: u32,
    /// Limite utilisée
    pub limit: u32,
}

/// Représente un enregistrement avec ses données décodées et typées
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Record {
    /// Identifiant de l'enregistrement
    pub id: u32,
    /// Champs de l'enregistrement (nom -> valeur typée)
    pub fields: HashMap<String, FieldValue>,
    /// Données mémo décodées (nom_champ_mémo -> contenu texte)
    pub memo_data: HashMap<String, String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum FieldValue {
    #[serde(rename = "string")]
    String { value: String },
    #[serde(rename = "integer")]
    Integer { value: i64 },
    #[serde(rename = "float")]
    Float { value: f64 },
    #[serde(rename = "binary")]
    Binary { value: String }, // hex string
    #[serde(rename = "null")]
    Null { #[serde(serialize_with = "serialize_null")] value: () },
}

// Helpers pour créer les valeurs plus facilement
impl FieldValue {
    pub fn string(s: String) -> Self {
        FieldValue::String { value: s }
    }
    
    pub fn integer(i: i64) -> Self {
        FieldValue::Integer { value: i }
    }
    
    pub fn float(f: f64) -> Self {
        FieldValue::Float { value: f }
    }
    
    pub fn binary(bytes: Vec<u8>) -> Self {
        let hex_string: String = bytes.iter()
            .map(|b| format!("{:02x}", b))
            .collect();
        FieldValue::Binary { value: hex_string }
    }
    
    pub fn null() -> Self {
        FieldValue::Null { value: () }
    }
}

fn serialize_null<S>(_value: &(), serializer: S) -> Result<S::Ok, S::Error>
where
    S: serde::Serializer,
{
    // Sérialiser explicitement comme null pour correspondre au format frontend
    serializer.serialize_some(&serde_json::Value::Null)
}

/// Moteur de stockage principal gérant l'accès aux données HFSQL
pub struct StorageEngine {
    /// Chemin du dossier contenant les fichiers .fic/.mmo/.ndx
    data_dir: PathBuf,
    /// Cache des tables détectées (thread-safe)
    tables: Arc<RwLock<HashMap<String, TableFiles>>>,
    /// Mode lecture seule (désactive les modifications)
    read_only: bool,
    /// Active le multi-threading pour la lecture parallèle
    parallel: bool,
}

impl StorageEngine {
    /**
     * Crée un nouveau moteur de stockage.
     * 
     * Initialise le moteur avec le dossier de données spécifié.
     * Crée le dossier s'il n'existe pas.
     * 
     * @param data_dir - Chemin vers le dossier contenant les fichiers HFSQL
     * @param read_only - Active le mode lecture seule
     * @returns Result<StorageEngine> - Moteur créé ou erreur
     * 
     * Effets de bord :
     * - Peut créer le dossier de données s'il n'existe pas
     */
    pub fn new(data_dir: impl AsRef<Path>, read_only: bool) -> Result<Self> {
        Self::new_with_parallel(data_dir, read_only, true)
    }

    /**
     * Crée un nouveau moteur de stockage avec contrôle du multi-threading.
     * 
     * @param data_dir - Chemin vers le dossier contenant les fichiers HFSQL
     * @param read_only - Active le mode lecture seule
     * @param parallel - Active le multi-threading pour la lecture parallèle
     * @returns Result<StorageEngine> - Moteur créé ou erreur
     */
    pub fn new_with_parallel(data_dir: impl AsRef<Path>, read_only: bool, parallel: bool) -> Result<Self> {
        let data_dir = data_dir.as_ref().to_path_buf();
        
        if !data_dir.exists() {
            std::fs::create_dir_all(&data_dir)
                .with_context(|| format!("Impossible de créer le dossier: {:?}", data_dir))?;
        }

        Ok(Self {
            data_dir,
            tables: Arc::new(RwLock::new(HashMap::new())),
            read_only,
            parallel,
        })
    }

    /**
     * Retourne le chemin du dossier de données.
     * 
     * @returns &Path - Chemin du dossier de données
     */
    pub fn data_dir(&self) -> &Path {
        &self.data_dir
    }

    /**
     * Scanne le dossier de données et détecte toutes les tables HFSQL.
     * 
     * Parcourt le dossier, détecte les fichiers .fic, les associe avec
     * leurs fichiers .mmo et .ndx correspondants, puis met à jour le cache
     * des tables.
     * 
     * @returns Result<Vec<String>> - Liste des noms de tables détectées
     * 
     * Effets de bord :
     * - Lit le contenu du dossier de données
     * - Met à jour le cache interne des tables
     */
    pub fn scan_tables(&self) -> Result<Vec<String>> {
        let mut tables = Vec::new();
        let entries = std::fs::read_dir(&self.data_dir)
            .with_context(|| format!("Impossible de lire le dossier: {:?}", self.data_dir))?;

        let mut fic_files: HashMap<String, PathBuf> = HashMap::new();

        // Détection des fichiers .fic (case-insensitive)
        for entry in entries {
            let entry = entry?;
            let path = entry.path();
            if let Some(ext) = path.extension() {
                let ext_lower = ext.to_string_lossy().to_lowercase();
                if ext_lower == "fic" {
                    if let Some(name) = path.file_stem() {
                        let name = name.to_string_lossy().to_string();
                        fic_files.insert(name.clone(), path.clone());
                    }
                }
            }
        }

        // Association avec .mmo et .ndx (en parallèle si activé)
        let data_dir = self.data_dir.clone();
        let table_files_vec: Vec<(String, TableFiles)> = if self.parallel && fic_files.len() > 5 {
            // Version parallèle pour plusieurs fichiers
            fic_files
                .into_par_iter()
                .map(|(name, fic_path)| {
                    self.process_table_files(name, fic_path, &data_dir)
                })
                .collect()
        } else {
            // Version séquentielle pour peu de fichiers
            fic_files
                .into_iter()
                .map(|(name, fic_path)| {
                    self.process_table_files(name, fic_path, &data_dir)
                })
                .collect()
        };

        // Insérer dans le cache et collecter les noms
        let mut tables_cache = self.tables.write().unwrap();
        for (name, table_files) in table_files_vec {
            tables_cache.insert(name.clone(), table_files);
            tables.push(name);
        }

        Ok(tables)
    }

    /**
     * Traite les fichiers associés à une table (.mmo, .ndx).
     * 
     * Fonction helper pour éviter la duplication de code entre
     * les versions parallèle et séquentielle de scan_tables.
     */
    fn process_table_files(&self, name: String, fic_path: PathBuf, data_dir: &Path) -> (String, TableFiles) {
        let mmo_path = data_dir.join(format!("{}.mmo", name));
        let mmo_path = if mmo_path.exists() {
            Some(mmo_path)
        } else {
            None
        };

        let mut ndx_paths = Vec::new();
        let mut i = 0;
        loop {
            let ndx_path = data_dir.join(format!("{}.ndx{}", name, i));
            if ndx_path.exists() {
                ndx_paths.push(ndx_path);
                i += 1;
            } else {
                break;
            }
        }

        let table_files = TableFiles {
            name: name.clone(),
            fic_path,
            mmo_path,
            ndx_paths,
        };

        (name, table_files)
    }

    /**
     * Retourne la liste des noms de toutes les tables détectées.
     * 
     * @returns Vec<String> - Liste des noms de tables
     * 
     * Effets de bord : Aucun
     */
    pub fn list_tables(&self) -> Vec<String> {
        self.tables.read().unwrap().keys().cloned().collect()
    }

    /**
     * Obtient le schéma complet d'une table.
     * 
     * Ouvre le fichier .fic, analyse sa structure et retourne le schéma
     * avec la liste des champs, leurs types, offsets et longueurs.
     * 
     * @param table - Nom de la table
     * @returns Result<TableSchema> - Schéma de la table ou erreur
     * 
     * Effets de bord :
     * - Lit le fichier .fic pour analyser le schéma
     */
    pub fn get_schema(&self, table: &str) -> Result<TableSchema> {
        let tables = self.tables.read().unwrap();
        let table_files = tables.get(table)
            .with_context(|| format!("Table '{}' non trouvée", table))?;

        let fic = FicFile::open(&table_files.fic_path)?;
        let fields = fic.analyze_schema();

        Ok(TableSchema {
            name: table.to_string(),
            record_length: fic.header().record_length,
            field_count: fields.len() as u32,
            fields,
        })
    }

    /**
     * Sélectionne des enregistrements d'une table avec filtres et pagination.
     * 
     * Lit tous les enregistrements de la table, applique les filtres par champ,
     * puis retourne une page de résultats avec pagination.
     * 
     * @param table - Nom de la table
     * @param filters - Filtres de requête (limit, offset, filtres par champ)
     * @returns Result<QueryResult> - Résultats de la requête ou erreur
     * 
     * Effets de bord :
     * - Lit les fichiers .fic/.mmo pour récupérer les données
     * - Décode les données selon le schéma de la table
     */
    pub fn select(&self, table: &str, filters: QueryFilters) -> Result<QueryResult> {
        let tables = self.tables.read().unwrap();
        let table_files = tables.get(table)
            .with_context(|| format!("Table '{}' non trouvée", table))?;

        // Obtenir le schéma pour décoder les champs
        let schema = self.get_schema(table)?;

        let mut fic = FicFile::open(&table_files.fic_path)
            .with_context(|| format!("Impossible d'ouvrir le fichier .fic: {:?}", table_files.fic_path))?;
        let mut mmo = table_files.mmo_path.as_ref()
            .map(|p| MmoFile::open(p))
            .transpose()
            .with_context(|| "Erreur lors de l'ouverture du fichier .mmo")?;

        let all_records = fic.read_all_records()
            .with_context(|| format!("Erreur lors de la lecture des enregistrements de la table '{}'", table))?;
        let total = all_records.len() as u32;

        // Application des filtres
        let offset = filters.offset.unwrap_or(0);
        let limit = filters.limit.unwrap_or(100);

        // Paralléliser le décodage des enregistrements si on en a beaucoup et si le multi-threading est activé
        let records_to_decode: Vec<FicRecord> = all_records
            .into_iter()
            .skip(offset as usize)
            .take(limit as usize)
            .collect();

        let records: Vec<Record> = if self.parallel && records_to_decode.len() > 50 {
            // Version parallèle : ouvrir un nouveau fichier MMO pour chaque thread si nécessaire
            let mmo_path = table_files.mmo_path.clone();
            let schema_clone = schema.clone();
            
            records_to_decode
                .into_par_iter()
                .map(|r| {
                    // Ouvrir un nouveau fichier MMO pour ce thread si nécessaire
                    let mut thread_mmo = mmo_path.as_ref()
                        .map(|p| MmoFile::open(p))
                        .transpose()
                        .with_context(|| "Erreur lors de l'ouverture du fichier .mmo pour le thread")?;
                    
                    self.record_from_fic_impl(r, &schema_clone, &mut thread_mmo)
                })
                .collect::<Result<Vec<_>>>()?
        } else {
            // Version séquentielle pour petits ensembles
            records_to_decode
                .into_iter()
                .map(|r| self.record_from_fic(r, &schema, &mut mmo))
                .collect::<Result<Vec<_>>>()?
        };

        Ok(QueryResult {
            records,
            total,
            offset,
            limit,
        })
    }

    /**
     * Obtient un enregistrement spécifique par son ID.
     * 
     * @param table - Nom de la table
     * @param id - Identifiant de l'enregistrement
     * @returns Result<Record> - Enregistrement ou erreur
     * 
     * Effets de bord :
     * - Lit le fichier .fic pour récupérer l'enregistrement
     * - Peut lire le fichier .mmo si des données mémo sont présentes
     */
    pub fn get_by_id(&self, table: &str, id: u32) -> Result<Record> {
        let tables = self.tables.read().unwrap();
        let table_files = tables.get(table)
            .with_context(|| format!("Table '{}' non trouvée", table))?;

        // Obtenir le schéma pour décoder les champs
        let schema = self.get_schema(table)?;

        let mut fic = FicFile::open(&table_files.fic_path)?;
        let mut mmo = table_files.mmo_path.as_ref()
            .map(|p| MmoFile::open(p))
            .transpose()?;

        let record = fic.read_record(id)?;
        self.record_from_fic(record, &schema, &mut mmo)
    }

    /**
     * Convertit un FicRecord brut en Record décodé selon le schéma.
     * 
     * Décode les données brutes de l'enregistrement selon le schéma de la table,
     * convertit chaque champ selon son type (entier, flottant, chaîne, binaire, mémo),
     * et récupère les données mémo depuis le fichier .mmo si nécessaire.
     * 
     * @param fic_record - Enregistrement brut depuis le fichier .fic
     * @param schema - Schéma de la table pour le décodage
     * @param mmo - Handle optionnel vers le fichier .mmo
     * @returns Result<Record> - Enregistrement décodé ou erreur
     * 
     * Effets de bord :
     * - Peut lire depuis le fichier .mmo pour les champs mémo
     */
    fn record_from_fic(
        &self,
        fic_record: FicRecord,
        schema: &TableSchema,
        mmo: &mut Option<MmoFile>,
    ) -> Result<Record> {
        self.record_from_fic_impl(fic_record, schema, mmo)
    }

    /**
     * Implémentation interne de record_from_fic (utilisée aussi en parallèle).
     */
    fn record_from_fic_impl(
        &self,
        fic_record: FicRecord,
        schema: &TableSchema,
        mmo: &mut Option<MmoFile>,
    ) -> Result<Record> {
        use crate::core::FieldType;
        use byteorder::{LittleEndian, ReadBytesExt};
        use std::io::Cursor;

        let mut fields = HashMap::new();
        let mut memo_data = HashMap::new();

        // Ajouter l'ID
        fields.insert("id".to_string(), FieldValue::integer(fic_record.id as i64));

        // Décoder chaque champ selon le schéma
        // Les données de l'enregistrement commencent après le byte de flags
        // On reconstruit le buffer complet en ajoutant le byte de flags au début
        let full_data = if fic_record.data.is_empty() {
            vec![0u8]
        } else {
            // Le premier byte est le flag, le reste sont les données
            let mut full = vec![0u8]; // Flag byte (non supprimé par défaut)
            full.extend_from_slice(&fic_record.data);
            full
        };

        for field in &schema.fields {
            // Ignorer le champ "id" car on l'a déjà ajouté
            if field.name == "id" {
                continue;
            }

            let offset = field.offset as usize;
            let length = field.length as usize;

            if offset + length > full_data.len() {
                // Champ hors limites, on le marque comme null
                fields.insert(field.name.clone(), FieldValue::null());
                continue;
            }

            let field_data = &full_data[offset..offset + length];

            let value = match field.field_type {
                FieldType::Integer => {
                    if length == 1 {
                        FieldValue::integer(field_data[0] as i64)
                    } else if length == 2 {
                        let mut cursor = Cursor::new(field_data);
                        FieldValue::integer(cursor.read_i16::<LittleEndian>().unwrap_or(0) as i64)
                    } else if length == 4 {
                        let mut cursor = Cursor::new(field_data);
                        FieldValue::integer(cursor.read_i32::<LittleEndian>().unwrap_or(0) as i64)
                    } else if length == 8 {
                        let mut cursor = Cursor::new(field_data);
                        FieldValue::integer(cursor.read_i64::<LittleEndian>().unwrap_or(0))
                    } else {
                        // Pour les entiers de taille non standard, on lit comme u32
                        let mut cursor = Cursor::new(field_data);
                        FieldValue::integer(cursor.read_u32::<LittleEndian>().unwrap_or(0) as i64)
                    }
                }
                FieldType::Float => {
                    if length == 4 {
                        let mut cursor = Cursor::new(field_data);
                        FieldValue::float(cursor.read_f32::<LittleEndian>().unwrap_or(0.0) as f64)
                    } else if length == 8 {
                        let mut cursor = Cursor::new(field_data);
                        FieldValue::float(cursor.read_f64::<LittleEndian>().unwrap_or(0.0))
                    } else {
                        FieldValue::null()
                    }
                }
                FieldType::String => {
                    // Les chaînes sont généralement null-terminated ou padded
                    // Trouver la fin de la chaîne (premier byte null ou fin des données)
                    let null_pos = field_data.iter().position(|&b| b == 0).unwrap_or(field_data.len());
                    let string_bytes = &field_data[..null_pos];
                    
                    // Décoder en utilisant Windows-1252 (CP1252) pour gérer les accents français
                    // Essayer d'abord Windows-1252, puis UTF-8 si ça échoue
                    let string_value = if string_bytes.is_empty() {
                        String::new()
                    } else {
                        // Essayer Windows-1252 d'abord (encodage standard pour fichiers français Windows)
                        let (decoded, _, had_errors) = WINDOWS_1252.decode(string_bytes);
                        let mut result = decoded.into_owned();
                        
                        // Si Windows-1252 a produit des erreurs, essayer UTF-8
                        if had_errors {
                            if let Ok(utf8_str) = std::str::from_utf8(string_bytes) {
                                result = utf8_str.to_string();
                            }
                        }
                        
                        result.trim_end().to_string()
                    };
                    
                    FieldValue::string(string_value)
                }
                FieldType::Binary => {
                    // Vérifier si le champ est entièrement rempli de zéros
                    let is_all_zeros = field_data.iter().all(|&b| b == 0);
                    if is_all_zeros {
                        // Pour les champs binaires vides, on peut les marquer comme null ou les garder comme binary vide
                        // On les garde comme binary mais le frontend pourra les détecter
                        FieldValue::binary(field_data.to_vec())
                    } else {
                        FieldValue::binary(field_data.to_vec())
                    }
                }
                FieldType::Memo => {
                    // Les mémos sont des pointeurs vers le fichier .mmo
                    if length >= 4 {
                        let mut cursor = Cursor::new(field_data);
                        let pointer = cursor.read_u32::<LittleEndian>().unwrap_or(0);
                        if pointer != 0 && pointer < 0xFFFFFFFF {
                            // Lire le contenu du mémo
                            if let Some(ref mut mmo_file) = mmo {
                                if let Ok(text) = mmo_file.read_text(pointer) {
                                    memo_data.insert(field.name.clone(), text);
                                }
                            }
                        }
                    }
                    FieldValue::null()
                }
                FieldType::Date | FieldType::Unknown => {
                    // Pour les dates et types inconnus, on affiche comme binaire ou string
                    // Essayer de décoder comme chaîne (Windows-1252 ou UTF-8)
                    let null_pos = field_data.iter().position(|&b| b == 0).unwrap_or(field_data.len());
                    let string_bytes = &field_data[..null_pos];
                    
                    if string_bytes.is_empty() {
                        FieldValue::binary(field_data.to_vec())
                    } else {
                        // Essayer Windows-1252 d'abord
                        let (decoded, _, had_errors) = WINDOWS_1252.decode(string_bytes);
                        let mut result = decoded.into_owned();
                        
                        // Si Windows-1252 a produit des erreurs, essayer UTF-8
                        if had_errors {
                            if let Ok(utf8_str) = std::str::from_utf8(string_bytes) {
                                result = utf8_str.to_string();
                                FieldValue::string(result.trim_end().to_string())
                            } else {
                                // Si les deux échouent, traiter comme binaire
                                FieldValue::binary(field_data.to_vec())
                            }
                        } else {
                            FieldValue::string(result.trim_end().to_string())
                        }
                    }
                }
            };

            fields.insert(field.name.clone(), value);
        }

        Ok(Record {
            id: fic_record.id,
            fields,
            memo_data,
        })
    }

    /**
     * Insère un nouvel enregistrement dans une table.
     * 
     * Note : Non implémenté pour le moment. Retourne une erreur.
     * 
     * @param _table - Nom de la table
     * @param _record - Données de l'enregistrement à insérer
     * @returns Result<u32> - ID de l'enregistrement créé ou erreur
     * 
     * Effets de bord :
     * - Devrait écrire dans le fichier .fic (non implémenté)
     */
    pub fn insert(&self, _table: &str, _record: Record) -> Result<u32> {
        if self.read_only {
            anyhow::bail!("Mode lecture seule activé");
        }
        // TODO: Implémenter l'écriture
        anyhow::bail!("Écriture non implémentée pour le moment")
    }

    /**
     * Met à jour un enregistrement existant.
     * 
     * Note : Non implémenté pour le moment. Retourne une erreur.
     * 
     * @param _table - Nom de la table
     * @param _id - Identifiant de l'enregistrement à mettre à jour
     * @param _record - Nouvelles données de l'enregistrement
     * @returns Result<()> - Succès ou erreur
     * 
     * Effets de bord :
     * - Devrait modifier le fichier .fic (non implémenté)
     */
    pub fn update(&self, _table: &str, _id: u32, _record: Record) -> Result<()> {
        if self.read_only {
            anyhow::bail!("Mode lecture seule activé");
        }
        anyhow::bail!("Écriture non implémentée pour le moment")
    }

    /**
     * Supprime un enregistrement (marque comme supprimé).
     * 
     * Note : Non implémenté pour le moment. Retourne une erreur.
     * 
     * @param _table - Nom de la table
     * @param _id - Identifiant de l'enregistrement à supprimer
     * @returns Result<()> - Succès ou erreur
     * 
     * Effets de bord :
     * - Devrait marquer l'enregistrement comme supprimé dans le fichier .fic (non implémenté)
     */
    pub fn delete(&self, _table: &str, _id: u32) -> Result<()> {
        if self.read_only {
            anyhow::bail!("Mode lecture seule activé");
        }
        anyhow::bail!("Écriture non implémentée pour le moment")
    }
}

