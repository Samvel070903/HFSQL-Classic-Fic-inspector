import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Play, Loader2, CheckCircle2, AlertCircle, Copy, Trash2, Database, RefreshCw, FolderOpen, Settings as SettingsIcon, Edit2, X, FileText, Download } from 'lucide-react';
import { Link } from 'react-router-dom';
import { apiClient } from '../services/apiClient';
import { dsnService, DSN } from '../services/dsnService';
import FolderPicker from '../components/FolderPicker';
import SqlAutocomplete from '../components/SqlAutocomplete';
import { useSqlAutocomplete } from '../hooks/useSqlAutocomplete';
import { exportSqlResults } from '../services/exportService';
import toast, { Toaster } from 'react-hot-toast';

interface SqlResponse {
  success: boolean;
  data?: {
    columns: string[];
    rows: any[];
  };
  error?: string;
  rows_affected?: number;
}

const Odbc: React.FC = () => {
  const [sqlQuery, setSqlQuery] = useState('SELECT * FROM ');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SqlResponse | null>(null);
  const [queryHistory, setQueryHistory] = useState<string[]>([]);
  const [availableDsns, setAvailableDsns] = useState<DSN[]>([]);
  const [dsn, setDsn] = useState<string>('');
  const [customDsn, setCustomDsn] = useState<string>('');
  const [useCustomDsn, setUseCustomDsn] = useState(false);
  const [limit, setLimit] = useState<number | null>(100);
  const [tables, setTables] = useState<string[]>([]);
  const [selectedTables, setSelectedTables] = useState<Set<string>>(new Set());
  const [relations, setRelations] = useState<Array<{ from_table: string; from_column: string; to_table: string; to_column: string }>>([]);
  const [loadingTables, setLoadingTables] = useState(false);
  const [loadingRelations, setLoadingRelations] = useState(false);
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [useLocalFolder, setUseLocalFolder] = useState(false);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const [showFolderPicker, setShowFolderPicker] = useState(false);
  
  // Cache pour mémoriser le format de nom de table qui fonctionne (par table et DSN)
  const [tableFormatCache, setTableFormatCache] = useState<Map<string, string>>(new Map());
  
  // États pour la modification de valeurs
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editCell, setEditCell] = useState<{
    table: string;
    column: string;
    currentValue: any;
    newValue: string;
    row: any;
    rowIndex: number;
    allColumns: string[];
  } | null>(null);
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [updating, setUpdating] = useState(false);
  
  // États pour le redimensionnement
  const [historyWidth, setHistoryWidth] = useState(256); // 64 * 4 (w-64 = 256px)
  const [tablesSectionHeight, setTablesSectionHeight] = useState(400);
  const [tablesColumnWidth, setTablesColumnWidth] = useState(50); // Pourcentage
  const [isResizingHistory, setIsResizingHistory] = useState(false);
  const [isResizingTables, setIsResizingTables] = useState(false);
  const [isResizingTablesColumns, setIsResizingTablesColumns] = useState(false);
  
  // États pour l'autocomplétion SQL
  const [cursorPosition, setCursorPosition] = useState(0);
  const [autocompleteSelectedIndex, setAutocompleteSelectedIndex] = useState(0);
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const [autocompletePosition, setAutocompletePosition] = useState({ top: 0, left: 0 });
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  
  // Utiliser le hook d'autocomplétion
  const { suggestions, hasSuggestions } = useSqlAutocomplete(
    sqlQuery,
    cursorPosition,
    tables
  );

  // Charger les DSN disponibles
  useEffect(() => {
    loadDSNs();
    
    // Écouter les changements de DSN (si la page de gestion DSN est utilisée)
    const handleStorageChange = () => {
      loadDSNs();
    };
    window.addEventListener('storage', handleStorageChange);
    // Également écouter les événements personnalisés pour les changements dans le même onglet
    window.addEventListener('dsnUpdated', handleStorageChange);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('dsnUpdated', handleStorageChange);
    };
  }, []);

  const loadDSNs = async () => {
    try {
      // Récupérer les DSN depuis le backend (DSN ODBC réels Windows)
      const dsns = await dsnService.getAllFromBackend();
      setAvailableDsns(dsns);
      
      // Si aucun DSN n'est sélectionné et qu'il y a des DSN disponibles, sélectionner le premier
      if (!dsn && dsns.length > 0 && !useCustomDsn) {
        setDsn(dsns[0].name);
      }
      // Si le DSN actuellement sélectionné n'existe plus dans la liste, sélectionner le premier disponible
      else if (dsn && dsns.length > 0 && !useCustomDsn) {
        const currentDsnExists = dsns.some(d => d.name === dsn);
        if (!currentDsnExists) {
          setDsn(dsns[0].name);
        }
      }
    } catch (error) {
      console.error('Erreur lors du chargement des DSN:', error);
      // Fallback sur localStorage si le backend n'est pas disponible
      const dsns = dsnService.getAll();
      setAvailableDsns(dsns);
      
      if (!dsn && dsns.length > 0 && !useCustomDsn) {
        setDsn(dsns[0].name);
      }
    }
  };

  // Obtenir le DSN actuel (configuré ou personnalisé)
  const getCurrentDsn = (): string => {
    return useCustomDsn ? customDsn : dsn;
  };

  // Ajoute ou modifie la clause LIMIT dans une requête SELECT
  const applyLimitToQuery = (query: string, limitValue: number | null): string => {
    if (!limitValue) return query;
    
    const trimmedQuery = query.trim();
    const upperQuery = trimmedQuery.toUpperCase();
    
    // Vérifier si c'est une requête SELECT
    if (!upperQuery.startsWith('SELECT')) {
      return query;
    }
    
    // Vérifier si LIMIT existe déjà
    const limitRegex = /\bLIMIT\s+\d+/gi;
    if (limitRegex.test(trimmedQuery)) {
      // Remplacer le LIMIT existant
      return trimmedQuery.replace(limitRegex, `LIMIT ${limitValue}`);
    }
    
    // Vérifier s'il y a un OFFSET sans LIMIT
    const offsetRegex = /\bOFFSET\s+\d+/gi;
    if (offsetRegex.test(trimmedQuery)) {
      // Insérer LIMIT avant OFFSET
      return trimmedQuery.replace(offsetRegex, `LIMIT ${limitValue} $&`);
    }
    
    // Ajouter LIMIT à la fin
    return `${trimmedQuery} LIMIT ${limitValue}`;
  };

  const executeQuery = async () => {
    if (!sqlQuery.trim()) return;

    setLoading(true);
    setResult(null);

    try {
      // Appliquer la limite si elle est définie
      const finalQuery = applyLimitToQuery(sqlQuery, limit);
      const currentDsn = getCurrentDsn();
      if (!currentDsn) {
        setResult({
          success: false,
          error: 'Aucun DSN sélectionné. Veuillez sélectionner un DSN ou en créer un.',
        });
        setLoading(false);
        return;
      }
      // Détecter l'environnement pour le diagnostic
      const isElectron = typeof window !== 'undefined' && (window as any).electronAPI;
      console.log(`[${isElectron ? 'Electron' : 'Web'}] Exécution de la requête:`, {
        query: finalQuery.substring(0, 200),
        dsn: currentDsn,
        limit
      });
      
      // Vérifier si on a un format mémorisé pour cette table
      const tableName = extractTableName(finalQuery);
      let queryToExecute = finalQuery;
      
      if (tableName && currentDsn) {
        const cacheKey = `${currentDsn}:${tableName}`;
        const cachedFormat = tableFormatCache.get(cacheKey);
        
        if (cachedFormat && cachedFormat !== tableName) {
          // Utiliser le format mémorisé
          console.log(`[${isElectron ? 'Electron' : 'Web'}] 📦 Utilisation du format mémorisé pour ${cacheKey}: ${cachedFormat}`);
          queryToExecute = finalQuery.replace(new RegExp(`FROM\\s+${tableName}`, 'i'), `FROM ${cachedFormat}`);
        }
      }
      
      let response = await apiClient.executeSql(queryToExecute, currentDsn);
      
      // Si erreur, essayer automatiquement avec des variantes de nom de table
      if (!response.success && response.error) {
        console.log(`[${isElectron ? 'Electron' : 'Web'}] Erreur détectée:`, response.error);
        const tableName = extractTableName(finalQuery);
        
        if (tableName) {
          console.log(`[${isElectron ? 'Electron' : 'Web'}] Table détectée: "${tableName}", essai de variantes...`);
          
          // Essayer automatiquement avec différentes variantes
          const variants = tryTableVariants(finalQuery, tableName);
          let triedVariants = false;
          let lastError = response.error;
          
          for (const variant of variants) {
            console.log(`[${isElectron ? 'Electron' : 'Web'}] Tentative avec variante: ${variant.substring(0, 200)}`);
            try {
              const variantResponse = await apiClient.executeSql(variant, currentDsn);
              
            if (variantResponse.success) {
              // Succès avec une variante !
              console.log(`[${isElectron ? 'Electron' : 'Web'}] ✅ Succès avec la variante: ${variant.substring(0, 200)}`);
              
              // Mémoriser le format qui fonctionne pour cette table et ce DSN
              const cacheKey = `${currentDsn}:${tableName}`;
              const variantTableName = extractTableName(variant);
              if (variantTableName && variantTableName !== tableName) {
                // Le format avec guillemets/backticks fonctionne
                const newCache = new Map(tableFormatCache);
                newCache.set(cacheKey, variantTableName);
                setTableFormatCache(newCache);
                console.log(`[${isElectron ? 'Electron' : 'Web'}] 💾 Format mémorisé pour ${cacheKey}: ${variantTableName}`);
              }
              
              setResult(variantResponse);
              
              // Mettre à jour la requête dans l'éditeur avec la variante qui fonctionne
              const originalQueryWithoutLimit = sqlQuery.replace(/\s+LIMIT\s+\d+/i, '');
              const variantWithoutLimit = variant.replace(/\s+LIMIT\s+\d+/i, '');
              if (variantWithoutLimit !== originalQueryWithoutLimit) {
                setSqlQuery(variantWithoutLimit);
              }
              
              // Ajouter à l'historique
              if (!queryHistory.includes(variantWithoutLimit)) {
                setQueryHistory(prev => [variantWithoutLimit, ...prev.slice(0, 9)]);
              }
              
              setLoading(false);
              return;
            } else {
                lastError = variantResponse.error || lastError;
                console.log(`[${isElectron ? 'Electron' : 'Web'}] ❌ Variante échouée:`, variantResponse.error);
              }
            } catch (variantError: any) {
              console.error(`[${isElectron ? 'Electron' : 'Web'}] ❌ Exception avec variante:`, variantError);
              lastError = variantError.message || lastError;
            }
            triedVariants = true;
          }
          
          // Si aucune variante n'a fonctionné, afficher l'erreur avec suggestions
          if (triedVariants) {
            const isElectron = typeof window !== 'undefined' && (window as any).electronAPI;
            let enhancedError = lastError || response.error;
            enhancedError += `\n\n💡 J'ai essayé automatiquement ${variants.length} variantes mais aucune n'a fonctionné:`;
            variants.forEach((variant, idx) => {
              enhancedError += `\n${idx + 1}. ${variant.substring(0, 150)}${variant.length > 150 ? '...' : ''}`;
            });
            enhancedError += `\n\nVérifiez que la table "${tableName}" existe et que vous avez les permissions nécessaires.`;
            enhancedError += `\n\n🔍 Environnement: ${isElectron ? 'Electron' : 'Navigateur Web'}`;
            
            setResult({
              success: false,
              error: enhancedError,
            });
          } else {
            setResult({
              success: false,
              error: response.error,
            });
          }
        } else {
          setResult({
            success: false,
            error: response.error,
          });
        }
      } else {
        setResult(response);
      }
      
      // Ajouter à l'historique si succès (avec la requête originale, pas celle avec LIMIT)
      if (response.success && !queryHistory.includes(sqlQuery)) {
        setQueryHistory(prev => [sqlQuery, ...prev.slice(0, 9)]); // Garder les 10 dernières
      }
    } catch (error: any) {
      console.error('Erreur lors de l\'exécution de la requête:', error);
      console.error('Détails complets:', {
        response: error.response?.data,
        status: error.response?.status,
        statusText: error.response?.statusText,
        message: error.message,
        config: error.config
      });
      
      // Extraire le message d'erreur détaillé
      let errorMessage = 'Erreur lors de l\'exécution de la requête';
      
      if (error.response?.data?.error) {
        errorMessage = error.response.data.error;
      } else if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      // Ajouter des informations supplémentaires
      const details: string[] = [];
      if (error.response?.status) {
        details.push(`Code HTTP: ${error.response.status}`);
      }
      if (error.response?.statusText) {
        details.push(`Status: ${error.response.statusText}`);
      }
      if (details.length > 0) {
        errorMessage += `\n(${details.join(', ')})`;
      }
      
      // Suggérer des solutions pour les erreurs de table
      const tableMatch = sqlQuery.match(/FROM\s+([a-zA-Z_][a-zA-Z0-9_]*)/i);
      if (tableMatch) {
        const tableName = tableMatch[1];
        errorMessage += `\n\n💡 Suggestion: Essayez avec des guillemets autour du nom de table:\nSELECT * FROM "${tableName}" LIMIT 100\nou\nSELECT * FROM \`${tableName}\` LIMIT 100`;
      }
      
      setResult({
        success: false,
        error: errorMessage,
      });
    } finally {
      setLoading(false);
    }
  };

  // Calculer la position de l'autocomplétion
  const updateAutocompletePosition = useCallback(() => {
    if (!textareaRef.current) return;
    
    const textarea = textareaRef.current;
    const textBeforeCursor = sqlQuery.substring(0, cursorPosition);
    const lines = textBeforeCursor.split('\n');
    const currentLineIndex = lines.length - 1;
    const currentLineText = lines[currentLineIndex] || '';
    
    // Obtenir les styles du textarea
    const computedStyle = window.getComputedStyle(textarea);
    const font = computedStyle.font;
    const fontSize = computedStyle.fontSize;
    const fontFamily = computedStyle.fontFamily;
    const lineHeight = parseFloat(computedStyle.lineHeight) || parseFloat(fontSize) * 1.2;
    const paddingLeft = parseFloat(computedStyle.paddingLeft) || 16;
    const paddingTop = parseFloat(computedStyle.paddingTop) || 16;
    const borderLeft = parseFloat(computedStyle.borderLeftWidth) || 0;
    const borderTop = parseFloat(computedStyle.borderTopWidth) || 0;
    
    // Créer un élément temporaire pour mesurer le texte avec les mêmes styles
    const measureDiv = document.createElement('div');
    measureDiv.style.position = 'absolute';
    measureDiv.style.visibility = 'hidden';
    measureDiv.style.whiteSpace = 'pre';
    measureDiv.style.font = font;
    measureDiv.style.fontSize = fontSize;
    measureDiv.style.fontFamily = fontFamily;
    measureDiv.style.padding = '0';
    measureDiv.style.margin = '0';
    measureDiv.style.border = 'none';
    measureDiv.style.wordWrap = 'normal';
    measureDiv.style.overflow = 'hidden';
    
    // Mesurer le texte jusqu'au curseur
    measureDiv.textContent = currentLineText;
    document.body.appendChild(measureDiv);
    
    const textWidth = measureDiv.offsetWidth;
    document.body.removeChild(measureDiv);
    
    // Obtenir la position du textarea
    const textareaRect = textarea.getBoundingClientRect();
    
    // Calculer la position verticale (ligne actuelle)
    const topPosition = 
      textareaRect.top + 
      borderTop + 
      paddingTop + 
      (currentLineIndex * lineHeight) + 
      lineHeight; // Position juste en dessous de la ligne actuelle
    
    // Calculer la position horizontale (position du curseur dans la ligne)
    const leftPosition = 
      textareaRect.left + 
      borderLeft + 
      paddingLeft + 
      textWidth;
    
    setAutocompletePosition({
      top: topPosition,
      left: leftPosition,
    });
  }, [sqlQuery, cursorPosition]);

  // Gérer la sélection d'une suggestion
  const handleSelectSuggestion = useCallback((suggestion: { value: string }) => {
    if (!textareaRef.current) return;
    
    const textBefore = sqlQuery.substring(0, cursorPosition);
    const textAfter = sqlQuery.substring(cursorPosition);
    
    // Trouver le début du mot actuel
    const wordsBefore = textBefore.split(/\s+/);
    const currentWord = wordsBefore[wordsBefore.length - 1] || '';
    const wordStart = textBefore.lastIndexOf(currentWord);
    
    // Remplacer le mot actuel par la suggestion
    const newText = 
      sqlQuery.substring(0, wordStart) + 
      suggestion.value + 
      textAfter;
    
    setSqlQuery(newText);
    
    // Repositionner le curseur après la suggestion
    const newCursorPos = wordStart + suggestion.value.length;
    setCursorPosition(newCursorPos);
    
    // Mettre à jour le curseur du textarea
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.setSelectionRange(newCursorPos, newCursorPos);
        textareaRef.current.focus();
      }
    }, 0);
    
    setShowAutocomplete(false);
  }, [sqlQuery, cursorPosition]);

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setSqlQuery(e.target.value);
    const newCursorPos = e.target.selectionStart;
    setCursorPosition(newCursorPos);
    
    // Afficher l'autocomplétion si on a des suggestions
    if (hasSuggestions && e.target.value.length > 0) {
      // Utiliser requestAnimationFrame pour s'assurer que le DOM est mis à jour
      requestAnimationFrame(() => {
        updateAutocompletePosition();
      });
      setShowAutocomplete(true);
    } else {
      setShowAutocomplete(false);
    }
  };

  const handleTextareaSelect = (e: React.SyntheticEvent<HTMLTextAreaElement>) => {
    const target = e.target as HTMLTextAreaElement;
    const newCursorPos = target.selectionStart;
    setCursorPosition(newCursorPos);
    
    // Mettre à jour la position de l'autocomplétion
    requestAnimationFrame(() => {
      updateAutocompletePosition();
    });
  };

  // Mettre à jour la position lors du scroll
  useEffect(() => {
    if (!textareaRef.current || !showAutocomplete) return;
    
    const textarea = textareaRef.current;
    const handleScroll = () => {
      updateAutocompletePosition();
    };
    
    textarea.addEventListener('scroll', handleScroll);
    window.addEventListener('resize', handleScroll);
    
    return () => {
      textarea.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleScroll);
    };
  }, [showAutocomplete, updateAutocompletePosition]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Gérer l'autocomplétion
    if (showAutocomplete && hasSuggestions) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setAutocompleteSelectedIndex(prev => 
          prev < suggestions.length - 1 ? prev + 1 : prev
        );
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setAutocompleteSelectedIndex(prev => prev > 0 ? prev - 1 : 0);
        return;
      }
      if (e.key === 'Enter' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        handleSelectSuggestion(suggestions[autocompleteSelectedIndex]);
        return;
      }
      if (e.key === 'Tab') {
        e.preventDefault();
        handleSelectSuggestion(suggestions[autocompleteSelectedIndex]);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setShowAutocomplete(false);
        return;
      }
    }
    
    // Exécuter la requête avec Ctrl+Entrée
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      setShowAutocomplete(false);
      executeQuery();
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const formatValue = (value: any): string => {
    if (value === null || value === undefined) return 'NULL';
    if (typeof value === 'object' && value.type) {
      return value.value?.toString() || 'NULL';
    }
    return String(value);
  };

  // Extraire le nom de la table depuis une requête SELECT
  const extractTableName = (query: string): string | null => {
    // Essayer d'extraire le nom de table après FROM
    // Gérer les cas avec ou sans alias
    const fromMatch = query.match(/FROM\s+([a-zA-Z_][a-zA-Z0-9_]*)/i);
    if (fromMatch) {
      return fromMatch[1];
    }
    
    // Essayer avec des backticks ou des crochets (pour les noms avec espaces)
    const fromMatch2 = query.match(/FROM\s+[`\[\]]?([a-zA-Z_][a-zA-Z0-9_]*)[`\[\]]?/i);
    if (fromMatch2) {
      return fromMatch2[1];
    }
    
    return null;
  };

  // Essayer différentes variantes de nom de table avec guillemets/backticks
  const tryTableVariants = (query: string, tableName: string): string[] => {
    const variants: string[] = [];
    
    // Variante avec guillemets doubles
    variants.push(query.replace(new RegExp(`FROM\\s+${tableName}`, 'i'), `FROM "${tableName}"`));
    
    // Variante avec backticks
    variants.push(query.replace(new RegExp(`FROM\\s+${tableName}`, 'i'), `FROM \`${tableName}\``));
    
    // Variante avec crochets (SQL Server)
    variants.push(query.replace(new RegExp(`FROM\\s+${tableName}`, 'i'), `FROM [${tableName}]`));
    
    // Variante en minuscules
    variants.push(query.replace(new RegExp(`FROM\\s+${tableName}`, 'i'), `FROM ${tableName.toLowerCase()}`));
    
    // Variante en majuscules
    variants.push(query.replace(new RegExp(`FROM\\s+${tableName}`, 'i'), `FROM ${tableName.toUpperCase()}`));
    
    return variants;
  };

  // Gérer le clic sur une cellule pour la modifier
  const handleCellClick = (row: any, column: string, rowIndex: number, allColumns: string[]) => {
    // Vérifier que c'est une requête SELECT
    const upperQuery = sqlQuery.trim().toUpperCase();
    if (!upperQuery.startsWith('SELECT')) {
      return;
    }

    const tableName = extractTableName(sqlQuery);
    if (!tableName) {
      return;
    }

    const currentValue = row[column];
    setEditCell({
      table: tableName,
      column,
      currentValue,
      newValue: formatValue(currentValue),
      row,
      rowIndex,
      allColumns,
    });
    setEditModalOpen(true);
  };

  // Vérifier si une valeur est un nombre
  const isNumericValue = (value: any): boolean => {
    if (value === null || value === undefined) return false;
    const str = String(value).trim();
    if (str === '') return false;
    return /^-?\d+(\.\d+)?$/.test(str);
  };

  // Générer la clause WHERE pour identifier la ligne
  // excludeColumn: colonne à exclure de la clause WHERE (celle qu'on modifie)
  const generateWhereClause = (row: any, columns: string[], excludeColumn?: string): string => {
    // Filtrer les colonnes à utiliser (exclure celle qu'on modifie)
    const columnsToUse = excludeColumn 
      ? columns.filter(col => col !== excludeColumn)
      : columns;

    // Priorité 1: Essayer d'utiliser une clé primaire ou un identifiant unique
    // D'abord, chercher des colonnes qui ressemblent à des clés primaires par leur nom
    const idColumnPatterns = [
      /^id$/i, /^pk$/i, /^primary_key$/i,
      /^.*num$/i,  // Colonnes se terminant par "num" (clnum, usernum, etc.)
      /^.*id$/i,    // Colonnes se terminant par "id" (userid, clientid, etc.)
      /^code$/i, /^ref$/i, /^reference$/i
    ];
    
    // Chercher d'abord les colonnes qui correspondent aux patterns
    for (const col of columnsToUse) {
      if (idColumnPatterns.some(pattern => pattern.test(col))) {
        const value = row[col];
        if (value !== null && value !== undefined && value !== '') {
          const formattedValue = formatValue(value);
          if (formattedValue === 'NULL') {
            continue; // Passer à la suivante si NULL
          }
          // Vérifier si c'est un nombre
          if (isNumericValue(value)) {
            return `${col} = ${formattedValue}`;
          }
          return `${col} = '${formattedValue.replace(/'/g, "''")}'`;
        }
      }
    }
    
    // Ensuite, chercher les colonnes exactes dans la liste
    const exactIdColumns = ['id', 'ID', 'Id', 'pk', 'PK', 'primary_key'];
    for (const col of exactIdColumns) {
      if (columnsToUse.includes(col)) {
        const value = row[col];
        if (value !== null && value !== undefined && value !== '') {
          const formattedValue = formatValue(value);
          if (formattedValue === 'NULL') {
            continue;
          }
          if (isNumericValue(value)) {
            return `${col} = ${formattedValue}`;
          }
          return `${col} = '${formattedValue.replace(/'/g, "''")}'`;
        }
      }
    }

    // Priorité 2: Utiliser les premières colonnes non-nulles (maximum 5 pour éviter une clause WHERE trop longue)
    const nonNullColumns = columnsToUse
      .filter(col => {
        const value = row[col];
        return value !== null && value !== undefined && value !== '';
      })
      .slice(0, 5); // Limiter à 5 colonnes maximum

    if (nonNullColumns.length > 0) {
      const conditions = nonNullColumns.map(col => {
        const value = row[col];
        const formattedValue = formatValue(value);
        if (formattedValue === 'NULL') {
          return `${col} IS NULL`;
        }
        // Vérifier si c'est un nombre
        if (isNumericValue(value)) {
          return `${col} = ${formattedValue}`;
        }
        return `${col} = '${formattedValue.replace(/'/g, "''")}'`;
      });
      return conditions.join(' AND ');
    }

    // Priorité 3: Si vraiment nécessaire, utiliser toutes les colonnes (même NULL)
    // Mais limiter à 10 colonnes maximum pour éviter une clause WHERE trop longue
    const limitedColumns = columnsToUse.slice(0, 10);
    return limitedColumns.map(col => {
      const value = row[col];
      const formattedValue = formatValue(value);
      if (formattedValue === 'NULL') {
        return `${col} IS NULL`;
      }
      if (isNumericValue(value)) {
        return `${col} = ${formattedValue}`;
      }
      return `${col} = '${formattedValue.replace(/'/g, "''")}'`;
    }).join(' AND ');
  };

  // Vérifier si une chaîne est un nombre valide
  const isNumeric = (str: string): boolean => {
    if (str.trim() === '') return false;
    // Vérifier si c'est un nombre entier ou décimal
    return /^-?\d+(\.\d+)?$/.test(str.trim());
  };

  // Confirmer et exécuter la modification
  const handleConfirmUpdate = async () => {
    if (!editCell) return;

    setUpdating(true);
    try {
      // Exclure la colonne qu'on modifie de la clause WHERE
      const whereClause = generateWhereClause(editCell.row, editCell.allColumns, editCell.column);
      
      // Gérer les valeurs NULL et les nombres
      let valuePart: string;
      const trimmedValue = editCell.newValue.trim();
      
      if (trimmedValue.toUpperCase() === 'NULL' || trimmedValue === '') {
        valuePart = 'NULL';
      } else if (isNumeric(trimmedValue)) {
        // C'est un nombre (entier ou décimal)
        valuePart = trimmedValue;
      } else {
        // C'est une chaîne
        const escapedValue = trimmedValue.replace(/'/g, "''");
        valuePart = `'${escapedValue}'`;
      }
      
      const updateQuery = `UPDATE ${editCell.table} SET ${editCell.column} = ${valuePart} WHERE ${whereClause}`;

      // Log pour le débogage
      console.log('Requête UPDATE générée:', updateQuery);
      console.log('Clause WHERE:', whereClause);
      console.log('Nouvelle valeur:', valuePart);

      const currentDsn = getCurrentDsn();
      if (!currentDsn) {
        setResult({
          success: false,
          error: 'Aucun DSN sélectionné',
        });
        setUpdating(false);
        setConfirmModalOpen(false);
        setEditModalOpen(false);
        return;
      }

      const response = await apiClient.executeSql(updateQuery, currentDsn);
      
      console.log('Réponse UPDATE:', response);
      
      if (response.success) {
        // Note: Le backend ODBC retourne toujours rows_affected: 0 pour les UPDATE
        // car la récupération du nombre de lignes affectées n'est pas encore implémentée.
        // On considère donc que si success: true, la modification a réussi.
        const rowsAffected = response.rows_affected;
        console.log('Lignes affectées:', rowsAffected);
        
        // Réexécuter la requête SELECT pour rafraîchir les résultats et vérifier que la modification a bien eu lieu
        const finalQuery = applyLimitToQuery(sqlQuery, limit);
        console.log('Réexécution de la requête SELECT:', finalQuery);
        
        const refreshResponse = await apiClient.executeSql(finalQuery, currentDsn);
        console.log('Réponse SELECT après UPDATE:', refreshResponse);
        
        if (refreshResponse.success) {
          // Vérifier si la valeur a vraiment changé dans les résultats rafraîchis
          const newRow = refreshResponse.data?.rows?.[editCell.rowIndex];
          if (newRow) {
            const newValue = formatValue(newRow[editCell.column]);
            const expectedValue = editCell.newValue.trim();
            
            // Comparer les valeurs (en tenant compte des types)
            const valuesMatch = newValue === expectedValue || 
                               (isNumeric(newValue) && isNumeric(expectedValue) && 
                                parseFloat(newValue) === parseFloat(expectedValue));
            
            if (valuesMatch) {
              // La modification a réussi, afficher les résultats rafraîchis
              setResult(refreshResponse);
            } else {
              // La valeur n'a pas changé, peut-être que la clause WHERE n'a pas trouvé de correspondance
              setResult({
                success: false,
                error: `La valeur n'a pas été modifiée. La clause WHERE n'a peut-être pas trouvé de correspondance.\nRequête: ${updateQuery}\nValeur attendue: ${expectedValue}, Valeur actuelle: ${newValue}`,
              });
              setUpdating(false);
              setConfirmModalOpen(false);
              return;
            }
          } else {
            // Impossible de trouver la ligne dans les résultats rafraîchis
            // Mais on affiche quand même les résultats (peut-être que la ligne a été déplacée)
            setResult(refreshResponse);
          }
        } else {
          // L'UPDATE a réussi mais le rafraîchissement a échoué
          const rowsMsg = rowsAffected !== undefined && rowsAffected !== null && rowsAffected > 0
            ? `${rowsAffected} ligne(s) modifiée(s)` 
            : 'modification réussie';
          setResult({
            success: false,
            error: `${rowsMsg}, mais impossible de rafraîchir les résultats: ${refreshResponse.error}`,
          });
        }
        
        setConfirmModalOpen(false);
        setEditModalOpen(false);
        setEditCell(null);
      } else {
        console.error('Erreur UPDATE:', response.error);
        setResult({
          success: false,
          error: `Erreur lors de la modification: ${response.error || 'Erreur inconnue'}\nRequête: ${updateQuery}`,
        });
      }
    } catch (error: any) {
      console.error('Erreur lors de la modification:', error);
      const errorMessage = error.response?.data?.error 
        || error.message 
        || 'Erreur lors de la modification';
      setResult({
        success: false,
        error: errorMessage,
      });
    } finally {
      setUpdating(false);
      setConfirmModalOpen(false);
    }
  };

  const loadTables = useCallback(async () => {
    const currentDsn = getCurrentDsn();
    if (!currentDsn) return;
    setLoadingTables(true);
    try {
      const response = await apiClient.getOdbcTables(currentDsn);
      if (response.success) {
        setTables(response.tables);
      }
    } catch (error: any) {
      console.error('Erreur lors du chargement des tables:', error);
    } finally {
      setLoadingTables(false);
    }
  }, [useCustomDsn, dsn, customDsn]);

  const loadRelations = useCallback(async () => {
    const currentDsn = getCurrentDsn();
    if (!currentDsn) return;
    setLoadingRelations(true);
    try {
      const response = await apiClient.getOdbcRelations(currentDsn);
      if (response.success) {
        setRelations(response.relations);
      }
    } catch (error: any) {
      console.error('Erreur lors du chargement des relations:', error);
    } finally {
      setLoadingRelations(false);
    }
  }, [useCustomDsn, dsn, customDsn]);

  useEffect(() => {
    const currentDsn = getCurrentDsn();
    if (currentDsn && !useLocalFolder) {
      loadTables();
      loadRelations();
    }
  }, [dsn, customDsn, useCustomDsn, useLocalFolder, loadTables, loadRelations]);

  const handleTableClick = async (table: string, event: React.MouseEvent) => {
    // Si Ctrl/Cmd est pressé, toggle la sélection pour les relations
    if (event.ctrlKey || event.metaKey) {
      toggleTableSelection(table);
      return;
    }

    // Sinon, exécuter une requête SELECT pour afficher les données
    const query = `SELECT * FROM ${table}`;
    setSqlQuery(query);
    
    // Exécuter automatiquement la requête
    setLoading(true);
    setResult(null);

    try {
      const finalQuery = applyLimitToQuery(query, limit);
      // Toujours utiliser ODBC pour exécuter les requêtes
      // Les fichiers locaux sont juste pour l'affichage de la liste
      const response = await apiClient.executeSql(finalQuery, dsn);
      setResult(response);
      
      // Ajouter à l'historique si succès
      if (response.success && !queryHistory.includes(query)) {
        setQueryHistory(prev => [query, ...prev.slice(0, 9)]);
      }
    } catch (error: any) {
      console.error('Erreur lors de l\'exécution de la requête:', error);
      const errorMessage = error.response?.data?.error 
        || error.message 
        || 'Erreur lors de l\'exécution de la requête';
      setResult({
        success: false,
        error: errorMessage,
      });
    } finally {
      setLoading(false);
    }
  };

  const toggleTableSelection = (table: string) => {
    setSelectedTables(prev => {
      const newSet = new Set(prev);
      if (newSet.has(table)) {
        newSet.delete(table);
      } else {
        newSet.add(table);
      }
      return newSet;
    });
  };

  const handleFolderSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    // Extraire le chemin du dossier depuis le premier fichier
    const firstFile = files[0];
    const webkitPath = (firstFile as any).webkitRelativePath;
    if (webkitPath) {
      const folderPath = webkitPath.split('/')[0];
      setSelectedFolder(folderPath);
    }

    // Scanner les fichiers .FIC (insensible à la casse)
    const ficFiles = new Set<string>();
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const fileName = file.name.toLowerCase();
      // Accepter .fic, .FIC, .Fic, etc.
      if (fileName.endsWith('.fic')) {
        // Extraire le nom de la table (sans l'extension, en préservant la casse originale)
        // Trouver la position de l'extension (insensible à la casse)
        const extensionIndex = file.name.length - 4; // .fic fait 4 caractères
        const tableName = file.name.substring(0, extensionIndex);
        if (tableName) {
          ficFiles.add(tableName);
        }
      }
    }

    if (ficFiles.size > 0) {
      setTables(Array.from(ficFiles).sort());
      setUseLocalFolder(true);
      setSelectedTables(new Set());
      setRelations([]); // Pas de relations pour les fichiers locaux
      console.log(`✅ ${ficFiles.size} fichier(s) .FIC détecté(s):`, Array.from(ficFiles));
    } else {
      // Afficher un message si aucun fichier .fic n'a été trouvé
      console.warn('⚠️ Aucun fichier .fic trouvé dans le dossier sélectionné');
      // Réinitialiser l'état si aucun fichier n'est trouvé
      setTables([]);
      setUseLocalFolder(false);
    }
  };

  const handleSelectFolderClick = () => {
    // Ouvrir le sélecteur de dossier personnalisé
    setShowFolderPicker(true);
  };

  const handleFolderSelected = async (path: string) => {
    setSelectedFolder(path);
    setShowFolderPicker(false);
    
    // Scanner les fichiers .FIC dans le dossier sélectionné via l'API backend
    setLoadingTables(true);
    try {
      const response = await apiClient.scanDirectory(path);
      if (response.success) {
        setTables(response.tables);
        setUseLocalFolder(true);
        setSelectedTables(new Set());
        setRelations([]); // Pas de relations pour les fichiers locaux
        console.log(`✅ ${response.tables.length} fichier(s) .FIC trouvé(s) dans ${path}`);
      } else {
        console.error('Erreur lors du scan:', response.error);
        setTables([]);
      }
    } catch (error: any) {
      console.error('Erreur lors du scan du dossier:', error);
      setTables([]);
    } finally {
      setLoadingTables(false);
    }
  };

  const switchToOdbc = () => {
    setUseLocalFolder(false);
    setSelectedFolder(null);
    setSelectedTables(new Set());
    if (folderInputRef.current) {
      folderInputRef.current.value = '';
    }
    loadTables();
    loadRelations();
  };

  // Handlers pour le redimensionnement de l'historique
  const handleHistoryResizeStart = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizingHistory(true);
  };

  useEffect(() => {
    const handleHistoryResize = (e: MouseEvent) => {
      if (!isResizingHistory) return;
      const newWidth = window.innerWidth - e.clientX;
      if (newWidth >= 200 && newWidth <= 600) {
        setHistoryWidth(newWidth);
      }
    };

    const handleHistoryResizeEnd = () => {
      setIsResizingHistory(false);
    };

    if (isResizingHistory) {
      document.addEventListener('mousemove', handleHistoryResize);
      document.addEventListener('mouseup', handleHistoryResizeEnd);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    }

    return () => {
      document.removeEventListener('mousemove', handleHistoryResize);
      document.removeEventListener('mouseup', handleHistoryResizeEnd);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isResizingHistory]);

  // Handlers pour le redimensionnement de la section Tables/Relations
  const handleTablesResizeStart = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizingTables(true);
  };

  useEffect(() => {
    const handleTablesResize = (e: MouseEvent) => {
      if (!isResizingTables) return;
      const container = document.querySelector('.odbc-container');
      if (!container) return;
      const containerRect = container.getBoundingClientRect();
      const newHeight = containerRect.bottom - e.clientY;
      if (newHeight >= 200 && newHeight <= 800) {
        setTablesSectionHeight(newHeight);
      }
    };

    const handleTablesResizeEnd = () => {
      setIsResizingTables(false);
    };

    if (isResizingTables) {
      document.addEventListener('mousemove', handleTablesResize);
      document.addEventListener('mouseup', handleTablesResizeEnd);
      document.body.style.cursor = 'row-resize';
      document.body.style.userSelect = 'none';
    }

    return () => {
      document.removeEventListener('mousemove', handleTablesResize);
      document.removeEventListener('mouseup', handleTablesResizeEnd);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isResizingTables]);

  // Handlers pour le redimensionnement des colonnes Tables/Relations
  const handleTablesColumnsResizeStart = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizingTablesColumns(true);
  };

  useEffect(() => {
    const handleTablesColumnsResize = (e: MouseEvent) => {
      if (!isResizingTablesColumns) return;
      const container = document.querySelector('.tables-grid-container');
      if (!container) return;
      const containerRect = container.getBoundingClientRect();
      const newWidthPercent = ((e.clientX - containerRect.left) / containerRect.width) * 100;
      if (newWidthPercent >= 20 && newWidthPercent <= 80) {
        setTablesColumnWidth(newWidthPercent);
      }
    };

    const handleTablesColumnsResizeEnd = () => {
      setIsResizingTablesColumns(false);
    };

    if (isResizingTablesColumns) {
      document.addEventListener('mousemove', handleTablesColumnsResize);
      document.addEventListener('mouseup', handleTablesColumnsResizeEnd);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    }

    return () => {
      document.removeEventListener('mousemove', handleTablesColumnsResize);
      document.removeEventListener('mouseup', handleTablesColumnsResizeEnd);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isResizingTablesColumns]);

  // Requêtes de sélection (SELECT)
  const selectQueries = [
    { label: 'SELECT simple', query: 'SELECT * FROM ' },
    { label: 'SELECT avec WHERE', query: 'SELECT * FROM  WHERE id = 1' },
    { label: 'SELECT avec LIMIT', query: 'SELECT * FROM  LIMIT 10' },
    { label: 'SELECT colonnes spécifiques', query: 'SELECT nom, prenom, age FROM ' },
    { label: 'COUNT', query: 'SELECT COUNT(*) as total FROM ' },
    { label: 'SUM', query: 'SELECT SUM(montant) as total FROM ' },
    { label: 'AVG', query: 'SELECT AVG(prix) as moyenne FROM ' },
    { label: 'MIN/MAX', query: 'SELECT MIN(date) as plus_ancien, MAX(date) as plus_recent FROM ' },
    { label: 'GROUP BY', query: 'SELECT categorie, COUNT(*) as nb FROM  GROUP BY categorie' },
    { label: 'HAVING', query: 'SELECT categorie, COUNT(*) as nb FROM  GROUP BY categorie HAVING COUNT(*) > 5' },
    { label: 'UPPER/LOWER', query: 'SELECT UPPER(nom) as nom_maj, LOWER(nom) as nom_min FROM ' },
    { label: 'CONCAT', query: 'SELECT CONCAT(prenom, \' \', nom) as nom_complet FROM ' },
    { label: 'SUBSTRING', query: 'SELECT SUBSTRING(code, 1, 3) as prefixe FROM ' },
    { label: 'LENGTH', query: 'SELECT nom, LENGTH(nom) as longueur FROM ' },
    { label: 'TRIM', query: 'SELECT TRIM(nom) as nom_nettoye FROM ' },
    { label: 'REPLACE', query: 'SELECT REPLACE(texte, \'ancien\', \'nouveau\') FROM ' },
    { label: 'DATE_FORMAT', query: 'SELECT DATE_FORMAT(date_creation, \'%Y-%m-%d\') as date_fmt FROM ' },
    { label: 'YEAR/MONTH/DAY', query: 'SELECT YEAR(date) as annee, MONTH(date) as mois, DAY(date) as jour FROM ' },
    { label: 'DATE_ADD', query: 'SELECT DATE_ADD(date, INTERVAL 30 DAY) as date_plus_30 FROM ' },
    { label: 'DATEDIFF', query: 'SELECT DATEDIFF(date_fin, date_debut) as jours_ecoules FROM ' },
    { label: 'NOW/CURDATE', query: 'SELECT NOW() as maintenant, CURDATE() as aujourdhui FROM ' },
    { label: 'ROUND', query: 'SELECT ROUND(prix, 2) as prix_arrondi FROM ' },
    { label: 'CEIL/FLOOR', query: 'SELECT CEIL(prix) as arrondi_sup, FLOOR(prix) as arrondi_inf FROM ' },
    { label: 'ABS', query: 'SELECT ABS(solde) as solde_absolu FROM ' },
    { label: 'MOD', query: 'SELECT MOD(nombre, 10) as reste FROM ' },
    { label: 'POWER', query: 'SELECT POWER(nombre, 2) as carre FROM ' },
    { label: 'WHERE avec AND/OR', query: 'SELECT * FROM  WHERE age > 18 AND ville = \'Paris\'' },
    { label: 'WHERE avec IN', query: 'SELECT * FROM  WHERE id IN (1, 2, 3, 5)' },
    { label: 'WHERE avec LIKE', query: 'SELECT * FROM  WHERE nom LIKE \'Dupont%\'' },
    { label: 'WHERE avec BETWEEN', query: 'SELECT * FROM  WHERE age BETWEEN 25 AND 50' },
    { label: 'WHERE avec IS NULL', query: 'SELECT * FROM  WHERE email IS NULL' },
    { label: 'WHERE avec NOT', query: 'SELECT * FROM  WHERE status != \'inactif\'' },
    { label: 'ORDER BY ASC', query: 'SELECT * FROM  ORDER BY nom ASC' },
    { label: 'ORDER BY DESC', query: 'SELECT * FROM  ORDER BY date DESC' },
    { label: 'ORDER BY multiple', query: 'SELECT * FROM  ORDER BY categorie ASC, prix DESC' },
    { label: 'LIMIT avec OFFSET', query: 'SELECT * FROM  LIMIT 10 OFFSET 20' },
    { label: 'INNER JOIN', query: 'SELECT a.*, b.nom FROM  a INNER JOIN  b ON a.id = b.id' },
    { label: 'LEFT JOIN', query: 'SELECT a.*, b.nom FROM  a LEFT JOIN  b ON a.id = b.id' },
    { label: 'RIGHT JOIN', query: 'SELECT a.*, b.nom FROM  a RIGHT JOIN  b ON a.id = b.id' },
    { label: 'Sous-requête WHERE', query: 'SELECT * FROM  WHERE id IN (SELECT id FROM  WHERE status = \'actif\')' },
    { label: 'Sous-requête SELECT', query: 'SELECT *, (SELECT COUNT(*) FROM  b WHERE b.id = a.id) as nb FROM  a' },
    { label: 'Top 10', query: 'SELECT * FROM  ORDER BY score DESC LIMIT 10' },
    { label: 'Distinct', query: 'SELECT DISTINCT categorie FROM ' },
    { label: 'Distinct COUNT', query: 'SELECT COUNT(DISTINCT categorie) as nb_categories FROM ' },
    { label: 'CASE WHEN', query: 'SELECT nom, CASE WHEN age < 18 THEN \'Mineur\' ELSE \'Majeur\' END as statut FROM ' },
    { label: 'COALESCE', query: 'SELECT COALESCE(telephone, email, \'Aucun contact\') as contact FROM ' },
    { label: 'IFNULL', query: 'SELECT IFNULL(prix, 0) as prix_defaut FROM ' },
    { label: 'Moyenne par groupe', query: 'SELECT categorie, AVG(prix) as prix_moyen FROM  GROUP BY categorie' },
    { label: 'Total par groupe', query: 'SELECT region, SUM(ventes) as total_ventes FROM  GROUP BY region' },
    { label: 'Top N par groupe', query: 'SELECT * FROM (SELECT *, ROW_NUMBER() OVER (PARTITION BY categorie ORDER BY prix DESC) as rn FROM ) WHERE rn <= 3' },
    { label: 'Recherche texte', query: 'SELECT * FROM  WHERE description LIKE \'%recherche%\'' },
    { label: 'Recherche insensible casse', query: 'SELECT * FROM  WHERE UPPER(nom) LIKE UPPER(\'%dupont%\')' },
    { label: 'Recherche multiple mots', query: 'SELECT * FROM  WHERE nom LIKE \'%mot1%\' OR nom LIKE \'%mot2%\'' },
    { label: 'Vérifier doublons', query: 'SELECT email, COUNT(*) as nb FROM  GROUP BY email HAVING COUNT(*) > 1' },
    { label: 'Vérifier valeurs nulles', query: 'SELECT * FROM  WHERE email IS NULL OR email = \'\'' },
    { label: 'Vérifier plage de valeurs', query: 'SELECT * FROM  WHERE age NOT BETWEEN 0 AND 120' },
  ];

  // Requêtes de modification (INSERT, UPDATE)
  const modificationQueries = [
    { label: 'INSERT', query: 'INSERT INTO  (nom, age) VALUES (\'Dupont\', 30)' },
    { label: 'INSERT multiple', query: 'INSERT INTO  (nom, age) VALUES (\'Dupont\', 30), (\'Martin\', 25)' },
    { label: 'INSERT avec SELECT', query: 'INSERT INTO  (nom, age) SELECT nom, age FROM  WHERE age > 18' },
    { label: 'UPDATE', query: 'UPDATE  SET nom = \'Nouveau\' WHERE id = 1' },
    { label: 'UPDATE multiple colonnes', query: 'UPDATE  SET nom = \'Nouveau\', age = 35 WHERE id = 1' },
    { label: 'UPDATE avec condition', query: 'UPDATE  SET status = \'actif\' WHERE date_creation < \'2020-01-01\'' },
    { label: 'UPDATE avec calcul', query: 'UPDATE  SET prix = prix * 1.1 WHERE categorie = \'A\'' },
    { label: 'UPDATE avec sous-requête', query: 'UPDATE  SET status = \'actif\' WHERE id IN (SELECT id FROM  WHERE date > \'2023-01-01\')' },
  ];

  // Requêtes de suppression (DELETE)
  const deleteQueries = [
    { label: 'DELETE', query: 'DELETE FROM  WHERE id = 1' },
    { label: 'DELETE avec condition', query: 'DELETE FROM  WHERE date < \'2020-01-01\'' },
    { label: 'DELETE avec IN', query: 'DELETE FROM  WHERE id IN (1, 2, 3)' },
    { label: 'DELETE avec sous-requête', query: 'DELETE FROM  WHERE id IN (SELECT id FROM  WHERE status = \'inactif\')' },
    { label: 'DELETE avec LIMIT', query: 'DELETE FROM  WHERE date < \'2020-01-01\' LIMIT 100' },
    { label: 'DELETE avec JOIN', query: 'DELETE a FROM  a INNER JOIN  b ON a.id = b.id WHERE b.status = \'supprime\'' },
  ];

  return (
    <div className="h-full flex flex-col bg-theme-background text-theme-foreground odbc-container">
      <Toaster position="top-right" />
      <div className="p-6 border-b border-theme-border">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold mb-2 text-theme-foreground">ODBC / Query Studio</h1>
            <p className="text-theme-secondary text-sm">
              Exécutez des requêtes SQL via ODBC. Utilisez Ctrl+Entrée pour exécuter.
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <label className="text-sm text-theme-statusbar font-semibold">DSN ODBC:</label>
              <div className="flex items-center gap-2">
                {availableDsns.length > 0 ? (
                  <>
                    <select
                      value={useCustomDsn ? 'custom' : dsn}
                      onChange={(e) => {
                        if (e.target.value === 'custom') {
                          setUseCustomDsn(true);
                          setCustomDsn('');
                        } else {
                          setUseCustomDsn(false);
                          setDsn(e.target.value);
                        }
                      }}
                      className="px-3 py-1.5 bg-theme-input border border-theme-input rounded text-sm text-theme-input focus:outline-none focus:ring-2 ring-theme-focus min-w-[200px]"
                    >
                      {availableDsns.map((dsnConfig) => (
                        <option key={dsnConfig.id} value={dsnConfig.name}>
                          {dsnConfig.name}
                        </option>
                      ))}
                      <option value="custom">DSN personnalisé...</option>
                    </select>
                    {useCustomDsn && (
                      <input
                        type="text"
                        value={customDsn}
                        onChange={(e) => setCustomDsn(e.target.value)}
                        placeholder="Nom du DSN personnalisé"
                        className="px-3 py-1.5 bg-theme-input border border-theme-input rounded text-sm text-theme-input focus:outline-none focus:ring-2 ring-theme-focus min-w-[200px]"
                        autoFocus
                      />
                    )}
                  </>
                ) : (
                  <>
                    <input
                      type="text"
                      value={customDsn}
                      onChange={(e) => {
                        setCustomDsn(e.target.value);
                        setUseCustomDsn(true);
                      }}
                      placeholder="Nom du DSN"
                      className="px-3 py-1.5 bg-theme-input border border-theme-input rounded text-sm text-theme-input focus:outline-none focus:ring-2 ring-theme-focus min-w-[200px]"
                    />
                    <Link
                      to="/dsn"
                      className="px-3 py-1.5 bg-theme-primary rounded text-sm text-white transition-colors flex items-center gap-1"
                      title="Gérer les DSN"
                    >
                      <SettingsIcon className="w-4 h-4" />
                      Configurer
                    </Link>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 flex gap-4 p-6 overflow-hidden min-h-0">
        {/* Zone de requête */}
        <div className="flex-1 flex flex-col gap-4 overflow-hidden min-h-0">
          <div className="flex-shrink-0 flex flex-col">
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-semibold text-theme-statusbar">Requête SQL</label>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-2">
                  <label className="text-xs text-theme-secondary">Limite:</label>
                  <select
                    value={limit === null ? 'all' : limit.toString()}
                    onChange={(e) => setLimit(e.target.value === 'all' ? null : parseInt(e.target.value))}
                    className="px-2 py-1 text-xs bg-theme-input border border-theme-input rounded text-theme-input focus:outline-none focus:ring-2 ring-theme-focus"
                  >
                    <option value="10">10</option>
                    <option value="25">25</option>
                    <option value="50">50</option>
                    <option value="100">100</option>
                    <option value="500">500</option>
                    <option value="1000">1000</option>
                    <option value="all">Tous</option>
                  </select>
                </div>
                <button
                  onClick={() => setSqlQuery('')}
                  className="px-3 py-1 text-xs bg-theme-secondary rounded transition-colors"
                  title="Effacer"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
                <button
                  onClick={executeQuery}
                  disabled={loading || !sqlQuery.trim()}
                  className="px-4 py-2 bg-theme-primary disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors flex items-center gap-2"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Exécution...</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4" />
                      <span>Exécuter (Ctrl+Entrée)</span>
                    </>
                  )}
                </button>
              </div>
            </div>
            <div className="relative flex-1">
              <textarea
                ref={textareaRef}
                value={sqlQuery}
                onChange={handleTextareaChange}
                onSelect={handleTextareaSelect}
                onKeyDown={handleKeyDown}
                onClick={handleTextareaSelect}
                placeholder="Entrez votre requête SQL ici... (Autocomplétion disponible)"
                className="flex-1 w-full bg-theme-input border border-theme-input rounded-lg p-4 text-sm font-mono text-theme-input placeholder-theme-input focus:outline-none focus:ring-2 ring-theme-focus resize-none"
                spellCheck={false}
              />
              <SqlAutocomplete
                suggestions={suggestions}
                selectedIndex={autocompleteSelectedIndex}
                onSelect={handleSelectSuggestion}
                position={autocompletePosition}
                visible={showAutocomplete && hasSuggestions}
              />
            </div>
          </div>

          {/* Exemples de requêtes */}
          <div className="flex-shrink-0">
            <label className="text-sm font-semibold text-theme-statusbar mb-3 block">
              Exemples de requêtes
            </label>
            <div className="grid grid-cols-3 gap-4">
              {/* Requêtes de sélection */}
              <div className="flex flex-col">
                <label className="text-xs font-semibold text-theme-primary mb-2">
                  Requêtes sélection ({selectQueries.length})
                </label>
                <div className="flex-1 max-h-48 overflow-y-auto bg-theme-input border border-theme-input rounded-lg p-3">
                  <div className="grid grid-cols-1 gap-2">
                    {selectQueries.map((example, idx) => (
                      <button
                        key={idx}
                        onClick={() => setSqlQuery(example.query)}
                        className="px-3 py-1.5 text-xs bg-theme-secondary border border-theme-input rounded transition-colors text-left"
                        title={example.query}
                      >
                        {example.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Requêtes de modification */}
              <div className="flex flex-col">
                <label className="text-xs font-semibold text-yellow-400 mb-2">
                  Requêtes modifications ({modificationQueries.length})
                </label>
                <div className="flex-1 max-h-48 overflow-y-auto bg-theme-input border border-theme-input rounded-lg p-3">
                  <div className="grid grid-cols-1 gap-2">
                    {modificationQueries.map((example, idx) => (
                      <button
                        key={idx}
                        onClick={() => setSqlQuery(example.query)}
                        className="px-3 py-1.5 text-xs bg-theme-secondary border border-theme-input rounded transition-colors text-left"
                        title={example.query}
                      >
                        {example.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Requêtes de suppression */}
              <div className="flex flex-col">
                <label className="text-xs font-semibold text-red-400 mb-2">
                  Requêtes suppression ({deleteQueries.length})
                </label>
                <div className="flex-1 max-h-48 overflow-y-auto bg-theme-input border border-theme-input rounded-lg p-3">
                  <div className="grid grid-cols-1 gap-2">
                    {deleteQueries.map((example, idx) => (
                      <button
                        key={idx}
                        onClick={() => setSqlQuery(example.query)}
                        className="px-3 py-1.5 text-xs bg-theme-secondary border border-theme-input rounded transition-colors text-left"
                        title={example.query}
                      >
                        {example.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Résultats */}
          {result && (
            <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
              {result.success ? (
                <div className="bg-theme-card border border-theme-card rounded-lg p-4 flex flex-col h-full min-h-0">
                  <div className="flex items-center justify-between mb-4 flex-shrink-0">
                    <div className="flex items-center gap-2 text-green-400">
                      <CheckCircle2 className="w-5 h-5" />
                      <span className="font-semibold">Requête exécutée avec succès</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {result.rows_affected !== undefined && (
                        <span className="text-sm text-theme-secondary">
                          {result.rows_affected} ligne(s) affectée(s)
                        </span>
                      )}
                      {result.data && result.data.rows && result.data.rows.length > 0 && (
                        <>
                          <button
                            onClick={() => {
                              try {
                                exportSqlResults(result.data!.columns, result.data!.rows, { format: 'json' });
                                toast.success('Export JSON réussi');
                              } catch (error: any) {
                                toast.error(`Erreur lors de l'export: ${error.message}`);
                              }
                            }}
                            className="flex items-center gap-1 px-3 py-1.5 bg-theme-secondary rounded text-sm text-white transition-colors hover:bg-theme-secondary/80"
                            title="Exporter en JSON"
                          >
                            <Download className="w-4 h-4" />
                            JSON
                          </button>
                          <button
                            onClick={() => {
                              try {
                                exportSqlResults(result.data!.columns, result.data!.rows, { format: 'csv' });
                                toast.success('Export CSV réussi');
                              } catch (error: any) {
                                toast.error(`Erreur lors de l'export: ${error.message}`);
                              }
                            }}
                            className="flex items-center gap-1 px-3 py-1.5 bg-theme-secondary rounded text-sm text-white transition-colors hover:bg-theme-secondary/80"
                            title="Exporter en CSV"
                          >
                            <Download className="w-4 h-4" />
                            CSV
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {result.data && (() => {
                    const data = result.data!;
                    return (
                      <div className="flex-1 overflow-auto border border-theme-table rounded min-h-0">
                        {data.rows && data.rows.length > 0 ? (
                          <div className="overflow-x-auto">
                            <table className="w-full text-sm border-collapse min-w-full">
                              <thead>
                                <tr className="bg-theme-table-header">
                                  {data.columns.map((col, idx) => (
                                    <th
                                      key={idx}
                                      className="px-4 py-2 text-left border-b border-theme-table font-semibold whitespace-nowrap sticky left-0 bg-theme-table-header z-10 text-theme-card"
                                    >
                                      {col}
                                    </th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {data.rows.map((row, rowIdx) => (
                                  <tr
                                    key={rowIdx}
                                    className="border-b border-theme-table bg-theme-table-row-hover"
                                  >
                                    {data.columns.map((col, colIdx) => (
                                      <td 
                                        key={colIdx} 
                                        className="px-4 py-2 text-theme-statusbar whitespace-nowrap cursor-pointer transition-colors group relative"
                                        onClick={() => handleCellClick(row, col, rowIdx, data.columns)}
                                        title="Cliquez pour modifier cette valeur"
                                      >
                                        <div className="max-w-xs truncate flex items-center gap-2">
                                          <span>{formatValue(row[col])}</span>
                                          <Edit2 className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity text-theme-primary" />
                                        </div>
                                      </td>
                                    ))}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        ) : (
                          <p className="text-theme-secondary text-center py-4">Aucun résultat</p>
                        )}
                      </div>
                    );
                  })()}

                  {result.data && result.data.rows && (
                    <div className="mt-4 text-xs text-theme-secondary flex-shrink-0">
                      {result.data.rows.length} ligne(s) retournée(s)
                    </div>
                  )}
                </div>
              ) : (
                <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-4">
                  <div className="flex items-center gap-2 text-red-400 mb-2">
                    <AlertCircle className="w-5 h-5" />
                    <span className="font-semibold">Erreur</span>
                  </div>
                  <p className="text-red-300 text-sm">{result.error}</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Diviseur pour l'historique */}
        {queryHistory.length > 0 && (
          <>
            <div
              className="w-1 bg-theme-border hover:bg-theme-primary cursor-col-resize transition-colors flex-shrink-0 relative group"
              onMouseDown={handleHistoryResizeStart}
              style={{ cursor: isResizingHistory ? 'col-resize' : 'col-resize' }}
              title="Glisser pour redimensionner"
            >
              <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-0.5 bg-theme-primary opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            <div className="flex flex-col" style={{ width: `${historyWidth}px`, minWidth: '200px', maxWidth: '600px' }}>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-semibold text-theme-statusbar">Historique</label>
              <button
                onClick={() => setQueryHistory([])}
                className="text-xs text-theme-secondary hover:text-theme-foreground"
              >
                Effacer
              </button>
            </div>
            <div className="flex-1 overflow-y-auto bg-theme-input border border-theme-input rounded-lg p-2">
              <div className="space-y-1">
                {queryHistory.map((query, idx) => (
                  <button
                    key={idx}
                    onClick={() => setSqlQuery(query)}
                    className="w-full text-left px-3 py-2 text-xs bg-theme-secondary rounded transition-colors group"
                    title={query}
                  >
                    <div className="flex items-center justify-between">
                      <span className="truncate text-theme-statusbar">{query}</span>
                      <Copy
                        className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={(e) => {
                          e.stopPropagation();
                          copyToClipboard(query);
                        }}
                      />
                    </div>
                  </button>
                ))}
              </div>
            </div>
            </div>
          </>
        )}
      </div>

      {/* Diviseur pour la section Tables/Relations */}
      <div
        className="h-1 bg-theme-border hover:bg-theme-primary cursor-row-resize transition-colors flex-shrink-0 relative group"
        onMouseDown={handleTablesResizeStart}
        style={{ cursor: isResizingTables ? 'row-resize' : 'row-resize' }}
        title="Glisser pour redimensionner"
      >
        <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-0.5 bg-theme-primary opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
      
      {/* Section Tables et Relations */}
      <div className="border-t border-theme-border p-6 bg-theme-background flex-shrink-0 overflow-hidden" style={{ height: `${tablesSectionHeight}px` }}>
        <div className="mb-4">
          <h2 className="text-xl font-bold mb-2 flex items-center gap-2 text-theme-foreground">
            <Database className="w-5 h-5" />
            Structure de la base de données
          </h2>
          <p className="text-theme-secondary text-sm">
            Cliquez sur une table pour afficher ses données via ODBC • Ctrl+Clic pour sélectionner et visualiser les relations
            {useLocalFolder && (
              <span className="block mt-1 text-yellow-400 text-xs">
                ⚠️ Les fichiers locaux sont affichés à titre informatif. Les requêtes s'exécutent via ODBC avec le DSN configuré.
              </span>
            )}
          </p>
        </div>

        <div className="flex gap-6 h-full min-h-0 tables-grid-container">
          {/* Liste des tables */}
          <div className="bg-theme-input border border-theme-input rounded-lg p-4 flex flex-col min-h-0" style={{ width: `${tablesColumnWidth}%` }}>
            <div className="flex items-center justify-between mb-3">
              <label className="text-sm font-semibold text-theme-statusbar">Tables disponibles</label>
              <div className="flex items-center gap-2">
                {useLocalFolder ? (
                  <button
                    onClick={switchToOdbc}
                    className="px-3 py-1 text-xs bg-theme-secondary rounded transition-colors"
                    title="Utiliser ODBC"
                  >
                    ODBC
                  </button>
                ) : (
                  <>
                    <button
                      onClick={handleSelectFolderClick}
                      className="px-3 py-1 text-xs bg-theme-primary rounded transition-colors flex items-center gap-1"
                      title="Sélectionner un dossier"
                    >
                      <FolderOpen className="w-3 h-3" />
                      Dossier
                    </button>
                    <button
                      onClick={loadTables}
                      disabled={loadingTables}
                      className="px-3 py-1 text-xs bg-theme-secondary rounded transition-colors flex items-center gap-1 disabled:opacity-50"
                      title="Actualiser"
                    >
                      <RefreshCw className={`w-3 h-3 ${loadingTables ? 'animate-spin' : ''}`} />
                      Actualiser
                    </button>
                  </>
                )}
              </div>
            </div>
            <input
              ref={folderInputRef}
              type="file"
              {...({ webkitdirectory: '', directory: '' } as any)}
              multiple
              onChange={handleFolderSelect}
              className="hidden"
              accept=".fic,.FIC,.Fic,.fIC,.FiC,.fIc"
            />
            {selectedFolder && (
              <div className="mb-2 text-xs text-theme-secondary">
                Dossier: <span className="text-theme-statusbar">{selectedFolder}</span>
              </div>
            )}
            <div className="flex-1 overflow-y-auto">
              {loadingTables ? (
                <div className="flex items-center justify-center h-full">
                  <Loader2 className="w-5 h-5 animate-spin text-theme-secondary" />
                </div>
              ) : tables.length === 0 ? (
                <p className="text-theme-secondary text-sm text-center py-4">Aucune table trouvée</p>
              ) : (
                <div className="space-y-1 overflow-y-auto">
                  {tables.map((table) => (
                    <button
                      key={table}
                      onClick={(e) => handleTableClick(table, e)}
                      className={`w-full text-left px-3 py-2 text-sm rounded transition-colors flex items-center gap-2 ${
                        selectedTables.has(table)
                          ? 'bg-theme-primary text-white'
                          : 'bg-theme-secondary text-theme-statusbar hover:bg-theme-secondary/80'
                      }`}
                      title={useLocalFolder ? `Fichier .FIC: ${table} • Clic pour afficher • Ctrl+Clic pour sélectionner` : `Clic pour afficher • Ctrl+Clic pour sélectionner`}
                    >
                      {useLocalFolder && (
                        <FileText className="w-4 h-4 flex-shrink-0 opacity-70" />
                      )}
                      <span className="truncate">{table}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="mt-2 text-xs text-theme-secondary">
              {useLocalFolder ? (
                <span>📁 Dossier local • {tables.length} fichier(s) .FIC trouvé(s)</span>
              ) : (
                <span>🔌 ODBC • {tables.length} table(s)</span>
              )}
              {' • '}
              {selectedTables.size} sélectionnée(s)
            </div>
          </div>

          {/* Diviseur entre les colonnes Tables/Relations */}
          <div
            className="w-1 bg-theme-border hover:bg-theme-primary cursor-col-resize transition-colors flex-shrink-0 relative group"
            onMouseDown={handleTablesColumnsResizeStart}
            style={{ cursor: isResizingTablesColumns ? 'col-resize' : 'col-resize' }}
            title="Glisser pour redimensionner"
          >
            <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-0.5 bg-theme-primary opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>

          {/* Diagramme des relations */}
          <div className="bg-theme-input border border-theme-input rounded-lg p-4 flex flex-col min-h-0" style={{ width: `${100 - tablesColumnWidth}%` }}>
            <div className="flex items-center justify-between mb-3">
              <label className="text-sm font-semibold text-theme-statusbar">Relations entre tables</label>
              {!useLocalFolder && (
                <button
                  onClick={loadRelations}
                  disabled={loadingRelations}
                  className="px-3 py-1 text-xs bg-theme-secondary rounded transition-colors flex items-center gap-1 disabled:opacity-50"
                  title="Actualiser"
                >
                  <RefreshCw className={`w-3 h-3 ${loadingRelations ? 'animate-spin' : ''}`} />
                  Actualiser
                </button>
              )}
            </div>
            <div className="flex-1 overflow-auto relative">
              {useLocalFolder ? (
                <div className="flex items-center justify-center h-full">
                  <p className="text-theme-secondary text-sm text-center">
                    Les relations ne sont disponibles que pour les bases de données ODBC
                  </p>
                </div>
              ) : loadingRelations ? (
                <div className="flex items-center justify-center h-full">
                  <Loader2 className="w-5 h-5 animate-spin text-theme-secondary" />
                </div>
              ) : (
                <RelationsDiagram
                  relations={relations}
                  selectedTables={selectedTables}
                />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Sélecteur de dossier personnalisé */}
      <FolderPicker
        isOpen={showFolderPicker}
        onClose={() => setShowFolderPicker(false)}
        onSelect={handleFolderSelected}
        initialPath={selectedFolder || undefined}
        title="Sélectionner le dossier contenant les fichiers .FIC"
      />

      {/* Modale d'édition */}
      {editModalOpen && editCell && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setEditModalOpen(false)}>
          <div className="bg-theme-card border border-theme-card rounded-lg p-6 max-w-md w-full mx-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-theme-card">Modifier la valeur</h2>
              <button
                onClick={() => {
                  setEditModalOpen(false);
                  setEditCell(null);
                }}
                className="text-theme-secondary hover:text-theme-foreground transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-sm text-theme-statusbar mb-1 block">Table</label>
                <div className="px-3 py-2 bg-theme-input rounded text-theme-input text-sm break-words" style={{ wordBreak: 'break-word', overflowWrap: 'anywhere' }}>
                  {editCell.table}
                </div>
              </div>

              <div>
                <label className="text-sm text-theme-statusbar mb-1 block">Colonne</label>
                <div className="px-3 py-2 bg-theme-input rounded text-theme-input text-sm break-words" style={{ wordBreak: 'break-word', overflowWrap: 'anywhere' }}>
                  {editCell.column}
                </div>
              </div>

              <div>
                <label className="text-sm text-theme-statusbar mb-1 block">Valeur actuelle</label>
                <div className="px-3 py-2 bg-theme-input rounded text-theme-statusbar text-sm break-words whitespace-pre-wrap" style={{ wordBreak: 'break-word', overflowWrap: 'anywhere' }}>
                  {formatValue(editCell.currentValue)}
                </div>
              </div>

              <div>
                <label className="text-sm text-theme-statusbar mb-1 block">Nouvelle valeur</label>
                <textarea
                  value={editCell.newValue}
                  onChange={(e) => setEditCell({ ...editCell, newValue: e.target.value })}
                  className="w-full px-3 py-2 bg-theme-input border border-theme-input rounded text-theme-input focus:outline-none focus:ring-2 ring-theme-focus resize-none min-h-[40px] max-h-[200px] overflow-y-auto break-words whitespace-pre-wrap"
                  style={{ wordBreak: 'break-word', overflowWrap: 'anywhere' }}
                  autoFocus
                  rows={1}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                      e.preventDefault();
                      if (editCell.newValue !== formatValue(editCell.currentValue)) {
                        setEditModalOpen(false);
                        setConfirmModalOpen(true);
                      }
                    } else if (e.key === 'Escape') {
                      setEditModalOpen(false);
                      setEditCell(null);
                    }
                  }}
                  onInput={(e) => {
                    // Ajuster automatiquement la hauteur du textarea
                    const target = e.target as HTMLTextAreaElement;
                    target.style.height = 'auto';
                    target.style.height = `${Math.min(target.scrollHeight, 200)}px`;
                  }}
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setEditModalOpen(false);
                  setEditCell(null);
                }}
                className="flex-1 px-4 py-2 bg-theme-secondary rounded text-white transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={() => {
                  if (editCell.newValue !== formatValue(editCell.currentValue)) {
                    setEditModalOpen(false);
                    setConfirmModalOpen(true);
                  }
                }}
                disabled={editCell.newValue === formatValue(editCell.currentValue)}
                className="flex-1 px-4 py-2 bg-theme-primary disabled:opacity-50 disabled:cursor-not-allowed rounded text-white transition-colors"
              >
                Modifier
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modale de confirmation */}
      {confirmModalOpen && editCell && (() => {
        // Générer la requête pour l'affichage (exclure la colonne qu'on modifie)
        const whereClause = generateWhereClause(editCell.row, editCell.allColumns, editCell.column);
        const trimmedValue = editCell.newValue.trim();
        let valuePart: string;
        if (trimmedValue.toUpperCase() === 'NULL' || trimmedValue === '') {
          valuePart = 'NULL';
        } else if (isNumeric(trimmedValue)) {
          valuePart = trimmedValue;
        } else {
          const escapedValue = trimmedValue.replace(/'/g, "''");
          valuePart = `'${escapedValue}'`;
        }
        const previewQuery = `UPDATE ${editCell.table} SET ${editCell.column} = ${valuePart} WHERE ${whereClause}`;
        
        return (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setConfirmModalOpen(false)}>
            <div className="bg-theme-card border border-theme-card rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center gap-3 mb-4">
                <AlertCircle className="w-6 h-6 text-yellow-400" />
                <h2 className="text-xl font-bold text-theme-card">Confirmer la modification</h2>
              </div>

              <div className="space-y-3 mb-6">
                <p className="text-theme-statusbar">
                  Êtes-vous sûr de vouloir modifier cette valeur ?
                </p>
                
                <div className="bg-theme-background rounded p-3 space-y-2">
                  <div className="flex justify-between text-sm gap-2">
                    <span className="text-theme-secondary flex-shrink-0">Table:</span>
                    <span className="text-theme-card font-mono break-words text-right" style={{ wordBreak: 'break-word', overflowWrap: 'anywhere' }}>{editCell.table}</span>
                  </div>
                  <div className="flex justify-between text-sm gap-2">
                    <span className="text-theme-secondary flex-shrink-0">Colonne:</span>
                    <span className="text-theme-card font-mono break-words text-right" style={{ wordBreak: 'break-word', overflowWrap: 'anywhere' }}>{editCell.column}</span>
                  </div>
                  <div className="flex justify-between text-sm gap-2">
                    <span className="text-theme-secondary flex-shrink-0">Ancienne valeur:</span>
                    <span className="text-theme-statusbar font-mono break-words whitespace-pre-wrap text-right" style={{ wordBreak: 'break-word', overflowWrap: 'anywhere' }}>{formatValue(editCell.currentValue)}</span>
                  </div>
                  <div className="flex justify-between text-sm gap-2">
                    <span className="text-theme-secondary flex-shrink-0">Nouvelle valeur:</span>
                    <span className="text-theme-card font-mono break-words whitespace-pre-wrap text-right" style={{ wordBreak: 'break-word', overflowWrap: 'anywhere' }}>{editCell.newValue}</span>
                  </div>
                </div>

                <div className="bg-theme-primary/20 border border-theme-primary/50 rounded p-3">
                  <p className="text-theme-primary text-xs font-semibold mb-2">Requête SQL qui sera exécutée:</p>
                  <pre className="text-xs text-theme-foreground font-mono bg-theme-background p-2 rounded overflow-x-auto break-words whitespace-pre-wrap" style={{ wordBreak: 'break-word', overflowWrap: 'anywhere' }}>
                    {previewQuery}
                  </pre>
                </div>

                <div className="bg-yellow-500/20 border border-yellow-500/50 rounded p-3">
                  <p className="text-yellow-300 text-xs">
                    ⚠️ Cette action est irréversible. La requête UPDATE sera exécutée immédiatement.
                  </p>
                </div>
              </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setConfirmModalOpen(false);
                  setEditModalOpen(true);
                }}
                disabled={updating}
                className="flex-1 px-4 py-2 bg-theme-secondary disabled:opacity-50 disabled:cursor-not-allowed rounded text-white transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={handleConfirmUpdate}
                disabled={updating}
                className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-red-800 disabled:cursor-not-allowed rounded text-white transition-colors flex items-center justify-center gap-2"
              >
                {updating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Modification...</span>
                  </>
                ) : (
                  'Confirmer la modification'
                )}
              </button>
            </div>
          </div>
        </div>
        );
      })()}
    </div>
  );
};

// Composant pour le diagramme de relations
interface RelationsDiagramProps {
  relations: Array<{ from_table: string; from_column: string; to_table: string; to_column: string }>;
  selectedTables: Set<string>;
}

const RelationsDiagram: React.FC<RelationsDiagramProps> = ({ relations, selectedTables }) => {
  // Filtrer les relations pour n'afficher que celles impliquant les tables sélectionnées
  const filteredRelations = selectedTables.size > 0
    ? relations.filter(r => selectedTables.has(r.from_table) || selectedTables.has(r.to_table))
    : relations;

  // Créer un graphe des tables
  const tableNodes = new Set<string>();
  filteredRelations.forEach(r => {
    tableNodes.add(r.from_table);
    tableNodes.add(r.to_table);
  });

  if (selectedTables.size === 0 && relations.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-theme-secondary text-sm text-center">
          Sélectionnez des tables pour voir leurs relations
        </p>
      </div>
    );
  }

  if (filteredRelations.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-theme-secondary text-sm text-center">
          Aucune relation trouvée pour les tables sélectionnées
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4 overflow-y-auto h-full">
      {Array.from(tableNodes).map(table => {
        const outgoing = filteredRelations.filter(r => r.from_table === table);
        const incoming = filteredRelations.filter(r => r.to_table === table);
        
        return (
          <div key={table} className="bg-theme-card/70 rounded-lg p-3">
            <div className="font-semibold text-theme-card mb-2">{table}</div>
            {outgoing.length > 0 && (
              <div className="mb-2">
                <div className="text-xs text-theme-secondary mb-1">→ Vers:</div>
                {outgoing.map((rel, idx) => (
                  <div key={idx} className="text-xs text-theme-statusbar ml-2">
                    {rel.from_column} → {rel.to_table}.{rel.to_column}
                  </div>
                ))}
              </div>
            )}
            {incoming.length > 0 && (
              <div>
                <div className="text-xs text-theme-secondary mb-1">← Depuis:</div>
                {incoming.map((rel, idx) => (
                  <div key={idx} className="text-xs text-theme-statusbar ml-2">
                    {rel.from_table}.{rel.from_column} → {rel.to_column}
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default Odbc;

