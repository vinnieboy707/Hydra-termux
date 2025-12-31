import React, { useState } from 'react';
import api from '../services/api';

function TargetScanner() {
  const [target, setTarget] = useState('');
  const [scanType, setScanType] = useState('auto');
  const [scanning, setScanning] = useState(false);
  const [scanResults, setScanResults] = useState(null);
  const [error, setError] = useState('');

  const detectTargetType = (target) => {
    // Email detection with proper validation
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (emailRegex.test(target)) {
      return 'email';
    }
    // IP address detection with octet validation
    const ipRegex = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
    const ipMatch = target.match(ipRegex);
    if (ipMatch) {
      // Validate each octet is 0-255
      const octets = ipMatch.slice(1).map(Number);
      if (octets.every(octet => octet >= 0 && octet <= 255)) {
        return 'ip';
      }
    }
    // Domain/hostname detection
    if (target.includes('.') && /^[a-zA-Z0-9.-]+$/.test(target)) {
      return 'domain';
    }
    return 'unknown';
  };

  const handleScan = async () => {
    if (!target) {
      setError('Please enter a target');
      return;
    }

    setScanning(true);
    setError('');
    setScanResults(null);

    try {
      const targetType = detectTargetType(target);
      
      // Call the backend scanning endpoint
      const response = await api.post('/scan/target', {
        target: target,
        targetType: targetType,
        scanType: scanType
      });

      setScanResults(response.data);
    } catch (error) {
      console.error('Scan error:', error);
      setError(error.response?.data?.error || 'Failed to scan target');
    } finally {
      setScanning(false);
    }
  };

  const renderProtocolRecommendations = (protocols) => {
    if (!protocols || protocols.length === 0) {
      return <p style={{ color: '#888' }}>No open ports detected</p>;
    }

    const protocolInfo = {
      22: { name: 'SSH', script: 'ssh_admin_attack.sh', info: 'Secure Shell - Remote login service' },
      21: { name: 'FTP', script: 'ftp_admin_attack.sh', info: 'File Transfer Protocol' },
      80: { name: 'HTTP', script: 'web_admin_attack.sh', info: 'Web server (unencrypted)' },
      443: { name: 'HTTPS', script: 'web_admin_attack.sh', info: 'Secure web server' },
      3389: { name: 'RDP', script: 'rdp_admin_attack.sh', info: 'Windows Remote Desktop' },
      3306: { name: 'MySQL', script: 'mysql_admin_attack.sh', info: 'MySQL database server' },
      5432: { name: 'PostgreSQL', script: 'postgres_admin_attack.sh', info: 'PostgreSQL database' },
      445: { name: 'SMB', script: 'smb_admin_attack.sh', info: 'Windows file sharing' },
      139: { name: 'NetBIOS', script: 'smb_admin_attack.sh', info: 'Windows networking' },
      25: { name: 'SMTP', script: 'admin_auto_attack.sh', info: 'Email server' },
      110: { name: 'POP3', script: 'admin_auto_attack.sh', info: 'Email retrieval' },
      143: { name: 'IMAP', script: 'admin_auto_attack.sh', info: 'Email retrieval' }
    };

    return (
      <div style={{ display: 'grid', gap: '15px' }}>
        {protocols.map((proto, idx) => {
          const info = protocolInfo[proto.port] || { 
            name: proto.service || 'Unknown', 
            script: 'admin_auto_attack.sh', 
            info: 'Unknown service' 
          };
          
          return (
            <div key={idx} className="card" style={{ padding: '15px', backgroundColor: '#252525' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                <div style={{ flex: 1 }}>
                  <h4 style={{ color: '#00d9ff', marginBottom: '8px' }}>
                    Port {proto.port} - {info.name}
                  </h4>
                  <p style={{ color: '#aaa', fontSize: '0.9rem', marginBottom: '10px' }}>
                    {info.info}
                  </p>
                  <div style={{ fontSize: '0.85rem', color: '#888' }}>
                    <div>State: <span style={{ color: proto.state === 'open' ? '#00ff00' : '#ff4444' }}>
                      {proto.state}
                    </span></div>
                    {proto.version && <div>Version: {proto.version}</div>}
                  </div>
                </div>
                <div style={{ marginLeft: '20px' }}>
                  <div style={{ 
                    padding: '8px 12px', 
                    backgroundColor: '#1a1a1a', 
                    borderRadius: '5px',
                    fontSize: '0.85rem',
                    fontFamily: 'monospace',
                    color: '#00ff00'
                  }}>
                    bash scripts/{info.script}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const renderEmailInfo = (emailData) => {
    return (
      <div className="card" style={{ marginTop: '20px' }}>
        <h3 style={{ color: '#00d9ff', marginBottom: '15px' }}>Email Information</h3>
        <div style={{ display: 'grid', gap: '10px' }}>
          <div>
            <strong style={{ color: '#aaa' }}>Domain:</strong>
            <span style={{ marginLeft: '10px', color: '#fff' }}>{emailData.domain}</span>
          </div>
          <div>
            <strong style={{ color: '#aaa' }}>MX Records:</strong>
            {emailData.mxRecords && emailData.mxRecords.length > 0 ? (
              <ul style={{ marginTop: '5px', marginLeft: '20px' }}>
                {emailData.mxRecords.map((mx, idx) => (
                  <li key={idx} style={{ color: '#fff' }}>{mx}</li>
                ))}
              </ul>
            ) : (
              <span style={{ marginLeft: '10px', color: '#888' }}>No MX records found</span>
            )}
          </div>
          <div>
            <strong style={{ color: '#aaa' }}>Potential Attack Vectors:</strong>
            <ul style={{ marginTop: '5px', marginLeft: '20px', color: '#fff' }}>
              <li>SMTP enumeration (port 25)</li>
              <li>Email password brute-forcing</li>
              <li>Phishing campaigns</li>
              <li>OSINT gathering</li>
            </ul>
          </div>
        </div>
      </div>
    );
  };

  const renderRecommendedScripts = (targetType) => {
    const recommendations = {
      ip: [
        { script: 'admin_auto_attack.sh', desc: 'Scan all ports and attack all services automatically' },
        { script: 'target_scanner.sh', desc: 'Quick reconnaissance scan' }
      ],
      domain: [
        { script: 'web_admin_attack.sh', desc: 'Attack web admin panels' },
        { script: 'admin_auto_attack.sh', desc: 'Full automated attack' }
      ],
      email: [
        { script: 'admin_auto_attack.sh', desc: 'Attack email server infrastructure' }
      ]
    };

    const scripts = recommendations[targetType] || recommendations.ip;

    return (
      <div className="card" style={{ marginTop: '20px' }}>
        <h3 style={{ color: '#00d9ff', marginBottom: '15px' }}>Recommended Scripts</h3>
        <div style={{ display: 'grid', gap: '10px' }}>
          {scripts.map((item, idx) => (
            <div key={idx} style={{ 
              padding: '10px', 
              backgroundColor: '#1a1a1a', 
              borderRadius: '5px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div>
                <div style={{ fontFamily: 'monospace', color: '#00ff00' }}>
                  bash scripts/{item.script}
                </div>
                <div style={{ fontSize: '0.85rem', color: '#888', marginTop: '4px' }}>
                  {item.desc}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Target Scanner</h1>
        <p className="page-subtitle">Scan and analyze targets to identify attack vectors</p>
      </div>

      <div className="card" style={{ marginBottom: '20px' }}>
        <h3 style={{ color: '#00d9ff', marginBottom: '15px' }}>Scan Configuration</h3>
        
        <div className="form-group">
          <label className="form-label">Target (IP, Domain, or Email)</label>
          <input
            type="text"
            className="form-input"
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            placeholder="192.168.1.100, example.com, or user@example.com"
            disabled={scanning}
          />
          <small style={{ color: '#888', marginTop: '5px', display: 'block' }}>
            Enter an IP address, domain name, or email address to scan
          </small>
        </div>

        <div className="form-group">
          <label className="form-label">Scan Type</label>
          <select
            className="form-select"
            value={scanType}
            onChange={(e) => setScanType(e.target.value)}
            disabled={scanning}
          >
            <option value="auto">Auto-detect</option>
            <option value="quick">Quick Scan (Top 100 ports)</option>
            <option value="full">Full Scan (All 65535 ports)</option>
            <option value="aggressive">Aggressive (OS & Service detection)</option>
          </select>
        </div>

        {error && (
          <div style={{ 
            padding: '10px', 
            backgroundColor: '#3d1414', 
            border: '1px solid #ff4444',
            borderRadius: '5px',
            color: '#ff4444',
            marginBottom: '15px'
          }}>
            {error}
          </div>
        )}

        <button
          className="btn btn-primary"
          onClick={handleScan}
          disabled={scanning || !target}
        >
          {scanning ? 'Scanning...' : 'Start Scan'}
        </button>
      </div>

      {scanning && (
        <div className="card" style={{ textAlign: 'center', padding: '40px' }}>
          <div style={{ fontSize: '1.2rem', color: '#00d9ff', marginBottom: '10px' }}>
            Scanning target...
          </div>
          <div style={{ color: '#888' }}>
            This may take a few minutes depending on the scan type
          </div>
        </div>
      )}

      {scanResults && (
        <div>
          <div className="card" style={{ marginBottom: '20px' }}>
            <h3 style={{ color: '#00d9ff', marginBottom: '15px' }}>Scan Summary</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px' }}>
              <div>
                <div style={{ fontSize: '0.85rem', color: '#888' }}>Target Type</div>
                <div style={{ fontSize: '1.2rem', color: '#fff', marginTop: '5px' }}>
                  {scanResults.targetType?.toUpperCase() || 'UNKNOWN'}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '0.85rem', color: '#888' }}>Open Ports</div>
                <div style={{ fontSize: '1.2rem', color: '#00ff00', marginTop: '5px' }}>
                  {scanResults.openPorts || 0}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '0.85rem', color: '#888' }}>Services Detected</div>
                <div style={{ fontSize: '1.2rem', color: '#00d9ff', marginTop: '5px' }}>
                  {scanResults.services || 0}
                </div>
              </div>
            </div>
          </div>

          {scanResults.protocols && scanResults.protocols.length > 0 && (
            <div className="card" style={{ marginBottom: '20px' }}>
              <h3 style={{ color: '#00d9ff', marginBottom: '15px' }}>
                Detected Protocols & Attack Recommendations
              </h3>
              {renderProtocolRecommendations(scanResults.protocols)}
            </div>
          )}

          {scanResults.targetType === 'email' && scanResults.emailInfo && 
            renderEmailInfo(scanResults.emailInfo)
          }

          {renderRecommendedScripts(scanResults.targetType)}

          <div className="card" style={{ marginTop: '20px', backgroundColor: '#2a2a2a' }}>
            <h3 style={{ color: '#ffaa00', marginBottom: '15px' }}>⚠️ Next Steps</h3>
            <ol style={{ marginLeft: '20px', color: '#ccc', lineHeight: '1.8' }}>
              <li>Review the detected services and open ports above</li>
              <li>Copy one of the recommended script commands</li>
              <li>Navigate to the Hydra-termux directory in your terminal</li>
              <li>Paste and run the command to start the attack</li>
              <li>Monitor results in the logs/ directory or use the Results Viewer</li>
            </ol>
          </div>
        </div>
      )}
    </div>
  );
}

export default TargetScanner;
