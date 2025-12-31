import React, { useState, useEffect, useRef } from 'react';
import api from '../services/api';

function Wordlists() {
  const [wordlists, setWordlists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [selectedWordlist, setSelectedWordlist] = useState(null);
  const [showViewModal, setShowViewModal] = useState(false);
  const [wordlistContent, setWordlistContent] = useState('');
  const fileInputRef = useRef(null);

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

  const handleUpload = async (file) => {
    if (!file) return;

    const formData = new FormData();
    formData.append('wordlist', file);

    try {
      setLoading(true);
      await api.post('/wordlists/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      alert('Wordlist uploaded successfully!');
      fetchWordlists();
      setShowUploadModal(false);
    } catch (error) {
      alert('Failed to upload wordlist: ' + (error.response?.data?.error || 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  const handleViewWordlist = async (wordlist) => {
    setSelectedWordlist(wordlist);
    setShowViewModal(true);
    
    try {
      const response = await api.get(`/wordlists/${wordlist.id}/content`, {
        params: { limit: 100 }
      });
      setWordlistContent(response.data.content);
    } catch (error) {
      setWordlistContent('Error loading wordlist content');
    }
  };

  const handleDeleteWordlist = async (wordlistId) => {
    if (!window.confirm('Are you sure you want to delete this wordlist?')) {
      return;
    }

    try {
      await api.delete(`/wordlists/${wordlistId}`);
      alert('Wordlist deleted successfully');
      fetchWordlists();
    } catch (error) {
      alert('Failed to delete wordlist');
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

      <div style={{ marginBottom: '20px', display: 'flex', gap: '10px' }}>
        <button
          className="btn btn-primary btn-small"
          onClick={handleScan}
        >
          Scan Directory
        </button>
        <button
          className="btn btn-secondary btn-small"
          onClick={() => setShowUploadModal(true)}
        >
          Upload Wordlist
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
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {wordlists.length === 0 ? (
              <tr>
                <td colSpan="7" style={{ textAlign: 'center', color: '#888' }}>
                  No wordlists found. Click "Scan Directory" or "Upload Wordlist" to add wordlists.
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
                  <td>
                    <button
                      className="btn btn-secondary btn-small"
                      onClick={() => handleViewWordlist(wordlist)}
                      style={{ marginRight: '5px' }}
                    >
                      View
                    </button>
                    <button
                      className="btn btn-danger btn-small"
                      onClick={() => handleDeleteWordlist(wordlist.id)}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="modal-overlay" onClick={() => setShowUploadModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Upload Wordlist</h2>
            </div>
            <div style={{ padding: '20px' }}>
              <p style={{ color: '#aaa', marginBottom: '20px' }}>
                Select a wordlist file (.txt) to upload. The file should contain one entry per line.
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".txt"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    handleUpload(e.target.files[0]);
                  }
                }}
                style={{ display: 'none' }}
              />
              <button
                className="btn btn-primary"
                onClick={() => fileInputRef.current?.click()}
              >
                Choose File
              </button>
              <button
                className="btn btn-secondary"
                onClick={() => setShowUploadModal(false)}
                style={{ marginLeft: '10px' }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View Modal */}
      {showViewModal && selectedWordlist && (
        <div className="modal-overlay" onClick={() => setShowViewModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '800px' }}>
            <div className="modal-header">
              <h2 className="modal-title">{selectedWordlist.name}</h2>
            </div>
            <div style={{ padding: '20px' }}>
              <div style={{ marginBottom: '15px', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
                <div>
                  <strong style={{ color: '#888' }}>Type:</strong>
                  <div style={{ color: '#fff' }}>{selectedWordlist.type}</div>
                </div>
                <div>
                  <strong style={{ color: '#888' }}>Size:</strong>
                  <div style={{ color: '#fff' }}>{formatBytes(selectedWordlist.size)}</div>
                </div>
                <div>
                  <strong style={{ color: '#888' }}>Lines:</strong>
                  <div style={{ color: '#fff' }}>{selectedWordlist.line_count?.toLocaleString()}</div>
                </div>
              </div>
              <div style={{ 
                backgroundColor: '#1a1a1a', 
                padding: '15px', 
                borderRadius: '5px',
                maxHeight: '400px',
                overflowY: 'auto',
                fontFamily: 'monospace',
                fontSize: '0.9rem',
                lineHeight: '1.6'
              }}>
                <pre style={{ margin: 0, color: '#00ff00' }}>{wordlistContent}</pre>
              </div>
              <div style={{ marginTop: '15px', textAlign: 'right' }}>
                <button
                  className="btn btn-secondary"
                  onClick={() => setShowViewModal(false)}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
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
