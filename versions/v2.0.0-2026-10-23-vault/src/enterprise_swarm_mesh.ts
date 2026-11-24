import { DatabaseSync } from 'node:sqlite';
import express, { Request, Response } from 'express';
import { execSync } from 'child_process';
import fs from 'fs';

export class EnterpriseSwarmMesh {
  private db: DatabaseSync;
  private app: express.Application;
  private port: number;
  private dbPath: string;

  constructor(dbPath: string = './data/chronos_production.db', port: number = 3000) {
    this.dbPath = dbPath;
    fs.mkdirSync('./data', { recursive: true });
    this.db = new DatabaseSync(dbPath);
    this.db.exec('PRAGMA journal_mode = WAL;');
    this.app = express();
    this.port = port;
    this.initInfrastructure();
    this.setupWebServer();
  }

  private initInfrastructure(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS agent_bus (
        id TEXT PRIMARY KEY,
        sender TEXT NOT NULL,
        recipient TEXT NOT NULL,
        payload TEXT NOT NULL,
        timestamp INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS ledger_audit (
        audit_id TEXT PRIMARY KEY,
        action TEXT NOT NULL,
        details TEXT NOT NULL,
        timestamp INTEGER NOT NULL
      );
    `);
  }

  public performCacheCleaning(): void {
    try {
      console.log('[CHRONOS MESH] Initiating auto cache cleaning...');
      execSync('npm cache clean --force', { stdio: 'ignore' });
      ['./dist', './build', './.tsbuildinfo'].forEach(dir => {
        if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
      });
      console.log('[CHRONOS MESH] Cache purged.');
    } catch (error) {
      console.error('[CHRONOS MESH ERROR]', error);
    }
  }

  public rotateLedger(): void {
    try {
      const stats = fs.statSync(this.dbPath);
      if (stats.size / (1024 * 1024) > 50) {
        this.db.exec('PRAGMA wal_checkpoint(FULL);');
        const archivePath = `./data/chronos_production_${Date.now()}.db.bak`;
        fs.copyFileSync(this.dbPath, archivePath);
        const stmt = this.db.prepare(`INSERT INTO ledger_audit (audit_id, action, details, timestamp) VALUES (?, ?, ?, ?)`);
        stmt.run(`AUDIT-${Date.now()}`, 'LEDGER_ROTATION', `Archived to ${archivePath}`, Date.now());
      }
    } catch (error) {
      console.error('[CHRONOS MESH ERROR]', error);
    }
  }

  private setupWebServer(): void {
    this.app.use(express.json());
    this.app.get('/', (req: Request, res: Response) => {
      res.send(`<html><body style="background:#0f172a;color:#38bdf8;font-family:monospace;padding:20px;">
        <h1>🚀 Chronos OS v10.0 // Secure Swarm Mesh</h1>
        <p>Status: ONLINE | Security Whitelist Active | Localhost Restricted</p>
      </body></html>`);
    });

    this.app.post('/api/terminal', (req: Request, res: Response) => {
      const { command } = req.body;
      const allowedPrefixes = ['pm2 status', 'pm2 logs', 'git status', 'node -e', 'rclone lsd'];
      const isAllowed = allowedPrefixes.some(prefix => command && command.trim().startsWith(prefix));

      if (!isAllowed) {
        res.status(403).json({ success: false, result: 'Access Denied: Command violates security whitelist policy.' });
        return;
      }

      try {
        const result = execSync(command, { encoding: 'utf8', timeout: 10000 });
        res.json({ success: true, result });
      } catch (error: any) {
        res.status(500).json({ success: false, result: error.message });
      }
    });
  }

  public startServer(): void {
    this.app.listen(this.port, '127.0.0.1', () => {
      console.log(`[CHRONOS MESH] Server bound to 127.0.0.1:${this.port}`);
    });
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const mesh = new EnterpriseSwarmMesh();
  mesh.performCacheCleaning();
  mesh.rotateLedger();
  mesh.startServer();
}
