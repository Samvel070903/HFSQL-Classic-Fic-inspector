/**
 * Gestionnaire de fichiers .fic (fichiers de données HFSQL).
 * 
 * Ce fichier contient les structures et fonctions pour lire et analyser
 * les fichiers .fic qui contiennent les données principales des tables HFSQL.
 * 
 * Structure d'un fichier .fic :
 * - Header : Métadonnées (magic bytes, version, nombre d'enregistrements, etc.)
 * - Données : Enregistrements de taille fixe, chacun commençant par un byte de flags
 * 
 * Fonctionnalités :
 * - Lecture du header avec détection automatique du format
 * - Lecture d'enregistrements individuels par index
 * - Lecture de tous les enregistrements actifs
 * - Analyse du schéma (déduction des champs)
 * - Extraction des pointeurs mémo vers les fichiers .mmo
 * 
 * Liens avec d'autres modules :
 * - Utilisé par src/storage/engine.rs pour lire les données
 * - Utilise src/core/FieldInfo pour représenter les champs
 */

use crate::core::FieldInfo;
use crate::logger::{get_logger, LogLevel};
use anyhow::{Context, Result};
use byteorder::{LittleEndian, ReadBytesExt};
use serde::{Deserialize, Serialize};
use std::fs::File;
use std::io::{Read, Seek, SeekFrom};
use std::path::Path;
use rayon::prelude::*;

/// Header d'un fichier .fic contenant les métadonnées
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FicHeader {
    /// Magic bytes identifiant le format (ex: 0x46494300 = "FIC\0" ou "PCS\0")
    pub magic: u32,
    /// Version du format de fichier
    pub version: u16,
    /// Longueur d'un enregistrement en bytes
    pub record_length: u32,
    /// Nombre total d'enregistrements dans le fichier
    pub record_count: u32,
    /// Nombre d'enregistrements marqués comme supprimés
    pub deleted_count: u32,
    /// Flags divers du fichier
    pub flags: u16,
    /// Taille du header en bytes
    pub header_size: u32,
    /// Offset où commencent les données (après le header)
    pub data_offset: u32,
}

/// Représente un enregistrement dans un fichier .fic
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FicRecord {
    /// Identifiant de l'enregistrement (index 0-based)
    pub id: u32,
    /// Indique si l'enregistrement est marqué comme supprimé
    pub deleted: bool,
    /// Données brutes de l'enregistrement (sans le byte de flags)
    pub data: Vec<u8>,
    /// Offsets vers les données mémo dans le fichier .mmo associé
    pub memo_pointers: Vec<u32>,
}

/// Gestionnaire de fichier .fic permettant la lecture et l'analyse
pub struct FicFile {
    /// Chemin du fichier
    #[allow(dead_code)]
    path: std::path::PathBuf,
    /// Header du fichier (lu au moment de l'ouverture)
    header: FicHeader,
    /// Handle du fichier ouvert (Option pour permettre la fermeture explicite)
    file: Option<File>,
}

impl FicFile {
    /**
     * Ouvre un fichier .fic en lecture et lit son header.
     * 
     * Ouvre le fichier, lit et parse le header pour déterminer la structure
     * du fichier (nombre d'enregistrements, longueur, etc.).
     * 
     * @param path - Chemin vers le fichier .fic
     * @returns Result<FicFile> - Gestionnaire de fichier ou erreur
     * 
     * Effets de bord :
     * - Ouvre le fichier en lecture
     * - Lit les premiers bytes pour parser le header
     */
    pub fn open<P: AsRef<Path>>(path: P) -> Result<Self> {
        let path = path.as_ref().to_path_buf();
        let mut file = File::open(&path)
            .with_context(|| format!("Impossible d'ouvrir le fichier: {:?}", path))?;

        let header = Self::read_header(&mut file)?;

        Ok(Self {
            path,
            header,
            file: Some(file),
        })
    }

