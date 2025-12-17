import React, { useState, useEffect } from 'react';
import { Folder, File, ChevronLeft, ChevronRight, X, Check, Home, HardDrive, Network, Star } from 'lucide-react';

export interface FolderPickerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (path: string) => void;
  initialPath?: string;
  title?: string;
}

interface DirectoryItem {
  name: string;
  path: string;
  isDirectory: boolean;
  size?: number;
}

const FolderPicker: React.FC<FolderPickerProps> = ({
  isOpen,
  onClose,
  onSelect,
  initialPath,
  title = 'Sélectionner un dossier',
}) => {
  const [currentPath, setCurrentPath] = useState<string>(initialPath || '');
  const [items, setItems] = useState<DirectoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [sidebarItems, setSidebarItems] = useState<Array<{ name: string; path: string; type: 'quick' | 'drive' | 'network' }>>([]);

  // Charger les éléments de la barre latérale
  useEffect(() => {
    if (isOpen && window.electronAPI?.getSidebarItems) {
      window.electronAPI.getSidebarItems().then((result) => {
        if (result.success) {
          setSidebarItems(result.items);
        }
      }).catch((err) => {
        console.error('Erreur lors du chargement de la barre latérale:', err);
      });
    }
  }, [isOpen]);

  // Initialiser avec le dossier home ou C:\ sur Windows
  useEffect(() => {
    if (isOpen && !currentPath) {
      const defaultPath = window.electronAPI?.platform === 'win32' 
        ? 'C:\\' 
        : '/';
      setCurrentPath(defaultPath);
      loadDirectory(defaultPath);
    } else if (isOpen && currentPath) {
      loadDirectory(currentPath);
    }
  }, [isOpen]);

  const loadDirectory = async (path: string) => {
    if (!path) return;
    
    setLoading(true);
    setError(null);
    setSelectedPath(null);

    try {
      if (window.electronAPI?.listDirectory) {
        const result = await window.electronAPI.listDirectory(path);
        if (result.success) {
          setItems(result.items);
          setCurrentPath(result.currentPath || path);
        } else {
          setError(result.error || 'Impossible de lire le dossier');
          setItems([]);
        }
      } else {
        // Fallback pour le navigateur (non implémenté pour l'instant)
        setError('L\'API de navigation de fichiers n\'est disponible que dans Electron');
        setItems([]);
      }
    } catch (err: any) {
      setError(err.message || 'Erreur lors du chargement du dossier');
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  const handleItemClick = (item: DirectoryItem) => {
    if (item.isDirectory) {
      // Ajouter à l'historique
      const newHistory = history.slice(0, historyIndex + 1);
      newHistory.push(currentPath);
      setHistory(newHistory);
      setHistoryIndex(newHistory.length - 1);
      
      // Naviguer vers le dossier
      loadDirectory(item.path);
    } else {
      // Sélectionner le fichier (mais on ne peut sélectionner que des dossiers)
      setSelectedPath(item.path);
    }
  };

  const handleDoubleClick = (item: DirectoryItem) => {
    if (item.isDirectory) {
      handleItemClick(item);
    }
  };

  const handleBack = () => {
    if (historyIndex >= 0 && history[historyIndex]) {
      const previousPath = history[historyIndex];
      setHistoryIndex(historyIndex - 1);
      loadDirectory(previousPath);
    } else {
      // Aller au dossier parent
      const isWindows = window.electronAPI?.platform === 'win32';
      const separator = isWindows ? '\\' : '/';
      const parts = currentPath.split(/[/\\]/).filter(p => p);
      if (parts.length > 0) {
        parts.pop();
        const parentPath = isWindows && parts.length === 0 
          ? 'C:\\' 
          : (isWindows ? '' : '/') + parts.join(separator) + (parts.length > 0 ? separator : '');
        if (parentPath && parentPath !== currentPath) {
          const newHistory = [...history];
          newHistory.push(currentPath);
          setHistory(newHistory);
          setHistoryIndex(newHistory.length - 1);
          loadDirectory(parentPath);
        }
      }
    }
  };

  const handleForward = () => {
    if (historyIndex < history.length - 1) {
      const nextIndex = historyIndex + 1;
      const nextPath = history[nextIndex];
      setHistoryIndex(nextIndex);
      loadDirectory(nextPath);
    }
  };

  const handleHome = () => {
    const homePath = window.electronAPI?.platform === 'win32' 
      ? 'C:\\' 
      : '/';
    const newHistory = [...history];
    newHistory.push(currentPath);
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
    loadDirectory(homePath);
  };

  const handleSelect = () => {
    if (selectedPath) {
      onSelect(selectedPath);
      onClose();
    } else if (currentPath) {
      // Si aucun élément n'est sélectionné, utiliser le dossier actuel
      onSelect(currentPath);
      onClose();
    }
  };

  const formatSize = (bytes?: number): string => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  };

  if (!isOpen) return null;

  const canGoBack = historyIndex >= 0 || (currentPath && currentPath.split(/[/\\]/).length > 1);
  const canGoForward = historyIndex < history.length - 1;

  const handleSidebarItemClick = (itemPath: string) => {
    const newHistory = [...history];
    newHistory.push(currentPath);
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
    loadDirectory(itemPath);
  };

  const getSidebarIcon = (type: 'quick' | 'drive' | 'network') => {
    switch (type) {
      case 'quick':
        return <Star className="w-4 h-4" />;
      case 'drive':
        return <HardDrive className="w-4 h-4" />;
      case 'network':
        return <Network className="w-4 h-4" />;
      default:
        return <Folder className="w-4 h-4" />;
    }
  };

  // Grouper les éléments de la barre latérale par type
  const quickAccess = sidebarItems.filter(item => item.type === 'quick');
  const drives = sidebarItems.filter(item => item.type === 'drive');
  const networkItems = sidebarItems.filter(item => item.type === 'network');

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div 
        className="bg-theme-card border border-theme-card rounded-lg shadow-2xl w-[90vw] max-w-6xl h-[80vh] max-h-[600px] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header style macOS */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-theme-border">
          <div className="flex items-center gap-3">
            <div className="flex gap-2">
              <div className="w-3 h-3 rounded-full bg-red-500"></div>
              <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
              <div className="w-3 h-3 rounded-full bg-green-500"></div>
            </div>
            <h2 className="text-lg font-semibold text-theme-foreground">{title}</h2>
          </div>
          <button
            onClick={onClose}
            className="text-theme-secondary hover:text-theme-foreground transition-colors p-1"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Barre de navigation */}
        <div className="px-6 py-3 border-b border-theme-border bg-theme-input/50">
          <div className="flex items-center gap-2">
            <button
              onClick={handleBack}
              disabled={!canGoBack}
              className="p-1.5 rounded hover:bg-theme-secondary disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              title="Précédent"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={handleForward}
              disabled={!canGoForward}
              className="p-1.5 rounded hover:bg-theme-secondary disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              title="Suivant"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <div className="w-px h-6 bg-theme-border mx-1"></div>
            <button
              onClick={handleHome}
              className="p-1.5 rounded hover:bg-theme-secondary transition-colors"
              title="Accueil"
            >
              <Home className="w-4 h-4" />
            </button>
            <div className="flex-1 mx-4">
              <div className="px-3 py-1.5 bg-theme-background border border-theme-input rounded text-sm text-theme-statusbar font-mono truncate">
                {currentPath || '...'}
              </div>
            </div>
          </div>
        </div>

        {/* Contenu principal avec barre latérale */}
        <div className="flex-1 flex overflow-hidden">
          {/* Barre latérale gauche */}
          <div className="w-64 border-r border-theme-border bg-theme-input/30 flex flex-col overflow-hidden">
            <div className="flex-1 overflow-y-auto p-3 space-y-4">
              {/* Emplacements rapides */}
              {quickAccess.length > 0 && (
                <div>
                  <div className="text-xs font-semibold text-theme-secondary uppercase mb-2 px-2">
                    Emplacements rapides
                  </div>
                  <div className="space-y-1">
                    {quickAccess.map((item) => (
                      <button
                        key={item.path}
                        onClick={() => handleSidebarItemClick(item.path)}
                        className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm transition-colors ${
                          currentPath === item.path
                            ? 'bg-theme-primary text-white'
                            : 'text-theme-foreground hover:bg-theme-secondary'
                        }`}
                      >
                        {getSidebarIcon(item.type)}
                        <span className="truncate">{item.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Lecteurs */}
              {drives.length > 0 && (
                <div>
                  <div className="text-xs font-semibold text-theme-secondary uppercase mb-2 px-2">
                    {window.electronAPI?.platform === 'win32' ? 'Lecteurs' : 'Disques'}
                  </div>
                  <div className="space-y-1">
                    {drives.map((item) => (
                      <button
                        key={item.path}
                        onClick={() => handleSidebarItemClick(item.path)}
                        className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm transition-colors ${
                          currentPath === item.path
                            ? 'bg-theme-primary text-white'
                            : 'text-theme-foreground hover:bg-theme-secondary'
                        }`}
                      >
                        {getSidebarIcon(item.type)}
                        <span className="truncate">{item.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Connexions réseau */}
              {networkItems.length > 0 && (
                <div>
                  <div className="text-xs font-semibold text-theme-secondary uppercase mb-2 px-2">
                    Réseau
                  </div>
                  <div className="space-y-1">
                    {networkItems.map((item) => (
                      <button
                        key={item.path}
                        onClick={() => handleSidebarItemClick(item.path)}
                        className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm transition-colors ${
                          currentPath === item.path
                            ? 'bg-theme-primary text-white'
                            : 'text-theme-foreground hover:bg-theme-secondary'
                        }`}
                      >
                        {getSidebarIcon(item.type)}
                        <span className="truncate">{item.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Liste des fichiers/dossiers */}
          <div className="flex-1 overflow-auto p-4">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-theme-secondary">Chargement...</div>
            </div>
          ) : error ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-red-400">{error}</div>
            </div>
          ) : items.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-theme-secondary">Dossier vide</div>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-1">
              {items.map((item) => (
                <div
                  key={item.path}
                  onClick={() => handleItemClick(item)}
                  onDoubleClick={() => handleDoubleClick(item)}
                  className={`flex items-center gap-3 px-4 py-2 rounded cursor-pointer transition-colors ${
                    selectedPath === item.path
                      ? 'bg-theme-primary text-white'
                      : 'hover:bg-theme-secondary text-theme-foreground'
                  } ${item.isDirectory ? 'font-medium' : ''}`}
                >
                  {item.isDirectory ? (
                    <Folder className="w-5 h-5 flex-shrink-0" />
                  ) : (
                    <File className="w-5 h-5 flex-shrink-0 opacity-50" />
                  )}
                  <span className="flex-1 truncate">{item.name}</span>
                  {!item.isDirectory && item.size && (
                    <span className="text-xs opacity-70">{formatSize(item.size)}</span>
                  )}
                </div>
              ))}
            </div>
          )}
          </div>
        </div>

        {/* Footer avec boutons */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-theme-border">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-theme-secondary rounded text-white transition-colors"
          >
            Annuler
          </button>
          <button
            onClick={handleSelect}
            disabled={!currentPath}
            className="px-4 py-2 bg-theme-primary disabled:opacity-50 disabled:cursor-not-allowed rounded text-white transition-colors flex items-center gap-2"
          >
            <Check className="w-4 h-4" />
            Sélectionner
          </button>
        </div>
      </div>
    </div>
  );
};

export default FolderPicker;

