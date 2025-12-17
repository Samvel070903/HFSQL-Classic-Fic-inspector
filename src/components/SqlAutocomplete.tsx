import React from 'react';
import { AutocompleteSuggestion } from '../hooks/useSqlAutocomplete';
import { Database, Code, Zap, Hash } from 'lucide-react';

interface SqlAutocompleteProps {
  suggestions: AutocompleteSuggestion[];
  selectedIndex: number;
  onSelect: (suggestion: AutocompleteSuggestion) => void;
  position: { top: number; left: number };
  visible: boolean;
}

const SqlAutocomplete: React.FC<SqlAutocompleteProps> = ({
  suggestions,
  selectedIndex,
  onSelect,
  position,
  visible,
}) => {
  if (!visible || suggestions.length === 0) {
    return null;
  }

  const getIcon = (type: AutocompleteSuggestion['type']) => {
    switch (type) {
      case 'table':
        return <Database className="w-4 h-4" />;
      case 'function':
        return <Hash className="w-4 h-4" />;
      case 'keyword':
        return <Code className="w-4 h-4" />;
      case 'operator':
        return <Zap className="w-4 h-4" />;
      case 'column':
        return <Database className="w-4 h-4" />;
      default:
        return <Code className="w-4 h-4" />;
    }
  };

  const getTypeColor = (type: AutocompleteSuggestion['type']) => {
    switch (type) {
      case 'table':
        return 'text-blue-400';
      case 'function':
        return 'text-purple-400';
      case 'keyword':
        return 'text-yellow-400';
      case 'operator':
        return 'text-green-400';
      case 'column':
        return 'text-cyan-400';
      default:
        return 'text-gray-400';
    }
  };

  return (
    <div
      className="fixed z-50 bg-theme-card border border-theme-card rounded-lg shadow-xl max-h-64 overflow-y-auto min-w-[300px]"
      style={{
        top: `${position.top}px`,
        left: `${position.left}px`,
      }}
    >
      <div className="p-1">
        {suggestions.map((suggestion, index) => (
          <button
            key={index}
            onClick={() => onSelect(suggestion)}
            className={`w-full text-left px-3 py-2 rounded flex items-center gap-2 transition-colors ${
              index === selectedIndex
                ? 'bg-theme-primary text-white'
                : 'hover:bg-theme-secondary text-theme-statusbar'
            }`}
          >
            <span className={index === selectedIndex ? 'text-white' : getTypeColor(suggestion.type)}>
              {getIcon(suggestion.type)}
            </span>
            <div className="flex-1 min-w-0">
              <div className="font-mono text-sm truncate">{suggestion.label}</div>
              {suggestion.description && (
                <div className={`text-xs truncate ${
                  index === selectedIndex ? 'text-white/80' : 'text-theme-secondary'
                }`}>
                  {suggestion.description}
                </div>
              )}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};

export default SqlAutocomplete;

