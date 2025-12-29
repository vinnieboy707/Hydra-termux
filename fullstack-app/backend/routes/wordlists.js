const express = require('express');
const { authMiddleware } = require('../middleware/auth');
const { run, get, all } = require('../database');
const fs = require('fs').promises;
const path = require('path');

const router = express.Router();

// Get all wordlists
router.get('/', authMiddleware, async (req, res) => {
  try {
    const wordlists = await all('SELECT * FROM wordlists ORDER BY created_at DESC');
    res.json({ wordlists });
  } catch (error) {
    console.error('Error fetching wordlists:', error);
    res.status(500).json({ error: 'Failed to fetch wordlists' });
  }
});

// Scan wordlists directory
router.post('/scan', authMiddleware, async (req, res) => {
  try {
    const wordlistsPath = process.env.WORDLISTS_PATH || path.join(__dirname, '../../../wordlists');
    
    // Check if directory exists
    try {
      await fs.access(wordlistsPath);
    } catch {
      return res.json({ message: 'Wordlists directory not found', wordlists: [] });
    }
    
    const files = await fs.readdir(wordlistsPath);
    const wordlistFiles = files.filter(f => f.endsWith('.txt'));
    
    for (const file of wordlistFiles) {
      const filePath = path.join(wordlistsPath, file);
      const stats = await fs.stat(filePath);
      
      // Count lines
      const content = await fs.readFile(filePath, 'utf-8');
      const lineCount = content.split('\n').length;
      
      // Check if already in database
      const existing = await get('SELECT id FROM wordlists WHERE name = ?', [file]);
      
      if (!existing) {
        await run(
          `INSERT INTO wordlists (name, type, path, size, line_count)
           VALUES (?, ?, ?, ?, ?)`,
          [file, 'password', filePath, stats.size, lineCount]
        );
      }
    }
    
    const wordlists = await all('SELECT * FROM wordlists');
    res.json({ message: 'Wordlists scanned successfully', wordlists });
  } catch (error) {
    console.error('Error scanning wordlists:', error);
    res.status(500).json({ error: 'Failed to scan wordlists' });
  }
});

module.exports = router;
