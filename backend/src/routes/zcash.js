const express = require('express');
const router = express.Router();
const zcashService = require('../services/zcash');

/**
 * Get Zcash network information
 */
router.get('/info', async (req, res) => {
  try {
    const networkInfo = zcashService.getNetworkInfo();
    res.json({
      success: true,
      ...networkInfo,
    });
  } catch (error) {
    console.error('Error fetching Zcash info:', error);
    res.status(500).json({ error: 'Failed to fetch Zcash info' });
  }
});

/**
 * Verify a Zcash transaction
 * POST body: { txHash, expectedAmount }
 */
router.post('/verify-transaction', async (req, res) => {
  try {
    const { txHash, expectedAmount } = req.body;

    if (!txHash) {
      return res.status(400).json({
        error: 'Missing required field: txHash',
      });
    }

    // Verify the transaction exists and is confirmed
    const transaction = await zcashService.verifyShieldedTransaction(txHash);
    
    if (!transaction.verified) {
      return res.status(400).json({
        error: 'Transaction not verified',
        transaction,
      });
    }

    // Get additional transaction details from explorer
    const txDetails = await zcashService.getTransaction(txHash);

    res.json({
      success: true,
      verified: true,
      transaction: {
        ...transaction,
        ...txDetails,
      },
      message: 'Zcash transaction verified successfully',
    });
  } catch (error) {
    console.error('Error verifying transaction:', error);
    res.status(500).json({
      error: 'Failed to verify transaction',
      message: error.message,
    });
  }
});

/**
 * Get current ZEC price
 */
router.get('/price', async (req, res) => {
  try {
    const price = await zcashService.getZecPrice();
    res.json({
      success: true,
      price,
      currency: 'USD',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error fetching ZEC price:', error);
    res.status(500).json({ error: 'Failed to fetch ZEC price' });
  }
});

/**
 * Validate a Zcash address
 * POST body: { address }
 */
router.post('/validate-address', (req, res) => {
  try {
    const { address } = req.body;

    if (!address) {
      return res.status(400).json({
        error: 'Missing required field: address',
      });
    }

    const isValid = zcashService.isValidZcashAddress(address);

    res.json({
      success: true,
      valid: isValid,
      address,
    });
  } catch (error) {
    console.error('Error validating address:', error);
    res.status(500).json({ error: 'Failed to validate address' });
  }
});

/**
 * Get bridge address for depositing ZEC
 */
router.get('/bridge-address', (req, res) => {
  try {
    const bridgeAddress = process.env.ZCASH_BRIDGE_ADDRESS || 'zs1_bridge_address_placeholder';
    
    res.json({
      success: true,
      address: bridgeAddress,
      network: process.env.ZCASH_NETWORK || 'mainnet',
      message: 'Send ZEC to this address to mint zenZEC on Solana',
    });
  } catch (error) {
    console.error('Error fetching bridge address:', error);
    res.status(500).json({ error: 'Failed to fetch bridge address' });
  }
});

module.exports = router;
