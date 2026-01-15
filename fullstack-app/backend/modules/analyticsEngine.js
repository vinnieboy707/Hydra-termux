/**
 * Analytics Engine Module
 * Provides attack analytics, statistics, and reporting
 * @module analyticsEngine
 */

const { createClient } = require('@supabase/supabase-js');
const { logger } = require('./logManager');
const moment = require('moment');

/**
 * Analytics Engine Service
 * Handles data analytics and statistical reporting
 */
class AnalyticsEngine {
  constructor() {
    this.supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY
    );

    logger.info('Analytics Engine initialized');
  }

  /**
   * Get attack statistics for user
   * @param {string} userId - User identifier
   * @param {Object} options - Query options
   * @returns {Promise<Object>} Attack statistics
   */
  async getAttackStatistics(userId, options = {}) {
    try {
      const {
        startDate = moment().subtract(30, 'days').toISOString(),
        endDate = moment().toISOString(),
        groupBy = 'day'
      } = options;

      // Get attack counts by status
      const { data: attacks, error } = await this.supabase
        .from('attacks')
        .select('status, created_at, attack_type')
        .eq('user_id', userId)
        .gte('created_at', startDate)
        .lte('created_at', endDate);

      if (error) throw error;

      const stats = {
        total: attacks.length,
        byStatus: this._groupBy(attacks, 'status'),
        byType: this._groupBy(attacks, 'attack_type'),
        timeline: this._generateTimeline(attacks, groupBy),
        successRate: this._calculateSuccessRate(attacks)
      };

      return stats;
    } catch (error) {
      logger.error(`Failed to get attack statistics: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get credential discovery statistics
   * @param {string} userId - User identifier
   * @param {Object} options - Query options
   * @returns {Promise<Object>} Credential statistics
   */
  async getCredentialStatistics(userId, options = {}) {
    try {
      const {
        startDate = moment().subtract(30, 'days').toISOString(),
        endDate = moment().toISOString()
      } = options;

      const { data: credentials, error } = await this.supabase
        .from('credentials')
        .select('service, discovered_at, verified, target')
        .eq('user_id', userId)
        .eq('active', true)
        .gte('discovered_at', startDate)
        .lte('discovered_at', endDate);

      if (error) throw error;

      const stats = {
        total: credentials.length,
        verified: credentials.filter(c => c.verified).length,
        byService: this._groupBy(credentials, 'service'),
        uniqueTargets: [...new Set(credentials.map(c => c.target))].length,
        timeline: this._generateTimeline(credentials, 'day', 'discovered_at')
      };

      return stats;
    } catch (error) {
      logger.error(`Failed to get credential statistics: ${error.message}`);
      throw error;
    }
  }

  /**
   * Generate comprehensive analytics report
   * @param {string} userId - User identifier
   * @param {Object} options - Report options
   * @returns {Promise<Object>} Analytics report
   */
  async generateReport(userId, options = {}) {
    try {
      const {
        startDate = moment().subtract(30, 'days').toISOString(),
        endDate = moment().toISOString(),
        includeCharts = true
      } = options;

      logger.info(`Generating analytics report for user ${userId}`);

      const [
        attackStats,
        credentialStats,
        performanceMetrics,
        topTargets,
        recentActivity
      ] = await Promise.all([
        this.getAttackStatistics(userId, { startDate, endDate }),
        this.getCredentialStatistics(userId, { startDate, endDate }),
        this.getPerformanceMetrics(userId, { startDate, endDate }),
        this.getTopTargets(userId, { startDate, endDate, limit: 10 }),
        this.getRecentActivity(userId, { limit: 20 })
      ]);

      const report = {
        userId,
        period: {
          start: startDate,
          end: endDate
        },
        generatedAt: new Date().toISOString(),
        summary: {
          totalAttacks: attackStats.total,
          successfulAttacks: attackStats.byStatus?.completed || 0,
          failedAttacks: attackStats.byStatus?.failed || 0,
          credentialsDiscovered: credentialStats.total,
          verifiedCredentials: credentialStats.verified,
          successRate: attackStats.successRate,
          averageDuration: performanceMetrics.averageDuration
        },
        attacks: attackStats,
        credentials: credentialStats,
        performance: performanceMetrics,
        topTargets,
        recentActivity
      };

      if (includeCharts) {
        report.charts = this._generateChartData(report);
      }

      logger.info(`Analytics report generated for user ${userId}`);
      return report;
    } catch (error) {
      logger.error(`Failed to generate report: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get performance metrics
   * @param {string} userId - User identifier
   * @param {Object} options - Query options
   * @returns {Promise<Object>} Performance metrics
   */
  async getPerformanceMetrics(userId, options = {}) {
    try {
      const {
        startDate = moment().subtract(30, 'days').toISOString(),
        endDate = moment().toISOString()
      } = options;

      const { data: attacks, error } = await this.supabase
        .from('attacks')
        .select('created_at, started_at, completed_at, status')
        .eq('user_id', userId)
        .gte('created_at', startDate)
        .lte('created_at', endDate)
        .not('started_at', 'is', null);

      if (error) throw error;

      const durations = attacks
        .filter(a => a.started_at && a.completed_at)
        .map(a => moment(a.completed_at).diff(moment(a.started_at)));

      const metrics = {
        totalAttacks: attacks.length,
        averageDuration: durations.length > 0 
          ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
          : 0,
        minDuration: durations.length > 0 ? Math.min(...durations) : 0,
        maxDuration: durations.length > 0 ? Math.max(...durations) : 0,
        completionRate: attacks.length > 0 
          ? (attacks.filter(a => a.status === 'completed').length / attacks.length * 100).toFixed(2)
          : 0
      };

      return metrics;
    } catch (error) {
      logger.error(`Failed to get performance metrics: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get top targets by attack count
   * @param {string} userId - User identifier
   * @param {Object} options - Query options
   * @returns {Promise<Array>} Top targets
   */
  async getTopTargets(userId, options = {}) {
    try {
      const {
        startDate = moment().subtract(30, 'days').toISOString(),
        endDate = moment().toISOString(),
        limit = 10
      } = options;

      const { data: attacks, error } = await this.supabase
        .from('attacks')
        .select('target, status, created_at')
        .eq('user_id', userId)
        .gte('created_at', startDate)
        .lte('created_at', endDate);

      if (error) throw error;

      const targetCounts = {};
      attacks.forEach(attack => {
        if (!targetCounts[attack.target]) {
          targetCounts[attack.target] = {
            target: attack.target,
            count: 0,
            successful: 0,
            failed: 0
          };
        }
        targetCounts[attack.target].count++;
        if (attack.status === 'completed') {
          targetCounts[attack.target].successful++;
        } else if (attack.status === 'failed') {
          targetCounts[attack.target].failed++;
        }
      });

      return Object.values(targetCounts)
        .sort((a, b) => b.count - a.count)
        .slice(0, limit);
    } catch (error) {
      logger.error(`Failed to get top targets: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get recent activity
   * @param {string} userId - User identifier
   * @param {Object} options - Query options
   * @returns {Promise<Array>} Recent activities
   */
  async getRecentActivity(userId, options = {}) {
    try {
      const { limit = 20 } = options;

      const { data: attacks, error } = await this.supabase
        .from('attacks')
        .select('id, target, attack_type, status, created_at, completed_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;

      return attacks.map(attack => ({
        id: attack.id,
        type: 'attack',
        target: attack.target,
        attackType: attack.attack_type,
        status: attack.status,
        timestamp: attack.created_at,
        completedAt: attack.completed_at
      }));
    } catch (error) {
      logger.error(`Failed to get recent activity: ${error.message}`);
      throw error;
    }
  }

  /**
   * Compare time periods
   * @param {string} userId - User identifier
   * @param {Object} options - Comparison options
   * @returns {Promise<Object>} Comparison results
   */
  async compareTimePeriods(userId, options = {}) {
    try {
      const {
        currentStart = moment().subtract(7, 'days').toISOString(),
        currentEnd = moment().toISOString(),
        previousStart = moment().subtract(14, 'days').toISOString(),
        previousEnd = moment().subtract(7, 'days').toISOString()
      } = options;

      const [currentStats, previousStats] = await Promise.all([
        this.getAttackStatistics(userId, { 
          startDate: currentStart, 
          endDate: currentEnd 
        }),
        this.getAttackStatistics(userId, { 
          startDate: previousStart, 
          endDate: previousEnd 
        })
      ]);

      const comparison = {
        current: currentStats,
        previous: previousStats,
        changes: {
          totalAttacks: this._calculateChange(
            currentStats.total, 
            previousStats.total
          ),
          successRate: this._calculateChange(
            currentStats.successRate,
            previousStats.successRate
          )
        }
      };

      return comparison;
    } catch (error) {
      logger.error(`Failed to compare time periods: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get attack trends
   * @param {string} userId - User identifier
   * @param {Object} options - Options
   * @returns {Promise<Object>} Trend analysis
   */
  async getAttackTrends(userId, options = {}) {
    try {
      const {
        days = 30
      } = options;

      const startDate = moment().subtract(days, 'days').toISOString();
      const endDate = moment().toISOString();

      const { data: attacks, error } = await this.supabase
        .from('attacks')
        .select('created_at, status, attack_type')
        .eq('user_id', userId)
        .gte('created_at', startDate)
        .lte('created_at', endDate)
        .order('created_at', { ascending: true });

      if (error) throw error;

      // Group by day
      const dailyCounts = {};
      attacks.forEach(attack => {
        const day = moment(attack.created_at).format('YYYY-MM-DD');
        if (!dailyCounts[day]) {
          dailyCounts[day] = { date: day, count: 0, successful: 0 };
        }
        dailyCounts[day].count++;
        if (attack.status === 'completed') {
          dailyCounts[day].successful++;
        }
      });

      const trend = Object.values(dailyCounts);

      // Calculate trend direction
      const firstHalf = trend.slice(0, Math.floor(trend.length / 2));
      const secondHalf = trend.slice(Math.floor(trend.length / 2));

      const firstHalfAvg = firstHalf.reduce((sum, d) => sum + d.count, 0) / firstHalf.length || 0;
      const secondHalfAvg = secondHalf.reduce((sum, d) => sum + d.count, 0) / secondHalf.length || 0;

      return {
        data: trend,
        direction: secondHalfAvg > firstHalfAvg ? 'up' : 
                  secondHalfAvg < firstHalfAvg ? 'down' : 'stable',
        changePercent: firstHalfAvg > 0 
          ? ((secondHalfAvg - firstHalfAvg) / firstHalfAvg * 100).toFixed(2)
          : 0
      };
    } catch (error) {
      logger.error(`Failed to get attack trends: ${error.message}`);
      throw error;
    }
  }

  /**
   * Group array of objects by key
   * @param {Array} array - Array to group
   * @param {string} key - Key to group by
   * @returns {Object} Grouped object
   * @private
   */
  _groupBy(array, key) {
    return array.reduce((result, item) => {
      const group = item[key] || 'unknown';
      result[group] = (result[group] || 0) + 1;
      return result;
    }, {});
  }

  /**
   * Generate timeline data
   * @param {Array} data - Data array
   * @param {string} interval - Time interval (day, week, month)
   * @param {string} dateField - Date field name
   * @returns {Array} Timeline data
   * @private
   */
  _generateTimeline(data, interval = 'day', dateField = 'created_at') {
    const timeline = {};
    const format = interval === 'day' ? 'YYYY-MM-DD' :
                  interval === 'week' ? 'YYYY-[W]WW' :
                  'YYYY-MM';

    data.forEach(item => {
      const period = moment(item[dateField]).format(format);
      timeline[period] = (timeline[period] || 0) + 1;
    });

    return Object.entries(timeline)
      .map(([period, count]) => ({ period, count }))
      .sort((a, b) => a.period.localeCompare(b.period));
  }

  /**
   * Calculate success rate
   * @param {Array} attacks - Attack array
   * @returns {number} Success rate percentage
   * @private
   */
  _calculateSuccessRate(attacks) {
    if (attacks.length === 0) return 0;
    const successful = attacks.filter(a => a.status === 'completed').length;
    return ((successful / attacks.length) * 100).toFixed(2);
  }

  /**
   * Calculate percentage change
   * @param {number} current - Current value
   * @param {number} previous - Previous value
   * @returns {Object} Change information
   * @private
   */
  _calculateChange(current, previous) {
    if (previous === 0) {
      return {
        absolute: current,
        percentage: current > 0 ? 100 : 0,
        direction: current > 0 ? 'up' : 'stable'
      };
    }

    const absolute = current - previous;
    const percentage = ((absolute / previous) * 100).toFixed(2);

    return {
      absolute,
      percentage,
      direction: absolute > 0 ? 'up' : absolute < 0 ? 'down' : 'stable'
    };
  }

  /**
   * Generate chart data from report
   * @param {Object} report - Analytics report
   * @returns {Object} Chart data
   * @private
   */
  _generateChartData(report) {
    return {
      attacksByStatus: {
        type: 'pie',
        labels: Object.keys(report.attacks.byStatus || {}),
        data: Object.values(report.attacks.byStatus || {})
      },
      attacksByType: {
        type: 'bar',
        labels: Object.keys(report.attacks.byType || {}),
        data: Object.values(report.attacks.byType || {})
      },
      attacksTimeline: {
        type: 'line',
        labels: report.attacks.timeline.map(t => t.period),
        data: report.attacks.timeline.map(t => t.count)
      },
      credentialsByService: {
        type: 'doughnut',
        labels: Object.keys(report.credentials.byService || {}),
        data: Object.values(report.credentials.byService || {})
      }
    };
  }

  /**
   * Export analytics data
   * @param {string} userId - User identifier
   * @param {string} format - Export format (json, csv)
   * @returns {Promise<any>} Exported data
   */
  async exportAnalytics(userId, format = 'json') {
    try {
      const report = await this.generateReport(userId);

      if (format === 'csv') {
        return this._convertToCSV(report);
      }

      return report;
    } catch (error) {
      logger.error(`Failed to export analytics: ${error.message}`);
      throw error;
    }
  }

  /**
   * Convert report to CSV format
   * @param {Object} report - Analytics report
   * @returns {string} CSV data
   * @private
   */
  _convertToCSV(report) {
    const rows = [];
    
    // Header
    rows.push(['Metric', 'Value']);
    
    // Summary
    rows.push(['Total Attacks', report.summary.totalAttacks]);
    rows.push(['Successful Attacks', report.summary.successfulAttacks]);
    rows.push(['Failed Attacks', report.summary.failedAttacks]);
    rows.push(['Credentials Discovered', report.summary.credentialsDiscovered]);
    rows.push(['Success Rate', `${report.summary.successRate}%`]);

    return rows.map(row => row.join(',')).join('\n');
  }
}

// Export singleton instance
module.exports = new AnalyticsEngine();
