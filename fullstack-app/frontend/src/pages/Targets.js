import React, { useState, useEffect } from 'react';
import api from '../services/api';

function Targets() {
  const [targets, setTargets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    fetchTargets();
  }, []);

  const fetchTargets = async () => {
    try {
      const response = await api.get('/targets');
      setTargets(response.data.targets);
    } catch (error) {
      console.error('Error fetching targets:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this target?')) return;
    
    try {
      await api.delete(`/targets/${id}`);
      fetchTargets();
    } catch (error) {
      alert('Failed to delete target');
    }
  };

  if (loading) {
    return <div className="loading">Loading targets...</div>;
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Targets</h1>
        <p className="page-subtitle">Manage your target systems</p>
      </div>

      <div style={{ marginBottom: '20px' }}>
        <button
          className="btn btn-primary btn-small"
          onClick={() => setShowModal(true)}
        >
          + Add Target
        </button>
      </div>

      <div className="table-container">
        <table className="table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Host</th>
              <th>Port</th>
              <th>Protocol</th>
              <th>Status</th>
              <th>Created</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {targets.length === 0 ? (
              <tr>
                <td colSpan="7" style={{ textAlign: 'center', color: '#888' }}>
                  No targets found. Add your first target!
                </td>
              </tr>
            ) : (
              targets.map((target) => (
                <tr key={target.id}>
                  <td>{target.name}</td>
                  <td>{target.host}</td>
                  <td>{target.port || '-'}</td>
                  <td>{target.protocol || '-'}</td>
                  <td>
                    <span className={`badge badge-${target.status === 'active' ? 'success' : 'warning'}`}>
                      {target.status}
                    </span>
                  </td>
                  <td>{new Date(target.created_at).toLocaleString()}</td>
                  <td>
                    <button
                      className="btn btn-danger btn-small"
                      onClick={() => handleDelete(target.id)}
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

      {showModal && (
        <NewTargetModal
          onClose={() => setShowModal(false)}
          onSuccess={() => {
            setShowModal(false);
            fetchTargets();
          }}
        />
      )}
    </div>
  );
}

function NewTargetModal({ onClose, onSuccess }) {
  const [formData, setFormData] = useState({
    name: '',
    host: '',
    port: '',
    protocol: '',
    description: '',
    tags: ''
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.post('/targets', formData);
      onSuccess();
    } catch (error) {
      alert('Failed to create target: ' + (error.response?.data?.error || 'Unknown error'));
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">New Target</h2>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Name</label>
            <input
              type="text"
              className="form-input"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Host/IP</label>
            <input
              type="text"
              className="form-input"
              value={formData.host}
              onChange={(e) => setFormData({ ...formData, host: e.target.value })}
              required
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Port</label>
              <input
                type="number"
                className="form-input"
                value={formData.port}
                onChange={(e) => setFormData({ ...formData, port: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Protocol</label>
              <input
                type="text"
                className="form-input"
                value={formData.protocol}
                onChange={(e) => setFormData({ ...formData, protocol: e.target.value })}
                placeholder="ssh, http, etc."
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Description</label>
            <textarea
              className="form-textarea"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            />
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary btn-small" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary btn-small">
              Add Target
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default Targets;
