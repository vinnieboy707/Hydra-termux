import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Attacks from './pages/Attacks';
import Targets from './pages/Targets';
import Results from './pages/Results';
import Wordlists from './pages/Wordlists';
import Webhooks from './pages/Webhooks';
import ScriptGenerator from './pages/ScriptGenerator';
import WordlistGenerator from './pages/WordlistGenerator';
import TargetScanner from './pages/TargetScanner';
import Layout from './components/Layout';
import Onboarding from './components/Onboarding';
import './App.css';

function PrivateRoute({ children }) {
  const { user, loading } = useAuth();
  
  if (loading) {
    return <div className="loading">Loading...</div>;
  }
  
  return user ? children : <Navigate to="/login" />;
}

function App() {
  return (
    <AuthProvider>
      <Router>
        <Onboarding />
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            path="/*"
            element={
              <PrivateRoute>
                <Layout>
                  <Routes>
                    <Route path="/" element={<Dashboard />} />
                    <Route path="/attacks/*" element={<Attacks />} />
                    <Route path="/script-generator" element={<ScriptGenerator />} />
                    <Route path="/targets" element={<Targets />} />
                    <Route path="/results" element={<Results />} />
                    <Route path="/wordlists" element={<Wordlists />} />
                    <Route path="/webhooks" element={<Webhooks />} />
                    <Route path="/wordlist-generator" element={<WordlistGenerator />} />
                    <Route path="/scanner" element={<TargetScanner />} />
                  </Routes>
                </Layout>
              </PrivateRoute>
            }
          />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
