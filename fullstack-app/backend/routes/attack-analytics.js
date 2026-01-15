const express = require('express');
const { authMiddleware } = require('../middleware/auth');
const { run, get, all } = require('../database-pg');

const router = express.Router();

// Get attack analytics summary
router.get('/summary', authMiddleware, async (req, res) => {
  try {
    // Get all attack counts
    const emailIpCount = await get(
      'SELECT COUNT(*) as count FROM email_ip_attacks WHERE user_id = $1',
      [req.user.id]
    );
    
    const supremeComboCount = await get(
      'SELECT COUNT(*) as count FROM supreme_combo_attacks WHERE user_id = $1',
      [req.user.id]
    );
    
    const cloudAttackCount = await get(
      'SELECT COUNT(*) as count FROM cloud_service_attacks WHERE user_id = $1',
      [req.user.id]
    );
    
    const adAttackCount = await get(
      'SELECT COUNT(*) as count FROM active_directory_attacks WHERE user_id = $1',
      [req.user.id]
    );
    
    const webAppAttackCount = await get(
      'SELECT COUNT(*) as count FROM web_application_attacks WHERE user_id = $1',
      [req.user.id]
    );
    
    const credentialCount = await get(
      'SELECT COUNT(*) as count FROM credential_vault WHERE user_id = $1',
      [req.user.id]
    );
    
    // Get status breakdowns
    const emailIpStatus = await all(
      'SELECT status, COUNT(*) as count FROM email_ip_attacks WHERE user_id = $1 GROUP BY status',
      [req.user.id]
    );
    
    const supremeComboStatus = await all(
      'SELECT status, COUNT(*) as count FROM supreme_combo_attacks WHERE user_id = $1 GROUP BY status',
      [req.user.id]
    );
    
    // Get recent activity
    const recentActivity = await all(`
      SELECT 'email_ip' as type, id, name, status, created_at FROM email_ip_attacks WHERE user_id = $1
      UNION ALL
      SELECT 'supreme_combo' as type, id, name, status, created_at FROM supreme_combo_attacks WHERE user_id = $1
      ORDER BY created_at DESC LIMIT 10
    `, [req.user.id, req.user.id]);
    
    res.json({
      summary: {
        total_attacks: parseInt(emailIpCount.count) + parseInt(supremeComboCount.count) + 
                      parseInt(cloudAttackCount.count) + parseInt(adAttackCount.count) + 
                      parseInt(webAppAttackCount.count),
        email_ip_attacks: parseInt(emailIpCount.count),
        supreme_combo_attacks: parseInt(supremeComboCount.count),
        cloud_attacks: parseInt(cloudAttackCount.count),
        ad_attacks: parseInt(adAttackCount.count),
        web_app_attacks: parseInt(webAppAttackCount.count),
        credentials_found: parseInt(credentialCount.count)
      },
      status_breakdown: {
        email_ip: emailIpStatus,
        supreme_combo: supremeComboStatus
      },
      recent_activity: recentActivity
    });
  } catch (error) {
    console.error('Error fetching analytics summary:', error);
    res.status(500).json({ error: 'Failed to fetch analytics summary' });
  }
});

// Get time-series analytics
router.get('/timeseries', authMiddleware, async (req, res) => {
  try {
    const { days = 30 } = req.query;
    
    const analytics = await all(`
      SELECT 
        date,
        SUM(total_attacks) as total_attacks,
        SUM(successful_attacks) as successful_attacks,
        SUM(failed_attacks) as failed_attacks,
        SUM(email_ip_attacks) as email_ip_attacks,
        SUM(supreme_combo_attacks) as supreme_combo_attacks,
        SUM(cloud_attacks) as cloud_attacks,
        SUM(ad_attacks) as ad_attacks,
        SUM(web_app_attacks) as web_app_attacks,
        SUM(total_credentials_found) as total_credentials_found,
        AVG(avg_success_rate) as avg_success_rate
      FROM attack_analytics
      WHERE user_id = $1 AND date >= CURRENT_DATE - INTERVAL '$2 days'
      GROUP BY date
      ORDER BY date ASC
    `, [req.user.id, parseInt(days)]);
    
    res.json({ analytics, period_days: parseInt(days) });
  } catch (error) {
    console.error('Error fetching time-series analytics:', error);
    res.status(500).json({ error: 'Failed to fetch time-series analytics' });
  }
});