    /**
     * Lit et parse le header d'un fichier .fic.
     * 
     * Lit les métadonnées depuis le début du fichier et les parse
     * pour construire un FicHeader. Gère différents formats (PCS, FIC)
     * et calcule automatiquement la longueur d'enregistrement si nécessaire.
     * 
     * @param reader - Reader positionné au début du fichier
     * @returns Result<FicHeader> - Header parsé ou erreur
     * 
     * Effets de bord :
     * - Lit depuis le reader (position modifiée)
     * - Peut faire des seeks pour déterminer la taille du fichier
     */
    fn read_header<R: Read + Seek>(reader: &mut R) -> Result<FicHeader> {
        reader.seek(SeekFrom::Start(0))?;

        // Magic bytes: "PCS\0" (4 bytes)
        let mut magic_bytes = [0u8; 4];
        reader.read_exact(&mut magic_bytes)?;
        let magic = u32::from_le_bytes(magic_bytes);
        
        // Vérification du magic
        if &magic_bytes[0..3] != b"PCS" {
            // Fallback: essayer "FIC" pour compatibilité
            if &magic_bytes[0..3] != b"FIC" {
                anyhow::bail!("Magic bytes invalides: {:?} (attendu: PCS ou FIC)", magic_bytes);
            }
        }

        let version = reader.read_u16::<LittleEndian>()?;
        let _padding1 = reader.read_u16::<LittleEndian>()?; // Padding
        
        // Record length en u16 (peut-être en unités spéciales)
        let record_length_u16 = reader.read_u16::<LittleEndian>()?;
        let record_count = reader.read_u16::<LittleEndian>()?;
        let _padding2 = reader.read_u16::<LittleEndian>()?; // Padding
        let deleted_count = reader.read_u16::<LittleEndian>()?;
        let _padding3 = reader.read_u16::<LittleEndian>()?; // Padding
        let flags = reader.read_u16::<LittleEndian>()?;
        
        // Record length: si c'est 1, peut-être que c'est en pages de 64KB
        // Mais d'abord, essayons de déterminer la vraie longueur en analysant le fichier
        let current_pos = reader.seek(SeekFrom::Current(0))?;
        let file_size = reader.seek(SeekFrom::End(0))?;
        reader.seek(SeekFrom::Start(current_pos))?;
        
        // Calculer la taille du header en cherchant la fin du header
        // Le header semble se terminer après les flags (offset 0x14 = 20 bytes)
        // mais peut contenir des données supplémentaires (GUIDs, etc.)
        // On va chercher un header_size plus réaliste en analysant la structure
        
        // Pour l'instant, on suppose que le header fait au moins 20 bytes
        // mais peut-être plus. On va le calculer dynamiquement si possible.
        let min_header_size = 0x14; // 20 bytes minimum
        
        // Si record_length_u16 == 1, cela pourrait signifier différentes choses:
        // 1. 65536 bytes (64KB) - mais cela ne correspond pas à la taille du fichier
        // 2. Une unité différente (peut-être en blocs de 512 bytes?)
        // 3. La vraie valeur est ailleurs dans le header
        let record_length = if record_length_u16 == 1 {
            // Si le fichier est trop petit pour 65536 bytes par enregistrement,
            // calculons la longueur réelle à partir de la taille du fichier
            if record_count > 0 {
                let available_data = file_size.saturating_sub(min_header_size as u64);
                let calculated_length = (available_data / record_count as u64) as u32;
                // Si la longueur calculée est raisonnable (entre 100 et 100000 bytes), l'utiliser
                if calculated_length >= 100 && calculated_length <= 100000 {
                    get_logger().log_with_source(LogLevel::Warn, format!("record_length=1 détecté, calculé dynamiquement: {} bytes (fichier: {} bytes, {} enregistrements)", 
                             calculated_length, file_size, record_count), Some("FIC Core".to_string()));
                    calculated_length
                } else {
                    // Sinon, utiliser 65536 comme valeur par défaut
                    65536u32
                }
            } else {
                65536u32
            }
        } else {
            record_length_u16 as u32
        };
        
        // Pour header_size et data_offset, on doit les chercher ailleurs
        // ou les calculer. Pour l'instant, on utilise des valeurs par défaut
        // basées sur l'observation que le header semble commencer à 0x14
        let header_size = min_header_size; // 20 bytes minimum, mais peut être plus
        let data_offset = header_size; // Les données commencent après le header de base

        Ok(FicHeader {
            magic,
            version,
            record_length,
            record_count: record_count as u32,
            deleted_count: deleted_count as u32,
            flags,
            header_size,
            data_offset,
        })
    }

