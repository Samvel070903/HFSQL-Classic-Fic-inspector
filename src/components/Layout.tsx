import React, { ReactNode } from 'react';
import Sidebar from './Sidebar';
import StatusBar from './StatusBar';
import MenuBar from './MenuBar';

interface LayoutProps {
  children: ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  return (
    <div className="flex h-screen bg-theme-background text-theme-foreground">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <MenuBar />
        <StatusBar />
        <main className="flex-1 overflow-auto p-6">
          {children}
        </main>
      </div>
    </div>
  );
};

export default Layout;

