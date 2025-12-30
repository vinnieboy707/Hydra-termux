const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const { run, get } = require('../database');

class AttackService {
  constructor() {
    this.runningAttacks = new Map();
    this.scriptsPath = process.env.SCRIPTS_PATH || path.resolve(__dirname, '../../../scripts');
    this.scriptBasePaths = Array.from(new Set([
      this.scriptsPath,
      path.resolve(process.cwd(), 'scripts'),
      path.resolve(__dirname, '..', '..', '..', 'scripts')
    ]));
  }

  async queueAttack(attackData) {
    const { id, attack_type, target_host, target_port, protocol, config, userId } = attackData;

    // Update status to running
    await run('UPDATE attacks SET status = ?, started_at = CURRENT_TIMESTAMP WHERE id = ?', ['running', id]);

    // Broadcast start event
    if (global.broadcast) {
      global.broadcast({
        type: 'attack_started',
        attackId: id,
        target: target_host,
        protocol
      });
    }

    // Execute attack
    this.executeAttack(attackData);
  }

  async executeAttack(attackData) {
    const { id, attack_type, target_host, target_port, protocol, config } = attackData;

    try {
      // Map attack type to script
      const scriptMap = {
        'ssh': 'ssh_admin_attack.sh',
        'ftp': 'ftp_admin_attack.sh',
        'http': 'web_admin_attack.sh',
        'rdp': 'rdp_admin_attack.sh',
        'mysql': 'mysql_admin_attack.sh',
        'postgres': 'postgres_admin_attack.sh',
        'smb': 'smb_admin_attack.sh',
        'auto': 'admin_auto_attack.sh'
      };

      const scriptName = scriptMap[attack_type];
      if (!scriptName) {
        throw new Error(`Unknown attack type: ${attack_type}`);
      }

      // Resolve script path with fallbacks (supports running backend outside repo root)
      let scriptPath;
      for (const base of this.scriptBasePaths) {
        const candidate = path.join(base, scriptName);
        if (fs.existsSync(candidate)) {
          scriptPath = candidate;
          break;
        }
      }
      if (!scriptPath) {
        throw new Error(`Script not found: ${scriptName}`);
      }

      // Build command arguments
      const args = [scriptPath, '-t', target_host];
      
      if (target_port) {
        args.push('-p', target_port);
      }
      
      if (config && config.threads) {
        args.push('-T', config.threads);
      }
      
      if (config && config.verbose) {
        args.push('-v');
      }
      
      if (config && config.userList) {
        args.push('-u', config.userList);
      }
      
      if (config && config.wordList) {
        args.push('-w', config.wordList);
      }

      // Log command
      await this.addLog(id, 'info', `Executing: bash ${args.join(' ')}`);

      // Spawn process
      const process = spawn('bash', args);
      
      this.runningAttacks.set(id, process);

      let outputBuffer = '';

      process.stdout.on('data', async (data) => {
        const output = data.toString();
        outputBuffer += output;
        
        // Log output
        await this.addLog(id, 'info', output.trim());
        
        // Parse for credentials
        this.parseCredentials(id, output);
        
        // Broadcast progress
        if (global.broadcast) {
          global.broadcast({
            type: 'attack_progress',
            attackId: id,
            output: output.trim()
          });
        }
      });

      process.stderr.on('data', async (data) => {
        const error = data.toString();
        await this.addLog(id, 'error', error.trim());
        
        if (global.broadcast) {
          global.broadcast({
            type: 'attack_error',
            attackId: id,
            error: error.trim()
          });
        }
      });

      process.on('close', async (code) => {
        this.runningAttacks.delete(id);
        
        const status = code === 0 ? 'completed' : 'failed';
        await run(
          'UPDATE attacks SET status = ?, completed_at = CURRENT_TIMESTAMP WHERE id = ?',
          [status, id]
        );
        
        await this.addLog(id, 'info', `Attack ${status} with exit code ${code}`);
        
        if (global.broadcast) {
          global.broadcast({
            type: 'attack_completed',
            attackId: id,
            status,
            exitCode: code
          });
        }
      });

      process.on('error', async (error) => {
        this.runningAttacks.delete(id);
        
        await run(
          'UPDATE attacks SET status = ?, error = ?, completed_at = CURRENT_TIMESTAMP WHERE id = ?',
          ['failed', error.message, id]
        );
        
        await this.addLog(id, 'error', `Attack failed: ${error.message}`);
        
        if (global.broadcast) {
          global.broadcast({
            type: 'attack_failed',
            attackId: id,
            error: error.message
          });
        }
      });

    } catch (error) {
      console.error('Execute attack error:', error);
      
      await run(
        'UPDATE attacks SET status = ?, error = ?, completed_at = CURRENT_TIMESTAMP WHERE id = ?',
        ['failed', error.message, id]
      );
      
      await this.addLog(id, 'error', error.message);
      
      if (global.broadcast) {
        global.broadcast({
          type: 'attack_failed',
          attackId: id,
          error: error.message
        });
      }
    }
  }

  async parseCredentials(attackId, output) {
    // Parse Hydra output for successful credentials
    // Format: [22][ssh] host: 192.168.1.100   login: admin   password: password123
    const regex = /\[(\d+)\]\[(\w+)\]\s+host:\s+([^\s]+)\s+login:\s+([^\s]+)\s+password:\s+(.+)/gi;
    let match;
    
    while ((match = regex.exec(output)) !== null) {
      const [, port, protocol, host, username, password] = match;
      
      try {
        await run(
          `INSERT INTO results (attack_id, target_host, protocol, port, username, password, success)
           VALUES (?, ?, ?, ?, ?, ?, 1)`,
          [attackId, host, protocol, parseInt(port), username, password.trim()]
        );
        
        await this.addLog(attackId, 'success', `Found credentials: ${username}:${password.trim()}`);
        
        if (global.broadcast) {
          global.broadcast({
            type: 'credentials_found',
            attackId,
            username,
            password: password.trim(),
            host,
            protocol,
            port
          });
        }
      } catch (error) {
        console.error('Error saving credentials:', error);
      }
    }
  }

  async addLog(attackId, level, message) {
    try {
      await run(
        'INSERT INTO attack_logs (attack_id, level, message) VALUES (?, ?, ?)',
        [attackId, level, message]
      );
    } catch (error) {
      console.error('Error adding log:', error);
    }
  }

  stopAttack(attackId) {
    const process = this.runningAttacks.get(attackId);
    if (process) {
      process.kill('SIGTERM');
      this.runningAttacks.delete(attackId);
      return true;
    }
    return false;
  }

  getRunningAttacks() {
    return Array.from(this.runningAttacks.keys());
  }
}

module.exports = AttackService;
