import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export const useMenuActions = () => {
  const navigate = useNavigate();

  useEffect(() => {
    // Vérifier si on est dans Electron
    if (!window.electronAPI) {
      return;
    }

    const cleanup = window.electronAPI.onMenuAction((channel, ...args) => {
      switch (channel) {
        case 'menu:navigate':
          if (args[0]) {
            navigate(args[0]);
          }
          break;
      }
    });

    return cleanup;
  }, [navigate]);
};