import React, { useState } from 'react';
import api from '../services/api';

function WordlistGenerator() {
  const [generatorType, setGeneratorType] = useState('combine');
  const [formData, setFormData] = useState({
    name: '',
    type: 'password',
    // Combine options
    sourceWordlists: [],
    
    // Pattern-based options
    pattern: '',
    baseWords: '',
    includeNumbers: true,
    includeSpecialChars: true,
    includeUppercase: true,
    minLength: 6,
    maxLength: 20,
    
    // Custom list
    customEntries: '',
    
    // Options
    dedupe: true,
    sort: false
  });
  const [wordlists, setWordlists] = useState([]);
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState(null);

  React.useEffect(() => {
    fetchWordlists();
  }, []);

  const fetchWordlists = async () => {
    try {
      const response = await api.get('/wordlists');
      setWordlists(response.data.wordlists || []);
    } catch (error) {
      console.error('Error fetching wordlists:', error);
    }
  };

  const handleGenerate = async () => {
    if (!formData.name) {
      alert('Please enter a name for the wordlist');
      return;
    }

    setGenerating(true);
    setResult(null);

    try {
      const response = await api.post('/wordlists/generate', {
        generatorType,
        ...formData
      });
      
      setResult(response.data);
      alert(`Wordlist generated successfully! Created ${response.data.lineCount} entries.`);
      fetchWordlists();
    } catch (error) {
      alert('Failed to generate wordlist: ' + (error.response?.data?.error || 'Unknown error'));
    } finally {
      setGenerating(false);
    }
  };

  const renderCombineOptions = () => (
    <div>
      <div className="form-group">
        <label className="form-label">Select Wordlists to Combine</label>
        <div style={{ 
          border: '1px solid #444', 
          borderRadius: '5px', 
          padding: '10px',
          maxHeight: '200px',
          overflowY: 'auto'
        }}>
          {wordlists.length === 0 ? (
            <p style={{ color: '#888' }}>No wordlists available</p>
          ) : (
            wordlists.map(w => (
              <label key={w.id} style={{ display: 'block', padding: '5px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={formData.sourceWordlists.includes(w.id)}
                  onChange={(e) => {
                    const newList = e.target.checked
                      ? [...formData.sourceWordlists, w.id]
                      : formData.sourceWordlists.filter(id => id !== w.id);
                    setFormData({ ...formData, sourceWordlists: newList });
                  }}
                  style={{ marginRight: '10px' }}
                />
                {w.name} ({w.line_count?.toLocaleString()} lines)
              </label>
            ))
          )}
        </div>
      </div>
    </div>
  );

  const renderPatternOptions = () => (
    <div>
      <div className="form-group">
        <label className="form-label">Base Words (one per line)</label>
        <textarea
          className="form-input"
          value={formData.baseWords}
          onChange={(e) => setFormData({ ...formData, baseWords: e.target.value })}
          placeholder="password&#10;admin&#10;user&#10;login"
          rows={5}
          style={{ fontFamily: 'monospace' }}
        />
      </div>

      <div className="form-group">
        <label className="form-label">Pattern (optional)</label>
        <input
          type="text"
          className="form-input"
          value={formData.pattern}
          onChange={(e) => setFormData({ ...formData, pattern: e.target.value })}
          placeholder="{word}{number} or {word}{year}"
          style={{ fontFamily: 'monospace' }}
        />
        <small style={{ color: '#888', display: 'block', marginTop: '5px' }}>
          Use {'{word}'} for base word, {'{number}'} for 0-999, {'{year}'} for 2020-2024
        </small>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
        <div className="form-group">
          <label>
            <input
              type="checkbox"
              checked={formData.includeNumbers}
              onChange={(e) => setFormData({ ...formData, includeNumbers: e.target.checked })}
            />
            <span style={{ marginLeft: '8px' }}>Add numbers (0-9)</span>
          </label>
        </div>

        <div className="form-group">
          <label>
            <input
              type="checkbox"
              checked={formData.includeSpecialChars}
              onChange={(e) => setFormData({ ...formData, includeSpecialChars: e.target.checked })}
            />
            <span style={{ marginLeft: '8px' }}>Add special characters</span>
          </label>
        </div>

        <div className="form-group">
          <label>
            <input
              type="checkbox"
              checked={formData.includeUppercase}
              onChange={(e) => setFormData({ ...formData, includeUppercase: e.target.checked })}
            />
            <span style={{ marginLeft: '8px' }}>Add uppercase variations</span>
          </label>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
        <div className="form-group">
          <label className="form-label">Minimum Length</label>
          <input
            type="number"
            className="form-input"
            value={formData.minLength}
            onChange={(e) => setFormData({ ...formData, minLength: parseInt(e.target.value) })}
            min={1}
            max={100}
          />
        </div>

        <div className="form-group">
          <label className="form-label">Maximum Length</label>
          <input
            type="number"
            className="form-input"
            value={formData.maxLength}
            onChange={(e) => setFormData({ ...formData, maxLength: parseInt(e.target.value) })}
            min={1}
            max={100}
          />
        </div>
      </div>
    </div>
  );

  const renderCustomOptions = () => (
    <div>
      <div className="form-group">
        <label className="form-label">Enter Entries (one per line)</label>
        <textarea
          className="form-input"
          value={formData.customEntries}
          onChange={(e) => setFormData({ ...formData, customEntries: e.target.value })}
          placeholder="password123&#10;admin2024&#10;Welcome!123"
          rows={10}
          style={{ fontFamily: 'monospace' }}
        />
      </div>
    </div>
  );

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Custom Wordlist Generator</h1>
        <p className="page-subtitle">Create custom wordlists for targeted attacks</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: '20px' }}>
        {/* Generator Type Selection */}
        <div>
          <h3 style={{ marginBottom: '15px', color: '#00d9ff' }}>Generator Type</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <button
              className={`btn ${generatorType === 'combine' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ textAlign: 'left', padding: '12px' }}
              onClick={() => setGeneratorType('combine')}
            >
              <div style={{ fontWeight: 'bold' }}>Combine Lists</div>
              <div style={{ fontSize: '0.85rem', opacity: 0.8 }}>Merge multiple wordlists</div>
            </button>

            <button
              className={`btn ${generatorType === 'pattern' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ textAlign: 'left', padding: '12px' }}
              onClick={() => setGeneratorType('pattern')}
            >
              <div style={{ fontWeight: 'bold' }}>Pattern-Based</div>
              <div style={{ fontSize: '0.85rem', opacity: 0.8 }}>Generate from patterns</div>
            </button>

            <button
              className={`btn ${generatorType === 'custom' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ textAlign: 'left', padding: '12px' }}
              onClick={() => setGeneratorType('custom')}
            >
              <div style={{ fontWeight: 'bold' }}>Custom List</div>
              <div style={{ fontSize: '0.85rem', opacity: 0.8 }}>Enter entries manually</div>
            </button>
          </div>
        </div>

        {/* Configuration Form */}
        <div>
          <div className="card">
            <h3 style={{ marginBottom: '20px', color: '#00d9ff' }}>
              {generatorType === 'combine' && 'Combine Wordlists'}
              {generatorType === 'pattern' && 'Pattern-Based Generator'}
              {generatorType === 'custom' && 'Custom Wordlist'}
            </h3>

            <div className="form-group">
              <label className="form-label">Wordlist Name <span style={{ color: '#ff4444' }}>*</span></label>
              <input
                type="text"
                className="form-input"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="my-custom-wordlist.txt"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Type</label>
              <select
                className="form-select"
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value })}
              >
                <option value="password">Password</option>
                <option value="username">Username</option>
                <option value="generic">Generic</option>
              </select>
            </div>

            <hr style={{ border: 'none', borderTop: '1px solid #333', margin: '20px 0' }} />

            {generatorType === 'combine' && renderCombineOptions()}
            {generatorType === 'pattern' && renderPatternOptions()}
            {generatorType === 'custom' && renderCustomOptions()}

            <hr style={{ border: 'none', borderTop: '1px solid #333', margin: '20px 0' }} />

            <h4 style={{ marginBottom: '15px', color: '#00d9ff' }}>Processing Options</h4>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
              <div className="form-group">
                <label>
                  <input
                    type="checkbox"
                    checked={formData.dedupe}
                    onChange={(e) => setFormData({ ...formData, dedupe: e.target.checked })}
                  />
                  <span style={{ marginLeft: '8px' }}>Remove duplicates</span>
                </label>
              </div>

              <div className="form-group">
                <label>
                  <input
                    type="checkbox"
                    checked={formData.sort}
                    onChange={(e) => setFormData({ ...formData, sort: e.target.checked })}
                  />
                  <span style={{ marginLeft: '8px' }}>Sort alphabetically</span>
                </label>
              </div>
            </div>

            <div style={{ marginTop: '30px' }}>
              <button
                className="btn btn-primary"
                onClick={handleGenerate}
                disabled={generating || !formData.name}
              >
                {generating ? 'Generating...' : 'Generate Wordlist'}
              </button>
            </div>
          </div>

          {result && (
            <div className="card" style={{ marginTop: '20px', backgroundColor: '#1a3d1a' }}>
              <h3 style={{ color: '#00ff00', marginBottom: '15px' }}>✓ Generation Complete</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '15px' }}>
                <div>
                  <div style={{ fontSize: '0.85rem', color: '#aaa' }}>Wordlist Name</div>
                  <div style={{ fontSize: '1.1rem', color: '#fff', marginTop: '5px' }}>{result.name}</div>
                </div>
                <div>
                  <div style={{ fontSize: '0.85rem', color: '#aaa' }}>Total Entries</div>
                  <div style={{ fontSize: '1.1rem', color: '#00ff00', marginTop: '5px' }}>
                    {result.lineCount?.toLocaleString()}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '0.85rem', color: '#aaa' }}>File Size</div>
                  <div style={{ fontSize: '1.1rem', color: '#00d9ff', marginTop: '5px' }}>
                    {formatBytes(result.size)}
                  </div>
                </div>
              </div>
              <div style={{ marginTop: '15px', padding: '10px', backgroundColor: '#0d2d0d', borderRadius: '5px' }}>
                <strong>Path:</strong> <code style={{ marginLeft: '10px', color: '#00ff00' }}>{result.path}</code>
              </div>
            </div>
          )}
        </div>
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

export default WordlistGenerator;
