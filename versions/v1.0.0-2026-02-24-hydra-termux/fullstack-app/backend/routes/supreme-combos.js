const express = require('express');
const { authMiddleware } = require('../middleware/auth');
const { run, get, all } = require('../database');

const router = express.Router();

// Get all supreme combo attacks
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { status, attack_type, limit = 50, offset = 0 } = req.query;
    
    let sql = 'SELECT * FROM supreme_combo_attacks WHERE user_id = $1';
    const params = [req.user.id];
    let paramCount = 2;
    
    if (status) {
      sql += ` AND status = $${paramCount++}`;
      params.push(status);
    }
    
    if (attack_type) {
      sql += ` AND attack_type = $${paramCount++}`;
      params.push(attack_type);
    }
    
    sql += ` ORDER BY priority DESC, created_at DESC LIMIT $${paramCount++} OFFSET $${paramCount++}`;
    params.push(parseInt(limit), parseInt(offset));
    
    const attacks = await all(sql, params);
    
    const countSql = 'SELECT COUNT(*) as total FROM supreme_combo_attacks WHERE user_id = $1' + 
      (status ? ' AND status = $2' : '') + 
      (attack_type ? ` AND attack_type = $${status ? 3 : 2}` : '');
    const countParams = [req.user.id];
    if (status) countParams.push(status);
    if (attack_type) countParams.push(attack_type);
    
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
    console.error('Error fetching supreme combo attacks:', error);
    res.status(500).json({ error: 'Failed to fetch attacks' });
  }
});

// Get single supreme combo attack
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const attack = await get(
      'SELECT * FROM supreme_combo_attacks WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );
    
    if (!attack) {
      return res.status(404).json({ error: 'Attack not found' });
    }
    
    // Get related results
    const results = await all(
      'SELECT * FROM combo_attack_results WHERE combo_attack_id = $1 ORDER BY tested_at DESC LIMIT 200',
      [req.params.id]
    );
    
    res.json({ attack, results, results_count: results.length });
  } catch (error) {
    console.error('Error fetching attack:', error);
    res.status(500).json({ error: 'Failed to fetch attack' });
  }
});

// Create new supreme combo attack
router.post('/', authMiddleware, async (req, res) => {
  try {
    const {
      name,
      attack_type,
      target_service,
      target_urls,
      target_endpoints,
      script_name,
      script_path,
      combo_file_path,
      combo_count = 0,
      proxy_list,
      user_agent_rotation = true,
      captcha_bypass = false,
      rate_limit_bypass = false,
      use_tor = false,
      use_vpn = false,
      max_threads = 10,
      timeout_seconds = 60,
      retry_failed = true,
      save_screenshots = false,
      notes,
      tags,
      priority = 5
    } = req.body;
    
    if (!name || !attack_type || !target_service || !script_name || !script_path || !combo_file_path) {
      return res.status(400).json({ 
        error: 'Required fields: name, attack_type, target_service, script_name, script_path, combo_file_path' 
      });
    }
    
    const sql = `
      INSERT INTO supreme_combo_attacks (
        user_id, name, attack_type, target_service, target_urls, target_endpoints,
        script_name, script_path, combo_file_path, combo_count,
        proxy_list, user_agent_rotation, captcha_bypass, rate_limit_bypass,
        use_tor, use_vpn, max_threads, timeout_seconds, retry_failed,
        save_screenshots, notes, tags, priority
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23)
      RETURNING *
    `;
    
    const attack = await get(sql, [
      req.user.id, name, attack_type, target_service, target_urls, 
      JSON.stringify(target_endpoints), script_name, script_path, combo_file_path, combo_count,
      proxy_list, user_agent_rotation, captcha_bypass, rate_limit_bypass,
      use_tor, use_vpn, max_threads, timeout_seconds, retry_failed,
      save_screenshots, notes, tags, priority
    ]);
    
    res.status(201).json({ attack });
  } catch (error) {
    console.error('Error creating supreme combo attack:', error);
    res.status(500).json({ error: 'Failed to create attack' });
  }
});

// Update supreme combo attack
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const attack = await get(
      'SELECT * FROM supreme_combo_attacks WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );
    
    if (!attack) {
      return res.status(404).json({ error: 'Attack not found' });
    }
    
    const updates = [];
    const params = [];
    let paramCount = 1;
    
    const allowedFields = [
      'name', 'status', 'notes', 'tags', 'priority',
      'total_combos_tested', 'successful_logins', 'failed_attempts',
      'rate_limited', 'captcha_hit', 'valid_credentials',
      'combos_per_second', 'success_rate', 'error_message',
      'output_file_path', 'screenshot_dir', 'duration_seconds'
    ];
    
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updates.push(`${field} = $${paramCount++}`);
        if (field === 'valid_credentials' || field === 'tags') {
          params.push(typeof req.body[field] === 'string' ? req.body[field] : JSON.stringify(req.body[field]));
        } else {
          params.push(req.body[field]);
        }
      }
    }
    
    if (req.body.status) {
      if (req.body.status === 'running' && !attack.started_at) {
        updates.push(`started_at = CURRENT_TIMESTAMP`);
      }
      if (req.body.status === 'completed' || req.body.status === 'failed') {
        updates.push(`completed_at = CURRENT_TIMESTAMP`);
      }
    }
    
    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }
    
    params.push(req.params.id, req.user.id);
    const sql = `UPDATE supreme_combo_attacks SET ${updates.join(', ')} WHERE id = $${paramCount++} AND user_id = $${paramCount++} RETURNING *`;
    
    const updated = await get(sql, params);
    res.json({ attack: updated });
  } catch (error) {
    console.error('Error updating supreme combo attack:', error);
    res.status(500).json({ error: 'Failed to update attack' });
  }
});

