import React, { useState, useEffect } from 'react';
import { webhookService } from '../services/api';
import './Webhooks.css';

const Webhooks = () => {
  const [webhooks, setWebhooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [testingWebhook, setTestingWebhook] = useState(null);
  
  const [newWebhook, setNewWebhook] = useState({
    name: '',
    url: '',
    events: [],
    description: '',
    retry_count: 3
  });

  const availableEvents = [
    { value: 'attack.queued', label: 'Attack Queued', icon: '📋' },
    { value: 'attack.started', label: 'Attack Started', icon: '🚀' },
    { value: 'attack.completed', label: 'Attack Completed', icon: '✅' },
    { value: 'attack.failed', label: 'Attack Failed', icon: '❌' },
    { value: 'credentials.found', label: 'Credentials Found', icon: '🎯' },
    { value: 'target.added', label: 'Target Added', icon: '🎯' },
    { value: 'wordlist.uploaded', label: 'Wordlist Uploaded', icon: '📚' }
  ];

  useEffect(() => {
    fetchWebhooks();
  }, []);

  const fetchWebhooks = async () => {
    try {
      setLoading(true);
      const data = await webhookService.getAll();
      setWebhooks(data.webhooks || []);
      setError(null);
    } catch (err) {
      setError('Failed to load webhooks: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    
    if (!newWebhook.name || !newWebhook.url || newWebhook.events.length === 0) {
      alert('Please fill in all required fields');
      return;
    }

    try {
      const result = await webhookService.create(newWebhook);
      
      // Show secret to user (only shown once!)
      alert(`Webhook created successfully!\n\nWebhook Secret (save this now!):\n${result.secret}\n\nUse this secret to verify webhook signatures.`);
      
      setShowCreateModal(false);
      setNewWebhook({ name: '', url: '', events: [], description: '', retry_count: 3 });
      fetchWebhooks();
    } catch (err) {
      alert('Failed to create webhook: ' + err.message);
    }
  };

  const handleToggle = async (id, currentStatus) => {
    try {
      await webhookService.update(id, { is_active: !currentStatus });
      fetchWebhooks();
    } catch (err) {
      alert('Failed to toggle webhook: ' + err.message);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this webhook?')) {
      return;
    }

    try {
      await webhookService.delete(id);
      fetchWebhooks();
    } catch (err) {
      alert('Failed to delete webhook: ' + err.message);
    }
  };

  const handleTest = async (id) => {
    setTestingWebhook(id);
    try {
      const result = await webhookService.test(id);
      alert(`Test webhook sent!\n\nStatus: ${result.status}\nResponse: ${result.message}`);
    } catch (err) {
      alert('Test failed: ' + err.message);
    } finally {
      setTestingWebhook(null);
    }
  };

  const handleEventToggle = (event) => {
    setNewWebhook(prev => ({
      ...prev,
      events: prev.events.includes(event)
        ? prev.events.filter(e => e !== event)
        : [...prev.events, event]
    }));
  };

  const getSuccessRate = (webhook) => {
    const total = webhook.success_count + webhook.failure_count;
    if (total === 0) return 'N/A';
    return `${Math.round((webhook.success_count / total) * 100)}%`;
  };

  if (loading) {
    return <div className="webhooks-container"><div className="loading">Loading webhooks...</div></div>;
  }

  return (
    <div className="webhooks-container">
      <div className="webhooks-header">
        <h1>🔗 Webhook Management</h1>
        <button className="btn-primary" onClick={() => setShowCreateModal(true)}>
          + Create Webhook
        </button>
      </div>

      {error && <div className="error-message">{error}</div>}

      <div className="webhooks-grid">
        {webhooks.length === 0 ? (
          <div className="empty-state">
            <p>No webhooks configured yet.</p>
            <p>Create your first webhook to receive real-time notifications!</p>
          </div>
        ) : (
          webhooks.map(webhook => (
            <div key={webhook.id} className={`webhook-card ${!webhook.is_active ? 'inactive' : ''}`}>
              <div className="webhook-header">
                <h3>{webhook.name}</h3>
                <div className="webhook-status">
                  {webhook.is_active ? (
                    <span className="status-badge active">Active</span>
                  ) : (
                    <span className="status-badge inactive">Inactive</span>
                  )}
                </div>
              </div>

              <div className="webhook-url">
                <strong>URL:</strong>
                <code>{webhook.url}</code>
              </div>

              {webhook.description && (
                <div className="webhook-description">
                  <strong>Description:</strong>
                  <p>{webhook.description}</p>
                </div>
              )}

              <div className="webhook-events">
                <strong>Events:</strong>
                <div className="event-tags">
                  {Array.isArray(webhook.events) ? webhook.events.map(event => (
                    <span key={event} className="event-tag">
                      {availableEvents.find(e => e.value === event)?.icon} {event}
                    </span>
                  )) : <span className="event-tag">No events</span>}
                </div>
              </div>

              <div className="webhook-stats">
                <div className="stat">
                  <span className="stat-label">Success Rate:</span>
                  <span className="stat-value">{getSuccessRate(webhook)}</span>
                </div>
                <div className="stat">
                  <span className="stat-label">Total Calls:</span>
                  <span className="stat-value">{webhook.success_count + webhook.failure_count}</span>
                </div>
                <div className="stat">
                  <span className="stat-label">Retry Count:</span>
                  <span className="stat-value">{webhook.retry_count}</span>
                </div>
              </div>

              {webhook.last_triggered_at && (
                <div className="webhook-last-triggered">
                  <strong>Last Triggered:</strong>
                  <span>{new Date(webhook.last_triggered_at).toLocaleString()}</span>
                </div>
              )}

              <div className="webhook-actions">
                <button
                  className="btn-test"
                  onClick={() => handleTest(webhook.id)}
                  disabled={testingWebhook === webhook.id}
                >
                  {testingWebhook === webhook.id ? 'Testing...' : '🧪 Test'}
                </button>
                <button
                  className="btn-toggle"
                  onClick={() => handleToggle(webhook.id, webhook.is_active)}
                >
                  {webhook.is_active ? '⏸ Pause' : '▶ Enable'}
                </button>
                <button
                  className="btn-delete"
                  onClick={() => handleDelete(webhook.id)}
                >
                  🗑 Delete
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Create New Webhook</h2>
              <button className="close-btn" onClick={() => setShowCreateModal(false)}>×</button>
            </div>

            <form onSubmit={handleCreate}>
              <div className="form-group">
                <label>Webhook Name *</label>
                <input
                  type="text"
                  value={newWebhook.name}
                  onChange={e => setNewWebhook({...newWebhook, name: e.target.value})}
                  placeholder="e.g., Slack Notifications"
                  required
                />
              </div>

              <div className="form-group">
                <label>Webhook URL *</label>
                <input
                  type="url"
                  value={newWebhook.url}
                  onChange={e => setNewWebhook({...newWebhook, url: e.target.value})}
                  placeholder="https://your-server.com/webhook"
                  required
                />
                <small>Must be a valid HTTPS URL</small>
              </div>

              <div className="form-group">
                <label>Description</label>
                <textarea
                  value={newWebhook.description}
                  onChange={e => setNewWebhook({...newWebhook, description: e.target.value})}
                  placeholder="What is this webhook used for?"
                  rows="3"
                />
              </div>

              <div className="form-group">
                <label>Events to Subscribe * (select at least one)</label>
                <div className="events-grid">
                  {availableEvents.map(event => (
                    <label key={event.value} className="event-checkbox">
                      <input
                        type="checkbox"
                        checked={newWebhook.events.includes(event.value)}
                        onChange={() => handleEventToggle(event.value)}
                      />
                      <span>{event.icon} {event.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="form-group">
                <label>Retry Count</label>
                <input
                  type="number"
                  min="0"
                  max="10"
                  value={newWebhook.retry_count}
                  onChange={e => setNewWebhook({...newWebhook, retry_count: parseInt(e.target.value)})}
                />
                <small>Number of retry attempts if webhook fails (0-10)</small>
              </div>

              <div className="form-actions">
                <button type="button" className="btn-secondary" onClick={() => setShowCreateModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  Create Webhook
                </button>
              </div>

              <div className="webhook-info">
                <h4>ℹ️ Webhook Information</h4>
                <ul>
                  <li>Webhooks receive HMAC SHA-256 signed payloads</li>
                  <li>Signature is sent in <code>X-Webhook-Signature</code> header</li>
                  <li>Event type is in <code>X-Webhook-Event</code> header</li>
                  <li>Timestamp is in <code>X-Webhook-Timestamp</code> header</li>
                  <li>Failed webhooks are retried with exponential backoff</li>
                  <li>Your secret will be shown once after creation - save it!</li>
                </ul>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Webhooks;