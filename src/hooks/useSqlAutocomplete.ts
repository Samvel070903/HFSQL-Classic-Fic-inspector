import { useMemo } from 'react';

export interface AutocompleteSuggestion {
  label: string;
  value: string;
  description?: string;
  type: 'keyword' | 'table' | 'column' | 'function' | 'operator';
}

interface SqlContext {
  position: 
    | 'start'
    | 'after_select'
    | 'after_from'
    | 'after_join'
    | 'after_on'
    | 'after_where'
    | 'after_group_by'
    | 'after_having'
    | 'after_order_by'
    | 'after_limit'
    | 'after_insert_into'
    | 'after_values'
    | 'after_update'
    | 'after_set'
    | 'after_delete'
    | 'unknown';
  currentWord: string;
  queryBefore: string;
  queryAfter: string;
  tables: string[];
  aliases: Map<string, string>; // alias -> table
  selectedColumns: string[];
}

/**
 * Extrait les tables et alias de la requête
 */
function extractTablesAndAliases(query: string): { tables: string[]; aliases: Map<string, string> } {
  const tables: string[] = [];
  const aliases = new Map<string, string>();
  
  // Chercher après FROM
  const fromMatch = query.match(/FROM\s+([a-zA-Z_][a-zA-Z0-9_]*)(?:\s+AS\s+([a-zA-Z_][a-zA-Z0-9_]*))?/i);
  if (fromMatch) {
    const tableName = fromMatch[1];
    tables.push(tableName);
    if (fromMatch[2]) {
      aliases.set(fromMatch[2], tableName);
    }
  }
  
  // Chercher les JOIN
  const joinRegex = /(?:INNER|LEFT|RIGHT|CROSS)?\s*JOIN\s+([a-zA-Z_][a-zA-Z0-9_]*)(?:\s+AS\s+([a-zA-Z_][a-zA-Z0-9_]*))?/gi;
  let joinMatch;
  while ((joinMatch = joinRegex.exec(query)) !== null) {
    const tableName = joinMatch[1];
    tables.push(tableName);
    if (joinMatch[2]) {
      aliases.set(joinMatch[2], tableName);
    }
  }
  
  return { tables, aliases };
}

/**
 * Extrait les colonnes sélectionnées dans le SELECT
 */
function extractSelectedColumns(query: string): string[] {
  const selectMatch = query.match(/SELECT\s+(.*?)\s+FROM/i);
  if (!selectMatch) return [];
  
  const selectClause = selectMatch[1];
  const columns: string[] = [];
  
  // Extraire les colonnes (gérer les virgules, AS, etc.)
  const columnParts = selectClause.split(',').map(c => c.trim());
  columnParts.forEach(part => {
    // Enlever les alias AS
    const withoutAs = part.replace(/\s+AS\s+[a-zA-Z_][a-zA-Z0-9_]*/i, '');
    // Extraire le nom de colonne (peut être table.colonne ou juste colonne)
    const columnMatch = withoutAs.match(/(?:[a-zA-Z_][a-zA-Z0-9_]*\.)?([a-zA-Z_][a-zA-Z0-9_]*)/);
    if (columnMatch && columnMatch[1] !== '*') {
      columns.push(columnMatch[1]);
    }
  });
  
  return columns;
}

/**
 * Analyse le contexte SQL autour de la position du curseur
 */
