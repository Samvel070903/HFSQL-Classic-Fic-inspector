import { app, BrowserWindow, Menu, dialog, ipcMain } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import * as fs from 'fs';
import * as os from 'os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let mainWindow: BrowserWindow | null = null;

function sendToRenderer(channel: string, ...args: any[]) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, ...args);
  }
}

// Handlers pour les contrôles de fenêtre
ipcMain.handle('window:minimize', () => {
  if (mainWindow) {
    mainWindow.minimize();
  }
});

ipcMain.handle('window:maximize', () => {
  if (mainWindow) {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow.maximize();
    }
  }
});

ipcMain.handle('window:close', () => {
  if (mainWindow) {
    mainWindow.close();
  }
});

function createMenu() {
  // Menu minimal pour les raccourcis clavier uniquement
  // Le menu visuel est géré par React
  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: 'Fichier',
      submenu: [
        {
          label: 'Importer des fichiers...',
          accelerator: 'CmdOrCtrl+I',
          click: () => {
            sendToRenderer('menu:import-files');
          },
        },
        {
          label: 'Scanner les tables',
          accelerator: 'CmdOrCtrl+Shift+S',
          click: () => {
            sendToRenderer('menu:scan-tables');
          },
        },
        { type: 'separator' },
        {
          label: 'Quitter',
          accelerator: process.platform === 'darwin' ? 'Cmd+Q' : 'Ctrl+Q',
          click: () => {
            app.quit();
          },
        },
      ],
    },
    {
      label: 'Navigation',
      submenu: [
        {
          label: 'Tableau de bord',
          accelerator: 'CmdOrCtrl+1',
          click: () => {
            sendToRenderer('menu:navigate', '/dashboard');
          },
        },
        {
          label: 'Tables',
          accelerator: 'CmdOrCtrl+2',
          click: () => {
            sendToRenderer('menu:navigate', '/tables');
          },
        },
        {
          label: 'ODBC / SQL',
          accelerator: 'CmdOrCtrl+3',
          click: () => {
            sendToRenderer('menu:navigate', '/odbc');
          },
        },
        {
          label: 'Logs & Diagnostics',
          accelerator: 'CmdOrCtrl+4',
          click: () => {
            sendToRenderer('menu:navigate', '/logs');
          },
        },
        {
          label: 'Paramètres',
          accelerator: 'CmdOrCtrl+,',
          click: () => {
            sendToRenderer('menu:navigate', '/settings');
          },
        },
      ],
    },
    {
      label: 'Édition',
      submenu: [
        {
          label: 'Annuler',
          accelerator: 'CmdOrCtrl+Z',
          role: 'undo',
        },
        {
          label: 'Rétablir',
          accelerator: 'Shift+CmdOrCtrl+Z',
          role: 'redo',
        },
        { type: 'separator' },
        {
          label: 'Couper',
          accelerator: 'CmdOrCtrl+X',
          role: 'cut',
        },
        {
          label: 'Copier',
          accelerator: 'CmdOrCtrl+C',
          role: 'copy',
        },
        {
          label: 'Coller',
          accelerator: 'CmdOrCtrl+V',
          role: 'paste',
        },
        {
          label: 'Supprimer',
          accelerator: 'Delete',
          role: 'delete',
        },
        { type: 'separator' },
        {
          label: 'Tout sélectionner',
          accelerator: 'CmdOrCtrl+A',
          role: 'selectAll',
        },
      ],
    },
    {
      label: 'Affichage',
      submenu: [
        {
          label: 'Actualiser',
          accelerator: 'CmdOrCtrl+R',
          click: (item, focusedWindow) => {
            if (focusedWindow) {
              focusedWindow.reload();
            }
          },
        },
        {
          label: 'Recharger complètement',
          accelerator: 'CmdOrCtrl+Shift+R',
          click: (item, focusedWindow) => {
            if (focusedWindow) {
              focusedWindow.webContents.reloadIgnoringCache();
            }
          },
        },
        { type: 'separator' },
        {
          label: 'Zoom avant',
          accelerator: 'CmdOrCtrl+Plus',
          click: (item, focusedWindow) => {
            if (focusedWindow) {
              focusedWindow.webContents.zoomLevel += 0.5;
            }
          },
        },
        {
          label: 'Zoom arrière',
          accelerator: 'CmdOrCtrl+-',
          click: (item, focusedWindow) => {
            if (focusedWindow) {
              focusedWindow.webContents.zoomLevel -= 0.5;
            }
          },
        },
        {
          label: 'Réinitialiser le zoom',
          accelerator: 'CmdOrCtrl+0',
          click: (item, focusedWindow) => {
            if (focusedWindow) {
              focusedWindow.webContents.zoomLevel = 0;
            }
          },
        },
        { type: 'separator' },
        {
          label: 'Plein écran',
          accelerator: 'F11',
          click: (item, focusedWindow) => {
            if (focusedWindow) {
              focusedWindow.setFullScreen(!focusedWindow.isFullScreen());
            }
          },
        },
      ],
    },
    {
      label: 'Outils',
      submenu: [
        {
          label: 'Ouvrir ODBC / SQL',
          accelerator: 'CmdOrCtrl+T',
          click: () => {
            sendToRenderer('menu:navigate', '/odbc');
          },
        },
        {
          label: 'Voir les logs',
          accelerator: 'CmdOrCtrl+L',
          click: () => {
            sendToRenderer('menu:navigate', '/logs');
          },
        },
      ],
    },
    {
      label: 'Aide',
      submenu: [
        {
          label: 'À propos de FIC Inspector',
          click: () => {
            dialog.showMessageBox(mainWindow!, {
              type: 'info',
              title: 'À propos de FIC Inspector',
              message: 'FIC Inspector',
              detail: 'Interface graphique pour inspecter les fichiers HFSQL (.fic, .mmo, .ndx)\n\nVersion 0.1.0',
            });
          },
        },
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  // Sur Windows/Linux, masquer le menu pour utiliser notre menu personnalisé
  if (process.platform !== 'darwin') {
    Menu.setApplicationMenu(null);
  } else {
    // Sur macOS, garder le menu mais le rendre invisible
    Menu.setApplicationMenu(menu);
  }
}

function createWindow() {
  const windowOptions: Electron.BrowserWindowConstructorOptions = {
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 600,
    backgroundColor: '#0f172a',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      devTools: false, // Désactiver les DevTools
    },
    // Sur macOS, utiliser une barre de titre intégrée
    // Sur Windows/Linux, utiliser une fenêtre frameless pour contrôler la barre de titre
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : undefined,
    frame: process.platform === 'darwin', // Garder le frame uniquement sur macOS
    autoHideMenuBar: process.platform !== 'darwin', // Masquer automatiquement le menu sur Windows/Linux
    show: false,
  };

  // Sur Windows, utiliser frame: false pour que notre MenuBar personnalisée
  // remplace la barre de titre système native avec la couleur claire du thème
  if (process.platform === 'win32') {
    windowOptions.frame = false; // Pas de barre système native, on utilise notre MenuBar
  }

  mainWindow = new BrowserWindow(windowOptions);

  // Charger l'app React
  const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;
  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    // Ne pas ouvrir les DevTools automatiquement
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  createMenu(); // Créer le menu personnalisé
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Handler pour sélectionner un dossier (ancienne API)
ipcMain.handle('folder:select', async () => {
  const result = await dialog.showOpenDialog(mainWindow!, {
    properties: ['openDirectory'],
    title: 'Sélectionner un dossier',
  });
  
  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }
  
  return result.filePaths[0];
});

