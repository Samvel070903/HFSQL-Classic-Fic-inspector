/**
 * Gestionnaire de fichiers .mmo (fichiers mémo HFSQL).
 * 
 * Ce fichier contient les structures et fonctions pour lire les fichiers .mmo
 * qui contiennent les données de type mémo (texte long, blobs) référencées
 * par les enregistrements dans les fichiers .fic.
 * 
 * Structure d'un fichier .mmo :
 * - Blocs de données de taille variable
 * - Chaque bloc commence par sa longueur (4 bytes)
 * - Les données peuvent être du texte (Windows-1252 ou UTF-8) ou binaires
 * 
 * Fonctionnalités :
 * - Lecture de blocs mémo par offset
 * - Décodage automatique en texte (Windows-1252 puis UTF-8)
 * - Lecture de données brutes
 * 
 * Liens avec d'autres modules :
 * - Utilisé par src/storage/engine.rs pour lire les données mémo
 * - Les offsets sont fournis par les enregistrements FicRecord
 */

use anyhow::{Context, Result};
use byteorder::{LittleEndian, ReadBytesExt};
use encoding_rs::WINDOWS_1252;
use serde::{Deserialize, Serialize};
use std::fs::File;
use std::io::{Read, Seek, SeekFrom};
use std::path::Path;

/// Représente un bloc mémo dans un fichier .mmo
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MmoBlock {
    /// Offset du bloc dans le fichier
    pub offset: u32,
    /// Longueur du bloc en bytes
    pub length: u32,
    /// Données brutes du bloc
    pub data: Vec<u8>,
    /// Texte décodé (si le bloc contient du texte)
    pub text: Option<String>,
}

/// Gestionnaire de fichier .mmo permettant la lecture des blocs mémo
pub struct MmoFile {
    /// Chemin du fichier
    #[allow(dead_code)]
    path: std::path::PathBuf,
    /// Handle du fichier ouvert
    file: Option<File>,
}

impl MmoFile {
    /**
     * Ouvre un fichier .mmo en lecture.
     * 
     * @param path - Chemin vers le fichier .mmo
     * @returns Result<MmoFile> - Gestionnaire de fichier ou erreur
     * 
     * Effets de bord :
     * - Ouvre le fichier en lecture
     */
    pub fn open<P: AsRef<Path>>(path: P) -> Result<Self> {
        let path = path.as_ref().to_path_buf();
        let file = File::open(&path)
            .with_context(|| format!("Impossible d'ouvrir le fichier: {:?}", path))?;

        Ok(Self {
            path,
            file: Some(file),
        })
    }

    /**
     * Lit un bloc mémo à l'offset spécifié.
     * 
     * Positionne le curseur à l'offset donné, lit la longueur du bloc,
     * puis lit les données. Tente automatiquement de décoder en texte
     * (Windows-1252 puis UTF-8).
     * 
     * @param offset - Offset du bloc dans le fichier (en bytes)
     * @returns Result<MmoBlock> - Bloc mémo lu ou erreur
     * 
     * Effets de bord :
     * - Lit depuis le fichier (position modifiée)
     */
    pub fn read_block(&mut self, offset: u32) -> Result<MmoBlock> {
        let file = self.file.as_mut()
            .context("Fichier non ouvert")?;

        file.seek(SeekFrom::Start(offset as u64))?;

        // Structure hypothétique d'un bloc mémo:
        // - 4 bytes: longueur du bloc
        // - N bytes: données
        let length = file.read_u32::<LittleEndian>()?;
        
        let mut data = vec![0u8; length as usize];
        file.read_exact(&mut data)?;

        // Tentative de décodage en texte (UTF-8 ou Windows-1252)
        let text = if let Ok(utf8_str) = std::str::from_utf8(&data) {
            Some(utf8_str.to_string())
        } else {
            // Essayer Windows-1252 (CP1252) pour les fichiers français avec accents
            let (decoded, _, _) = WINDOWS_1252.decode(&data);
            Some(decoded.into_owned())
        };

        Ok(MmoBlock {
            offset,
            length,
            data,
            text,
        })
    }

    /**
     * Lit un bloc mémo et retourne uniquement le texte décodé.
     * 
     * @param offset - Offset du bloc dans le fichier
     * @returns Result<String> - Texte décodé ou erreur si le bloc n'est pas textuel
     * 
     * Effets de bord :
     * - Lit depuis le fichier
     */
    pub fn read_text(&mut self, offset: u32) -> Result<String> {
        let block = self.read_block(offset)?;
        block.text.ok_or_else(|| anyhow::anyhow!("Bloc non textuel à l'offset {}", offset))
    }

    /**
     * Lit un bloc mémo et retourne les données brutes (sans décodage).
     * 
     * @param offset - Offset du bloc dans le fichier
     * @returns Result<Vec<u8>> - Données brutes du bloc
     * 
     * Effets de bord :
     * - Lit depuis le fichier
     */
    pub fn read_raw(&mut self, offset: u32) -> Result<Vec<u8>> {
        let block = self.read_block(offset)?;
        Ok(block.data)
    }
}

impl Drop for MmoFile {
    fn drop(&mut self) {
        // Fermeture automatique
    }
}