// Get performance metrics
router.get('/performance', authMiddleware, async (req, res) => {
  try {
    const emailIpPerf = await get(`
      SELECT 
        COUNT(*) as total_attacks,
        AVG(duration_seconds) as avg_duration,
        AVG(CASE WHEN total_attempts > 0 
          THEN (successful_attempts::DECIMAL / total_attempts * 100) 
          ELSE 0 END) as avg_success_rate,
        SUM(successful_attempts) as total_successful,
        SUM(total_attempts) as total_attempts
      FROM email_ip_attacks 
      WHERE user_id = $1 AND status = 'completed'
    `, [req.user.id]);
    
    const supremeComboPerf = await get(`
      SELECT 
        COUNT(*) as total_attacks,
        AVG(duration_seconds) as avg_duration,
        AVG(success_rate) as avg_success_rate,
        SUM(successful_logins) as total_successful,
        SUM(total_combos_tested) as total_attempts,
        AVG(combos_per_second) as avg_speed
      FROM supreme_combo_attacks 
      WHERE user_id = $1 AND status = 'completed'
    `, [req.user.id]);
    
    res.json({
      email_ip: {
        total_attacks: parseInt(emailIpPerf.total_attacks || 0),
        avg_duration_seconds: parseFloat(emailIpPerf.avg_duration || 0).toFixed(2),
        avg_success_rate: parseFloat(emailIpPerf.avg_success_rate || 0).toFixed(2),
        total_successful: parseInt(emailIpPerf.total_successful || 0),
        total_attempts: parseInt(emailIpPerf.total_attempts || 0)
      },
      supreme_combo: {
        total_attacks: parseInt(supremeComboPerf.total_attacks || 0),
        avg_duration_seconds: parseFloat(supremeComboPerf.avg_duration || 0).toFixed(2),
        avg_success_rate: parseFloat(supremeComboPerf.avg_success_rate || 0).toFixed(2),
        total_successful: parseInt(supremeComboPerf.total_successful || 0),
        total_attempts: parseInt(supremeComboPerf.total_attempts || 0),
        avg_speed: parseFloat(supremeComboPerf.avg_speed || 0).toFixed(2)
      }
    });
  } catch (error) {
    console.error('Error fetching performance metrics:', error);
    res.status(500).json({ error: 'Failed to fetch performance metrics' });
  }
});

// Get credential statistics
router.get('/credentials', authMiddleware, async (req, res) => {
  try {
    const byCategory = await all(`
      SELECT category, COUNT(*) as count
      FROM credential_vault
      WHERE user_id = $1
      GROUP BY category
      ORDER BY count DESC
    `, [req.user.id]);
    
    const byService = await all(`
      SELECT target_service, COUNT(*) as count
      FROM credential_vault
      WHERE user_id = $1
      GROUP BY target_service
      ORDER BY count DESC
      LIMIT 10
    `, [req.user.id]);
    
    const bySource = await all(`
      SELECT source_attack_type, COUNT(*) as count
      FROM credential_vault
      WHERE user_id = $1
      GROUP BY source_attack_type
      ORDER BY count DESC
    `, [req.user.id]);
    
    const recentCredentials = await all(`
      SELECT 
        username, target_service, category, 
        two_factor_enabled, discovered_at
      FROM credential_vault
      WHERE user_id = $1
      ORDER BY discovered_at DESC
      LIMIT 20
    `, [req.user.id]);
    
    res.json({
      by_category: byCategory,
      by_service: byService,
      by_source: bySource,
      recent_credentials: recentCredentials
    });
  } catch (error) {
    console.error('Error fetching credential statistics:', error);
    res.status(500).json({ error: 'Failed to fetch credential statistics' });
  }
});

// Get attack type breakdown
router.get('/attack-types', authMiddleware, async (req, res) => {
  try {
    const breakdown = await all(`
      SELECT 
        attack_type,
        COUNT(*) as count,
        AVG(success_rate) as avg_success_rate,
        SUM(successful_logins) as total_successful
      FROM supreme_combo_attacks
      WHERE user_id = $1
      GROUP BY attack_type
      ORDER BY count DESC
    `, [req.user.id]);
    
    res.json({ breakdown });
  } catch (error) {
    console.error('Error fetching attack type breakdown:', error);
    res.status(500).json({ error: 'Failed to fetch attack type breakdown' });
  }
});