// Delete supreme combo attack
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const attack = await get(
      'SELECT * FROM supreme_combo_attacks WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );
    
    if (!attack) {
      return res.status(404).json({ error: 'Attack not found' });
    }
    
    await run('DELETE FROM supreme_combo_attacks WHERE id = $1', [req.params.id]);
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
      'SELECT * FROM supreme_combo_attacks WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );
    
    if (!attack) {
      return res.status(404).json({ error: 'Attack not found' });
    }
    
    const stats = {
      total_combos_tested: attack.total_combos_tested,
      successful_logins: attack.successful_logins,
      failed_attempts: attack.failed_attempts,
      rate_limited: attack.rate_limited,
      captcha_hit: attack.captcha_hit,
      success_rate: attack.success_rate || 0,
      combos_per_second: attack.combos_per_second || 0,
      duration_seconds: attack.duration_seconds,
      credentials_count: attack.valid_credentials ? attack.valid_credentials.length : 0,
      status: attack.status,
      completion_percentage: attack.combo_count > 0 
        ? ((attack.total_combos_tested / attack.combo_count) * 100).toFixed(2) 
        : 0
    };
    
    res.json({ stats });
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});

// Start supreme combo attack
router.post('/:id/start', authMiddleware, async (req, res) => {
  try {
    const attack = await get(
      'SELECT * FROM supreme_combo_attacks WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );
    
    if (!attack) {
      return res.status(404).json({ error: 'Attack not found' });
    }
    
    if (attack.status !== 'queued' && attack.status !== 'paused') {
      return res.status(400).json({ error: 'Attack cannot be started in current status' });
    }
    
    const updated = await get(
      'UPDATE supreme_combo_attacks SET status = $1, started_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *',
      ['running', req.params.id]
    );
    
    res.json({ attack: updated, message: 'Attack started successfully' });
  } catch (error) {
    console.error('Error starting attack:', error);
    res.status(500).json({ error: 'Failed to start attack' });
  }
});

// Pause supreme combo attack
router.post('/:id/pause', authMiddleware, async (req, res) => {
  try {
    const attack = await get(
      'SELECT * FROM supreme_combo_attacks WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );
    
    if (!attack) {
      return res.status(404).json({ error: 'Attack not found' });
    }
    
    if (attack.status !== 'running') {
      return res.status(400).json({ error: 'Attack is not running' });
    }
    
    const updated = await get(
      'UPDATE supreme_combo_attacks SET status = $1 WHERE id = $2 RETURNING *',
      ['paused', req.params.id]
    );
    
    res.json({ attack: updated, message: 'Attack paused successfully' });
  } catch (error) {
    console.error('Error pausing attack:', error);
    res.status(500).json({ error: 'Failed to pause attack' });
  }
});

// Stop supreme combo attack
router.post('/:id/stop', authMiddleware, async (req, res) => {
  try {
    const attack = await get(
      'SELECT * FROM supreme_combo_attacks WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );
    
    if (!attack) {
      return res.status(404).json({ error: 'Attack not found' });
    }
    
    if (attack.status !== 'running' && attack.status !== 'paused') {
      return res.status(400).json({ error: 'Attack cannot be stopped in current status' });
    }
    
    const updated = await get(
      'UPDATE supreme_combo_attacks SET status = $1, completed_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *',
      ['cancelled', req.params.id]
    );
    
    res.json({ attack: updated, message: 'Attack stopped successfully' });
  } catch (error) {
    console.error('Error stopping attack:', error);
    res.status(500).json({ error: 'Failed to stop attack' });
  }
});

// Get available supreme combo scripts
router.get('/scripts/available', authMiddleware, async (req, res) => {
  try {
    // This would normally scan a scripts directory
    // For now, return a predefined list
    const scripts = [
      {
        name: 'Gmail Supreme Combo',
        type: 'email_ip',
        script_name: 'gmail_supreme.py',
        description: 'Advanced Gmail credential testing with IP rotation',
        features: ['proxy_support', 'captcha_bypass', 'rate_limit_bypass']
      },
      {
        name: 'Office365 Supreme Combo',
        type: 'email_ip',
        script_name: 'office365_supreme.py',
        description: 'Office365 credential testing with Azure AD bypass',
        features: ['mfa_detection', 'tenant_enumeration', 'proxy_support']
      },
      {
        name: 'AWS Console Combo',
        type: 'cloud_service',
        script_name: 'aws_console_combo.py',
        description: 'AWS console login testing',
        features: ['iam_enumeration', 'access_key_testing', 'role_discovery']
      },
      {
        name: 'Azure Portal Combo',
        type: 'cloud_service',
        script_name: 'azure_portal_combo.py',
        description: 'Azure portal credential testing',
        features: ['tenant_discovery', 'conditional_access_bypass', 'mfa_detection']
      },
      {
        name: 'LinkedIn Combo',
        type: 'web_application',
        script_name: 'linkedin_combo.py',
        description: 'LinkedIn credential validation',
        features: ['captcha_bypass', 'rate_limit_evasion', 'session_extraction']
      },
      {
        name: 'Instagram Combo',
        type: 'web_application',
        script_name: 'instagram_combo.py',
        description: 'Instagram account validation',
        features: ['2fa_detection', 'challenge_bypass', 'proxy_support']
      }
    ];
    
    res.json({ scripts });
  } catch (error) {
    console.error('Error fetching scripts:', error);
    res.status(500).json({ error: 'Failed to fetch scripts' });
  }
});

module.exports = router;
