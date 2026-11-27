const express = require('express');
const { authMiddleware } = require('../middleware/auth');
const { run, get, all } = require('../database');

const router = express.Router();

// Get all email-IP attacks for user
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { status, limit = 50, offset = 0 } = req.query;
    
    let sql = 'SELECT * FROM email_ip_attacks WHERE user_id = $1';
    const params = [req.user.id];
    
    if (status) {
      sql += ' AND status = $2';
      params.push(status);
      sql += ' ORDER BY created_at DESC LIMIT $3 OFFSET $4';
      params.push(parseInt(limit), parseInt(offset));
    } else {
      sql += ' ORDER BY created_at DESC LIMIT $2 OFFSET $3';
      params.push(parseInt(limit), parseInt(offset));
    }
    
    const attacks = await all(sql, params);
    
    // Get total count
    const countSql = 'SELECT COUNT(*) as total FROM email_ip_attacks WHERE user_id = $1' + (status ? ' AND status = $2' : '');
    const countParams = status ? [req.user.id, status] : [req.user.id];
    const { total } = await get(countSql, countParams);
    
    res.json({ 
      attacks, 
      pagination: { 
        total: parseInt(total), 
        limit: parseInt(limit), 
        offset: parseInt(offset) 
      } 
    });
  } catch (error) {
    console.error('Error fetching email-IP attacks:', error);
    res.status(500).json({ error: 'Failed to fetch attacks' });
  }
});

// Get single email-IP attack
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const attack = await get(
      'SELECT * FROM email_ip_attacks WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );
    
    if (!attack) {
      return res.status(404).json({ error: 'Attack not found' });
    }
    
    // Get related results
    const results = await all(
      'SELECT * FROM combo_attack_results WHERE email_attack_id = $1 ORDER BY tested_at DESC LIMIT 100',
      [req.params.id]
    );
    
    res.json({ attack, results });
  } catch (error) {
    console.error('Error fetching attack:', error);
    res.status(500).json({ error: 'Failed to fetch attack' });
  }
});

// Create new email-IP attack
router.post('/', authMiddleware, async (req, res) => {
  try {
    const {
      name,
      target_email,
      target_ip,
      target_port = 587,
      protocol = 'smtp',
      wordlist_id,
      combo_list_path,
      use_ssl = true,
      use_tls = true,
      timeout_seconds = 30,
      max_threads = 4,
      retry_attempts = 3,
      notes,
      tags
    } = req.body;
    
    if (!name || !target_email || !target_ip) {
      return res.status(400).json({ error: 'Name, target_email, and target_ip are required' });
    }
    
    const sql = `
      INSERT INTO email_ip_attacks (
        user_id, name, target_email, target_ip, target_port, protocol,
        wordlist_id, combo_list_path, use_ssl, use_tls, timeout_seconds,
        max_threads, retry_attempts, notes, tags
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      RETURNING *
    `;
    
    const attack = await get(sql, [
      req.user.id, name, target_email, target_ip, target_port, protocol,
      wordlist_id, combo_list_path, use_ssl, use_tls, timeout_seconds,
      max_threads, retry_attempts, notes, tags
    ]);
    
    res.status(201).json({ attack });
  } catch (error) {
    console.error('Error creating attack:', error);
    res.status(500).json({ error: 'Failed to create attack' });
  }
});

