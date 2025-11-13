const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
require('dotenv').config();

const bridgeRoutes = require('./routes/bridge');
const solanaService = require('./services/solana');
const relayerService = require('./services/relayer');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Routes
app.get('/', (req, res) => {
  res.json({
    message: 'FLASH — BTC → ZEC (shielded) → Solana Bridge',
    description: 'Backend API for zenZEC minting and SOL swap relayer',
    version: '1.0.0',
    status: 'running',
    endpoints: {
      bridge: '/api/bridge',
      health: '/health',
      info: '/api/bridge/info',
    },
  });
});

app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok',
    relayerActive: relayerService.isListening,
    timestamp: new Date().toISOString(),
  });
});

app.use('/api/bridge', bridgeRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    error: 'Internal server error',
    message: err.message,
  });
});

// Start server
app.listen(PORT, async () => {
  console.log('='.repeat(60));
  console.log('FLASH — BTC → ZEC → Solana Bridge (MVP)');
  console.log('='.repeat(60));
  console.log(`Backend server running on port ${PORT}`);
  console.log(`Solana Network: ${process.env.SOLANA_NETWORK || 'devnet'}`);
  console.log(`Program ID: ${process.env.PROGRAM_ID || 'Not configured'}`);
  console.log(`zenZEC Mint: ${process.env.ZENZEC_MINT || 'Not configured'}`);
  console.log('='.repeat(60));

  // Start relayer listener if enabled
  if (process.env.ENABLE_RELAYER === 'true') {
    console.log('Starting relayer service...');
    try {
      await relayerService.startListening();
      console.log('Relayer service started successfully');
    } catch (error) {
      console.error('Failed to start relayer:', error.message);
    }
  } else {
    console.log('Relayer disabled (set ENABLE_RELAYER=true to enable)');
  }
  
  console.log('='.repeat(60));
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down gracefully...');
  relayerService.stopListening();
  process.exit(0);
});

module.exports = app;