// Get hourly analytics
router.get('/hourly', authMiddleware, async (req, res) => {
  try {
    const { date = new Date().toISOString().split('T')[0] } = req.query;
    
    const hourlyData = await all(`
      SELECT 
        hour,
        total_attacks,
        successful_attacks,
        failed_attacks,
        total_credentials_found,
        avg_success_rate
      FROM attack_analytics
      WHERE user_id = $1 AND date = $2 AND hour IS NOT NULL
      ORDER BY hour ASC
    `, [req.user.id, date]);
    
    res.json({ date, hourly_data: hourlyData });
  } catch (error) {
    console.error('Error fetching hourly analytics:', error);
    res.status(500).json({ error: 'Failed to fetch hourly analytics' });
  }
});

// Update analytics (internal endpoint, could be called by attack completion webhooks)
router.post('/update', authMiddleware, async (req, res) => {
  try {
    const now = new Date();
    const date = now.toISOString().split('T')[0];
    const hour = now.getHours();
    
    // Aggregate today's data
    const emailIpStats = await get(`
      SELECT 
        COUNT(*) as count,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as successful,
        COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed,
        SUM(successful_attempts) as creds_found
      FROM email_ip_attacks
      WHERE user_id = $1 AND DATE(created_at) = $2
    `, [req.user.id, date]);
    
    const supremeComboStats = await get(`
      SELECT 
        COUNT(*) as count,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as successful,
        COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed,
        SUM(successful_logins) as creds_found
      FROM supreme_combo_attacks
      WHERE user_id = $1 AND DATE(created_at) = $2
    `, [req.user.id, date]);
    
    // Insert or update analytics record
    await run(`
      INSERT INTO attack_analytics (
        user_id, date, hour, 
        total_attacks, successful_attacks, failed_attacks,
        email_ip_attacks, supreme_combo_attacks,
        total_credentials_found
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      ON CONFLICT (user_id, date, hour) 
      DO UPDATE SET
        total_attacks = EXCLUDED.total_attacks,
        successful_attacks = EXCLUDED.successful_attacks,
        failed_attacks = EXCLUDED.failed_attacks,
        email_ip_attacks = EXCLUDED.email_ip_attacks,
        supreme_combo_attacks = EXCLUDED.supreme_combo_attacks,
        total_credentials_found = EXCLUDED.total_credentials_found
    `, [
      req.user.id, date, hour,
      parseInt(emailIpStats.count || 0) + parseInt(supremeComboStats.count || 0),
      parseInt(emailIpStats.successful || 0) + parseInt(supremeComboStats.successful || 0),
      parseInt(emailIpStats.failed || 0) + parseInt(supremeComboStats.failed || 0),
      parseInt(emailIpStats.count || 0),
      parseInt(supremeComboStats.count || 0),
      parseInt(emailIpStats.creds_found || 0) + parseInt(supremeComboStats.creds_found || 0)
    ]);
    
    res.json({ message: 'Analytics updated successfully' });
  } catch (error) {
    console.error('Error updating analytics:', error);
    res.status(500).json({ error: 'Failed to update analytics' });
  }
});

// Export analytics data
router.get('/export', authMiddleware, async (req, res) => {
  try {
    const { format = 'json', days = 30 } = req.query;
    
    const data = await all(`
      SELECT * FROM attack_analytics
      WHERE user_id = $1 AND date >= CURRENT_DATE - INTERVAL '$2 days'
      ORDER BY date DESC, hour DESC
    `, [req.user.id, parseInt(days)]);
    
    if (format === 'csv') {
      // Convert to CSV
      const headers = Object.keys(data[0] || {}).join(',');
      const rows = data.map(row => Object.values(row).join(','));
      const csv = [headers, ...rows].join('\n');
      
      res.header('Content-Type', 'text/csv');
      res.header('Content-Disposition', `attachment; filename="analytics_${Date.now()}.csv"`);
      res.send(csv);
    } else {
      res.json({ data, period_days: parseInt(days) });
    }
  } catch (error) {
    console.error('Error exporting analytics:', error);
    res.status(500).json({ error: 'Failed to export analytics' });
  }
});

module.exports = router;
