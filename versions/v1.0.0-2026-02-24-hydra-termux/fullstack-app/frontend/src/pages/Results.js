import React, { useState, useEffect, useCallback } from 'react';
import api from '../services/api';

function Results() {
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState({ protocol: '', success: '' });

  const fetchResults = useCallback(async () => {
    try {
      const params = {};
      if (filter.protocol) params.protocol = filter.protocol;
      if (filter.success !== '') params.success = filter.success;
      
      const response = await api.get('/results', { params });
      setResults(response.data.results);
    } catch (error) {
      console.error('Error fetching results:', error);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    fetchResults();
  }, [fetchResults]);

  const handleExport = async () => {
    try {
      const response = await api.get('/results/export', { params: { format: 'json' } });
      const blob = new Blob([JSON.stringify(response.data.results, null, 2)], { type: 'application/json' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `results_${Date.now()}.json`;
      a.click();
    } catch (error) {
      alert('Failed to export results');
    }
  };

  if (loading) {
    return <div className="loading">Loading results...</div>;
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Results</h1>
        <p className="page-subtitle">View discovered credentials and attack results</p>
      </div>

      <div style={{ marginBottom: '20px', display: 'flex', gap: '10px', alignItems: 'center' }}>
        <select
          className="form-select"
          style={{ width: '200px' }}
          value={filter.protocol}
          onChange={(e) => setFilter({ ...filter, protocol: e.target.value })}
        >
          <option value="">All Protocols</option>
          <option value="ssh">SSH</option>
          <option value="ftp">FTP</option>
          <option value="http">HTTP</option>
          <option value="mysql">MySQL</option>
          <option value="rdp">RDP</option>
        </select>

        <select
          className="form-select"
          style={{ width: '200px' }}
          value={filter.success}
          onChange={(e) => setFilter({ ...filter, success: e.target.value })}
        >
          <option value="">All Results</option>
          <option value="true">Successful Only</option>
          <option value="false">Failed Only</option>
        </select>

        <button
          className="btn btn-primary btn-small"
          onClick={handleExport}
          style={{ marginLeft: 'auto' }}
        >
          Export Results
        </button>
      </div>

      <div className="table-container">
        <table className="table">
          <thead>
            <tr>
              <th>Target</th>
              <th>Protocol</th>
              <th>Port</th>
              <th>Username</th>
              <th>Password</th>
              <th>Success</th>
              <th>Date</th>
            </tr>
          </thead>
          <tbody>
            {results.length === 0 ? (
              <tr>
                <td colSpan="7" style={{ textAlign: 'center', color: '#888' }}>
                  No results found
                </td>
              </tr>
            ) : (
              results.map((result) => (
                <tr key={result.id}>
                  <td>{result.target_host}</td>
                  <td>{result.protocol}</td>
                  <td>{result.port}</td>
                  <td style={{ fontFamily: 'monospace', color: '#00ff00' }}>
                    {result.username || '-'}
                  </td>
                  <td style={{ fontFamily: 'monospace', color: '#00ff00' }}>
                    {result.password || '-'}
                  </td>
                  <td>
                    <span className={`badge ${result.success ? 'badge-success' : 'badge-danger'}`}>
                      {result.success ? 'Success' : 'Failed'}
                    </span>
                  </td>
                  <td>{new Date(result.created_at).toLocaleString()}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default Results;
