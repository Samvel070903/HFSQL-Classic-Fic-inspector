/**
 * Implémentation des commandes CLI pour FIC Engine.
 * 
 * Ce fichier contient l'implémentation des différentes commandes disponibles
 * dans l'interface en ligne de commande :
 * 
 * - scan_tables : Détecte et liste les tables HFSQL dans un dossier
 * - export_table : Exporte les données d'une table vers JSON ou CSV
 * - debug_file : Affiche des informations de debug sur un fichier
 * 
 * Liens avec d'autres modules :
 * - Utilise src/storage/engine.rs pour accéder aux données
 * - Utilise src/core/ pour analyser les fichiers bruts
 */

use anyhow::Result;
use crate::storage::StorageEngine;
use crate::storage::engine::QueryFilters;
use std::fs::File;
use std::io::Write;
use std::path::PathBuf;
use tracing::info;

/**
 * Scanne un dossier et affiche les tables HFSQL trouvées.
 * 
 * Détecte tous les fichiers .fic dans le dossier spécifié, les associe
 * avec leurs fichiers .mmo et .ndx correspondants, puis affiche les
 * informations sur chaque table (nom, longueur d'enregistrement, nombre de champs).
 * 
 * @param path - Chemin du dossier à scanner
 * @returns Result<()> - Succès si le scan s'est bien déroulé, erreur sinon
 * 
 * Effets de bord :
 * - Lit les fichiers du système de fichiers
 * - Affiche des informations sur stdout
 */
pub async fn scan_tables(path: PathBuf) -> Result<()> {
    let engine = StorageEngine::new(&path, true)?;
    let tables = engine.scan_tables()?;

    println!("Tables trouvées: {}", tables.len());
    for table in &tables {
        println!("  - {}", table);
        
        if let Ok(schema) = engine.get_schema(table) {
            println!("    Record length: {} bytes", schema.record_length);
            println!("    Fields: {}", schema.field_count);
        }
    }

    Ok(())
}

/**
 * Exporte une table vers un fichier JSON ou CSV.
 * 
 * Lit tous les enregistrements de la table spécifiée et les exporte
 * dans le format demandé (JSON ou CSV). Si aucun fichier de sortie
 * n'est spécifié, les données sont écrites sur stdout.
 * 
 * @param engine - Moteur de stockage contenant les données
 * @param table - Nom de la table à exporter
 * @param format - Format d'export ("json" ou "csv")
 * @param output - Chemin du fichier de sortie (None = stdout)
 * @returns Result<()> - Succès si l'export s'est bien déroulé, erreur sinon
 * 
 * Effets de bord :
 * - Lit les données depuis les fichiers .fic/.mmo
 * - Écrit les données dans un fichier ou sur stdout
 */
pub async fn export_table(
    engine: StorageEngine,
    table: String,
    format: String,
    output: Option<PathBuf>,
) -> Result<()> {
    info!("Export de la table '{}' au format {}", table, format);

    let filters = QueryFilters {
        limit: None,
        offset: None,
        field_filters: std::collections::HashMap::new(),
    };

    let result = engine.select(&table, filters)?;

    match format.as_str() {
        "json" => {
            let json = serde_json::to_string_pretty(&result.records)?;
            if let Some(output_path) = output {
                std::fs::write(&output_path, json)?;
                println!("Exporté vers: {:?}", output_path);
            } else {
                println!("{}", json);
            }
        }
        "csv" => {
            let writer: Box<dyn Write> = if let Some(output_path) = &output {
                Box::new(File::create(output_path)?)
            } else {
                Box::new(std::io::stdout())
            };

            let mut wtr = csv::Writer::from_writer(writer);
            
            // En-têtes (simplifié)
            wtr.write_record(&["id"])?;
            
            for record in &result.records {
                wtr.write_record(&[record.id.to_string()])?;
            }
            
            wtr.flush()?;
            
            if let Some(output_path) = output {
                println!("Exporté vers: {:?}", output_path);
            }
        }
        _ => {
            anyhow::bail!("Format non supporté: {}", format);
        }
    }

    Ok(())
}

/**
 * Affiche des informations de debug sur un fichier HFSQL.
 * 
 * Analyse un fichier .fic, .mmo ou .ndx et affiche des informations
 * selon le type de dump demandé :
 * - "header" : Affiche les informations du header
 * - "hex" : Affiche un dump hexadécimal des 64 premiers bytes
 * - "raw" : Affiche un dump hexadécimal complet du header
 * - "records" : Affiche les premiers enregistrements
 * 
 * @param file - Chemin du fichier à analyser
 * @param dump - Type de dump à effectuer (header, hex, raw, records)
 * @returns Result<()> - Succès si l'analyse s'est bien déroulée, erreur sinon
 * 
 * Effets de bord :
 * - Lit le fichier depuis le système de fichiers
 * - Affiche des informations sur stdout
 */
pub async fn debug_file(file: PathBuf, dump: String) -> Result<()> {
    if let Some(ext) = file.extension() {
        let ext_lower = ext.to_string_lossy().to_lowercase();
        match ext_lower.as_str() {
            "fic" => {
                let mut fic = crate::core::FicFile::open(&file)?;
                match dump.as_str() {
                    "header" => {
                        println!("{:#?}", fic.header());
                    }
                    "hex" => {
                        // Dump hexadécimal des 64 premiers bytes
                        use std::fs::File;
                        use std::io::Read;
                        let mut f = File::open(&file)?;
                        let mut buffer = vec![0u8; 64];
                        f.read_exact(&mut buffer)?;
                        println!("Premiers 64 bytes (hex):");
                        for (i, chunk) in buffer.chunks(16).enumerate() {
                            let hex_str: String = chunk.iter()
                                .map(|b| format!("{:02x}", b))
                                .collect::<Vec<_>>()
                                .join(" ");
                            let ascii: String = chunk.iter()
                                .map(|&b| if b >= 32 && b < 127 { b as char } else { '.' })
                                .collect();
                            println!("{:04x}: {:48} |{}|", i * 16, hex_str, ascii);
                        }
                    }
                    "raw" => {
                        // Dump hexadécimal complet du header
                        println!("{}", fic.dump_header_hex());
                    }
                    "records" => {
                        let records = fic.read_all_records()?;
                        println!("Nombre d'enregistrements: {}", records.len());
                        for (i, record) in records.iter().take(10).enumerate() {
                            println!("Record {}: {:?}", i, record);
                        }
                    }
                    _ => {
                        anyhow::bail!("Type de dump inconnu: {}. Options: header, hex, raw, records", dump);
                    }
                }
            }
            "mmo" => {
                let _mmo = crate::core::MmoFile::open(&file)?;
                println!("Fichier .mmo ouvert: {:?}", file);
                // TODO: Dump du contenu
            }
            "ndx" => {
                let ndx = crate::core::NdxFile::open(&file)?;
                println!("Entrées dans l'index: {}", ndx.entries().len());
                for entry in ndx.entries().iter().take(10) {
                    println!("  Key: {:?}, Record ID: {}", entry.key, entry.record_id);
                }
            }
            _ => {
                anyhow::bail!("Extension de fichier non supportée: {:?}", ext);
            }
        }
    } else {
        anyhow::bail!("Fichier sans extension: {:?}", file);
    }

    Ok(())
}

