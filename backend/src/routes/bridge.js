const express = require('express');
const router = express.Router();
const solanaService = require('../services/solana');

// Get bridge information
router.get('/info', async (req, res) => {
  try {
    const connection = solanaService.getConnection();
    const version = await connection.getVersion();
    
    res.json({
      status: 'active',
      network: process.env.SOLANA_NETWORK || 'devnet',
      programId: process.env.PROGRAM_ID,
      solanaVersion: version,
    });
  } catch (error) {
    console.error('Error fetching bridge info:', error);
    res.status(500).json({ error: 'Failed to fetch bridge info' });
  }
});

// Initiate a bridge transfer
router.post('/transfer', async (req, res) => {
  try {
    const { amount, destination, walletAddress } = req.body;

    if (!amount || !destination || !walletAddress) {
      return res.status(400).json({
        error: 'Missing required fields: amount, destination, walletAddress',
      });
    }

    // In a real implementation, this would interact with the Solana program
    const txId = `mock_tx_${Date.now()}`;
    
    res.json({
      success: true,
      transactionId: txId,
      amount,
      destination,
      status: 'pending',
    });
  } catch (error) {
    console.error('Error processing transfer:', error);
    res.status(500).json({ error: 'Failed to process transfer' });
  }
});

// Get transaction status
router.get('/transaction/:txId', async (req, res) => {
  try {
    const { txId } = req.params;
    
    // In a real implementation, this would query the blockchain
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

module.exports = router;
