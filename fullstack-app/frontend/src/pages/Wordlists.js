import React, { useState, useEffect } from 'react';
import api from '../services/api';

function Wordlists() {
  const [wordlists, setWordlists] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchWordlists();
  }, []);

  const fetchWordlists = async () => {
    try {
      const response = await api.get('/wordlists');
      setWordlists(response.data.wordlists);
    } catch (error) {
      console.error('Error fetching wordlists:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleScan = async () => {
    setLoading(true);
    try {
      const response = await api.post('/wordlists/scan');
      setWordlists(response.data.wordlists);
      alert('Wordlist directory scanned successfully');
    } catch (error) {
      alert('Failed to scan wordlists');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="loading">Loading wordlists...</div>;
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Wordlists</h1>
        <p className="page-subtitle">Manage password and username wordlists</p>
      </div>

      <div style={{ marginBottom: '20px' }}>
        <button
          className="btn btn-primary btn-small"
          onClick={handleScan}
        >
          Scan Directory
        </button>
      </div>

      <div className="table-container">
        <table className="table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Type</th>
              <th>Size</th>
              <th>Lines</th>
              <th>Path</th>
              <th>Created</th>
            </tr>
          </thead>
          <tbody>
            {wordlists.length === 0 ? (
              <tr>
                <td colSpan="6" style={{ textAlign: 'center', color: '#888' }}>
                  No wordlists found. Click "Scan Directory" to import wordlists.
                </td>
              </tr>
            ) : (
              wordlists.map((wordlist) => (
                <tr key={wordlist.id}>
                  <td style={{ fontFamily: 'monospace' }}>{wordlist.name}</td>
                  <td>{wordlist.type}</td>
                  <td>{formatBytes(wordlist.size)}</td>
                  <td>{wordlist.line_count?.toLocaleString() || '-'}</td>
                  <td style={{ fontSize: '0.85rem', color: '#888' }}>
                    {wordlist.path}
                  </td>
                  <td>{new Date(wordlist.created_at).toLocaleString()}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function formatBytes(bytes) {
  if (!bytes) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export default Wordlists;