export function analyzeSqlContext(query: string, cursorPosition: number, _availableTables: string[]): SqlContext {
  const beforeCursor = query.substring(0, cursorPosition);
  const afterCursor = query.substring(cursorPosition);
  
  // Extraire le mot actuel
  const wordsBefore = beforeCursor.trim().split(/\s+/);
  const currentWord = wordsBefore[wordsBefore.length - 1] || '';
  
  const upperQuery = beforeCursor.toUpperCase().trim();
  const words = upperQuery.split(/\s+/).filter(w => w.length > 0);
  
  // Extraire les tables et alias
  const { tables, aliases } = extractTablesAndAliases(beforeCursor);
  const selectedColumns = extractSelectedColumns(beforeCursor);
  
  // Déterminer la position précise
  let position: SqlContext['position'] = 'unknown';
  
  // Chercher le dernier mot-clé significatif
  const sqlKeywords = ['SELECT', 'FROM', 'WHERE', 'JOIN', 'INNER', 'LEFT', 'RIGHT', 'CROSS', 'ON', 
                       'GROUP', 'BY', 'HAVING', 'ORDER', 'LIMIT', 'OFFSET',
                       'INSERT', 'INTO', 'VALUES', 'UPDATE', 'SET', 'DELETE'];
  
  let lastKeyword = '';
  let lastKeywordIndex = -1;
  
  for (let i = words.length - 1; i >= 0; i--) {
    const word = words[i];
    if (sqlKeywords.includes(word)) {
      lastKeyword = word;
      lastKeywordIndex = i;
      break;
    }
  }
  
  // Déterminer la position selon le dernier mot-clé
  if (words.length === 0) {
    position = 'start';
  } else if (lastKeyword === 'SELECT' || (lastKeywordIndex >= 0 && words[lastKeywordIndex] === 'SELECT')) {
    position = 'after_select';
  } else if (lastKeyword === 'FROM') {
    position = 'after_from';
  } else if (lastKeyword === 'JOIN' || lastKeyword === 'INNER' || lastKeyword === 'LEFT' || lastKeyword === 'RIGHT' || lastKeyword === 'CROSS') {
    position = 'after_join';
  } else if (lastKeyword === 'ON') {
    position = 'after_on';
  } else if (lastKeyword === 'WHERE') {
    position = 'after_where';
  } else if (lastKeyword === 'GROUP' || (lastKeywordIndex > 0 && words[lastKeywordIndex - 1] === 'GROUP' && words[lastKeywordIndex] === 'BY')) {
    position = 'after_group_by';
  } else if (lastKeyword === 'HAVING') {
    position = 'after_having';
  } else if (lastKeyword === 'ORDER' || (lastKeywordIndex > 0 && words[lastKeywordIndex - 1] === 'ORDER' && words[lastKeywordIndex] === 'BY')) {
    position = 'after_order_by';
  } else if (lastKeyword === 'LIMIT') {
    position = 'after_limit';
  } else if (lastKeyword === 'INSERT' || (lastKeywordIndex > 0 && words[lastKeywordIndex - 1] === 'INSERT' && words[lastKeywordIndex] === 'INTO')) {
    position = 'after_insert_into';
  } else if (lastKeyword === 'VALUES') {
    position = 'after_values';
  } else if (lastKeyword === 'UPDATE') {
    position = 'after_update';
  } else if (lastKeyword === 'SET') {
    position = 'after_set';
  } else if (lastKeyword === 'DELETE') {
    position = 'after_delete';
  }
  
  return {
    position,
    currentWord: currentWord.toUpperCase(),
    queryBefore: beforeCursor,
    queryAfter: afterCursor,
    tables,
    aliases,
    selectedColumns,
  };
}

/**
 * Génère des suggestions basées sur le contexte SQL
 */
