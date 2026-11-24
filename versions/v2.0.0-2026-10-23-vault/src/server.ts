import express, { Request, Response } from 'express';
import { DatabaseSync } from 'node:sqlite';
import fs from 'fs';

fs.mkdirSync('./data', { recursive: true });
const app = express();
app.use(express.json());

const db = new DatabaseSync('./data/chronos_production.db');
db.exec('PRAGMA journal_mode = WAL;');

app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ONLINE', timestamp: Date.now(), environment: 'PRODUCTION' });
});

app.post('/api/webhook/stripe', (req: Request, res: Response) => {
  console.log('[CHRONOS WEBHOOK] Received Stripe event:', req.body.type);
  res.json({ received: true });
});

const PORT = process.env.PORT || 4000;
app.listen(Number(PORT), '127.0.0.1', () => {
  console.log(`[CHRONOS SERVER] Enterprise API server bound to 127.0.0.1:${PORT}`);
});