// Update email-IP attack
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const attack = await get(
      'SELECT * FROM email_ip_attacks WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );
    
    if (!attack) {
      return res.status(404).json({ error: 'Attack not found' });
    }
    
    const {
      name, status, notes, tags,
      total_attempts, successful_attempts, failed_attempts,
      credentials_found, error_message, duration_seconds
    } = req.body;
    
    const updates = [];
    const params = [];
    let paramCount = 1;
    
    if (name !== undefined) {
      updates.push(`name = $${paramCount++}`);
      params.push(name);
    }
    if (status !== undefined) {
      updates.push(`status = $${paramCount++}`);
      params.push(status);
      if (status === 'running' && !attack.started_at) {
        updates.push(`started_at = CURRENT_TIMESTAMP`);
      }
      if (status === 'completed' || status === 'failed') {
        updates.push(`completed_at = CURRENT_TIMESTAMP`);
      }
    }
    if (notes !== undefined) {
      updates.push(`notes = $${paramCount++}`);
      params.push(notes);
    }
    if (tags !== undefined) {
      updates.push(`tags = $${paramCount++}`);
      params.push(tags);
    }
    if (total_attempts !== undefined) {
      updates.push(`total_attempts = $${paramCount++}`);
      params.push(total_attempts);
    }
    if (successful_attempts !== undefined) {
      updates.push(`successful_attempts = $${paramCount++}`);
      params.push(successful_attempts);
    }
    if (failed_attempts !== undefined) {
      updates.push(`failed_attempts = $${paramCount++}`);
      params.push(failed_attempts);
    }
    if (credentials_found !== undefined) {
      updates.push(`credentials_found = $${paramCount++}`);
      params.push(JSON.stringify(credentials_found));
    }
    if (error_message !== undefined) {
      updates.push(`error_message = $${paramCount++}`);
      params.push(error_message);
    }
    if (duration_seconds !== undefined) {
      updates.push(`duration_seconds = $${paramCount++}`);
      params.push(duration_seconds);
    }
    
    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }
    
    params.push(req.params.id, req.user.id);
    const sql = `UPDATE email_ip_attacks SET ${updates.join(', ')} WHERE id = $${paramCount++} AND user_id = $${paramCount++} RETURNING *`;
    
    const updated = await get(sql, params);
    res.json({ attack: updated });
  } catch (error) {
    console.error('Error updating attack:', error);
    res.status(500).json({ error: 'Failed to update attack' });
  }
});

// Delete email-IP attack
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const attack = await get(
      'SELECT * FROM email_ip_attacks WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );
    
    if (!attack) {
      return res.status(404).json({ error: 'Attack not found' });
    }
    
    await run('DELETE FROM email_ip_attacks WHERE id = $1', [req.params.id]);
    res.json({ message: 'Attack deleted successfully' });
  } catch (error) {
    console.error('Error deleting attack:', error);
    res.status(500).json({ error: 'Failed to delete attack' });
  }
});

// Get attack statistics
router.get('/:id/stats', authMiddleware, async (req, res) => {
  try {
    const attack = await get(
      'SELECT * FROM email_ip_attacks WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );
    
    if (!attack) {
      return res.status(404).json({ error: 'Attack not found' });
    }
    
    const stats = {
      total_attempts: attack.total_attempts,
      successful_attempts: attack.successful_attempts,
      failed_attempts: attack.failed_attempts,
      success_rate: attack.total_attempts > 0 
        ? ((attack.successful_attempts / attack.total_attempts) * 100).toFixed(2) 
        : 0,
      duration_seconds: attack.duration_seconds,
      credentials_count: attack.credentials_found ? attack.credentials_found.length : 0,
      status: attack.status
    };
    
    res.json({ stats });
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});

// Start email-IP attack
router.post('/:id/start', authMiddleware, async (req, res) => {
  try {
    const attack = await get(
      'SELECT * FROM email_ip_attacks WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );
    
    if (!attack) {
      return res.status(404).json({ error: 'Attack not found' });
    }
    
    if (attack.status !== 'queued' && attack.status !== 'paused') {
      return res.status(400).json({ error: 'Attack cannot be started in current status' });
    }
    
    const updated = await get(
      'UPDATE email_ip_attacks SET status = $1, started_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *',
      ['running', req.params.id]
    );
    
    // Here you would trigger the actual attack execution
    // This could be a queue system, webhook, or background job
    
    res.json({ attack: updated, message: 'Attack started successfully' });
  } catch (error) {
    console.error('Error starting attack:', error);
    res.status(500).json({ error: 'Failed to start attack' });
  }
});

// Stop email-IP attack
router.post('/:id/stop', authMiddleware, async (req, res) => {
  try {
    const attack = await get(
      'SELECT * FROM email_ip_attacks WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );
    
    if (!attack) {
      return res.status(404).json({ error: 'Attack not found' });
    }
    
    if (attack.status !== 'running') {
      return res.status(400).json({ error: 'Attack is not running' });
    }
    
    const updated = await get(
      'UPDATE email_ip_attacks SET status = $1, completed_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *',
      ['cancelled', req.params.id]
    );
    
    res.json({ attack: updated, message: 'Attack stopped successfully' });
  } catch (error) {
    console.error('Error stopping attack:', error);
    res.status(500).json({ error: 'Failed to stop attack' });
  }
});

module.exports = router;
