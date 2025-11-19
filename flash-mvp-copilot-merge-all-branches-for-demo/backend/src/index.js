const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
require('dotenv').config();

const bridgeRoutes = require('./routes/bridge');
const zcashRoutes = require('./routes/zcash');
const arciumRoutes = require('./routes/arcium');
const solanaService = require('./services/solana');
const relayerService = require('./services/relayer');
const zcashService = require('./services/zcash');
const arciumService = require('./services/arcium');
const bitcoinService = require('./services/bitcoin');

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
      zcash: '/api/zcash',
      arcium: '/api/arcium',
      health: '/health',
      bridgeInfo: '/api/bridge/info',
      zcashInfo: '/api/zcash/info',
      arciumStatus: '/api/arcium/status',
    },
    features: {
      privacy: 'Full MPC encryption via Arcium',
      confidential: 'All transactions encrypted',
    },
  });
});

app.get('/health', (req, res) => {
  const arciumStatus = arciumService.getStatus();
  res.json({ 
    status: 'ok',
    relayerActive: relayerService.isListening,
    arciumMPC: arciumStatus.enabled,
    privacy: arciumStatus.enabled ? 'full' : 'basic',
    timestamp: new Date().toISOString(),
  });
});

app.use('/api/bridge', bridgeRoutes);
app.use('/api/zcash', zcashRoutes);
app.use('/api/arcium', arciumRoutes);

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
  console.log(`Zcash Network: ${process.env.ZCASH_NETWORK || 'mainnet'}`);
  console.log(`Zcash Bridge: ${process.env.ZCASH_BRIDGE_ADDRESS ? 'Configured' : 'Not configured'}`);
  console.log(`Bitcoin Network: ${process.env.BITCOIN_NETWORK || 'mainnet'}`);
  console.log(`Bitcoin Bridge: ${process.env.BITCOIN_BRIDGE_ADDRESS ? 'Configured' : 'Not configured'}`);
  console.log('='.repeat(60));
  
  // Initialize Arcium MPC if enabled
  if (process.env.ENABLE_ARCIUM_MPC === 'true') {
    console.log('Initializing Arcium MPC network...');
    try {
      await arciumService.initialize();
      const arciumStatus = arciumService.getStatus();
      console.log(`Arcium MPC: ${arciumStatus.connected ? 'Connected' : 'Not connected'}`);
      console.log(`Privacy Features: ${arciumStatus.features.encryptedAmounts ? 'Enabled' : 'Disabled'}`);
    } catch (error) {
      console.error('Failed to initialize Arcium:', error.message);
    }
  } else {
    console.log('Arcium MPC disabled (set ENABLE_ARCIUM_MPC=true to enable full privacy)');
  }
  
  console.log('='.repeat(60));

  // Initialize Bitcoin service
  console.log('Initializing Bitcoin service...');
  try {
    await bitcoinService.initialize();
    const bitcoinInfo = bitcoinService.getNetworkInfo();
    console.log(`Bitcoin Bridge Address: ${bitcoinInfo.bridgeAddress || 'Not configured'}`);
    console.log(`Bitcoin Reserve: ${bitcoinInfo.currentReserveBTC} BTC`);
    
    // Start Bitcoin monitoring if enabled
    if (process.env.ENABLE_BITCOIN_MONITORING === 'true' && bitcoinInfo.bridgeAddress) {
      console.log('Starting Bitcoin monitoring...');
      await bitcoinService.startMonitoring(async (payment) => {
        console.log(`New Bitcoin payment detected: ${payment.amount / 100000000} BTC`);
        console.log(`Transaction: ${payment.txHash}`);
        // In production, this would trigger zenZEC minting automatically
      });
      console.log('Bitcoin monitoring started successfully');
    } else {
      console.log('Bitcoin monitoring disabled (set ENABLE_BITCOIN_MONITORING=true to enable)');
    }
  } catch (error) {
    console.error('Failed to initialize Bitcoin service:', error.message);
  }
  
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
  bitcoinService.stopMonitoring();
  relayerService.stopListening();
  process.exit(0);
});

module.exports = app;