export function generateSuggestions(
  context: SqlContext,
  availableTables: string[],
  currentWord: string
): AutocompleteSuggestion[] {
  const suggestions: AutocompleteSuggestion[] = [];
  const wordLower = currentWord.toLowerCase();
  
  switch (context.position) {
    case 'start':
      suggestions.push(
        { label: 'SELECT', value: 'SELECT ', type: 'keyword' },
        { label: 'INSERT INTO', value: 'INSERT INTO ', type: 'keyword' },
        { label: 'UPDATE', value: 'UPDATE ', type: 'keyword' },
        { label: 'DELETE FROM', value: 'DELETE FROM ', type: 'keyword' }
      );
      break;
      
    case 'after_select':
      // Après SELECT : *, colonnes, fonctions, DISTINCT
      suggestions.push(
        { label: '*', value: '*', type: 'operator' },
        { label: 'DISTINCT', value: 'DISTINCT ', type: 'keyword' },
        { label: 'COUNT(*)', value: 'COUNT(*)', type: 'function' },
        { label: 'SUM()', value: 'SUM()', type: 'function' },
        { label: 'AVG()', value: 'AVG()', type: 'function' },
        { label: 'MAX()', value: 'MAX()', type: 'function' },
        { label: 'MIN()', value: 'MIN()', type: 'function' }
      );
      
      // Si on a déjà des colonnes, proposer une virgule puis une colonne
      if (context.selectedColumns.length > 0) {
        suggestions.push(
          { label: ', colonne', value: ', ', type: 'column' }
        );
      }
      break;
      
    case 'after_from':
      // Tables disponibles
      availableTables.forEach(table => {
        if (!wordLower || table.toLowerCase().includes(wordLower)) {
          suggestions.push({
            label: table,
            value: table + ' ',
            type: 'table'
          });
          // Proposer aussi avec alias
          suggestions.push({
            label: `${table} AS t`,
            value: `${table} AS t `,
            type: 'table'
          });
        }
      });
      
      // Mots-clés possibles après FROM
      if (!wordLower || 'join'.includes(wordLower)) {
        suggestions.push(
          { label: 'JOIN', value: 'JOIN ', type: 'keyword' },
          { label: 'INNER JOIN', value: 'INNER JOIN ', type: 'keyword' },
          { label: 'LEFT JOIN', value: 'LEFT JOIN ', type: 'keyword' },
          { label: 'RIGHT JOIN', value: 'RIGHT JOIN ', type: 'keyword' },
          { label: 'CROSS JOIN', value: 'CROSS JOIN ', type: 'keyword' }
        );
      }
      if (!wordLower || 'where'.includes(wordLower)) {
        suggestions.push({ label: 'WHERE', value: 'WHERE ', type: 'keyword' });
      }
      if (!wordLower || 'group'.includes(wordLower)) {
        suggestions.push({ label: 'GROUP BY', value: 'GROUP BY ', type: 'keyword' });
      }
      if (!wordLower || 'order'.includes(wordLower)) {
        suggestions.push({ label: 'ORDER BY', value: 'ORDER BY ', type: 'keyword' });
      }
      if (!wordLower || 'limit'.includes(wordLower)) {
        suggestions.push({ label: 'LIMIT', value: 'LIMIT ', type: 'keyword' });
      }
      break;
      
    case 'after_join':
      // Tables pour la jointure
      availableTables.forEach(table => {
        if (!wordLower || table.toLowerCase().includes(wordLower)) {
          suggestions.push({
            label: table,
            value: table + ' ',
            type: 'table'
          });
        }
      });
      if (!wordLower || 'on'.includes(wordLower)) {
        suggestions.push({ label: 'ON', value: 'ON ', type: 'keyword' });
      }
      break;
      
    case 'after_on':
      // Conditions de jointure : table.colonne = table.colonne
      const allTables = [...context.tables, ...Array.from(context.aliases.keys())];
      if (allTables.length >= 2) {
        const t1 = allTables[0];
        const t2 = allTables[1] || allTables[0];
        suggestions.push(
          { label: `${t1}.id = ${t2}.id`, value: `${t1}.id = ${t2}.id`, type: 'operator' },
          { label: `${t1}.user_id = ${t2}.id`, value: `${t1}.user_id = ${t2}.id`, type: 'operator' },
          { label: `${t1}.client_id = ${t2}.id`, value: `${t1}.client_id = ${t2}.id`, type: 'operator' }
        );
      }
      break;
      
    case 'after_where':
      // Colonnes, opérateurs, conditions
      if (context.selectedColumns.length > 0) {
        context.selectedColumns.forEach(col => {
          if (!wordLower || col.toLowerCase().includes(wordLower)) {
            suggestions.push({
              label: col,
              value: col + ' ',
              type: 'column'
            });
          }
        });
      }
      
      // Opérateurs et conditions
      suggestions.push(
        { label: '= ', value: '= ', type: 'operator' },
        { label: '<> ', value: '<> ', type: 'operator' },
        { label: '!= ', value: '!= ', type: 'operator' },
        { label: '> ', value: '> ', type: 'operator' },
        { label: '< ', value: '< ', type: 'operator' },
        { label: '>= ', value: '>= ', type: 'operator' },
        { label: '<= ', value: '<= ', type: 'operator' },
        { label: 'LIKE ', value: 'LIKE ', type: 'operator' },
        { label: 'IN ', value: 'IN ', type: 'operator' },
        { label: 'BETWEEN ', value: 'BETWEEN ', type: 'operator' },
        { label: 'IS NULL', value: 'IS NULL', type: 'operator' },
        { label: 'IS NOT NULL', value: 'IS NOT NULL', type: 'operator' }
      );
      
      // Opérateurs logiques pour conditions multiples
      if (context.queryBefore.match(/WHERE\s+.*[=<>!]/i)) {
        suggestions.push(
          { label: 'AND ', value: 'AND ', type: 'keyword' },
          { label: 'OR ', value: 'OR ', type: 'keyword' },
          { label: '( ', value: '( ', type: 'operator' },
          { label: ') ', value: ') ', type: 'operator' }
        );
      }
      break;
      
    case 'after_group_by':
      // Colonnes non agrégées du SELECT
      context.selectedColumns.forEach(col => {
        if (!wordLower || col.toLowerCase().includes(wordLower)) {
          suggestions.push({
            label: col,
            value: col + ' ',
            type: 'column'
          });
        }
      });
      if (!wordLower || 'having'.includes(wordLower)) {
        suggestions.push({ label: 'HAVING', value: 'HAVING ', type: 'keyword' });
      }
      break;
      
    case 'after_having':
      // Fonctions d'agrégation
      suggestions.push(
        { label: 'COUNT(*)', value: 'COUNT(*) ', type: 'function' },
        { label: 'SUM()', value: 'SUM() ', type: 'function' },
        { label: 'AVG()', value: 'AVG() ', type: 'function' },
        { label: '> ', value: '> ', type: 'operator' },
        { label: '< ', value: '< ', type: 'operator' },
        { label: '= ', value: '= ', type: 'operator' },
        { label: 'AND ', value: 'AND ', type: 'keyword' },
        { label: 'OR ', value: 'OR ', type: 'keyword' }
      );
      break;
      
    case 'after_order_by':
      // Colonnes du SELECT
      context.selectedColumns.forEach(col => {
        if (!wordLower || col.toLowerCase().includes(wordLower)) {
          suggestions.push({
            label: col,
            value: col + ' ',
            type: 'column'
          });
        }
      });
      suggestions.push(
        { label: 'ASC', value: 'ASC', type: 'keyword' },
        { label: 'DESC', value: 'DESC', type: 'keyword' },
        { label: ', ', value: ', ', type: 'operator' }
      );
      break;
      
    case 'after_limit':
      suggestions.push(
        { label: '10', value: '10', type: 'operator' },
        { label: '100', value: '100', type: 'operator' },
        { label: '1000', value: '1000', type: 'operator' }
      );
      if (!wordLower || 'offset'.includes(wordLower)) {
        suggestions.push({ label: 'OFFSET', value: 'OFFSET ', type: 'keyword' });
      }
      break;
      
    case 'after_insert_into':
      // Tables disponibles
      availableTables.forEach(table => {
        if (!wordLower || table.toLowerCase().includes(wordLower)) {
          suggestions.push({
            label: table,
            value: table + ' ',
            type: 'table'
          });
        }
      });
      break;
      
    case 'after_values':
      suggestions.push(
        { label: '()', value: '()', type: 'operator' },
        { label: '(val1, val2)', value: '(val1, val2)', type: 'operator' }
      );
      break;
      
    case 'after_update':
      // Tables disponibles
      availableTables.forEach(table => {
        if (!wordLower || table.toLowerCase().includes(wordLower)) {
          suggestions.push({
            label: table,
            value: table + ' ',
            type: 'table'
          });
        }
      });
      if (!wordLower || 'set'.includes(wordLower)) {
        suggestions.push({ label: 'SET', value: 'SET ', type: 'keyword' });
      }
      break;
      
    case 'after_set':
      // Colonnes = valeur
      if (context.selectedColumns.length > 0) {
        context.selectedColumns.forEach(col => {
          suggestions.push(
            { label: `${col} = `, value: `${col} = `, type: 'operator' },
            { label: `${col} = NULL`, value: `${col} = NULL`, type: 'operator' }
          );
        });
      } else {
        suggestions.push(
          { label: 'colonne = ', value: 'colonne = ', type: 'operator' },
          { label: 'colonne = NULL', value: 'colonne = NULL', type: 'operator' }
        );
      }
      if (!wordLower || 'where'.includes(wordLower)) {
        suggestions.push({ label: 'WHERE', value: 'WHERE ', type: 'keyword' });
      }
      break;
      
    case 'after_delete':
      if (!wordLower || 'from'.includes(wordLower)) {
        suggestions.push({ label: 'FROM', value: 'FROM ', type: 'keyword' });
      }
      break;
      
    default:
      // Suggestions générales de mots-clés SQL
      const sqlKeywords = [
        'SELECT', 'FROM', 'WHERE', 'JOIN', 'INNER', 'LEFT', 'RIGHT', 'ON',
        'ORDER', 'BY', 'GROUP', 'HAVING', 'LIMIT', 'OFFSET',
        'INSERT', 'INTO', 'VALUES', 'UPDATE', 'SET', 'DELETE',
        'AND', 'OR', 'NOT', 'IN', 'LIKE', 'BETWEEN', 'IS', 'NULL',
        'COUNT', 'SUM', 'AVG', 'MAX', 'MIN', 'DISTINCT'
      ];
      
      sqlKeywords.forEach(keyword => {
        if (!wordLower || keyword.toLowerCase().startsWith(wordLower)) {
          suggestions.push({
            label: keyword,
            value: keyword + ' ',
            type: 'keyword'
          });
        }
      });
  }
  
  return suggestions.slice(0, 20);
}

/**
 * Hook personnalisé pour l'autocomplétion SQL
 */
export function useSqlAutocomplete(
  query: string,
  cursorPosition: number,
  availableTables: string[]
) {
  const context = useMemo(() => {
    return analyzeSqlContext(query, cursorPosition, availableTables);
  }, [query, cursorPosition, availableTables]);
  
  const suggestions = useMemo(() => {
    const currentWord = query.substring(0, cursorPosition)
      .split(/\s+/)
      .pop() || '';
    
    return generateSuggestions(context, availableTables, currentWord);
  }, [context, availableTables, query, cursorPosition]);
  
  return {
    context,
    suggestions,
    hasSuggestions: suggestions.length > 0,
  };
}

