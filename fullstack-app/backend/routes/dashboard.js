const express = require('express');
const { authMiddleware } = require('../middleware/auth');
const { all } = require('../database');

const router = express.Router();

// Get dashboard statistics
router.get('/stats', authMiddleware, async (req, res) => {
  try {
    // Get attack statistics
    const attackStats = await all(`
      SELECT 
        status,
        COUNT(*) as count
      FROM attacks
      WHERE user_id = ?
      GROUP BY status
    `, [req.user.id]);
    
    // Get protocol statistics
    const protocolStats = await all(`
      SELECT 
        protocol,
        COUNT(*) as count,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed
      FROM attacks
      WHERE user_id = ?
      GROUP BY protocol
    `, [req.user.id]);
    
    // Get recent successful credentials
    const recentCredentials = await all(`
      SELECT r.*, a.attack_type, a.created_at as attack_date
      FROM results r
      JOIN attacks a ON r.attack_id = a.id
      WHERE a.user_id = ? AND r.success = 1
      ORDER BY r.created_at DESC
      LIMIT 10
    `, [req.user.id]);
    
    // Get total counts
    const totals = await all(`
      SELECT 
        (SELECT COUNT(*) FROM attacks WHERE user_id = ?) as total_attacks,
        (SELECT COUNT(*) FROM results r JOIN attacks a ON r.attack_id = a.id WHERE a.user_id = ? AND r.success = 1) as total_credentials,
        (SELECT COUNT(*) FROM targets WHERE user_id = ?) as total_targets
    `, [req.user.id, req.user.id, req.user.id]);
    
    // Get recent activity
    const recentActivity = await all(`
      SELECT 
        id,
        attack_type,
        target_host,
        protocol,
        status,
        created_at,
        completed_at
      FROM attacks
      WHERE user_id = ?
      ORDER BY created_at DESC
      LIMIT 10
    `, [req.user.id]);
    
    res.json({
      attackStats,
      protocolStats,
      recentCredentials,
      totals: totals[0] || { total_attacks: 0, total_credentials: 0, total_targets: 0 },
      recentActivity
    });
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard statistics' });
  }
});

module.exports = router;
