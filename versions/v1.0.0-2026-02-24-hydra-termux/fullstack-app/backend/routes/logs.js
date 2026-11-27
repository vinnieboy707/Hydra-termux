const express = require('express');
const { authMiddleware } = require('../middleware/auth');
const { all } = require('../database');
const fs = require('fs').promises;
const path = require('path');

const router = express.Router();

// Get logs from database
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { level, limit = 100, offset = 0, attackId } = req.query;
    const parsedLimit = parseInt(limit);
    const parsedOffset = parseInt(offset);
    
    // Build query based on filters to avoid dynamic SQL concatenation
    let sql, params;
    
    if (level && attackId) {
      sql = `SELECT l.*, a.attack_type, a.target_host 
             FROM attack_logs l
             JOIN attacks a ON l.attack_id = a.id
             WHERE a.user_id = ? AND l.level = ? AND l.attack_id = ?
             ORDER BY l.timestamp DESC LIMIT ? OFFSET ?`;
      params = [req.user.id, level, attackId, parsedLimit, parsedOffset];
    } else if (level) {
      sql = `SELECT l.*, a.attack_type, a.target_host 
             FROM attack_logs l
             JOIN attacks a ON l.attack_id = a.id
             WHERE a.user_id = ? AND l.level = ?
             ORDER BY l.timestamp DESC LIMIT ? OFFSET ?`;
      params = [req.user.id, level, parsedLimit, parsedOffset];
    } else if (attackId) {
      sql = `SELECT l.*, a.attack_type, a.target_host 
             FROM attack_logs l
             JOIN attacks a ON l.attack_id = a.id
             WHERE a.user_id = ? AND l.attack_id = ?
             ORDER BY l.timestamp DESC LIMIT ? OFFSET ?`;
      params = [req.user.id, attackId, parsedLimit, parsedOffset];
    } else {
      sql = `SELECT l.*, a.attack_type, a.target_host 
             FROM attack_logs l
             JOIN attacks a ON l.attack_id = a.id
             WHERE a.user_id = ?
             ORDER BY l.timestamp DESC LIMIT ? OFFSET ?`;
      params = [req.user.id, parsedLimit, parsedOffset];
    }
    
    const logs = await all(sql, params);
    res.json({ logs });
  } catch (error) {
    console.error('Error fetching logs:', error);
    res.status(500).json({ error: 'Failed to fetch logs' });
  }
});

// Get file-based logs
router.get('/files', authMiddleware, async (req, res) => {
  try {
    const logsPath = process.env.LOGS_PATH || path.join(__dirname, '../../../logs');
    
    try {
      const files = await fs.readdir(logsPath);
      const logFiles = files.filter(f => f.endsWith('.log'));
      
      const fileDetails = await Promise.all(
        logFiles.map(async (file) => {
          const filePath = path.join(logsPath, file);
          const stats = await fs.stat(filePath);
          return {
            name: file,
            path: filePath,
            size: stats.size,
            modified: stats.mtime,
            created: stats.birthtime
          };
        })
      );
      
      res.json({ files: fileDetails.sort((a, b) => b.modified - a.modified) });
    } catch (error) {
      if (error.code === 'ENOENT') {
        return res.json({ files: [], message: 'Logs directory not found' });
      }
      throw error;
    }
  } catch (error) {
    console.error('Error fetching log files:', error);
    res.status(500).json({ error: 'Failed to fetch log files' });
  }
});

// Get specific log file content
router.get('/files/:filename', authMiddleware, async (req, res) => {
  try {
    const { filename } = req.params;
    const { tail = 1000 } = req.query;
    
    // Validate filename to prevent path traversal
    if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      return res.status(400).json({ error: 'Invalid filename' });
    }
    
    const logsPath = process.env.LOGS_PATH || path.join(__dirname, '../../../logs');
    const filePath = path.join(logsPath, filename);
    
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const lines = content.split('\n');
      const tailedLines = tail ? lines.slice(-parseInt(tail)) : lines;
      
      res.json({ 
        content: tailedLines.join('\n'),
        totalLines: lines.length,
        displayedLines: tailedLines.length
      });
    } catch (error) {
      if (error.code === 'ENOENT') {
        return res.status(404).json({ error: 'Log file not found' });
      }
      throw error;
    }
  } catch (error) {
    console.error('Error fetching log file:', error);
    res.status(500).json({ error: 'Failed to fetch log file' });
  }
});

// Clear old logs
router.delete('/cleanup', authMiddleware, async (req, res) => {
  try {
    const { daysOld = 30 } = req.body;
    
    // Clear database logs
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);
    
    const result = await run(
      `DELETE FROM attack_logs 
       WHERE timestamp < ? 
       AND attack_id IN (SELECT id FROM attacks WHERE user_id = ?)`,
      [cutoffDate.toISOString(), req.user.id]
    );
    
    res.json({ 
      message: `Logs older than ${daysOld} days deleted successfully`,
      deletedCount: result.changes || 0
    });
  } catch (error) {
    console.error('Error cleaning up logs:', error);
    res.status(500).json({ error: 'Failed to cleanup logs' });
  }
});

module.exports = router;
