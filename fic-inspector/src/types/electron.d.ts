/**
 * Déclarations TypeScript pour l'API Electron
 */

interface DirectoryItem {
  name: string;
  path: string;
  isDirectory: boolean;
  size?: number;
}

interface ListDirectoryResult {
  success: boolean;
  items: DirectoryItem[];
  currentPath?: string;
  error?: string;
}

declare global {
  interface Window {
    electronAPI?: {
      onMenuAction: (callback: (channel: string, ...args: any[]) => void) => () => void;
      windowControls?: {
        minimize: () => void;
        maximize: () => void;
        close: () => void;
      };
      platform?: string;
      selectFolder?: () => Promise<string | null>;
      selectFolderDialog?: () => Promise<string | null>;
      listDirectory?: (path: string) => Promise<ListDirectoryResult>;
      getSidebarItems?: () => Promise<{ success: boolean; items: Array<{ name: string; path: string; type: 'quick' | 'drive' | 'network' }>; error?: string }>;
    };
  }
}

export {};

