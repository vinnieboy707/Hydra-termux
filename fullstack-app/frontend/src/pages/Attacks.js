import React, { useState, useEffect } from 'react';
import { Routes, Route, useNavigate } from 'react-router-dom';
import api from '../services/api';

function AttacksList() {
  const [attacks, setAttacks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    fetchAttacks();
  }, []);

  const fetchAttacks = async () => {
    try {
      const response = await api.get('/attacks');
      setAttacks(response.data.attacks);
    } catch (error) {
      console.error('Error fetching attacks:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="loading">Loading attacks...</div>;
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Attacks</h1>
        <p className="page-subtitle">Manage and monitor your attacks</p>
      </div>

      <div style={{ marginBottom: '20px' }}>
        <button
          className="btn btn-primary btn-small"
          onClick={() => setShowModal(true)}
        >
          + New Attack
        </button>
      </div>

      <div className="table-container">
        <table className="table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Type</th>
              <th>Target</th>
              <th>Protocol</th>
              <th>Status</th>
              <th>Started</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {attacks.length === 0 ? (
              <tr>
                <td colSpan="7" style={{ textAlign: 'center', color: '#888' }}>
                  No attacks found. Create your first attack!
                </td>
              </tr>
            ) : (
              attacks.map((attack) => (
                <tr key={attack.id}>
                  <td>{attack.id}</td>
                  <td>{attack.attack_type}</td>
                  <td>{attack.target_host}</td>
                  <td>{attack.protocol}</td>
                  <td>
                    <span className={`badge badge-${getStatusBadge(attack.status)}`}>
                      {attack.status}
                    </span>
                  </td>
                  <td>{attack.started_at ? new Date(attack.started_at).toLocaleString() : '-'}</td>
                  <td>
                    <button
                      className="btn btn-secondary btn-small"
                      onClick={() => navigate(`/attacks/${attack.id}`)}
                      style={{ marginRight: '10px' }}
                    >
                      View
                    </button>
                    {attack.status === 'running' && (
                      <button
                        className="btn btn-danger btn-small"
                        onClick={() => handleStopAttack(attack.id)}
                      >
                        Stop
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <NewAttackModal
          onClose={() => setShowModal(false)}
          onSuccess={() => {
            setShowModal(false);
            fetchAttacks();
          }}
        />
      )}
    </div>
  );

  async function handleStopAttack(attackId) {
    try {
      await api.post(`/attacks/${attackId}/stop`);
      fetchAttacks();
    } catch (error) {
      alert('Failed to stop attack');
    }
  }
}

function NewAttackModal({ onClose, onSuccess }) {
  const [attackTypes, setAttackTypes] = useState([]);
  const [formData, setFormData] = useState({
    attack_type: 'ssh',
    target_host: '',
    target_port: '',
    protocol: 'ssh',
    config: {
      threads: 16,
      verbose: false
    }
  });

  useEffect(() => {
    fetchAttackTypes();
  }, []);

  const fetchAttackTypes = async () => {
    try {
      const response = await api.get('/attacks/types/list');
      setAttackTypes(response.data.attackTypes);
    } catch (error) {
      console.error('Error fetching attack types:', error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.post('/attacks', formData);
      onSuccess();
    } catch (error) {
      alert('Failed to create attack: ' + (error.response?.data?.error || 'Unknown error'));
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">New Attack</h2>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Attack Type</label>
            <select
              className="form-select"
              value={formData.attack_type}
              onChange={(e) => {
                const selected = attackTypes.find(t => t.id === e.target.value);
                setFormData({
                  ...formData,
                  attack_type: e.target.value,
                  protocol: e.target.value,
                  target_port: selected?.default_port || ''
                });
              }}
            >
              {attackTypes.map((type) => (
                <option key={type.id} value={type.id}>
                  {type.name} - {type.description}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Target Host/IP</label>
            <input
              type="text"
              className="form-input"
              value={formData.target_host}
              onChange={(e) => setFormData({ ...formData, target_host: e.target.value })}
              placeholder="192.168.1.100 or example.com"
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Port (optional)</label>
            <input
              type="number"
              className="form-input"
              value={formData.target_port}
              onChange={(e) => setFormData({ ...formData, target_port: e.target.value })}
              placeholder="Default port will be used"
            />
          </div>

          <div className="form-group">
            <label className="form-label">Threads</label>
            <input
              type="number"
              className="form-input"
              value={formData.config.threads}
              onChange={(e) => setFormData({
                ...formData,
                config: { ...formData.config, threads: parseInt(e.target.value) }
              })}
              min="1"
              max="64"
            />
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary btn-small" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary btn-small">
              Launch Attack
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function getStatusBadge(status) {
  switch (status) {
    case 'completed':
      return 'success';
    case 'running':
      return 'info';
    case 'failed':
      return 'danger';
    default:
      return 'warning';
  }
}

function Attacks() {
  return (
    <Routes>
      <Route path="/" element={<AttacksList />} />
      <Route path="/:id" element={<AttackDetail />} />
    </Routes>
  );
}

function AttackDetail() {
  return <div>Attack detail page - to be implemented</div>;
}

export default Attacks;
