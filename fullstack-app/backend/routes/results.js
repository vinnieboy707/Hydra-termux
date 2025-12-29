const express = require('express');
const { authMiddleware } = require('../middleware/auth');
const { run, get, all } = require('../database');

const router = express.Router();

// Get all results
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { protocol, success, limit = 100, offset = 0 } = req.query;
    
    let sql = `
      SELECT r.*, a.user_id 
      FROM results r
      JOIN attacks a ON r.attack_id = a.id
      WHERE a.user_id = ?
    `;
    const params = [req.user.id];
    
    if (protocol) {
      sql += ' AND r.protocol = ?';
      params.push(protocol);
    }
    
    if (success !== undefined) {
      sql += ' AND r.success = ?';
      params.push(success === 'true' ? 1 : 0);
    }
    
    sql += ' ORDER BY r.created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));
    
    const results = await all(sql, params);
    res.json({ results });
  } catch (error) {
    console.error('Error fetching results:', error);
    res.status(500).json({ error: 'Failed to fetch results' });
  }
});

// Get results by attack ID
router.get('/attack/:attackId', authMiddleware, async (req, res) => {
  try {
    // Verify attack belongs to user
    const attack = await get(
      'SELECT id FROM attacks WHERE id = ? AND user_id = ?',
      [req.params.attackId, req.user.id]
    );
    
    if (!attack) {
      return res.status(404).json({ error: 'Attack not found' });
    }
    
    const results = await all(
      'SELECT * FROM results WHERE attack_id = ? ORDER BY created_at DESC',
      [req.params.attackId]
    );
    
    res.json({ results });
  } catch (error) {
    console.error('Error fetching results:', error);
    res.status(500).json({ error: 'Failed to fetch results' });
  }
});

// Get result statistics
router.get('/stats', authMiddleware, async (req, res) => {
  try {
    const stats = await all(`
      SELECT 
        r.protocol,
        COUNT(*) as total,
        SUM(CASE WHEN r.success = 1 THEN 1 ELSE 0 END) as successful,
        SUM(CASE WHEN r.success = 0 THEN 1 ELSE 0 END) as failed
      FROM results r
      JOIN attacks a ON r.attack_id = a.id
      WHERE a.user_id = ?
      GROUP BY r.protocol
    `, [req.user.id]);
    
    res.json({ stats });
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});

// Export results
router.get('/export', authMiddleware, async (req, res) => {
  try {
    const { format = 'json' } = req.query;
    
    const results = await all(`
      SELECT r.*, a.attack_type, a.target_host as attack_target
      FROM results r
      JOIN attacks a ON r.attack_id = a.id
      WHERE a.user_id = ?
      ORDER BY r.created_at DESC
    `, [req.user.id]);
    
    if (format === 'csv') {
      const csv = this.convertToCSV(results);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=results.csv');
      res.send(csv);
    } else {
      res.json({ results });
    }
  } catch (error) {
    console.error('Error exporting results:', error);
    res.status(500).json({ error: 'Failed to export results' });
  }
});

// Helper function to convert to CSV
router.convertToCSV = (data) => {
  if (!data || data.length === 0) return '';
  
  const headers = Object.keys(data[0]);
  const rows = data.map(row => 
    headers.map(header => {
      const value = row[header];
      return typeof value === 'string' && value.includes(',') 
        ? `"${value}"` 
        : value;
    }).join(',')
  );
  
  return [headers.join(','), ...rows].join('\n');
};

module.exports = router;
