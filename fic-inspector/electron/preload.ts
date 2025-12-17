import { contextBridge, ipcRenderer } from 'electron';

// Exposer des APIs sécurisées au renderer
contextBridge.exposeInMainWorld('electronAPI', {
  // Écouter les messages du menu
  onMenuAction: (callback: (channel: string, ...args: any[]) => void) => {
    const handlers: Array<() => void> = [];
    
    // Créer des handlers pour chaque canal
    const createHandler = (channel: string) => {
      const handler = (_event: any, ...args: any[]) => {
        callback(channel, ...args);
      };
      ipcRenderer.on(channel, handler);
      return () => {
        ipcRenderer.removeListener(channel, handler);
      };
    };
    
    handlers.push(createHandler('menu:import-files'));
    handlers.push(createHandler('menu:scan-tables'));
    handlers.push(createHandler('menu:navigate'));
    
    // Retourner une fonction de nettoyage
    return () => {
      handlers.forEach(cleanup => cleanup());
    };
  },
  
  // Contrôles de fenêtre
  windowControls: {
    minimize: () => ipcRenderer.invoke('window:minimize'),
    maximize: () => ipcRenderer.invoke('window:maximize'),
    close: () => ipcRenderer.invoke('window:close'),
  },
  
  // Informations sur la plateforme
  platform: process.platform,
  
  // Sélection de dossier (ancienne API, gardée pour compatibilité)
  selectFolder: () => ipcRenderer.invoke('folder:select'),
  
  // Nouvelles APIs pour le navigateur de fichiers
  listDirectory: (path: string) => ipcRenderer.invoke('folder:list', path),
  selectFolderDialog: () => ipcRenderer.invoke('folder:select'),
  getSidebarItems: () => ipcRenderer.invoke('folder:getSidebarItems'),
});