    /**
     * Retourne une référence vers le header du fichier.
     * 
     * @returns &FicHeader - Référence vers le header
     */
    pub fn header(&self) -> &FicHeader {
        &self.header
    }

    /**
     * Lit un enregistrement spécifique par son index.
     * 
     * Positionne le curseur du fichier à l'offset de l'enregistrement
     * demandé, lit les données et extrait les informations (flags,
     * pointeurs mémo, etc.).
     * 
     * @param index - Index de l'enregistrement (0-based)
     * @returns Result<FicRecord> - Enregistrement lu ou erreur
     * 
     * Effets de bord :
     * - Lit depuis le fichier (position modifiée)
     * - Peut retourner une erreur si l'index est hors limites
     */
    pub fn read_record(&mut self, index: u32) -> Result<FicRecord> {
        let file = self.file.as_mut()
            .context("Fichier non ouvert")?;

        if index >= self.header.record_count {
            anyhow::bail!("Index {} hors limites (max: {})", index, self.header.record_count);
        }

        let offset = self.header.data_offset as u64 + (index * self.header.record_length) as u64;
        
        // Vérifier que l'offset est dans les limites du fichier
        let current_pos = file.seek(SeekFrom::Current(0))
            .context("Impossible de déterminer la position actuelle")?;
        file.seek(SeekFrom::Start(offset))
            .with_context(|| format!("Impossible de se positionner à l'offset {} pour l'enregistrement {} (position actuelle: {})", offset, index, current_pos))?;

        // Lecture de l'enregistrement complet (record_length bytes)
        let mut record_buffer = vec![0u8; self.header.record_length as usize];
        let bytes_read = file.read(&mut record_buffer)
            .with_context(|| format!("Erreur lors de la lecture de l'enregistrement {} à l'offset {} (record_length: {})", index, offset, self.header.record_length))?;

        // Vérifier qu'on a lu suffisamment de données
        if bytes_read < 1 {
            anyhow::bail!("Enregistrement {} incomplet: seulement {} bytes lus sur {}", index, bytes_read, self.header.record_length);
        }

        // Le premier byte contient le flag de suppression
        let flags_byte = record_buffer[0];
        let deleted = (flags_byte & 0x01) != 0;

        // Le reste sont les données (on prend ce qui a été lu, au cas où le fichier serait tronqué)
        let data = if bytes_read > 1 {
            record_buffer[1..bytes_read].to_vec()
        } else {
            Vec::new()
        };

        // Extraction des pointeurs mémo (si présents dans les premiers bytes)
        let memo_pointers = Self::extract_memo_pointers(&data);

        Ok(FicRecord {
            id: index,
            deleted,
            data,
            memo_pointers,
        })
    }

    /**
     * Extrait les pointeurs mémo depuis les données brutes d'un enregistrement.
     * 
     * Analyse les premiers bytes des données pour détecter les pointeurs
     * vers le fichier .mmo. Cette fonction est une implémentation simplifiée
     * et peut nécessiter des ajustements selon le format réel HFSQL.
     * 
     * @param data - Données brutes de l'enregistrement
     * @returns Vec<u32> - Liste des offsets vers le fichier .mmo
     * 
     * Effets de bord : Aucun
     */
    fn extract_memo_pointers(data: &[u8]) -> Vec<u32> {
        // Hypothèse: les pointeurs mémo sont dans les 4 premiers bytes
        // À adapter selon le format réel HFSQL
        let mut pointers = Vec::new();
        if data.len() >= 4 {
            let ptr = u32::from_le_bytes([data[0], data[1], data[2], data[3]]);
            if ptr != 0 && ptr < 0xFFFFFFFF {
                pointers.push(ptr);
            }
        }
        pointers
    }

