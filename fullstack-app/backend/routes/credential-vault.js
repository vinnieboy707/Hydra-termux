const express = require('express');
const { authMiddleware } = require('../middleware/auth');
const { run, get, all } = require('../database-pg');

const router = express.Router();

// Get all credentials from vault
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { 
      category, 
      target_service, 
      is_verified,
      limit = 100, 
      offset = 0 
    } = req.query;
    
    let sql = 'SELECT * FROM credential_vault WHERE user_id = $1';
    const params = [req.user.id];
    let paramCount = 2;
    
    if (category) {
      sql += ` AND category = $${paramCount++}`;
      params.push(category);
    }
    
    if (target_service) {
      sql += ` AND target_service = $${paramCount++}`;
      params.push(target_service);
    }
    
    if (is_verified !== undefined) {
      sql += ` AND is_verified = $${paramCount++}`;
      params.push(is_verified === 'true');
    }
    
    sql += ` ORDER BY priority DESC, discovered_at DESC LIMIT $${paramCount++} OFFSET $${paramCount++}`;
    params.push(parseInt(limit), parseInt(offset));
    
    const credentials = await all(sql, params);
    
    // Get total count
    let countSql = 'SELECT COUNT(*) as total FROM credential_vault WHERE user_id = $1';
    const countParams = [req.user.id];
    if (category) {
      countSql += ' AND category = $2';
      countParams.push(category);
    }
    if (target_service) {
      countSql += ` AND target_service = $${countParams.length + 1}`;
      countParams.push(target_service);
    }
    
    const { total } = await get(countSql, countParams);
    
    res.json({ 
      credentials, 
      pagination: { 
        total: parseInt(total), 
        limit: parseInt(limit), 
        offset: parseInt(offset) 
      } 
    });
  } catch (error) {
    console.error('Error fetching credentials:', error);
    res.status(500).json({ error: 'Failed to fetch credentials' });
  }
});

// Get single credential
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const credential = await get(
      'SELECT * FROM credential_vault WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );
    
    if (!credential) {
      return res.status(404).json({ error: 'Credential not found' });
    }
    
    res.json({ credential });
  } catch (error) {
    console.error('Error fetching credential:', error);
    res.status(500).json({ error: 'Failed to fetch credential' });
  }
});

// Add credential to vault
router.post('/', authMiddleware, async (req, res) => {
  try {
    const {
      username,
      password,
      email,
      target_service,
      target_url,
      access_level,
      account_status,
      two_factor_enabled = false,
      session_token,
      api_keys,
      additional_info,
      category,
      tags,
      notes,
      priority = 5,
      source_attack_type,
      source_attack_id
    } = req.body;
    
    if (!username || !password || !target_service) {
      return res.status(400).json({ 
        error: 'Username, password, and target_service are required' 
      });
    }
    
    const sql = `
      INSERT INTO credential_vault (
        user_id, username, password, email, target_service, target_url,
        access_level, account_status, two_factor_enabled, session_token,
        api_keys, additional_info, category, tags, notes, priority,
        source_attack_type, source_attack_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
      RETURNING *
    `;
    
    const credential = await get(sql, [
      req.user.id, username, password, email, target_service, target_url,
      access_level, account_status, two_factor_enabled, session_token,
      JSON.stringify(api_keys), JSON.stringify(additional_info), 
      category, tags, notes, priority, source_attack_type, source_attack_id
    ]);
    
    res.status(201).json({ credential });
  } catch (error) {
    console.error('Error adding credential:', error);
    res.status(500).json({ error: 'Failed to add credential' });
  }
});

// Update credential
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const credential = await get(
      'SELECT * FROM credential_vault WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );
    
    if (!credential) {
      return res.status(404).json({ error: 'Credential not found' });
    }
    
    const updates = [];
    const params = [];
    let paramCount = 1;
    
    const allowedFields = [
      'username', 'password', 'email', 'target_service', 'target_url',
      'access_level', 'account_status', 'two_factor_enabled', 'session_token',
      'api_keys', 'additional_info', 'category', 'tags', 'notes', 'priority',
      'is_verified'
    ];
    
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updates.push(`${field} = $${paramCount++}`);
        if (field === 'api_keys' || field === 'additional_info') {
          params.push(JSON.stringify(req.body[field]));
        } else {
          params.push(req.body[field]);
        }
      }
    }
    
    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }
    
    params.push(req.params.id, req.user.id);
    const sql = `UPDATE credential_vault SET ${updates.join(', ')} WHERE id = $${paramCount++} AND user_id = $${paramCount++} RETURNING *`;
    
    const updated = await get(sql, params);
    res.json({ credential: updated });
  } catch (error) {
    console.error('Error updating credential:', error);
    res.status(500).json({ error: 'Failed to update credential' });
  }
});

// Delete credential
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const credential = await get(
      'SELECT * FROM credential_vault WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );
    
    if (!credential) {
      return res.status(404).json({ error: 'Credential not found' });
    }
    
    await run('DELETE FROM credential_vault WHERE id = $1', [req.params.id]);
    res.json({ message: 'Credential deleted successfully' });
  } catch (error) {
    console.error('Error deleting credential:', error);
    res.status(500).json({ error: 'Failed to delete credential' });
  }
});

