const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const bodyParser = require('body-parser');
const rateLimit = require('express-rate-limit');
const http = require('http');
const WebSocket = require('ws');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Import routes
const attackRoutes = require('./routes/attacks');
const targetRoutes = require('./routes/targets');
const resultRoutes = require('./routes/results');
const wordlistRoutes = require('./routes/wordlists');
const authRoutes = require('./routes/auth');
const dashboardRoutes = require('./routes/dashboard');
const configRoutes = require('./routes/config');
const logsRoutes = require('./routes/logs');
const systemRoutes = require('./routes/system');
const webhookRoutes = require('./routes/webhooks');
const securityRoutes = require('./routes/security');
const scanRoutes = require('./routes/scan');
const vpnRoutes = require('./routes/vpn');

// Middleware
app.use(helmet());
app.use(cors());
app.use(morgan('combined'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});
app.use('/api/', limiter);

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/attacks', attackRoutes);
app.use('/api/targets', targetRoutes);
app.use('/api/results', resultRoutes);
app.use('/api/wordlists', wordlistRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/config', configRoutes);
app.use('/api/logs', logsRoutes);
app.use('/api/system', systemRoutes);
app.use('/api/webhooks', webhookRoutes);
app.use('/api/security', securityRoutes);
app.use('/api/scan', scanRoutes);
app.use('/api/vpn', vpnRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// WebSocket connection handling
wss.on('connection', (ws) => {
  console.log('WebSocket client connected');
  
  ws.on('message', (message) => {
    console.log('Received:', message);
  });
  
  ws.on('close', () => {
    console.log('WebSocket client disconnected');
  });
});

// Broadcast function for real-time updates
global.broadcast = (data) => {
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(data));
    }
  });
};

// Error handling
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ 
    error: 'Internal server error',
    message: err.message 
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║   🐍 HYDRA PENETRATION TESTING PLATFORM API 🐍               ║
║                                                               ║
║   Server running on port ${PORT}                              ║
║   Environment: ${process.env.NODE_ENV || 'development'}                                    ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
  `);
});

module.exports = { app, server, wss };
