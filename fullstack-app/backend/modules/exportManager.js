/**
 * Export Manager Module
 * Exports data to CSV, JSON, PDF, and Excel formats
 * @module exportManager
 */

const fs = require('fs').promises;
const path = require('path');
const PDFDocument = require('pdfkit');
const { parse } = require('json2csv');
const ExcelJS = require('exceljs');
const { logger } = require('./logManager');

/**
 * Export Manager Service
 * Handles data export to various formats
 */
class ExportManager {
  constructor() {
    this.exportDir = process.env.EXPORT_DIR || path.join(__dirname, '../exports');
    this.ensureExportDirectory();
    
    logger.info('Export Manager initialized');
  }

  /**
   * Ensure export directory exists
   * @private
   */
  async ensureExportDirectory() {
    try {
      await fs.mkdir(this.exportDir, { recursive: true });
    } catch (error) {
      logger.error(`Failed to create export directory: ${error.message}`);
    }
  }

  /**
   * Export data to specified format
   * @param {Object} data - Data to export
   * @param {string} format - Export format (json, csv, pdf, excel)
   * @param {Object} options - Export options
   * @returns {Promise<Object>} Export result with file path
   */
  async export(data, format, options = {}) {
    try {
      logger.info(`Exporting data to ${format} format`);

      const {
        filename = `export_${Date.now()}`
      } = options;

      let result;

      switch (format.toLowerCase()) {
        case 'json':
          result = await this.exportToJSON(data, filename, options);
          break;
        case 'csv':
          result = await this.exportToCSV(data, filename, options);
          break;
        case 'pdf':
          result = await this.exportToPDF(data, filename, options);
          break;
        case 'excel':
        case 'xlsx':
          result = await this.exportToExcel(data, filename, options);
          break;
        default:
          throw new Error(`Unsupported export format: ${format}`);
      }

      logger.info(`Export completed: ${result.filePath}`);
      return result;
    } catch (error) {
      logger.error(`Export failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Export to JSON format
   * @param {Object} data - Data to export
   * @param {string} filename - File name
   * @param {Object} options - Export options
   * @returns {Promise<Object>} Export result
   */
  async exportToJSON(data, filename, options = {}) {
    try {
      const { pretty = true } = options;
      const filePath = path.join(this.exportDir, `${filename}.json`);
      
      const jsonData = pretty 
        ? JSON.stringify(data, null, 2)
        : JSON.stringify(data);

      await fs.writeFile(filePath, jsonData, 'utf8');

      return {
        format: 'json',
        filePath,
        filename: `${filename}.json`,
        size: Buffer.byteLength(jsonData)
      };
    } catch (error) {
      logger.error(`JSON export failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Export to CSV format
   * @param {Array|Object} data - Data to export
   * @param {string} filename - File name
   * @param {Object} options - Export options
   * @returns {Promise<Object>} Export result
   */
  async exportToCSV(data, filename, options = {}) {
    try {
      const { fields = null, delimiter = ',' } = options;
      const filePath = path.join(this.exportDir, `${filename}.csv`);

      // Ensure data is array
      const dataArray = Array.isArray(data) ? data : [data];

      if (dataArray.length === 0) {
        throw new Error('No data to export');
      }

      // Generate CSV
      const csvOptions = {
        fields: fields || Object.keys(dataArray[0]),
        delimiter
      };

      const csv = parse(dataArray, csvOptions);
      await fs.writeFile(filePath, csv, 'utf8');

      return {
        format: 'csv',
        filePath,
        filename: `${filename}.csv`,
        size: Buffer.byteLength(csv),
        rows: dataArray.length
      };
    } catch (error) {
      logger.error(`CSV export failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Export to PDF format
   * @param {Object} data - Data to export
   * @param {string} filename - File name
   * @param {Object} options - Export options
   * @returns {Promise<Object>} Export result
   */
  async exportToPDF(data, filename, options = {}) {
    return new Promise(async (resolve, reject) => {
      try {
        const {
          title = 'Export Report',
          author = 'Hydra-Termux',
          includeTimestamp = true
        } = options;

        const filePath = path.join(this.exportDir, `${filename}.pdf`);
        const doc = new PDFDocument({ margin: 50 });
        const writeStream = require('fs').createWriteStream(filePath);

        doc.pipe(writeStream);

        // Add metadata
        doc.info['Title'] = title;
        doc.info['Author'] = author;

        // Add header
        doc.fontSize(24).text(title, { align: 'center' });
        doc.moveDown();

        if (includeTimestamp) {
          doc.fontSize(10).text(
            `Generated: ${new Date().toLocaleString()}`,
            { align: 'center' }
          );
          doc.moveDown();
        }

        // Add content
        doc.fontSize(12);
        this._addContentToPDF(doc, data);

        // Finalize PDF
        doc.end();

        writeStream.on('finish', async () => {
          const stats = await fs.stat(filePath);
          resolve({
            format: 'pdf',
            filePath,
            filename: `${filename}.pdf`,
            size: stats.size
          });
        });

        writeStream.on('error', reject);
      } catch (error) {
        logger.error(`PDF export failed: ${error.message}`);
        reject(error);
      }
    });
  }

  /**
   * Add content to PDF document
   * @param {PDFDocument} doc - PDF document
   * @param {Object|Array} data - Data to add
   * @param {number} level - Indentation level
   * @private
   */
  _addContentToPDF(doc, data, level = 0) {
    const indent = level * 20;

    if (Array.isArray(data)) {
      data.forEach((item, index) => {
        doc.text(`[${index}]`, { indent });
        this._addContentToPDF(doc, item, level + 1);
      });
    } else if (typeof data === 'object' && data !== null) {
      Object.entries(data).forEach(([key, value]) => {
        if (typeof value === 'object' && value !== null) {
          doc.fillColor('#0066cc').text(`${key}:`, { indent });
          doc.fillColor('#000000');
          this._addContentToPDF(doc, value, level + 1);
        } else {
          doc.text(`${key}: ${value}`, { indent });
        }
        doc.moveDown(0.5);
      });
    } else {
      doc.text(String(data), { indent });
    }
  }

  /**
   * Export to Excel format
   * @param {Array|Object} data - Data to export
   * @param {string} filename - File name
   * @param {Object} options - Export options
   * @returns {Promise<Object>} Export result
   */
  async exportToExcel(data, filename, options = {}) {
    try {
      const {
        sheetName = 'Sheet1',
        title = 'Export'
      } = options;

      const filePath = path.join(this.exportDir, `${filename}.xlsx`);
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet(sheetName);

      // Ensure data is array
      const dataArray = Array.isArray(data) ? data : [data];

      if (dataArray.length === 0) {
        throw new Error('No data to export');
      }

      // Add title row
      worksheet.mergeCells('A1', 'E1');
      const titleCell = worksheet.getCell('A1');
      titleCell.value = title;
      titleCell.font = { size: 16, bold: true };
      titleCell.alignment = { horizontal: 'center' };

      // Add timestamp
      worksheet.mergeCells('A2', 'E2');
      const timestampCell = worksheet.getCell('A2');
      timestampCell.value = `Generated: ${new Date().toLocaleString()}`;
      timestampCell.font = { size: 10, italic: true };
      timestampCell.alignment = { horizontal: 'center' };

      // Add headers
      const headers = Object.keys(dataArray[0]);
      const headerRow = worksheet.getRow(4);
      
      headers.forEach((header, index) => {
        const cell = headerRow.getCell(index + 1);
        cell.value = header.toUpperCase();
        cell.font = { bold: true };
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FF4472C4' }
        };
        cell.font = { color: { argb: 'FFFFFFFF' }, bold: true };
      });

      // Add data rows
      dataArray.forEach((item, rowIndex) => {
        const row = worksheet.getRow(rowIndex + 5);
        headers.forEach((header, colIndex) => {
          row.getCell(colIndex + 1).value = item[header];
        });
      });

      // Auto-fit columns
      worksheet.columns.forEach(column => {
        let maxLength = 0;
        column.eachCell({ includeEmpty: true }, cell => {
          const length = cell.value ? cell.value.toString().length : 10;
          maxLength = Math.max(maxLength, length);
        });
        column.width = Math.min(maxLength + 2, 50);
      });

      // Save workbook
      await workbook.xlsx.writeFile(filePath);

      const stats = await fs.stat(filePath);

      return {
        format: 'excel',
        filePath,
        filename: `${filename}.xlsx`,
        size: stats.size,
        rows: dataArray.length
      };
    } catch (error) {
      logger.error(`Excel export failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Export credentials to file
   * @param {Array} credentials - Credentials array
   * @param {string} format - Export format
   * @param {Object} options - Export options
   * @returns {Promise<Object>} Export result
   */
  async exportCredentials(credentials, format, options = {}) {
    try {
      const filename = options.filename || `credentials_${Date.now()}`;
      
      // Sanitize credential data for export
      const sanitized = credentials.map(cred => ({
        Target: cred.target,
        Service: cred.service,
        Port: cred.port || 'N/A',
        Username: cred.username,
        Password: options.includePasswords ? cred.password : '***HIDDEN***',
        'Discovered At': new Date(cred.discoveredAt).toLocaleString(),
        Verified: cred.verified ? 'Yes' : 'No'
      }));

      return await this.export(sanitized, format, {
        ...options,
        filename,
        title: 'Credentials Export'
      });
    } catch (error) {
      logger.error(`Credential export failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Export attack report
   * @param {Object} report - Attack report data
   * @param {string} format - Export format
   * @param {Object} options - Export options
   * @returns {Promise<Object>} Export result
   */
  async exportAttackReport(report, format, options = {}) {
    try {
      const filename = options.filename || `attack_report_${Date.now()}`;

      // Format report data
      const formatted = {
        'Attack ID': report.id,
        'Target': report.target,
        'Attack Type': report.attackType,
        'Status': report.status,
        'Started At': new Date(report.startedAt).toLocaleString(),
        'Completed At': report.completedAt 
          ? new Date(report.completedAt).toLocaleString() 
          : 'N/A',
        'Duration': this._formatDuration(report.duration),
        'Credentials Found': report.credentialsFound || 0
      };

      if (format === 'pdf') {
        return await this.exportToPDF(
          { ...formatted, details: report.details || {} },
          filename,
          { ...options, title: 'Attack Report' }
        );
      }

      return await this.export([formatted], format, {
        ...options,
        filename,
        title: 'Attack Report'
      });
    } catch (error) {
      logger.error(`Attack report export failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Export analytics report
   * @param {Object} analytics - Analytics data
   * @param {string} format - Export format
   * @param {Object} options - Export options
   * @returns {Promise<Object>} Export result
   */
  async exportAnalyticsReport(analytics, format, options = {}) {
    try {
      const filename = options.filename || `analytics_${Date.now()}`;

      if (format === 'excel') {
        return await this._exportAnalyticsToExcel(analytics, filename, options);
      }

      return await this.export(analytics, format, {
        ...options,
        filename,
        title: 'Analytics Report'
      });
    } catch (error) {
      logger.error(`Analytics export failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Export analytics to Excel with multiple sheets
   * @param {Object} analytics - Analytics data
   * @param {string} filename - File name
   * @param {Object} options - Export options
   * @returns {Promise<Object>} Export result
   * @private
   */
  async _exportAnalyticsToExcel(analytics, filename, options = {}) {
    try {
      const filePath = path.join(this.exportDir, `${filename}.xlsx`);
      const workbook = new ExcelJS.Workbook();

      // Summary sheet
      const summarySheet = workbook.addWorksheet('Summary');
      this._addSummaryToSheet(summarySheet, analytics.summary);

      // Attacks by type sheet
      if (analytics.attacks?.byType) {
        const attacksSheet = workbook.addWorksheet('Attacks by Type');
        this._addChartDataToSheet(attacksSheet, analytics.attacks.byType, 'Attack Type', 'Count');
      }

      // Credentials by service sheet
      if (analytics.credentials?.byService) {
        const credSheet = workbook.addWorksheet('Credentials by Service');
        this._addChartDataToSheet(credSheet, analytics.credentials.byService, 'Service', 'Count');
      }

      await workbook.xlsx.writeFile(filePath);

      const stats = await fs.stat(filePath);

      return {
        format: 'excel',
        filePath,
        filename: `${filename}.xlsx`,
        size: stats.size
      };
    } catch (error) {
      logger.error(`Analytics Excel export failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Add summary data to Excel sheet
   * @param {Worksheet} sheet - Excel worksheet
   * @param {Object} summary - Summary data
   * @private
   */
  _addSummaryToSheet(sheet, summary) {
    sheet.getCell('A1').value = 'Metric';
    sheet.getCell('B1').value = 'Value';
    
    let row = 2;
    Object.entries(summary).forEach(([key, value]) => {
      sheet.getCell(`A${row}`).value = key;
      sheet.getCell(`B${row}`).value = value;
      row++;
    });

    sheet.getColumn('A').width = 30;
    sheet.getColumn('B').width = 20;
  }

  /**
   * Add chart data to Excel sheet
   * @param {Worksheet} sheet - Excel worksheet
   * @param {Object} data - Data object
   * @param {string} keyHeader - Header for key column
   * @param {string} valueHeader - Header for value column
   * @private
   */
  _addChartDataToSheet(sheet, data, keyHeader, valueHeader) {
    sheet.getCell('A1').value = keyHeader;
    sheet.getCell('B1').value = valueHeader;
    
    let row = 2;
    Object.entries(data).forEach(([key, value]) => {
      sheet.getCell(`A${row}`).value = key;
      sheet.getCell(`B${row}`).value = value;
      row++;
    });

    sheet.getColumn('A').width = 30;
    sheet.getColumn('B').width = 15;
  }

  /**
   * Format duration in milliseconds
   * @param {number} ms - Duration in milliseconds
   * @returns {string} Formatted duration
   * @private
   */
  _formatDuration(ms) {
    if (!ms) return 'N/A';

    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  }

  /**
   * Delete export file
   * @param {string} filename - File name or path
   * @returns {Promise<boolean>} Success status
   */
  async deleteExport(filename) {
    try {
      const filePath = filename.includes(this.exportDir)
        ? filename
        : path.join(this.exportDir, filename);

      await fs.unlink(filePath);
      logger.info(`Export file deleted: ${filePath}`);
      return true;
    } catch (error) {
      logger.error(`Failed to delete export: ${error.message}`);
      throw error;
    }
  }

  /**
   * List all exports
   * @returns {Promise<Array>} List of export files
   */
  async listExports() {
    try {
      const files = await fs.readdir(this.exportDir);
      const exports = [];

      for (const file of files) {
        const filePath = path.join(this.exportDir, file);
        const stats = await fs.stat(filePath);

        exports.push({
          filename: file,
          path: filePath,
          size: stats.size,
          created: stats.birthtime,
          modified: stats.mtime
        });
      }

      return exports.sort((a, b) => b.modified - a.modified);
    } catch (error) {
      logger.error(`Failed to list exports: ${error.message}`);
      throw error;
    }
  }

  /**
   * Clean old export files
   * @param {number} maxAgeMs - Maximum age in milliseconds
   * @returns {Promise<number>} Number of files deleted
   */
  async cleanOldExports(maxAgeMs = 7 * 24 * 60 * 60 * 1000) { // 7 days default
    try {
      const exports = await this.listExports();
      const now = Date.now();
      let deleted = 0;

      for (const exp of exports) {
        const age = now - exp.modified.getTime();
        if (age > maxAgeMs) {
          await this.deleteExport(exp.path);
          deleted++;
        }
      }

      logger.info(`Cleaned ${deleted} old export files`);
      return deleted;
    } catch (error) {
      logger.error(`Failed to clean old exports: ${error.message}`);
      throw error;
    }
  }
}

// Export singleton instance
module.exports = new ExportManager();