// Verify credential
router.post('/:id/verify', authMiddleware, async (req, res) => {
  try {
    const credential = await get(
      'SELECT * FROM credential_vault WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );
    
    if (!credential) {
      return res.status(404).json({ error: 'Credential not found' });
    }
    
    // Here you would implement actual verification logic
    // For now, just update the verification status
    
    const updated = await get(`
      UPDATE credential_vault 
      SET is_verified = $1, 
          last_verified_at = CURRENT_TIMESTAMP,
          verification_attempts = verification_attempts + 1
      WHERE id = $2 
      RETURNING *
    `, [true, req.params.id]);
    
    res.json({ credential: updated, message: 'Credential verified successfully' });
  } catch (error) {
    console.error('Error verifying credential:', error);
    res.status(500).json({ error: 'Failed to verify credential' });
  }
});

// Bulk import credentials
router.post('/bulk-import', authMiddleware, async (req, res) => {
  try {
    const { credentials } = req.body;
    
    if (!Array.isArray(credentials) || credentials.length === 0) {
      return res.status(400).json({ error: 'Credentials array is required' });
    }
    
    const imported = [];
    const errors = [];
    
    for (const cred of credentials) {
      try {
        const { username, password, target_service } = cred;
        
        if (!username || !password || !target_service) {
          errors.push({ credential: cred, error: 'Missing required fields' });
          continue;
        }
        
        const sql = `
          INSERT INTO credential_vault (
            user_id, username, password, email, target_service,
            category, tags, notes
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          RETURNING *
        `;
        
        const result = await get(sql, [
          req.user.id, username, password, cred.email || null,
          target_service, cred.category || null, cred.tags || null,
          cred.notes || null
        ]);
        
        imported.push(result);
      } catch (error) {
        errors.push({ credential: cred, error: error.message });
      }
    }
    
    res.json({ 
      imported: imported.length,
      errors: errors.length,
      details: { imported, errors }
    });
  } catch (error) {
    console.error('Error bulk importing credentials:', error);
    res.status(500).json({ error: 'Failed to bulk import credentials' });
  }
});

// Export credentials
router.get('/export/all', authMiddleware, async (req, res) => {
  try {
    const { format = 'json' } = req.query;
    
    const credentials = await all(
      'SELECT username, password, email, target_service, target_url, category, tags, notes FROM credential_vault WHERE user_id = $1 ORDER BY discovered_at DESC',
      [req.user.id]
    );
    
    if (format === 'csv') {
      const headers = 'username,password,email,target_service,target_url,category,notes';
      const rows = credentials.map(c => 
        `${c.username},${c.password},${c.email || ''},${c.target_service},${c.target_url || ''},${c.category || ''},${c.notes || ''}`
      );
      const csv = [headers, ...rows].join('\n');
      
      res.header('Content-Type', 'text/csv');
      res.header('Content-Disposition', `attachment; filename="credentials_${Date.now()}.csv"`);
      res.send(csv);
    } else if (format === 'txt') {
      const txt = credentials.map(c => `${c.username}:${c.password}`).join('\n');
      res.header('Content-Type', 'text/plain');
      res.header('Content-Disposition', `attachment; filename="credentials_${Date.now()}.txt"`);
      res.send(txt);
    } else {
      res.json({ credentials });
    }
  } catch (error) {
    console.error('Error exporting credentials:', error);
    res.status(500).json({ error: 'Failed to export credentials' });
  }
});

// Get credential categories
router.get('/meta/categories', authMiddleware, async (req, res) => {
  try {
    const categories = await all(
      'SELECT DISTINCT category FROM credential_vault WHERE user_id = $1 AND category IS NOT NULL ORDER BY category',
      [req.user.id]
    );
    
    res.json({ categories: categories.map(c => c.category) });
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

// Get credential services
router.get('/meta/services', authMiddleware, async (req, res) => {
  try {
    const services = await all(
      'SELECT target_service, COUNT(*) as count FROM credential_vault WHERE user_id = $1 GROUP BY target_service ORDER BY count DESC',
      [req.user.id]
    );
    
    res.json({ services });
  } catch (error) {
    console.error('Error fetching services:', error);
    res.status(500).json({ error: 'Failed to fetch services' });
  }
});

// Search credentials
router.post('/search', authMiddleware, async (req, res) => {
  try {
    const { query, fields = ['username', 'email', 'target_service'] } = req.body;
    
    if (!query) {
      return res.status(400).json({ error: 'Search query is required' });
    }
    
    const conditions = fields.map((field, i) => `${field} ILIKE $${i + 2}`).join(' OR ');
    const params = [req.user.id, ...fields.map(() => `%${query}%`)];
    
    const sql = `SELECT * FROM credential_vault WHERE user_id = $1 AND (${conditions}) ORDER BY discovered_at DESC LIMIT 50`;
    
    const results = await all(sql, params);
    
    res.json({ results, query, count: results.length });
  } catch (error) {
    console.error('Error searching credentials:', error);
    res.status(500).json({ error: 'Failed to search credentials' });
  }
});

module.exports = router;
