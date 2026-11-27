const express = require('express');
const { authMiddleware } = require('../middleware/auth');
const { run, get, all } = require('../database');

const router = express.Router();

// Get all targets
router.get('/', authMiddleware, async (req, res) => {
  try {
    const targets = await all(
      'SELECT * FROM targets WHERE user_id = ? ORDER BY created_at DESC',
      [req.user.id]
    );
    res.json({ targets });
  } catch (error) {
    console.error('Error fetching targets:', error);
    res.status(500).json({ error: 'Failed to fetch targets' });
  }
});

// Get target by ID
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const target = await get(
      'SELECT * FROM targets WHERE id = ? AND user_id = ?',
      [req.params.id, req.user.id]
    );
    
    if (!target) {
      return res.status(404).json({ error: 'Target not found' });
    }
    
    res.json({ target });
  } catch (error) {
    console.error('Error fetching target:', error);
    res.status(500).json({ error: 'Failed to fetch target' });
  }
});

// Create new target
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { name, host, port, protocol, description, tags } = req.body;
    
    if (!name || !host) {
      return res.status(400).json({ error: 'Name and host are required' });
    }
    
    const result = await run(
      `INSERT INTO targets (name, host, port, protocol, description, tags, user_id)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [name, host, port, protocol, description, tags, req.user.id]
    );
    
    res.status(201).json({
      message: 'Target created successfully',
      targetId: result.id
    });
  } catch (error) {
    console.error('Error creating target:', error);
    res.status(500).json({ error: 'Failed to create target' });
  }
});

// Update target
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const { name, host, port, protocol, description, tags, status } = req.body;
    
    const target = await get(
      'SELECT * FROM targets WHERE id = ? AND user_id = ?',
      [req.params.id, req.user.id]
    );
    
    if (!target) {
      return res.status(404).json({ error: 'Target not found' });
    }
    
    await run(
      `UPDATE targets SET name = ?, host = ?, port = ?, protocol = ?, 
       description = ?, tags = ?, status = ?, updated_at = CURRENT_TIMESTAMP 
       WHERE id = ?`,
      [name, host, port, protocol, description, tags, status, req.params.id]
    );
    
    res.json({ message: 'Target updated successfully' });
  } catch (error) {
    console.error('Error updating target:', error);
    res.status(500).json({ error: 'Failed to update target' });
  }
});

// Delete target
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const target = await get(
      'SELECT * FROM targets WHERE id = ? AND user_id = ?',
      [req.params.id, req.user.id]
    );
    
    if (!target) {
      return res.status(404).json({ error: 'Target not found' });
    }
    
    await run('DELETE FROM targets WHERE id = ?', [req.params.id]);
    
    res.json({ message: 'Target deleted successfully' });
  } catch (error) {
    console.error('Error deleting target:', error);
    res.status(500).json({ error: 'Failed to delete target' });
  }
});

module.exports = router;
