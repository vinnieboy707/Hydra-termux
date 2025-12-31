import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';

const ATTACK_TYPES = [
  {
    id: 'ssh',
    name: 'SSH Admin Attack',
    description: 'Brute-force SSH service with username/password combinations',
    defaultPort: 22,
    fields: [
      { name: 'target', label: 'Target IP/Hostname', type: 'text', required: true, placeholder: '192.168.1.100' },
      { name: 'port', label: 'Port', type: 'number', required: false, placeholder: '22' },
      { name: 'username', label: 'Username (optional)', type: 'text', required: false, placeholder: 'admin' },
      { name: 'userlist', label: 'Username List', type: 'select', required: false, options: [] },
      { name: 'password', label: 'Password (optional)', type: 'text', required: false, placeholder: 'password123' },
      { name: 'passlist', label: 'Password List', type: 'select', required: false, options: [] },
      { name: 'threads', label: 'Threads', type: 'number', required: false, placeholder: '16' },
      { name: 'verbose', label: 'Verbose Output', type: 'checkbox', required: false }
    ]
  },
  {
    id: 'ftp',
    name: 'FTP Admin Attack',
    description: 'Attack FTP service with credential brute-forcing',
    defaultPort: 21,
    fields: [
      { name: 'target', label: 'Target IP/Hostname', type: 'text', required: true, placeholder: '192.168.1.100' },
      { name: 'port', label: 'Port', type: 'number', required: false, placeholder: '21' },
      { name: 'username', label: 'Username (optional)', type: 'text', required: false, placeholder: 'ftp' },
      { name: 'userlist', label: 'Username List', type: 'select', required: false, options: [] },
      { name: 'password', label: 'Password (optional)', type: 'text', required: false },
      { name: 'passlist', label: 'Password List', type: 'select', required: false, options: [] },
      { name: 'threads', label: 'Threads', type: 'number', required: false, placeholder: '16' }
    ]
  },
  {
    id: 'web',
    name: 'Web Admin Attack',
    description: 'Attack HTTP/HTTPS admin panels and login forms',
    defaultPort: 80,
    fields: [
      { name: 'target', label: 'Target URL', type: 'text', required: true, placeholder: 'http://example.com/admin' },
      { name: 'method', label: 'HTTP Method', type: 'select', required: true, options: ['GET', 'POST'] },
      { name: 'path', label: 'Login Path', type: 'text', required: false, placeholder: '/admin/login' },
      { name: 'username', label: 'Username (optional)', type: 'text', required: false, placeholder: 'admin' },
      { name: 'userlist', label: 'Username List', type: 'select', required: false, options: [] },
      { name: 'password', label: 'Password (optional)', type: 'text', required: false },
      { name: 'passlist', label: 'Password List', type: 'select', required: false, options: [] },
      { name: 'https', label: 'Use HTTPS', type: 'checkbox', required: false }
    ]
  },
  {
    id: 'rdp',
    name: 'RDP Admin Attack',
    description: 'Brute-force Windows Remote Desktop Protocol',
    defaultPort: 3389,
    fields: [
      { name: 'target', label: 'Target IP/Hostname', type: 'text', required: true, placeholder: '192.168.1.100' },
      { name: 'port', label: 'Port', type: 'number', required: false, placeholder: '3389' },
      { name: 'domain', label: 'Domain (optional)', type: 'text', required: false, placeholder: 'WORKGROUP' },
      { name: 'username', label: 'Username (optional)', type: 'text', required: false, placeholder: 'Administrator' },
      { name: 'userlist', label: 'Username List', type: 'select', required: false, options: [] },
      { name: 'password', label: 'Password (optional)', type: 'text', required: false },
      { name: 'passlist', label: 'Password List', type: 'select', required: false, options: [] },
      { name: 'threads', label: 'Threads', type: 'number', required: false, placeholder: '4' }
    ]
  },
  {
    id: 'mysql',
    name: 'MySQL Admin Attack',
    description: 'Attack MySQL database server',
    defaultPort: 3306,
    fields: [
      { name: 'target', label: 'Target IP/Hostname', type: 'text', required: true, placeholder: '192.168.1.100' },
      { name: 'port', label: 'Port', type: 'number', required: false, placeholder: '3306' },
      { name: 'username', label: 'Username (optional)', type: 'text', required: false, placeholder: 'root' },
      { name: 'userlist', label: 'Username List', type: 'select', required: false, options: [] },
      { name: 'password', label: 'Password (optional)', type: 'text', required: false },
      { name: 'passlist', label: 'Password List', type: 'select', required: false, options: [] },
      { name: 'database', label: 'Database Name', type: 'text', required: false, placeholder: 'mysql' },
      { name: 'threads', label: 'Threads', type: 'number', required: false, placeholder: '16' }
    ]
  },
  {
    id: 'postgres',
    name: 'PostgreSQL Admin Attack',
    description: 'Attack PostgreSQL database server',
    defaultPort: 5432,
    fields: [
      { name: 'target', label: 'Target IP/Hostname', type: 'text', required: true, placeholder: '192.168.1.100' },
      { name: 'port', label: 'Port', type: 'number', required: false, placeholder: '5432' },
      { name: 'username', label: 'Username (optional)', type: 'text', required: false, placeholder: 'postgres' },
      { name: 'userlist', label: 'Username List', type: 'select', required: false, options: [] },
      { name: 'password', label: 'Password (optional)', type: 'text', required: false },
      { name: 'passlist', label: 'Password List', type: 'select', required: false, options: [] },
      { name: 'database', label: 'Database Name', type: 'text', required: false, placeholder: 'postgres' },
      { name: 'threads', label: 'Threads', type: 'number', required: false, placeholder: '16' }
    ]
  },
  {
    id: 'smb',
    name: 'SMB Admin Attack',
    description: 'Attack Windows SMB/CIFS file sharing',
    defaultPort: 445,
    fields: [
      { name: 'target', label: 'Target IP/Hostname', type: 'text', required: true, placeholder: '192.168.1.100' },
      { name: 'port', label: 'Port', type: 'number', required: false, placeholder: '445' },
      { name: 'domain', label: 'Domain (optional)', type: 'text', required: false, placeholder: 'WORKGROUP' },
      { name: 'username', label: 'Username (optional)', type: 'text', required: false, placeholder: 'Administrator' },
      { name: 'userlist', label: 'Username List', type: 'select', required: false, options: [] },
      { name: 'password', label: 'Password (optional)', type: 'text', required: false },
      { name: 'passlist', label: 'Password List', type: 'select', required: false, options: [] },
      { name: 'threads', label: 'Threads', type: 'number', required: false, placeholder: '16' }
    ]
  },
  {
    id: 'auto',
    name: 'Multi-Protocol Auto Attack',
    description: 'Automatically detect and attack all available services',
    defaultPort: null,
    fields: [
      { name: 'target', label: 'Target IP/Hostname', type: 'text', required: true, placeholder: '192.168.1.100' },
      { name: 'userlist', label: 'Username List', type: 'select', required: false, options: [] },
      { name: 'passlist', label: 'Password List', type: 'select', required: false, options: [] },
      { name: 'scan_first', label: 'Scan Target First', type: 'checkbox', required: false, defaultValue: true },
      { name: 'threads', label: 'Threads', type: 'number', required: false, placeholder: '16' }
    ]
  }
];

