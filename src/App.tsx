import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AppProvider } from './context/AppContext';
import Layout from './components/Layout';
import MenuHandler from './components/MenuHandler';
import Dashboard from './pages/Dashboard';
import Tables from './pages/Tables';
import Odbc from './pages/Odbc';
import DsnManagement from './pages/DsnManagement';
import Logs from './pages/Logs';
import Settings from './pages/Settings';

function App() {
  return (
    <AppProvider>
      <Router>
        <MenuHandler />
        <Layout>
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/tables" element={<Tables />} />
            <Route path="/dsn" element={<DsnManagement />} />
            <Route path="/odbc" element={<Odbc />} />
            <Route path="/logs" element={<Logs />} />
            <Route path="/settings" element={<Settings />} />
          </Routes>
        </Layout>
      </Router>
    </AppProvider>
  );
}

export default App;