    /**
     * Lit tous les enregistrements actifs (non supprimés) du fichier.
     * 
     * Parcourt tous les enregistrements du fichier et ne retourne que
     * ceux qui ne sont pas marqués comme supprimés. Continue la lecture
     * même si certains enregistrements sont corrompus (sauf le premier).
     * 
     * @returns Result<Vec<FicRecord>> - Liste des enregistrements actifs ou erreur
     * 
     * Effets de bord :
     * - Lit tous les enregistrements depuis le fichier
     * - Peut afficher des avertissements sur stderr si des enregistrements sont corrompus
     */
    pub fn read_all_records(&mut self) -> Result<Vec<FicRecord>> {
        // Utiliser la version parallèle si le fichier est assez grand
        if self.header.record_count > 100 {
            self.read_all_records_parallel()
        } else {
            self.read_all_records_sequential()
        }
    }

    /**
     * Version séquentielle de read_all_records (pour petits fichiers).
     */
    fn read_all_records_sequential(&mut self) -> Result<Vec<FicRecord>> {
        let file = self.file.as_mut()
            .context("Fichier non ouvert")?;
        
        // Vérifier la taille du fichier
        let file_size = file.seek(SeekFrom::End(0))
            .context("Impossible de déterminer la taille du fichier")?;
        file.seek(SeekFrom::Start(0))
            .context("Impossible de revenir au début du fichier")?;
        
        let expected_size = self.header.data_offset as u64 + (self.header.record_count as u64 * self.header.record_length as u64);
        if file_size < expected_size {
            get_logger().log_with_source(LogLevel::Warn, format!("Taille du fichier ({}) inférieure à la taille attendue ({})", file_size, expected_size), Some("FIC Core".to_string()));
            get_logger().log_with_source(LogLevel::Warn, format!("  Header: data_offset={}, record_count={}, record_length={}", 
                     self.header.data_offset, self.header.record_count, self.header.record_length), Some("FIC Core".to_string()));
        }
        
        let mut records = Vec::new();
        for i in 0..self.header.record_count {
            match self.read_record(i) {
                Ok(record) => {
                    if !record.deleted {
                        records.push(record);
                    }
                }
                Err(e) => {
                    get_logger().log_with_source(LogLevel::Error, format!("Erreur lors de la lecture de l'enregistrement {}: {}", i, e), Some("FIC Core".to_string()));
                    // Pour les gros fichiers, on continue avec les enregistrements suivants
                    // au lieu de tout arrêter
                    if i == 0 {
                        // Si le premier enregistrement échoue, on propage l'erreur
                        return Err(e).with_context(|| format!("Impossible de lire le premier enregistrement (index 0)"));
                    }
                    // Sinon, on arrête la lecture mais on retourne ce qu'on a lu
                    get_logger().log_with_source(LogLevel::Warn, format!("Arrêt de la lecture après {} enregistrements valides", records.len()), Some("FIC Core".to_string()));
                    break;
                }
            }
        }
        Ok(records)
    }

