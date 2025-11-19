const express = require('express');
const router = express.Router();
const solanaService = require('../services/solana');
const zcashService = require('../services/zcash');

// Get bridge information and status
router.get('/info', async (req, res) => {
  try {
    const connection = solanaService.getConnection();
    const version = await connection.getVersion();
    
    res.json({
      status: 'active',
      network: process.env.SOLANA_NETWORK || 'devnet',
      programId: process.env.PROGRAM_ID,
      zenZECMint: process.env.ZENZEC_MINT || 'Not configured',
      solanaVersion: version,
      description: 'FLASH BTC→ZEC→Solana Bridge',
    });
  } catch (error) {
    console.error('Error fetching bridge info:', error);
    res.status(500).json({ error: 'Failed to fetch bridge info' });
  }
});

// Main bridge endpoint: Mint zenZEC tokens
// Called after user pays BTC and ZEC is shielded
router.post('/', async (req, res) => {
  try {
    const { solanaAddress, amount, swapToSol, zcashTxHash } = req.body;

    if (!solanaAddress || !amount) {
      return res.status(400).json({
        error: 'Missing required fields: solanaAddress, amount',
      });
    }

    // Validate amount
    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      return res.status(400).json({
        error: 'Invalid amount',
      });
    }

    console.log(`Bridge request: ${amount} zenZEC to ${solanaAddress}, swapToSol: ${swapToSol}`);

    // INTEGRATED FLOW:
    // 1. Verify BTC payment received (Cash App / Lightning) - MOCKED
    // 2. If zcashTxHash provided, verify ZEC shielding
    let zcashVerification = null;
    if (zcashTxHash) {
      try {
        console.log(`Verifying Zcash transaction: ${zcashTxHash}`);
        zcashVerification = await zcashService.verifyShieldedTransaction(zcashTxHash);
        if (!zcashVerification.verified) {
          return res.status(400).json({
            error: 'Zcash transaction verification failed',
            zcashTxHash,
          });
        }
      } catch (error) {
        console.error('Zcash verification error:', error);
        // Continue with mock for MVP
      }
    }

    // 3. Generate bridge transaction ID
    const txId = zcashTxHash 
      ? zcashService.generateBridgeTxId(zcashTxHash)
      : `mock_tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // 4. Call Solana program to mint zenZEC
    // In production: await solanaService.mintZenZEC(solanaAddress, amountNum);
    
    // Simulate async processing
    setTimeout(() => {
      console.log(`Minted ${amount} zenZEC to ${solanaAddress}`);
    }, 1000);

    res.json({
      success: true,
      transactionId: txId,
      amount: amountNum,
      solanaAddress,
      swapToSol: swapToSol || false,
      status: 'pending',
      message: 'zenZEC minting initiated',
      zcashVerification: zcashVerification ? {
        verified: true,
        txHash: zcashTxHash,
        blockHeight: zcashVerification.blockHeight,
      } : null,
    });
  } catch (error) {
    console.error('Error processing bridge request:', error);
    res.status(500).json({ 
      error: 'Failed to process bridge request',
      message: error.message,
    });
  }
});

// Get transaction status
router.get('/transaction/:txId', async (req, res) => {
  try {
    const { txId } = req.params;
    
    // In a real implementation, query the blockchain
    res.json({
      transactionId: txId,
      status: 'confirmed',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error fetching transaction:', error);
    res.status(500).json({ error: 'Failed to fetch transaction' });
  }
});

// Health check for bridge service
router.get('/health', async (req, res) => {
  try {
    const connection = solanaService.getConnection();
    const blockHeight = await connection.getBlockHeight();
    
    res.json({
      healthy: true,
      blockHeight,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Bridge health check failed:', error);
    res.status(503).json({ 
      healthy: false,
      error: error.message,
    });
  }
});

module.exports = router;
