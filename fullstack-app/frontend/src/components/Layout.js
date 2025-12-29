import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

function Layout({ children }) {
  const location = useLocation();
  const { user, logout } = useAuth();

  const navItems = [
    { path: '/', label: 'Dashboard', icon: '📊' },
    { path: '/attacks', label: 'Attacks', icon: '⚔️' },
    { path: '/targets', label: 'Targets', icon: '🎯' },
    { path: '/results', label: 'Results', icon: '✅' },
    { path: '/wordlists', label: 'Wordlists', icon: '📚' },
  ];

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="sidebar-header">
          <h1 className="sidebar-title">
            🐍 HYDRA
          </h1>
          <p style={{ color: '#888', fontSize: '0.85rem' }}>
            Penetration Testing Platform
          </p>
        </div>
        
        <nav>
          <ul className="sidebar-nav">
            {navItems.map((item) => (
              <li key={item.path} className="nav-item">
                <Link
                  to={item.path}
                  className={`nav-link ${location.pathname === item.path ? 'active' : ''}`}
                >
                  <span>{item.icon}</span>
                  <span>{item.label}</span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div style={{ marginTop: 'auto', paddingTop: '20px', borderTop: '1px solid #333' }}>
          <div style={{ color: '#888', fontSize: '0.85rem', marginBottom: '10px' }}>
            Logged in as: <strong style={{ color: '#00ff00' }}>{user?.username}</strong>
          </div>
          <button
            onClick={logout}
            className="btn btn-secondary btn-small"
            style={{ width: '100%' }}
          >
            Logout
          </button>
        </div>
      </aside>

      <main className="main-content">
        {children}
      </main>
    </div>
  );
}

export default Layout;
