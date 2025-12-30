const express = require('express');
const { authMiddleware } = require('../middleware/auth');
const { run, get, all } = require('../database');
const crypto = require('crypto');
const axios = require('axios');

const router = express.Router();

// Get all webhooks for user
router.get('/', authMiddleware, async (req, res) => {
  try {
    const webhooks = await all(
      'SELECT * FROM webhooks WHERE user_id = ? ORDER BY created_at DESC',
      [req.user.id]
    );
    res.json({ webhooks });
  } catch (error) {
    console.error('Error fetching webhooks:', error);
    res.status(500).json({ error: 'Failed to fetch webhooks' });
  }
});

// Get webhook by ID
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const webhook = await get(
      'SELECT * FROM webhooks WHERE id = ? AND user_id = ?',
      [req.params.id, req.user.id]
    );
    
    if (!webhook) {
      return res.status(404).json({ error: 'Webhook not found' });
    }
    
    res.json({ webhook });
  } catch (error) {
    console.error('Error fetching webhook:', error);
    res.status(500).json({ error: 'Failed to fetch webhook' });
  }
});

// Create new webhook
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { name, url, events, description } = req.body;
    
    if (!name || !url || !events) {
      return res.status(400).json({ 
        error: 'Missing required fields: name, url, events' 
      });
    }
    
    // Validate URL
    try {
      new URL(url);
    } catch {
      return res.status(400).json({ error: 'Invalid URL format' });
    }
    
    // Generate secret for webhook verification
    const secret = crypto.randomBytes(32).toString('hex');
    
    const result = await run(
      `INSERT INTO webhooks (name, url, events, description, secret, user_id, enabled)
       VALUES (?, ?, ?, ?, ?, ?, 1)`,
      [name, url, JSON.stringify(events), description, secret, req.user.id]
    );
    
    res.status(201).json({
      message: 'Webhook created successfully',
      webhookId: result.id,
      secret
    });
  } catch (error) {
    console.error('Error creating webhook:', error);
    res.status(500).json({ error: 'Failed to create webhook' });
  }
});

// Update webhook
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const { name, url, events, description, enabled } = req.body;
    
    const webhook = await get(
      'SELECT * FROM webhooks WHERE id = ? AND user_id = ?',
      [req.params.id, req.user.id]
    );
    
    if (!webhook) {
      return res.status(404).json({ error: 'Webhook not found' });
    }
    
    await run(
      `UPDATE webhooks SET name = ?, url = ?, events = ?, description = ?, enabled = ?, updated_at = CURRENT_TIMESTAMP 
       WHERE id = ?`,
      [name, url, JSON.stringify(events), description, enabled ? 1 : 0, req.params.id]
    );
    
    res.json({ message: 'Webhook updated successfully' });
  } catch (error) {
    console.error('Error updating webhook:', error);
    res.status(500).json({ error: 'Failed to update webhook' });
  }
});

// Delete webhook
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const webhook = await get(
      'SELECT * FROM webhooks WHERE id = ? AND user_id = ?',
      [req.params.id, req.user.id]
    );
    
    if (!webhook) {
      return res.status(404).json({ error: 'Webhook not found' });
    }
    
    await run('DELETE FROM webhooks WHERE id = ?', [req.params.id]);
    
    res.json({ message: 'Webhook deleted successfully' });
  } catch (error) {
    console.error('Error deleting webhook:', error);
    res.status(500).json({ error: 'Failed to delete webhook' });
  }
});

// Test webhook
router.post('/:id/test', authMiddleware, async (req, res) => {
  try {
    const webhook = await get(
      'SELECT * FROM webhooks WHERE id = ? AND user_id = ?',
      [req.params.id, req.user.id]
    );
    
    if (!webhook) {
      return res.status(404).json({ error: 'Webhook not found' });
    }
    
    const testPayload = {
      event: 'webhook.test',
      timestamp: new Date().toISOString(),
      data: {
        message: 'This is a test webhook notification'
      }
    };
    
    const signature = crypto
      .createHmac('sha256', webhook.secret)
      .update(JSON.stringify(testPayload))
      .digest('hex');
    
    try {
      const response = await axios.post(webhook.url, testPayload, {
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Signature': signature
        },
        timeout: 10000
      });
      
      res.json({
        message: 'Webhook test successful',
        statusCode: response.status,
        response: response.data
      });
    } catch (error) {
      res.status(400).json({
        error: 'Webhook test failed',
        message: error.message,
        statusCode: error.response?.status
      });
    }
  } catch (error) {
    console.error('Error testing webhook:', error);
    res.status(500).json({ error: 'Failed to test webhook' });
  }
});

// Get webhook delivery logs
router.get('/:id/deliveries', authMiddleware, async (req, res) => {
  try {
    const { limit = 50, offset = 0 } = req.query;
    
    const webhook = await get(
      'SELECT id FROM webhooks WHERE id = ? AND user_id = ?',
      [req.params.id, req.user.id]
    );
    
    if (!webhook) {
      return res.status(404).json({ error: 'Webhook not found' });
    }
    
    const deliveries = await all(
      `SELECT * FROM webhook_deliveries 
       WHERE webhook_id = ? 
       ORDER BY created_at DESC 
       LIMIT ? OFFSET ?`,
      [req.params.id, parseInt(limit), parseInt(offset)]
    );
    
    res.json({ deliveries });
  } catch (error) {
    console.error('Error fetching webhook deliveries:', error);
    res.status(500).json({ error: 'Failed to fetch webhook deliveries' });
  }
});

// Helper function to trigger webhooks (can be called from other routes)
async function triggerWebhooks(userId, event, data) {
  try {
    const webhooks = await all(
      `SELECT * FROM webhooks WHERE user_id = ? AND enabled = 1`,
      [userId]
    );
    
    for (const webhook of webhooks) {
      const events = JSON.parse(webhook.events || '[]');
      
      // Check if this webhook is subscribed to this event
      if (!events.includes(event)) {
        continue;
      }
      
      const payload = {
        event,
        timestamp: new Date().toISOString(),
        data
      };
      
      const signature = crypto
        .createHmac('sha256', webhook.secret)
        .update(JSON.stringify(payload))
        .digest('hex');
      
      // Send webhook in background (don't await)
      axios.post(webhook.url, payload, {
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Signature': signature,
          'X-Webhook-Event': event
        },
        timeout: 10000
      })
        .then(response => {
          // Log successful delivery
          run(
            `INSERT INTO webhook_deliveries (webhook_id, event, payload, status_code, response, success)
             VALUES (?, ?, ?, ?, ?, 1)`,
            [webhook.id, event, JSON.stringify(payload), response.status, JSON.stringify(response.data)]
          ).catch(console.error);
        })
        .catch(error => {
          // Log failed delivery
          run(
            `INSERT INTO webhook_deliveries (webhook_id, event, payload, status_code, response, success, error)
             VALUES (?, ?, ?, ?, ?, 0, ?)`,
            [
              webhook.id, 
              event, 
              JSON.stringify(payload), 
              error.response?.status || 0,
              JSON.stringify(error.response?.data || {}),
              error.message
            ]
          ).catch(console.error);
        });
    }
  } catch (error) {
    console.error('Error triggering webhooks:', error);
  }
}

module.exports = router;
module.exports.triggerWebhooks = triggerWebhooks;