// Liste des fichiers système Windows à ignorer
const WINDOWS_SYSTEM_FILES = new Set([
  'DumpStack.log',
  'DumpStack.log.tmp',
  'hiberfil.sys',
  'pagefile.sys',
  'swapfile.sys',
  '$Recycle.Bin',
  'System Volume Information',
  'Recovery',
  'Boot',
  'bootmgr',
  'BOOTNXT',
  'BOOTSECT.BAK',
]);

// Vérifier si un fichier/dossier doit être ignoré
function shouldSkipFile(fileName: string, isDirectory: boolean): boolean {
  if (process.platform === 'win32') {
    // Ignorer les fichiers système Windows
    if (WINDOWS_SYSTEM_FILES.has(fileName)) {
      return true;
    }
    // Ignorer les fichiers cachés (commençant par .) et les fichiers système
    if (fileName.startsWith('$') || fileName.startsWith('.')) {
      return true;
    }
  }
  return false;
}

// Handler pour lister le contenu d'un dossier
ipcMain.handle('folder:list', async (_event, dirPath: string) => {
  try {
    if (!dirPath || !fs.existsSync(dirPath)) {
      return { success: false, error: 'Chemin invalide', items: [] };
    }
    
    const stats = fs.statSync(dirPath);
    if (!stats.isDirectory()) {
      return { success: false, error: 'Le chemin n\'est pas un dossier', items: [] };
    }
    
    const items: Array<{ name: string; path: string; isDirectory: boolean; size?: number }> = [];
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    
    // Trier : dossiers d'abord, puis fichiers
    const directories = entries
      .filter(e => e.isDirectory() && !shouldSkipFile(e.name, true))
      .sort((a, b) => a.name.localeCompare(b.name));
    const files = entries
      .filter(e => e.isFile() && !shouldSkipFile(e.name, false))
      .sort((a, b) => a.name.localeCompare(b.name));
    
    // Ajouter les dossiers
    for (const entry of directories) {
      const fullPath = path.join(dirPath, entry.name);
      try {
        items.push({
          name: entry.name,
          path: fullPath,
          isDirectory: true,
        });
      } catch (e) {
        // Ignorer silencieusement les dossiers inaccessibles
      }
    }
    
    // Ajouter les fichiers
    for (const entry of files) {
      const fullPath = path.join(dirPath, entry.name);
      try {
        const fileStats = fs.statSync(fullPath);
        items.push({
          name: entry.name,
          path: fullPath,
          isDirectory: false,
          size: fileStats.size,
        });
      } catch (e: any) {
        // Ignorer silencieusement les fichiers inaccessibles
        // Ne pas logger les erreurs EPERM ou EBUSY pour les fichiers système
        if (e.code !== 'EPERM' && e.code !== 'EBUSY') {
          // Logger uniquement les autres types d'erreurs
          console.error(`Impossible de lire ${fullPath}:`, e);
        }
      }
    }
    
    return { success: true, items, currentPath: dirPath };
  } catch (error: any) {
    return { success: false, error: error.message || 'Erreur inconnue', items: [] };
  }
});

