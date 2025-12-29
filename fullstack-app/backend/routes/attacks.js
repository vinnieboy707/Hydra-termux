const express = require('express');
const { authMiddleware } = require('../middleware/auth');
const { run, get, all } = require('../database');
const AttackService = require('../services/attackService');

const router = express.Router();
const attackService = new AttackService();

// Get all attacks
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { status, protocol, limit = 50, offset = 0 } = req.query;
    
    let sql = 'SELECT * FROM attacks WHERE user_id = ?';
    const params = [req.user.id];
    
    if (status) {
      sql += ' AND status = ?';
      params.push(status);
    }
    
    if (protocol) {
      sql += ' AND protocol = ?';
      params.push(protocol);
    }
    
    sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));
    
    const attacks = await all(sql, params);
    res.json({ attacks });
  } catch (error) {
    console.error('Error fetching attacks:', error);
    res.status(500).json({ error: 'Failed to fetch attacks' });
  }
});

// Get attack by ID
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const attack = await get(
      'SELECT * FROM attacks WHERE id = ? AND user_id = ?',
      [req.params.id, req.user.id]
    );
    
    if (!attack) {
      return res.status(404).json({ error: 'Attack not found' });
    }
    
    // Get results
    const results = await all(
      'SELECT * FROM results WHERE attack_id = ?',
      [req.params.id]
    );
    
    // Get logs
    const logs = await all(
      'SELECT * FROM attack_logs WHERE attack_id = ? ORDER BY timestamp DESC LIMIT 100',
      [req.params.id]
    );
    
    res.json({ attack, results, logs });
  } catch (error) {
    console.error('Error fetching attack:', error);
    res.status(500).json({ error: 'Failed to fetch attack' });
  }
});

// Create new attack
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { attack_type, target_host, target_port, protocol, config } = req.body;
    
    if (!attack_type || !target_host || !protocol) {
      return res.status(400).json({ 
        error: 'Missing required fields: attack_type, target_host, protocol' 
      });
    }
    
    // Create attack record
    const result = await run(
      `INSERT INTO attacks (attack_type, target_host, target_port, protocol, status, user_id, config)
       VALUES (?, ?, ?, ?, 'queued', ?, ?)`,
      [attack_type, target_host, target_port, protocol, req.user.id, JSON.stringify(config || {})]
    );
    
    const attackId = result.id;
    
    // Queue the attack
    attackService.queueAttack({
      id: attackId,
      attack_type,
      target_host,
      target_port,
      protocol,
      config,
      userId: req.user.id
    });
    
    res.status(201).json({
      message: 'Attack queued successfully',
      attackId,
      status: 'queued'
    });
  } catch (error) {
    console.error('Error creating attack:', error);
    res.status(500).json({ error: 'Failed to create attack' });
  }
});

// Stop attack
router.post('/:id/stop', authMiddleware, async (req, res) => {
  try {
    const attack = await get(
      'SELECT * FROM attacks WHERE id = ? AND user_id = ?',
      [req.params.id, req.user.id]
    );
    
    if (!attack) {
      return res.status(404).json({ error: 'Attack not found' });
    }
    
    if (attack.status !== 'running') {
      return res.status(400).json({ error: 'Attack is not running' });
    }
    
    // Stop the attack
    attackService.stopAttack(req.params.id);
    
    await run(
      'UPDATE attacks SET status = ?, completed_at = CURRENT_TIMESTAMP WHERE id = ?',
      ['stopped', req.params.id]
    );
    
    res.json({ message: 'Attack stopped successfully' });
  } catch (error) {
    console.error('Error stopping attack:', error);
    res.status(500).json({ error: 'Failed to stop attack' });
  }
});

// Delete attack
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const attack = await get(
      'SELECT * FROM attacks WHERE id = ? AND user_id = ?',
      [req.params.id, req.user.id]
    );
    
    if (!attack) {
      return res.status(404).json({ error: 'Attack not found' });
    }
    
    if (attack.status === 'running') {
      return res.status(400).json({ error: 'Cannot delete running attack. Stop it first.' });
    }
    
    // Delete related records
    await run('DELETE FROM results WHERE attack_id = ?', [req.params.id]);
    await run('DELETE FROM attack_logs WHERE attack_id = ?', [req.params.id]);
    await run('DELETE FROM attacks WHERE id = ?', [req.params.id]);
    
    res.json({ message: 'Attack deleted successfully' });
  } catch (error) {
    console.error('Error deleting attack:', error);
    res.status(500).json({ error: 'Failed to delete attack' });
  }
});

// Get available attack types
router.get('/types/list', authMiddleware, async (req, res) => {
  const attackTypes = [
    { 
      id: 'ssh', 
      name: 'SSH', 
      description: 'SSH brute-force attack',
      default_port: 22
    },
    { 
      id: 'ftp', 
      name: 'FTP', 
      description: 'FTP brute-force attack',
      default_port: 21
    },
    { 
      id: 'http', 
      name: 'HTTP', 
      description: 'HTTP/HTTPS web admin attack',
      default_port: 80
    },
    { 
      id: 'rdp', 
      name: 'RDP', 
      description: 'Windows RDP attack',
      default_port: 3389
    },
    { 
      id: 'mysql', 
      name: 'MySQL', 
      description: 'MySQL database attack',
      default_port: 3306
    },
    { 
      id: 'postgres', 
      name: 'PostgreSQL', 
      description: 'PostgreSQL database attack',
      default_port: 5432
    },
    { 
      id: 'smb', 
      name: 'SMB', 
      description: 'Windows SMB/CIFS attack',
      default_port: 445
    },
    { 
      id: 'auto', 
      name: 'Auto Attack', 
      description: 'Multi-protocol automatic attack',
      default_port: null
    }
  ];
  
  res.json({ attackTypes });
});

module.exports = router;
