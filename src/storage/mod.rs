/**
 * Module de stockage haut niveau pour FIC Engine.
 * 
 * Ce module fournit une couche d'abstraction haut niveau pour accéder
 * aux données HFSQL. Il gère :
 * 
 * - La détection et le scan des tables dans un dossier
 * - La lecture et l'écriture d'enregistrements
 * - La conversion des données brutes en structures typées
 * - Les requêtes avec filtres et pagination
 * - La gestion des schémas de tables
 * 
 * Structure :
 * - engine.rs : Moteur de stockage principal (StorageEngine)
 * 
 * Exports :
 * - StorageEngine : Moteur principal de stockage
 * - QueryFilters, QueryResult : Structures pour les requêtes
 * - Record, FieldValue : Structures pour les données
 */

pub mod engine;

pub use engine::{QueryFilters, QueryResult, Record, StorageEngine};

