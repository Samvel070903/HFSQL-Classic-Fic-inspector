import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Terminal,
  Settings,
  LayoutDashboard,
  ChevronDown,
  FileCode,
  FileText,
  ZoomIn,
  ZoomOut,
  Maximize,
  Minimize,
  X,
} from 'lucide-react';
import clsx from 'clsx';

// Types pour les items du menu
interface MenuItemAction {
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  shortcut?: string;
  action: () => void;
  disabled?: boolean;
  path?: never;
  type?: never;
}

interface MenuItemPath {
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  shortcut?: string;
  path: string;
  action?: never;
  disabled?: never;
  type?: never;
}

interface MenuItemSeparator {
  type: 'separator';
  label?: never;
  icon?: never;
  shortcut?: never;
  action?: never;
  path?: never;
  disabled?: never;
}

type MenuItem = MenuItemAction | MenuItemPath | MenuItemSeparator;


const MenuBar: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [platform, setPlatform] = useState<string>('');

  // Détecter la plateforme de manière sécurisée
  React.useEffect(() => {
    if (window.electronAPI?.platform) {
      setPlatform(window.electronAPI.platform);
    } else {
      // Fallback pour le navigateur
      setPlatform('web');
    }
  }, []);

  const handleNavigate = (path: string) => {
    navigate(path);
    setActiveMenu(null);
  };

  const menuItems: Array<{
    label: string;
    items: MenuItem[];
  }> = [
    {
      label: 'Fichier',
      items: [
        {
          label: 'Quitter',
          shortcut: 'Ctrl+Q',
          action: () => {
            if (window.electronAPI) {
              // Envoyer un message pour quitter
              window.dispatchEvent(new CustomEvent('menu:quit'));
            }
          },
        },
      ],
    },
    {
      label: 'Navigation',
      items: [
        {
          label: 'Tableau de bord',
          icon: LayoutDashboard,
          shortcut: 'Ctrl+1',
          path: '/dashboard',
        },
        {
          label: 'ODBC / SQL',
          icon: Terminal,
          shortcut: 'Ctrl+2',
          path: '/odbc',
        },
        {
          label: 'Logs & Diagnostics',
          icon: FileText,
          shortcut: 'Ctrl+3',
          path: '/logs',
        },
        {
          label: 'Paramètres',
          icon: Settings,
          shortcut: 'Ctrl+,',
          path: '/settings',
        },
      ],
    },
    {
      label: 'Affichage',
      items: [
        {
          label: 'Actualiser',
          shortcut: 'Ctrl+R',
          action: () => window.location.reload(),
        },
        {
          label: 'Zoom avant',
          icon: ZoomIn,
          shortcut: 'Ctrl++',
          action: () => {
            // Logique de zoom
          },
        },
        {
          label: 'Zoom arrière',
          icon: ZoomOut,
          shortcut: 'Ctrl+-',
          action: () => {
            // Logique de zoom
          },
        },
        { type: 'separator' as const },
        {
          label: 'Plein écran',
          icon: Maximize,
          shortcut: 'F11',
          action: () => {
            // Logique plein écran
          },
        },
      ],
    },
    {
      label: 'Outils',
      items: [
        {
          label: 'Ouvrir ODBC / SQL',
          icon: Terminal,
          shortcut: 'Ctrl+T',
          path: '/odbc',
        },
        {
          label: 'Voir les logs',
          icon: FileText,
          shortcut: 'Ctrl+L',
          path: '/logs',
        },
      ],
    },
    {
      label: 'Aide',
      items: [
        {
          label: 'À propos de FIC Inspector',
          icon: FileCode,
          action: () => {
            alert('FIC Inspector\nVersion 0.1.0\n\nInterface graphique pour inspecter les fichiers HFSQL (.fic, .mmo, .ndx)');
          },
        },
      ],
    },
  ];

  const handleMenuClick = (menuLabel: string) => {
    setActiveMenu(activeMenu === menuLabel ? null : menuLabel);
  };

  const handleItemClick = (item: MenuItem) => {
    if ('type' in item && item.type === 'separator') return;
    if ('disabled' in item && item.disabled) return;
    
    if ('path' in item && item.path) {
      handleNavigate(item.path);
    } else if ('action' in item && item.action) {
      item.action();
      setActiveMenu(null);
    }
  };

  // Fermer le menu si on clique ailleurs
  React.useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.menu-bar')) {
        setActiveMenu(null);
      }
    };

    if (activeMenu) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [activeMenu]);

  return (
    <div 
      className="menu-bar h-10 bg-theme-menubar border-b border-theme-menubar flex items-center px-2 text-sm select-none relative z-50 shadow-sm"
      style={platform && platform !== 'darwin' && platform !== 'web' ? { WebkitAppRegion: 'drag' } as any : {}}
    >
      {/* Logo/Titre - Zone de drag sur Windows/Linux */}
      <div 
        className="flex items-center gap-2 px-3 mr-4 flex-1"
      >
        <div className="relative">
          <FileCode className="w-4 h-4 text-theme-primary drop-shadow-sm" />
          <div className="absolute inset-0 opacity-20 blur-sm" style={{ backgroundColor: 'var(--primary)' }} />
        </div>
        <span className="font-bold text-theme-menubar text-xs tracking-wide">FIC Inspector</span>
      </div>

      {/* Menus */}
      <div className="flex items-center gap-1" style={platform && platform !== 'darwin' && platform !== 'web' ? { WebkitAppRegion: 'no-drag' } as any : {}}>
        {menuItems.map((menu) => (
          <div key={menu.label} className="relative">
            <button
              onClick={() => handleMenuClick(menu.label)}
              style={platform && platform !== 'darwin' && platform !== 'web' ? { WebkitAppRegion: 'no-drag' } as any : {}}
              className={clsx(
                'px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-150 flex items-center gap-1.5',
                activeMenu === menu.label
                  ? 'bg-theme-menubar-active text-theme-menubar-active shadow-lg'
                  : 'text-theme-menubar bg-theme-menubar-hover'
              )}
            >
              {menu.label}
              <ChevronDown className={clsx('w-3 h-3 transition-transform', activeMenu === menu.label && 'rotate-180')} />
            </button>

            {/* Dropdown menu */}
            {activeMenu === menu.label && (
              <div 
                className="absolute top-full left-0 mt-1.5 bg-theme-menubar-dropdown border border-theme-menubar-dropdown rounded-lg shadow-2xl min-w-[240px] py-1.5 z-50 backdrop-blur-md ring-1"
                style={platform && platform !== 'darwin' && platform !== 'web' ? { WebkitAppRegion: 'no-drag' } as any : {}}
              >
                {menu.items.map((item, idx) => {
                  if ('type' in item && item.type === 'separator') {
                    return (
                      <div
                        key={idx}
                        className="h-px bg-theme-menubar-dropdown-separator my-1 mx-2"
                      />
                    );
                  }

                  const Icon = 'icon' in item ? item.icon : undefined;
                  const isActive = 'path' in item && item.path && location.pathname === item.path;
                  const isDisabled = 'disabled' in item && item.disabled;
                  const shortcut = 'shortcut' in item ? item.shortcut : undefined;
                  const label = 'label' in item ? item.label : '';

                  return (
                    <button
                      key={idx}
                      onClick={() => handleItemClick(item)}
                      disabled={isDisabled}
                      style={{
                        ...(platform && platform !== 'darwin' && platform !== 'web' ? { WebkitAppRegion: 'no-drag' } as any : {}),
                        ...(isActive ? { borderLeftColor: 'var(--primary)' } : {})
                      }}
                      className={clsx(
                        'w-full px-3 py-2 text-left text-xs flex items-center justify-between transition-all duration-150',
                        isActive
                          ? 'bg-theme-primary/30 text-theme-primary border-l-2'
                          : isDisabled
                          ? 'text-theme-menubar-dropdown opacity-50 cursor-not-allowed'
                          : 'text-theme-menubar-dropdown bg-theme-menubar-dropdown-hover hover:translate-x-0.5'
                      )}
                    >
                      <div className="flex items-center gap-2.5">
                        {Icon && <Icon className={clsx('w-3.5 h-3.5', isActive && 'text-theme-primary')} />}
                        <span className="font-medium">{label}</span>
                      </div>
                      {shortcut && (
                        <span className={clsx(
                          'text-xs ml-4 px-1.5 py-0.5 rounded font-mono',
                          isActive ? 'text-theme-primary/70 bg-theme-primary/10' : 'text-theme-menubar-dropdown opacity-60 bg-theme-menubar-dropdown/30'
                        )}>
                          {shortcut}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Espace flexible - Zone de drag */}
      <div className="flex-1" />

      {/* Contrôles de fenêtre (Windows/Linux) */}
      {platform && platform !== 'darwin' && platform !== 'web' && window.electronAPI?.windowControls && (
        <div className="flex items-center gap-0.5 mr-1" style={{ WebkitAppRegion: 'no-drag' } as any}>
          <button
            className="w-9 h-9 flex items-center justify-center text-theme-menubar-controls bg-theme-menubar-controls-hover transition-all duration-150 rounded-md group"
            onClick={() => {
              window.electronAPI?.windowControls?.minimize();
            }}
            title="Réduire"
          >
            <Minimize className="w-4 h-4 group-hover:scale-110 transition-transform" />
          </button>
          <button
            className="w-9 h-9 flex items-center justify-center text-theme-menubar-controls bg-theme-menubar-controls-hover transition-all duration-150 rounded-md group"
            onClick={() => {
              window.electronAPI?.windowControls?.maximize();
            }}
            title="Agrandir/Restaurer"
          >
            <Maximize className="w-4 h-4 group-hover:scale-110 transition-transform" />
          </button>
          <button
            className="w-9 h-9 flex items-center justify-center text-theme-menubar-controls hover:bg-red-600 hover:text-white transition-all duration-150 rounded-md group"
            onClick={() => {
              window.electronAPI?.windowControls?.close();
            }}
            title="Fermer"
          >
            <X className="w-4 h-4 group-hover:scale-110 transition-transform" />
          </button>
        </div>
      )}
    </div>
  );
};

export default MenuBar;