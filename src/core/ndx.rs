/**
 * Gestionnaire de fichiers .ndx (fichiers d'index HFSQL).
 * 
 * Ce fichier contient les structures et fonctions pour lire les fichiers .ndx
 * qui contiennent des index permettant de rechercher rapidement des enregistrements
 * par clé dans les fichiers .fic.
 * 
 * Structure d'un fichier .ndx (simplifiée) :
 * - Header : Magic bytes, nombre d'entrées, longueur de clé
 * - Entrées : Liste de (clé, record_id) permettant de mapper une clé à un ID d'enregistrement
 * 
 * Fonctionnalités :
 * - Lecture de l'index complet au chargement
 * - Recherche par clé
 * - Recherche par record_id
 * 
 * Note : Cette implémentation est simplifiée et suppose un format d'index linéaire.
 * Les vrais fichiers .ndx HFSQL utilisent généralement une structure B-tree.
 * 
 * Liens avec d'autres modules :
 * - Utilisé par src/storage/engine.rs pour les recherches indexées
 */

use anyhow::{Context, Result};
use byteorder::{LittleEndian, ReadBytesExt};
use serde::{Deserialize, Serialize};
use std::fs::File;
use std::io::{Read, Seek, SeekFrom};
use std::path::Path;

/// Entrée dans un index .ndx
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NdxEntry {
    /// Clé de l'index (données brutes)
    pub key: Vec<u8>,
    /// ID de l'enregistrement associé dans le fichier .fic
    pub record_id: u32,
    /// Offset de l'entrée dans le fichier .ndx
    pub offset: u64,
}

/// Gestionnaire de fichier d'index .ndx
pub struct NdxFile {
    /// Chemin du fichier
    #[allow(dead_code)]
    path: std::path::PathBuf,
    /// Handle du fichier ouvert
    #[allow(dead_code)]
    file: Option<File>,
    /// Liste de toutes les entrées de l'index (chargée en mémoire)
    entries: Vec<NdxEntry>,
}

impl NdxFile {
    /**
     * Ouvre un fichier .ndx en lecture et charge toutes les entrées.
     * 
     * @param path - Chemin vers le fichier .ndx
     * @returns Result<NdxFile> - Gestionnaire de fichier ou erreur
     * 
     * Effets de bord :
     * - Ouvre le fichier en lecture
     * - Lit toutes les entrées de l'index en mémoire
     */
    pub fn open<P: AsRef<Path>>(path: P) -> Result<Self> {
        let path = path.as_ref().to_path_buf();
        let mut file = File::open(&path)
            .with_context(|| format!("Impossible d'ouvrir le fichier: {:?}", path))?;

        // Lecture de l'index (structure simplifiée)
        let entries = Self::read_index(&mut file)?;

        Ok(Self {
            path,
            file: Some(file),
            entries,
        })
    }

    /**
     * Lit la structure d'index depuis le fichier.
     * 
     * Parse le header puis lit toutes les entrées de l'index.
     * Cette implémentation suppose un format linéaire simplifié.
     * 
     * @param reader - Reader positionné au début du fichier
     * @returns Result<Vec<NdxEntry>> - Liste des entrées de l'index
     * 
     * Effets de bord :
     * - Lit toutes les entrées depuis le reader
     */
    fn read_index<R: Read + Seek>(reader: &mut R) -> Result<Vec<NdxEntry>> {
        reader.seek(SeekFrom::Start(0))?;

        // Header hypothétique:
        // - 4 bytes: magic
        // - 4 bytes: nombre d'entrées
        // - 4 bytes: longueur de clé
        let _magic = reader.read_u32::<LittleEndian>()?;
        let entry_count = reader.read_u32::<LittleEndian>()?;
        let key_length = reader.read_u32::<LittleEndian>()?;

        let mut entries = Vec::new();
        let mut offset = 12u64; // Header size

        for _i in 0..entry_count {
            let mut key = vec![0u8; key_length as usize];
            reader.read_exact(&mut key)?;
            
            let record_id = reader.read_u32::<LittleEndian>()?;

            entries.push(NdxEntry {
                key,
                record_id,
                offset,
            });

            offset += (key_length + 4) as u64;
        }

        Ok(entries)
    }

    /**
     * Recherche une entrée par sa clé.
     * 
     * Effectue une recherche linéaire dans l'index. Pour de meilleures
     * performances, cette fonction devrait être optimisée avec une recherche
     * binaire si les entrées sont triées.
     * 
     * @param key - Clé à rechercher
     * @returns Option<&NdxEntry> - Entrée trouvée ou None
     * 
     * Effets de bord : Aucun
     */
    pub fn find(&self, key: &[u8]) -> Option<&NdxEntry> {
        // Recherche linéaire (à optimiser avec binaire si trié)
        self.entries.iter().find(|e| e.key == key)
    }

    /**
     * Retourne toutes les entrées de l'index.
     * 
     * @returns &[NdxEntry] - Référence vers toutes les entrées
     */
    pub fn entries(&self) -> &[NdxEntry] {
        &self.entries
    }

    /**
     * Recherche toutes les entrées associées à un record_id.
     * 
     * @param record_id - ID de l'enregistrement à rechercher
     * @returns Vec<&NdxEntry> - Liste des entrées trouvées (peut y en avoir plusieurs)
     * 
     * Effets de bord : Aucun
     */
    pub fn find_by_record_id(&self, record_id: u32) -> Vec<&NdxEntry> {
        self.entries.iter()
            .filter(|e| e.record_id == record_id)
            .collect()
    }
}