// Handler pour obtenir les emplacements rapides et lecteurs
ipcMain.handle('folder:getSidebarItems', async () => {
  try {
    const platform = process.platform;
    const items: Array<{ name: string; path: string; type: 'quick' | 'drive' | 'network' }> = [];
    
    if (platform === 'win32') {
      // Emplacements rapides Windows
      const homeDir = os.homedir();
      const quickAccess = [
        { name: 'Accueil', path: homeDir, type: 'quick' as const },
        { name: 'Bureau', path: path.join(homeDir, 'Desktop'), type: 'quick' as const },
        { name: 'Documents', path: path.join(homeDir, 'Documents'), type: 'quick' as const },
        { name: 'Téléchargements', path: path.join(homeDir, 'Downloads'), type: 'quick' as const },
        { name: 'Images', path: path.join(homeDir, 'Pictures'), type: 'quick' as const },
        { name: 'Musique', path: path.join(homeDir, 'Music'), type: 'quick' as const },
        { name: 'Vidéos', path: path.join(homeDir, 'Videos'), type: 'quick' as const },
      ];
      
      // Filtrer les emplacements qui existent
      for (const item of quickAccess) {
        try {
          if (fs.existsSync(item.path)) {
            items.push(item);
          }
        } catch (e) {
          // Ignorer les emplacements inaccessibles
        }
      }
      
      // Lister les lecteurs (C:\, D:\, etc.)
      const drives: string[] = [];
      for (let letter = 'A'.charCodeAt(0); letter <= 'Z'.charCodeAt(0); letter++) {
        const drive = String.fromCharCode(letter) + ':\\';
        try {
          if (fs.existsSync(drive)) {
            drives.push(drive);
          }
        } catch (e) {
          // Ignorer les lecteurs inaccessibles
        }
      }
      
      // Ajouter les lecteurs locaux
      for (const drive of drives) {
        try {
          const stats = fs.statSync(drive);
          if (stats.isDirectory()) {
            items.push({
              name: drive,
              path: drive,
              type: 'drive',
            });
          }
        } catch (e) {
          // Ignorer
        }
      }
      
      // Connexions réseau (lecteurs réseau mappés)
      // Sur Windows, on peut détecter les lecteurs réseau en vérifiant le type de lecteur
      // Les lecteurs réseau mappés commencent généralement à partir de Z:
      // On peut aussi essayer d'accéder à \\Network pour lister les partages
      const networkDrives: string[] = [];
      for (let letter = 'Z'.charCodeAt(0); letter >= 'A'.charCodeAt(0); letter--) {
        const drive = String.fromCharCode(letter) + ':\\';
        try {
          if (fs.existsSync(drive)) {
            // Vérifier si c'est un lecteur réseau en essayant de lire ses propriétés
            // Les lecteurs réseau ont souvent un chemin UNC associé
            const stats = fs.statSync(drive);
            if (stats.isDirectory()) {
              // Vérifier si le chemin ressemble à un chemin réseau
              // (cette vérification est basique, une vraie vérification nécessiterait WNetGetConnection)
              networkDrives.push(drive);
            }
          }
        } catch (e) {
          // Ignorer
        }
      }
      
      // Ajouter les lecteurs réseau détectés
      for (const drive of networkDrives) {
        items.push({
          name: `Réseau (${drive})`,
          path: drive,
          type: 'network',
        });
      }
      
      // Ajouter une entrée pour accéder au réseau
      items.push({
        name: 'Réseau',
        path: '\\\\Network',
        type: 'network',
      });
      
    } else {
      // Linux/macOS
      const homeDir = os.homedir();
      const quickAccess = [
        { name: 'Accueil', path: homeDir, type: 'quick' as const },
        { name: 'Bureau', path: path.join(homeDir, 'Desktop'), type: 'quick' as const },
        { name: 'Documents', path: path.join(homeDir, 'Documents'), type: 'quick' as const },
        { name: 'Téléchargements', path: path.join(homeDir, 'Downloads'), type: 'quick' as const },
        { name: 'Images', path: path.join(homeDir, 'Pictures'), type: 'quick' as const },
        { name: 'Musique', path: path.join(homeDir, 'Music'), type: 'quick' as const },
        { name: 'Vidéos', path: path.join(homeDir, 'Videos'), type: 'quick' as const },
      ];
      
      for (const item of quickAccess) {
        try {
          if (fs.existsSync(item.path)) {
            items.push(item);
          }
        } catch (e) {
          // Ignorer
        }
      }
      
      // Racine du système
      items.push({
        name: 'Racine',
        path: '/',
        type: 'drive',
      });
      
      // Points de montage courants
      const mountPoints = ['/mnt', '/media', '/Volumes'];
      for (const mountPoint of mountPoints) {
        try {
          if (fs.existsSync(mountPoint)) {
            const entries = fs.readdirSync(mountPoint, { withFileTypes: true });
            for (const entry of entries) {
              if (entry.isDirectory()) {
                const fullPath = path.join(mountPoint, entry.name);
                items.push({
                  name: entry.name,
                  path: fullPath,
                  type: 'drive',
                });
              }
            }
          }
        } catch (e) {
          // Ignorer
        }
      }
    }
    
    return { success: true, items };
  } catch (error: any) {
    return { success: false, error: error.message || 'Erreur inconnue', items: [] };
  }
});


