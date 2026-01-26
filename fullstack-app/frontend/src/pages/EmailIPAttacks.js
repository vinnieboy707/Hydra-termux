import React, { useState, useEffect } from 'react';
import api from '../services/api';
import './EmailIPAttacks.css';

function EmailIPAttacks() {
  const [attacks, setAttacks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    target_email: '',
    target_ip: '',
    target_port: 587,
    protocol: 'smtp',
    wordlist_id: null,
    combo_list_path: '',
    use_ssl: true,
    use_tls: true,
    timeout_seconds: 30,
    max_threads: 4,
    retry_attempts: 3,
    notes: '',
    tags: []
  });

  useEffect(() => {
    fetchAttacks();
  }, []);

  const fetchAttacks = async () => {
    try {
      const response = await api.get('/email-ip-attacks');
      setAttacks(response.data.attacks || []);
    } catch (error) {
      console.error('Error fetching attacks:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateAttack = async (e) => {
    e.preventDefault();
    try {
      await api.post('/email-ip-attacks', formData);
      setShowCreateModal(false);
      fetchAttacks();
      resetForm();
    } catch (error) {
      console.error('Error creating attack:', error);
      alert('Failed to create attack: ' + (error.response?.data?.error || error.message));
    }
  };

  const handleStartAttack = async (attackId) => {
    try {
      await api.post(`/email-ip-attacks/${attackId}/start`);
      fetchAttacks();
    } catch (error) {
      console.error('Error starting attack:', error);
      alert('Failed to start attack');
    }
  };

  const handleStopAttack = async (attackId) => {
    try {
      await api.post(`/email-ip-attacks/${attackId}/stop`);
      fetchAttacks();
    } catch (error) {
      console.error('Error stopping attack:', error);
      alert('Failed to stop attack');
    }
  };

  const handleDeleteAttack = async (attackId) => {
    if (!window.confirm('Are you sure you want to delete this attack?')) return;
    
    try {
      await api.delete(`/email-ip-attacks/${attackId}`);
      fetchAttacks();
    } catch (error) {
      console.error('Error deleting attack:', error);
      alert('Failed to delete attack');
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      target_email: '',
      target_ip: '',
      target_port: 587,
      protocol: 'smtp',
      wordlist_id: null,
      combo_list_path: '',
      use_ssl: true,
      use_tls: true,
      timeout_seconds: 30,
      max_threads: 4,
      retry_attempts: 3,
      notes: '',
      tags: []
    });
  };

  const getStatusColor = (status) => {
    const colors = {
      'queued': '#6c757d',
      'running': '#007bff',
      'completed': '#28a745',
      'failed': '#dc3545',
      'cancelled': '#ffc107',
      'paused': '#17a2b8'
    };
    return colors[status] || '#6c757d';
  };

  if (loading) {
    return <div className="loading">Loading email-IP attacks...</div>;
  }

  return (
    <div className="email-ip-attacks">
      <div className="page-header">
        <h1 className="page-title">Email-IP Penetration Testing</h1>
        <p className="page-subtitle">Advanced email credential attacks with IP targeting</p>
        <button 
          className="btn btn-primary" 
          onClick={() => setShowCreateModal(true)}
        >
          Create New Attack
        </button>
      </div>

      <div className="attacks-grid">
        {attacks.length === 0 ? (
          <div className="empty-state">
            <p>No email-IP attacks yet. Create your first attack to get started!</p>
          </div>
        ) : (
          attacks.map(attack => (
            <div key={attack.id} className="attack-card">
              <div className="attack-header">
                <h3>{attack.name}</h3>
                <span 
                  className="status-badge" 
                  style={{ backgroundColor: getStatusColor(attack.status) }}
                >
                  {attack.status}
                </span>
              </div>
              
              <div className="attack-details">
                <div className="detail-row">
                  <span className="label">Target Email:</span>
                  <span className="value">{attack.target_email}</span>
                </div>
                <div className="detail-row">
                  <span className="label">Target IP:</span>
                  <span className="value">{attack.target_ip}:{attack.target_port}</span>
                </div>
                <div className="detail-row">
                  <span className="label">Protocol:</span>
                  <span className="value">{attack.protocol}</span>
                </div>
                <div className="detail-row">
                  <span className="label">Attempts:</span>
                  <span className="value">{attack.total_attempts || 0}</span>
                </div>
                <div className="detail-row">
                  <span className="label">Success:</span>
                  <span className="value success">{attack.successful_attempts || 0}</span>
                </div>
                <div className="detail-row">
                  <span className="label">Failed:</span>
                  <span className="value failed">{attack.failed_attempts || 0}</span>
                </div>
              </div>

              {attack.credentials_found && attack.credentials_found.length > 0 && (
                <div className="credentials-found">
                  <strong>Credentials Found: {attack.credentials_found.length}</strong>
                </div>
              )}

              <div className="attack-actions">
                {attack.status === 'queued' || attack.status === 'paused' ? (
                  <button 
                    className="btn btn-sm btn-success"
                    onClick={() => handleStartAttack(attack.id)}
                  >
                    Start
                  </button>
                ) : null}
                
                {attack.status === 'running' ? (
                  <button 
                    className="btn btn-sm btn-warning"
                    onClick={() => handleStopAttack(attack.id)}
                  >
                    Stop
                  </button>
                ) : null}
                
                <button 
                  className="btn btn-sm btn-info"
                  onClick={() => window.location.href = `/email-ip-attacks/${attack.id}`}
                >
                  Details
                </button>
                
                <button 
                  className="btn btn-sm btn-danger"
                  onClick={() => handleDeleteAttack(attack.id)}
                  disabled={attack.status === 'running'}
                >
                  Delete
                </button>
              </div>

              <div className="attack-footer">
                <small>Created: {new Date(attack.created_at).toLocaleString()}</small>
              </div>
            </div>
          ))
        )}
      </div>

      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Create Email-IP Attack</h2>
              <button className="modal-close" onClick={() => setShowCreateModal(false)}>&times;</button>
            </div>
            
            <form onSubmit={handleCreateAttack} className="attack-form">
              <div className="form-group">
                <label>Attack Name *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  required
                  placeholder="e.g., Gmail Attack #1"
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Target Email *</label>
                  <input
                    type="email"
                    value={formData.target_email}
                    onChange={(e) => setFormData({...formData, target_email: e.target.value})}
                    required
                    placeholder="target@example.com"
                  />
                </div>

                <div className="form-group">
                  <label>Target IP *</label>
                  <input
                    type="text"
                    value={formData.target_ip}
                    onChange={(e) => setFormData({...formData, target_ip: e.target.value})}
                    required
                    placeholder="192.168.1.1"
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Port</label>
                  <input
                    type="number"
                    value={formData.target_port}
                    onChange={(e) => setFormData({...formData, target_port: parseInt(e.target.value)})}
                    placeholder="587"
                  />
                </div>

                <div className="form-group">
                  <label>Protocol</label>
                  <select
                    value={formData.protocol}
                    onChange={(e) => setFormData({...formData, protocol: e.target.value})}
                  >
                    <option value="smtp">SMTP</option>
                    <option value="imap">IMAP</option>
                    <option value="pop3">POP3</option>
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label>Combo List Path</label>
                <input
                  type="text"
                  value={formData.combo_list_path}
                  onChange={(e) => setFormData({...formData, combo_list_path: e.target.value})}
                  placeholder="/path/to/combos.txt"
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Max Threads</label>
                  <input
                    type="number"
                    value={formData.max_threads}
                    onChange={(e) => setFormData({...formData, max_threads: parseInt(e.target.value)})}
                    min="1"
                    max="16"
                  />
                </div>

                <div className="form-group">
                  <label>Timeout (seconds)</label>
                  <input
                    type="number"
                    value={formData.timeout_seconds}
                    onChange={(e) => setFormData({...formData, timeout_seconds: parseInt(e.target.value)})}
                    min="10"
                    max="120"
                  />
                </div>
              </div>

              <div className="form-group checkbox-group">
                <label>
                  <input
                    type="checkbox"
                    checked={formData.use_ssl}
                    onChange={(e) => setFormData({...formData, use_ssl: e.target.checked})}
                  />
                  Use SSL
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={formData.use_tls}
                    onChange={(e) => setFormData({...formData, use_tls: e.target.checked})}
                  />
                  Use TLS
                </label>
              </div>

              <div className="form-group">
                <label>Notes</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({...formData, notes: e.target.value})}
                  rows="3"
                  placeholder="Optional notes about this attack"
                />
              </div>

              <div className="form-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowCreateModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Create Attack
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default EmailIPAttacks;
