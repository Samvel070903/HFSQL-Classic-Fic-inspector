import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  FileText, 
  Settings,
  FileCode,
  Terminal,
  Database
} from 'lucide-react';
import clsx from 'clsx';

const Sidebar: React.FC = () => {
  const location = useLocation();

  const menuItems = [
    { path: '/dashboard', icon: LayoutDashboard, label: 'Tableau de bord' },
    { path: '/dsn', icon: Database, label: 'Gestion DSN' },
    { path: '/odbc', icon: Terminal, label: 'Query Studio' },
    { path: '/logs', icon: FileText, label: 'Logs & Diagnostics' },
    { path: '/settings', icon: Settings, label: 'Paramètres' },
  ];

  return (
    <div className="w-64 bg-theme-sidebar border-r border-theme-sidebar flex flex-col">
      <div className="p-6 border-b border-theme-sidebar">
        <div className="flex items-center gap-3">
          <FileCode className="w-8 h-8 text-theme-primary" />
          <div>
            <h1 className="text-xl font-bold text-theme-sidebar">FIC Inspector</h1>
            <p className="text-xs text-theme-statusbar">HFSQL Viewer</p>
          </div>
        </div>
      </div>
      
      <nav className="flex-1 p-4">
        <ul className="space-y-2">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            
            return (
              <li key={item.path}>
                <Link
                  to={item.path}
                  className={clsx(
                    'flex items-center gap-3 px-4 py-3 rounded-lg transition-colors',
                    isActive
                      ? 'bg-theme-sidebar-active text-white'
                      : 'text-theme-sidebar hover:text-white bg-theme-sidebar-hover'
                  )}
                >
                  <Icon className="w-5 h-5" />
                  <span>{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
};

export default Sidebar;