    /**
     * Version parallèle de read_all_records (pour gros fichiers).
     * 
     * Lit le fichier en mémoire puis parse les enregistrements en parallèle
     * pour améliorer les performances sur les fichiers volumineux.
     * 
     * @returns Result<Vec<FicRecord>> - Liste des enregistrements actifs ou erreur
     */
    fn read_all_records_parallel(&mut self) -> Result<Vec<FicRecord>> {
        let file = self.file.as_mut()
            .context("Fichier non ouvert")?;
        
        // Vérifier la taille du fichier
        let file_size = file.seek(SeekFrom::End(0))
            .context("Impossible de déterminer la taille du fichier")?;
        file.seek(SeekFrom::Start(0))
            .context("Impossible de revenir au début du fichier")?;
        
        let expected_size = self.header.data_offset as u64 + (self.header.record_count as u64 * self.header.record_length as u64);
        if file_size < expected_size {
            get_logger().log_with_source(LogLevel::Warn, format!("Taille du fichier ({}) inférieure à la taille attendue ({})", file_size, expected_size), Some("FIC Core".to_string()));
            get_logger().log_with_source(LogLevel::Warn, format!("  Header: data_offset={}, record_count={}, record_length={}", 
                     self.header.data_offset, self.header.record_count, self.header.record_length), Some("FIC Core".to_string()));
        }

        // Lire tout le fichier en mémoire
        file.seek(SeekFrom::Start(self.header.data_offset as u64))
            .context("Impossible de se positionner au début des données")?;
        
        let data_size = (self.header.record_count as u64 * self.header.record_length as u64) as usize;
        let mut file_data = vec![0u8; data_size];
        file.read_exact(&mut file_data)
            .context("Impossible de lire toutes les données du fichier")?;

        // Extraire les informations du header pour le parsing parallèle
        let record_length = self.header.record_length as usize;
        let record_count = self.header.record_count as usize;

        // Parser les enregistrements en parallèle
        let records: Vec<Result<FicRecord>> = (0..record_count)
            .into_par_iter()
            .map(|i| {
                let offset = i * record_length;
                if offset + record_length > file_data.len() {
                    return Err(anyhow::anyhow!("Enregistrement {} hors limites", i));
                }

                let record_data = &file_data[offset..offset + record_length];
                
                // Le premier byte contient le flag de suppression
                if record_data.is_empty() {
                    return Err(anyhow::anyhow!("Enregistrement {} vide", i));
                }

                let flags_byte = record_data[0];
                let deleted = (flags_byte & 0x01) != 0;

                // Le reste sont les données
                let data = if record_data.len() > 1 {
                    record_data[1..].to_vec()
                } else {
                    Vec::new()
                };

                // Extraction des pointeurs mémo
                let memo_pointers = Self::extract_memo_pointers(&data);

                Ok(FicRecord {
                    id: i as u32,
                    deleted,
                    data,
                    memo_pointers,
                })
            })
            .collect();

        // Collecter les résultats et gérer les erreurs
        let mut valid_records = Vec::new();
        let mut first_error = None;

        for (i, result) in records.into_iter().enumerate() {
            match result {
                Ok(record) => {
                    if !record.deleted {
                        valid_records.push(record);
                    }
                }
                Err(e) => {
                    get_logger().log_with_source(LogLevel::Error, format!("Erreur lors de la lecture de l'enregistrement {}: {}", i, e), Some("FIC Core".to_string()));
                    if i == 0 {
                        first_error = Some(e);
                    } else {
                        get_logger().log_with_source(LogLevel::Warn, format!("Arrêt de la lecture après {} enregistrements valides", valid_records.len()), Some("FIC Core".to_string()));
                        break;
                    }
                }
            }
        }

        if let Some(err) = first_error {
            return Err(err).with_context(|| "Impossible de lire le premier enregistrement (index 0)");
        }

        Ok(valid_records)
    }

    /**
     * Retourne le nombre total d'enregistrements dans le fichier.
     * 
     * @returns u32 - Nombre d'enregistrements
     */
    pub fn record_count(&self) -> u32 {
        self.header.record_count
    }

    /**
     * Génère un dump hexadécimal du header du fichier.
     * 
     * Lit les 64 premiers bytes du fichier et les formate en hexadécimal
     * avec représentation ASCII pour faciliter le debug.
     * 
     * @returns String - Dump hexadécimal formaté
     * 
     * Effets de bord :
     * - Lit depuis le fichier (si possible)
     */
    pub fn dump_header_hex(&self) -> String {
        use std::fs::File;
        use std::io::Read;
        if let Ok(mut f) = File::open(&self.path) {
            let mut buffer = vec![0u8; 64];
            if f.read_exact(&mut buffer).is_ok() {
                let mut result = String::new();
                result.push_str("Header (64 premiers bytes):\n");
                for (i, chunk) in buffer.chunks(16).enumerate() {
                    let hex_str: String = chunk.iter()
                        .map(|b| format!("{:02x}", b))
                        .collect::<Vec<_>>()
                        .join(" ");
                    let ascii: String = chunk.iter()
                        .map(|&b| if b >= 32 && b < 127 { b as char } else { '.' })
                        .collect();
                    result.push_str(&format!("{:04x}: {:48} |{}|\n", i * 16, hex_str, ascii));
                }
                return result;
            }
        }
        format!("{:#?}", self.header)
    }

