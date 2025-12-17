import { useEffect } from 'react';
import { Theme } from '../themes/types';

export const useTheme = (theme: Theme) => {
  useEffect(() => {
    const root = document.documentElement;
    
    // Appliquer les variables CSS du thème
    root.style.setProperty('--background', theme.colors.background);
    root.style.setProperty('--foreground', theme.colors.foreground);
    root.style.setProperty('--border', theme.colors.border);
    root.style.setProperty('--primary', theme.colors.primary);
    root.style.setProperty('--secondary', theme.colors.secondary);
    root.style.setProperty('--accent', theme.colors.accent);
    
    // Sidebar
    root.style.setProperty('--sidebar-bg', theme.colors.sidebar.bg);
    root.style.setProperty('--sidebar-border', theme.colors.sidebar.border);
    root.style.setProperty('--sidebar-text', theme.colors.sidebar.text);
    root.style.setProperty('--sidebar-active', theme.colors.sidebar.active);
    root.style.setProperty('--sidebar-hover', theme.colors.sidebar.hover);
    
    // StatusBar
    root.style.setProperty('--statusbar-bg', theme.colors.statusBar.bg);
    root.style.setProperty('--statusbar-border', theme.colors.statusBar.border);
    root.style.setProperty('--statusbar-text', theme.colors.statusBar.text);
    
    // Card
    root.style.setProperty('--card-bg', theme.colors.card.bg);
    root.style.setProperty('--card-border', theme.colors.card.border);
    root.style.setProperty('--card-text', theme.colors.card.text);
    
    // Input
    root.style.setProperty('--input-bg', theme.colors.input.bg);
    root.style.setProperty('--input-border', theme.colors.input.border);
    root.style.setProperty('--input-text', theme.colors.input.text);
    root.style.setProperty('--input-placeholder', theme.colors.input.placeholder);
    root.style.setProperty('--input-focus', theme.colors.input.focus);
    
    // Button
    root.style.setProperty('--button-primary', theme.colors.button.primary);
    root.style.setProperty('--button-primary-hover', theme.colors.button.primaryHover);
    root.style.setProperty('--button-secondary', theme.colors.button.secondary);
    root.style.setProperty('--button-secondary-hover', theme.colors.button.secondaryHover);
    
    // Scrollbar
    root.style.setProperty('--scrollbar-track', theme.colors.scrollbar.track);
    root.style.setProperty('--scrollbar-thumb', theme.colors.scrollbar.thumb);
    root.style.setProperty('--scrollbar-thumb-hover', theme.colors.scrollbar.thumbHover);
    
    // Menubar
    root.style.setProperty('--menubar-bg', theme.colors.menubar.bg);
    root.style.setProperty('--menubar-border', theme.colors.menubar.border);
    root.style.setProperty('--menubar-text', theme.colors.menubar.text);
    root.style.setProperty('--menubar-hover', theme.colors.menubar.hover);
    root.style.setProperty('--menubar-active', theme.colors.menubar.active);
    root.style.setProperty('--menubar-active-text', theme.colors.menubar.activeText);
    root.style.setProperty('--menubar-dropdown-bg', theme.colors.menubar.dropdown.bg);
    root.style.setProperty('--menubar-dropdown-border', theme.colors.menubar.dropdown.border);
    root.style.setProperty('--menubar-dropdown-text', theme.colors.menubar.dropdown.text);
    root.style.setProperty('--menubar-dropdown-hover', theme.colors.menubar.dropdown.hover);
    root.style.setProperty('--menubar-dropdown-separator', theme.colors.menubar.dropdown.separator);
    root.style.setProperty('--menubar-controls-text', theme.colors.menubar.controls.text);
    root.style.setProperty('--menubar-controls-hover', theme.colors.menubar.controls.hover);
  }, [theme]);
};

