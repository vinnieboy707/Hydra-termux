import React, { useState, useEffect } from 'react';
import api from '../services/api';

function Dashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardStats();
  }, []);

  const fetchDashboardStats = async () => {
    try {
      const response = await api.get('/dashboard/stats');
      setStats(response.data);
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="loading">Loading dashboard...</div>;
  }

  const totals = stats?.totals || {};
  const recentActivity = stats?.recentActivity || [];

  return (
    <div className="dashboard">
      <div className="page-header">
        <h1 className="page-title">Dashboard</h1>
        <p className="page-subtitle">Overview of your penetration testing activities</p>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-label">Total Attacks</div>
          <div className="stat-value">{totals.total_attacks || 0}</div>
        </div>

        <div className="stat-card">
          <div className="stat-label">Credentials Found</div>
          <div className="stat-value">{totals.total_credentials || 0}</div>
        </div>

        <div className="stat-card">
          <div className="stat-label">Targets</div>
          <div className="stat-value">{totals.total_targets || 0}</div>
        </div>

        <div className="stat-card">
          <div className="stat-label">Success Rate</div>
          <div className="stat-value">
            {totals.total_attacks > 0
              ? ((totals.total_credentials / totals.total_attacks) * 100).toFixed(1)
              : 0}%
          </div>
        </div>
      </div>

      <div className="table-container">
        <div className="table-header">
          <h2 className="table-title">Recent Activity</h2>
        </div>
        <table className="table">
          <thead>
            <tr>
              <th>Type</th>
              <th>Target</th>
              <th>Protocol</th>
              <th>Status</th>
              <th>Created</th>
            </tr>
          </thead>
          <tbody>
            {recentActivity.length === 0 ? (
              <tr>
                <td colSpan="5" style={{ textAlign: 'center', color: '#888' }}>
                  No recent activity
                </td>
              </tr>
            ) : (
              recentActivity.map((activity) => (
                <tr key={activity.id}>
                  <td>{activity.attack_type}</td>
                  <td>{activity.target_host}</td>
                  <td>{activity.protocol}</td>
                  <td>
                    <span className={`badge badge-${getStatusBadge(activity.status)}`}>
                      {activity.status}
                    </span>
                  </td>
                  <td>{new Date(activity.created_at).toLocaleString()}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
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

export default Dashboard;