    /**
     * Analyse le schéma du fichier pour déduire la structure des champs.
     * 
     * Effectue une analyse basique pour déterminer les champs présents
     * dans les enregistrements. Cette implémentation est simplifiée et
     * suppose une structure fixe (ID, flags, données).
     * 
     * @returns Vec<FieldInfo> - Liste des champs détectés
     * 
     * Effets de bord : Aucun
     */
    pub fn analyze_schema(&self) -> Vec<FieldInfo> {
        // Analyse basique: on suppose des champs fixes
        // À améliorer avec une analyse plus poussée
        let mut fields = Vec::new();
        let mut offset = 0;

        // Champ ID (toujours présent)
        fields.push(FieldInfo {
            name: "id".to_string(),
            offset,
            length: 4,
            field_type: crate::core::FieldType::Integer,
        });
        offset += 4;

        // Champ flags
        fields.push(FieldInfo {
            name: "flags".to_string(),
            offset,
            length: 1,
            field_type: crate::core::FieldType::Integer,
        });
        offset += 1;

        // Reste des données comme champ binaire
        if self.header.record_length > offset as u32 {
            fields.push(FieldInfo {
                name: "data".to_string(),
                offset,
                length: self.header.record_length - offset,
                field_type: crate::core::FieldType::Binary,
            });
        }

        fields
    }
}

impl Drop for FicFile {
    fn drop(&mut self) {
        // Fermeture automatique du fichier
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;
    use tempfile::NamedTempFile;

    fn create_test_fic_file() -> Result<NamedTempFile> {
        let mut file = NamedTempFile::new()?;
        
        // Écriture d'un header de test
        let mut header_bytes = Vec::new();
        header_bytes.write_all(&0x46494300u32.to_le_bytes())?; // Magic "FIC\0"
        header_bytes.write_all(&1u16.to_le_bytes())?; // Version
        header_bytes.write_all(&100u32.to_le_bytes())?; // Record length
        header_bytes.write_all(&5u32.to_le_bytes())?; // Record count
        header_bytes.write_all(&0u32.to_le_bytes())?; // Deleted count
        header_bytes.write_all(&0u16.to_le_bytes())?; // Flags
        header_bytes.write_all(&32u32.to_le_bytes())?; // Header size
        header_bytes.write_all(&32u32.to_le_bytes())?; // Data offset
        
        // Padding jusqu'à l'offset des données
        while header_bytes.len() < 32 {
            header_bytes.push(0);
        }
        
        // Écriture de quelques enregistrements de test
        for i in 0..5 {
            header_bytes.push(0); // Flag non supprimé
            let mut record_data = vec![0u8; 99];
            record_data[0..4].copy_from_slice(&(i as u32).to_le_bytes());
            header_bytes.extend_from_slice(&record_data);
        }
        
        file.write_all(&header_bytes)?;
        file.flush()?;
        Ok(file)
    }

    #[test]
    fn test_read_header() -> Result<()> {
        let test_file = create_test_fic_file()?;
        let mut fic = FicFile::open(test_file.path())?;
        
        let header = fic.header();
        assert_eq!(header.magic, 0x46494300);
        assert_eq!(header.record_count, 5);
        assert_eq!(header.record_length, 100);
        
        Ok(())
    }

    #[test]
    fn test_read_record() -> Result<()> {
        let test_file = create_test_fic_file()?;
        let mut fic = FicFile::open(test_file.path())?;
        
        let record = fic.read_record(0)?;
        assert_eq!(record.id, 0);
        assert!(!record.deleted);
        
        Ok(())
    }

    #[test]
    fn test_read_all_records() -> Result<()> {
        let test_file = create_test_fic_file()?;
        let mut fic = FicFile::open(test_file.path())?;
        
        let records = fic.read_all_records()?;
        assert_eq!(records.len(), 5);
        
        Ok(())
    }
}