function ScriptGenerator() {
  const [selectedType, setSelectedType] = useState(ATTACK_TYPES[0]);
  const [formData, setFormData] = useState({});
  const [wordlists, setWordlists] = useState([]);
  const [generatedScript, setGeneratedScript] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    fetchWordlists();
  }, []);

  useEffect(() => {
    // Initialize form data with default values
    const initialData = {};
    selectedType.fields.forEach(field => {
      if (field.type === 'number' && field.placeholder) {
        initialData[field.name] = '';
      } else if (field.type === 'checkbox') {
        initialData[field.name] = field.defaultValue || false;
      } else {
        initialData[field.name] = '';
      }
    });
    setFormData(initialData);
    setGeneratedScript('');
  }, [selectedType]);

  const fetchWordlists = async () => {
    try {
      const response = await api.get('/wordlists');
      setWordlists(response.data.wordlists || []);
    } catch (error) {
      console.error('Error fetching wordlists:', error);
    }
  };

  const handleInputChange = (fieldName, value) => {
    setFormData(prev => ({ ...prev, [fieldName]: value }));
  };

  const generateScript = () => {
    const type = selectedType.id;
    let script = '';

    switch (type) {
      case 'ssh':
        script = generateSSHScript();
        break;
      case 'ftp':
        script = generateFTPScript();
        break;
      case 'web':
        script = generateWebScript();
        break;
      case 'rdp':
        script = generateRDPScript();
        break;
      case 'mysql':
        script = generateMySQLScript();
        break;
      case 'postgres':
        script = generatePostgresScript();
        break;
      case 'smb':
        script = generateSMBScript();
        break;
      case 'auto':
        script = generateAutoScript();
        break;
      default:
        script = '# Unknown attack type';
    }

    setGeneratedScript(script);
  };

  const generateSSHScript = () => {
    const { target, port, username, userlist, password, passlist, threads, verbose } = formData;
    let cmd = `bash scripts/ssh_admin_attack.sh -t ${target}`;
    if (port) cmd += ` -p ${port}`;
    if (username) cmd += ` -l ${username}`;
    if (userlist) {
      const path = getWordlistPath(userlist);
      if (path) cmd += ` -u ${path}`;
    }
    if (password) cmd += ` -P ${password}`;
    if (passlist) {
      const path = getWordlistPath(passlist);
      if (path) cmd += ` -w ${path}`;
    }
    if (threads) cmd += ` -T ${threads}`;
    if (verbose) cmd += ` -v`;
    
    return `# SSH Admin Attack
# Target: ${target}${port ? ':' + port : ':22'}
# This script uses THC-Hydra to brute-force SSH credentials

${cmd}

# Results will be saved to logs/ directory
# Check results with: bash scripts/results_viewer.sh --protocol ssh`;
  };

  const generateFTPScript = () => {
    const { target, port, username, userlist, password, passlist, threads } = formData;
    let cmd = `bash scripts/ftp_admin_attack.sh -t ${target}`;
    if (port) cmd += ` -p ${port}`;
    if (username) cmd += ` -l ${username}`;
    if (userlist) cmd += ` -u ${getWordlistPath(userlist)}`;
    if (password) cmd += ` -P ${password}`;
    if (passlist) cmd += ` -w ${getWordlistPath(passlist)}`;
    if (threads) cmd += ` -T ${threads}`;
    
    return `# FTP Admin Attack
# Target: ${target}${port ? ':' + port : ':21'}

${cmd}`;
  };

  const generateWebScript = () => {
    const { target, method, path, username, userlist, password, passlist, https } = formData;
    let cmd = `bash scripts/web_admin_attack.sh -t ${target}`;
    if (path) cmd += ` -P ${path}`;
    if (username) cmd += ` -l ${username}`;
    if (userlist) cmd += ` -u ${getWordlistPath(userlist)}`;
    if (password) cmd += ` -p ${password}`;
    if (passlist) cmd += ` -w ${getWordlistPath(passlist)}`;
    if (https) cmd += ` -s`;
    
    return `# Web Admin Attack
# Target: ${target}
# Method: ${method || 'POST'}

${cmd}`;
  };

  const generateRDPScript = () => {
    const { target, port, domain, username, userlist, password, passlist, threads } = formData;
    let cmd = `bash scripts/rdp_admin_attack.sh -t ${target}`;
    if (port) cmd += ` -p ${port}`;
    if (domain) cmd += ` -d ${domain}`;
    if (username) cmd += ` -l ${username}`;
    if (userlist) cmd += ` -u ${getWordlistPath(userlist)}`;
    if (password) cmd += ` -P ${password}`;
    if (passlist) cmd += ` -w ${getWordlistPath(passlist)}`;
    if (threads) cmd += ` -T ${threads}`;
    
    return `# RDP Admin Attack
# Target: ${target}${port ? ':' + port : ':3389'}
${domain ? `# Domain: ${domain}` : ''}

${cmd}`;
  };

  const generateMySQLScript = () => {
    const { target, port, username, userlist, password, passlist, database, threads } = formData;
    let cmd = `bash scripts/mysql_admin_attack.sh -t ${target}`;
    if (port) cmd += ` -p ${port}`;
    if (username) cmd += ` -l ${username}`;
    if (userlist) cmd += ` -u ${getWordlistPath(userlist)}`;
    if (password) cmd += ` -P ${password}`;
    if (passlist) cmd += ` -w ${getWordlistPath(passlist)}`;
    if (database) cmd += ` -d ${database}`;
    if (threads) cmd += ` -T ${threads}`;
    
    return `# MySQL Admin Attack
# Target: ${target}${port ? ':' + port : ':3306'}
${database ? `# Database: ${database}` : ''}

${cmd}`;
  };

  const generatePostgresScript = () => {
    const { target, port, username, userlist, password, passlist, database, threads } = formData;
    let cmd = `bash scripts/postgres_admin_attack.sh -t ${target}`;
    if (port) cmd += ` -p ${port}`;
    if (username) cmd += ` -l ${username}`;
    if (userlist) cmd += ` -u ${getWordlistPath(userlist)}`;
    if (password) cmd += ` -P ${password}`;
    if (passlist) cmd += ` -w ${getWordlistPath(passlist)}`;
    if (database) cmd += ` -d ${database}`;
    if (threads) cmd += ` -T ${threads}`;
    
    return `# PostgreSQL Admin Attack
# Target: ${target}${port ? ':' + port : ':5432'}
${database ? `# Database: ${database}` : ''}

${cmd}`;
  };

  const generateSMBScript = () => {
    const { target, port, domain, username, userlist, password, passlist, threads } = formData;
    let cmd = `bash scripts/smb_admin_attack.sh -t ${target}`;
    if (port) cmd += ` -p ${port}`;
    if (domain) cmd += ` -d ${domain}`;
    if (username) cmd += ` -l ${username}`;
    if (userlist) cmd += ` -u ${getWordlistPath(userlist)}`;
    if (password) cmd += ` -P ${password}`;
    if (passlist) cmd += ` -w ${getWordlistPath(passlist)}`;
    if (threads) cmd += ` -T ${threads}`;
    
    return `# SMB Admin Attack
# Target: ${target}${port ? ':' + port : ':445'}
${domain ? `# Domain: ${domain}` : ''}

${cmd}`;
  };

  const generateAutoScript = () => {
    const { target, userlist, passlist, scan_first, threads } = formData;
    let cmd = `bash scripts/admin_auto_attack.sh -t ${target}`;
    if (userlist) cmd += ` -u ${getWordlistPath(userlist)}`;
    if (passlist) cmd += ` -w ${getWordlistPath(passlist)}`;
    if (scan_first) cmd += ` -r`;
    if (threads) cmd += ` -T ${threads}`;
    
    return `# Multi-Protocol Auto Attack
# Target: ${target}
# This will automatically detect and attack all available services

${cmd}`;
  };

  const getWordlistPath = (wordlistId) => {
    if (!wordlistId) return null;
    const wordlist = wordlists.find(w => w.id === parseInt(wordlistId));
    return wordlist ? wordlist.path : null;
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(generatedScript);
    alert('Script copied to clipboard!');
  };

  const renderField = (field) => {
    const wordlistOptions = wordlists.filter(w => 
      (field.name.includes('user') && w.type === 'username') ||
      (field.name.includes('pass') && w.type === 'password') ||
      w.type === 'generic'
    );

    switch (field.type) {
      case 'text':
        return (
          <input
            type="text"
            className="form-input"
            value={formData[field.name] || ''}
            onChange={(e) => handleInputChange(field.name, e.target.value)}
            placeholder={field.placeholder}
            required={field.required}
          />
        );
      case 'number':
        return (
          <input
            type="number"
            className="form-input"
            value={formData[field.name] || ''}
            onChange={(e) => handleInputChange(field.name, e.target.value)}
            placeholder={field.placeholder}
            required={field.required}
          />
        );
      case 'checkbox':
        return (
          <input
            type="checkbox"
            checked={formData[field.name] || false}
            onChange={(e) => handleInputChange(field.name, e.target.checked)}
          />
        );
      case 'select':
        if (field.name.includes('list')) {
          return (
            <select
              className="form-select"
              value={formData[field.name] || ''}
              onChange={(e) => handleInputChange(field.name, e.target.value)}
            >
              <option value="">-- Select wordlist --</option>
              {wordlistOptions.map(w => (
                <option key={w.id} value={w.id}>{w.name}</option>
              ))}
            </select>
          );
        } else if (field.options) {
          return (
            <select
              className="form-select"
              value={formData[field.name] || field.options[0]}
              onChange={(e) => handleInputChange(field.name, e.target.value)}
            >
              {field.options.map(opt => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          );
        }
        break;
      default:
        return null;
    }
  };

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Attack Script Generator</h1>
        <p className="page-subtitle">Generate ready-to-use attack scripts with custom parameters</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: '20px' }}>
        {/* Attack Type Selection */}
        <div>
          <h3 style={{ marginBottom: '15px', color: '#00d9ff' }}>Attack Types</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {ATTACK_TYPES.map(type => (
              <button
                key={type.id}
                className={`btn ${selectedType.id === type.id ? 'btn-primary' : 'btn-secondary'}`}
                style={{ textAlign: 'left', padding: '12px' }}
                onClick={() => setSelectedType(type)}
              >
                <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>{type.name}</div>
                <div style={{ fontSize: '0.85rem', opacity: 0.8 }}>{type.description}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Configuration Form */}
        <div>
          <div className="card" style={{ marginBottom: '20px' }}>
            <h3 style={{ marginBottom: '20px', color: '#00d9ff' }}>{selectedType.name}</h3>
            <p style={{ color: '#888', marginBottom: '30px' }}>{selectedType.description}</p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
              {selectedType.fields.map(field => (
                <div key={field.name} className="form-group" style={field.type === 'checkbox' ? { gridColumn: '1 / -1' } : {}}>
                  <label className="form-label">
                    {field.label}
                    {field.required && <span style={{ color: '#ff4444' }}> *</span>}
                  </label>
                  {renderField(field)}
                </div>
              ))}
            </div>

            <div style={{ marginTop: '30px', display: 'flex', gap: '10px' }}>
              <button 
                className="btn btn-primary"
                onClick={generateScript}
                disabled={!formData.target}
              >
                Generate Script
              </button>
              <button 
                className="btn btn-secondary"
                onClick={() => navigate('/attacks')}
              >
                Back to Attacks
              </button>
            </div>
          </div>

          {/* Generated Script */}
          {generatedScript && (
            <div className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                <h3 style={{ color: '#00d9ff' }}>Generated Script</h3>
                <button className="btn btn-secondary btn-small" onClick={copyToClipboard}>
                  Copy to Clipboard
                </button>
              </div>
              <pre style={{
                backgroundColor: '#1a1a1a',
                padding: '15px',
                borderRadius: '5px',
                overflowX: 'auto',
                fontSize: '0.9rem',
                lineHeight: '1.5',
                color: '#00ff00'
              }}>
                {generatedScript}
              </pre>
              <div style={{ marginTop: '15px', padding: '10px', backgroundColor: '#2a2a2a', borderRadius: '5px' }}>
                <strong style={{ color: '#ffaa00' }}>⚠️ Instructions:</strong>
                <ol style={{ marginTop: '10px', marginLeft: '20px', color: '#ccc' }}>
                  <li>Copy the script above</li>
                  <li>Open your terminal and navigate to the Hydra-termux directory</li>
                  <li>Paste and run the command</li>
                  <li>Results will be saved automatically to the logs/ directory</li>
                </ol>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default ScriptGenerator;
