const express = require('express');
const { authMiddleware } = require('../middleware/auth');
const { vpnCheckMiddleware } = require('../middleware/vpn-check');
const { run, get, all } = require('../database');
const AttackService = require('../services/attackService');
const logger = require('../utils/logger');
const { asyncHandler, AppError } = require('../middleware/errorHandler');

const router = express.Router();
const attackService = new AttackService();

// Get all attacks
router.get('/', authMiddleware, asyncHandler(async (req, res) => {
  const { status, protocol, limit = 50, offset = 0 } = req.query;
  const parsedLimit = parseInt(limit);
  const parsedOffset = parseInt(offset);
  
  // Build query based on filters to avoid dynamic SQL concatenation
  let sql, params;
  
  if (status && protocol) {
    sql = 'SELECT * FROM attacks WHERE user_id = ? AND status = ? AND protocol = ? ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params = [req.user.id, status, protocol, parsedLimit, parsedOffset];
  } else if (status) {
    sql = 'SELECT * FROM attacks WHERE user_id = ? AND status = ? ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params = [req.user.id, status, parsedLimit, parsedOffset];
  } else if (protocol) {
    sql = 'SELECT * FROM attacks WHERE user_id = ? AND protocol = ? ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params = [req.user.id, protocol, parsedLimit, parsedOffset];
  } else {
    sql = 'SELECT * FROM attacks WHERE user_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params = [req.user.id, parsedLimit, parsedOffset];
  }
  
  const attacks = await all(sql, params);
  logger.debug('Attacks fetched', { userId: req.user.id, count: attacks.length });
  res.json({ attacks });
}));

// Get attack by ID
router.get('/:id', authMiddleware, asyncHandler(async (req, res) => {
  const attack = await get(
    'SELECT * FROM attacks WHERE id = ? AND user_id = ?',
    [req.params.id, req.user.id]
  );
  
  if (!attack) {
    throw new AppError('Attack not found', 404);
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
}));

// Create new attack (with VPN check)
router.post('/', authMiddleware, vpnCheckMiddleware({ enforceVPN: true, trackRotation: true }), async (req, res) => {
  try {
    const { attack_type, target_host, target_port, protocol, config } = req.body;
    
    if (!attack_type || !target_host || !protocol) {
      return res.status(400).json({ 
        error: 'Missing required fields: attack_type, target_host, protocol' 
      });
    }
    
    // Create attack record with VPN and IP information
    const vpnInfo = {
      vpnDetected: req.vpnStatus?.isVPNDetected || false,
      clientIP: req.clientIP || 'unknown',
      vpnProvider: req.vpnStatus?.vpnProvider,
      detectedInterface: req.vpnStatus?.detectedInterface
    };
    
    const result = await run(
      `INSERT INTO attacks (attack_type, target_host, target_port, protocol, status, user_id, config, vpn_info, source_ip)
       VALUES (?, ?, ?, ?, 'queued', ?, ?, ?, ?)`,
      [attack_type, target_host, target_port, protocol, req.user.id, JSON.stringify(config || {}), JSON.stringify(vpnInfo), req.clientIP]
    );
    
    const attackId = result.id;
    
    // Log IP rotation stats
    if (req.ipRotation) {
      try {
        await run(
          `INSERT INTO ip_rotation_log (attack_id, user_id, ip_address, total_ips_tracked, unique_ips_last_hour)
           VALUES (?, ?, ?, ?, ?)`,
          [attackId, req.user.id, req.clientIP, req.ipRotation.totalIPsTracked, req.ipRotation.uniqueIPsLastHour]
        );
      } catch (err) {
        console.error(
          'Failed to log IP rotation for attack',
          attackId,
          'and user',
          req.user.id,
          err
        );
        if (typeof process !== 'undefined' && typeof process.emitWarning === 'function') {
          process.emitWarning(
            `Failed to log IP rotation for attack ${attackId} and user ${req.user.id}`,
            { cause: err }
          );
        }
      }
    }
    
    // Queue the attack
    attackService.queueAttack({
      id: attackId,
      attack_type,
      target_host,
      target_port,
      protocol,
      config,
      userId: req.user.id,
      vpnInfo
    });
    
    res.status(201).json({
      message: 'Attack queued successfully',
      attackId,
      status: 'queued',
      vpn: vpnInfo,
      ipRotation: req.ipRotation
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
