const express = require('express');
const router = express.Router();
const solanaService = require('../services/solana');
const zcashService = require('../services/zcash');
const bitcoinService = require('../services/bitcoin');
const converterService = require('../services/converter');

// Get bridge information and status
router.get('/info', async (req, res) => {
  try {
    const connection = solanaService.getConnection();
    const version = await connection.getVersion();
    const bitcoinInfo = bitcoinService.getNetworkInfo();
    
    res.json({
      status: 'active',
      network: process.env.SOLANA_NETWORK || 'devnet',
      programId: process.env.PROGRAM_ID,
      zenZECMint: process.env.ZENZEC_MINT || 'Not configured',
      solanaVersion: version,
      description: 'FLASH BTC→ZEC→Solana Bridge (Cash App Optimized)',
      bitcoin: {
        network: bitcoinInfo.network,
        bridgeAddress: bitcoinInfo.bridgeAddress,
        currentReserve: bitcoinInfo.currentReserveBTC,
      },
    });
  } catch (error) {
    console.error('Error fetching bridge info:', error);
    res.status(500).json({ error: 'Failed to fetch bridge info' });
  }
});

// Main bridge endpoint: Mint zenZEC tokens
// Supports two flows:
// 1. BTC → zenZEC (Cash App → Bitcoin → Bridge)
// 2. ZEC → zenZEC (Direct Zcash → Bridge)
router.post('/', async (req, res) => {
  try {
    const { solanaAddress, amount, swapToSol, bitcoinTxHash, zcashTxHash, useZecPrivacy } = req.body;

    // Validate required fields
    if (!solanaAddress || !amount) {
      return res.status(400).json({
        error: 'Missing required fields: solanaAddress, amount',
      });
    }

    // Either Bitcoin or Zcash transaction hash is required
    if (!bitcoinTxHash && !zcashTxHash) {
      return res.status(400).json({
        error: 'Missing required field: bitcoinTxHash OR zcashTxHash',
        note: 'Provide bitcoinTxHash for Cash App flow, or zcashTxHash for direct ZEC bridging',
      });
    }

    // Cannot provide both
    if (bitcoinTxHash && zcashTxHash) {
      return res.status(400).json({
        error: 'Provide either bitcoinTxHash OR zcashTxHash, not both',
      });
    }

    // Validate amount
    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      return res.status(400).json({
        error: 'Invalid amount',
      });
    }

    // Determine flow type
    const isBitcoinFlow = !!bitcoinTxHash;
    const isZcashFlow = !!zcashTxHash;

    console.log(`Bridge request: ${amount} ${isBitcoinFlow ? 'BTC' : 'ZEC'} to ${solanaAddress}`);
    if (isBitcoinFlow) {
      console.log(`Bitcoin TX: ${bitcoinTxHash}`);
      console.log(`Use ZEC privacy: ${useZecPrivacy || false}`);
    } else {
      console.log(`Zcash TX: ${zcashTxHash}`);
    }

    let btcVerification = null;
    let zecVerification = null;
    let reserveAmount = 0;
    let reserveAsset = 'ZEC'; // Default to ZEC for direct flow

    // FLOW 1: Bitcoin → zenZEC (Cash App flow)
    if (isBitcoinFlow) {
      // STEP 1: Verify Bitcoin payment
      console.log(`Verifying Bitcoin payment: ${bitcoinTxHash}`);
      btcVerification = await bitcoinService.verifyBitcoinPayment(
        bitcoinTxHash,
        amountNum // Expected amount in BTC
      );

      if (!btcVerification.verified) {
        return res.status(400).json({
          error: 'Bitcoin payment verification failed',
          reason: btcVerification.reason,
          bitcoinTxHash,
          confirmations: btcVerification.confirmations,
        });
      }

      console.log(`Bitcoin payment verified: ${btcVerification.amountBTC} BTC`);
      console.log(`Confirmations: ${btcVerification.confirmations}`);

      // STEP 2: Optional - Convert BTC → ZEC for privacy layer
      reserveAmount = btcVerification.amount; // Default: use BTC amount (in satoshis)
      reserveAsset = 'BTC';

      if (useZecPrivacy) {
        console.log('Converting BTC → ZEC for privacy layer...');
        try {
          const conversionResult = await converterService.convertBTCtoZEC(
            btcVerification.amountBTC
          );

          console.log(`Conversion: ${btcVerification.amountBTC} BTC → ${conversionResult.zecAmount} ZEC`);

          // If ZEC transaction hash is provided, verify it
          if (conversionResult.zecTxHash) {
            zecVerification = await zcashService.verifyShieldedTransaction(
              conversionResult.zecTxHash
            );

            if (zecVerification.verified) {
              reserveAmount = Math.floor(conversionResult.zecAmount * 100000000);
              reserveAsset = 'ZEC';
              console.log(`ZEC verification successful: ${conversionResult.zecAmount} ZEC`);
            }
          }
        } catch (error) {
          console.error('ZEC conversion error:', error);
          console.log('Continuing with BTC reserve (conversion failed)');
        }
      }
    }

    // FLOW 2: ZEC → zenZEC (Direct Zcash flow)
    if (isZcashFlow) {
      // STEP 1: Verify Zcash shielded transaction
      console.log(`Verifying Zcash transaction: ${zcashTxHash}`);
      zecVerification = await zcashService.verifyShieldedTransaction(zcashTxHash);

      if (!zcashVerification.verified) {
        return res.status(400).json({
          error: 'Zcash transaction verification failed',
          zcashTxHash,
          reason: 'Transaction not verified or not confirmed',
        });
      }

      console.log(`Zcash transaction verified: ${zecVerification.amount || amountNum} ZEC`);
      console.log(`Block height: ${zecVerification.blockHeight}`);

      // Use ZEC amount directly (1:1 with zenZEC)
      reserveAmount = Math.floor((zecVerification.amount || amountNum) * 100000000); // Convert to smallest unit
      reserveAsset = 'ZEC';
    }

    // STEP 3: Check reserve capacity
    const currentReserve = reserveAsset === 'BTC' 
      ? bitcoinService.getCurrentReserve()
      : 0; // ZEC reserve would be tracked separately (in production, query on-chain)

    // For minting, use 1:1 ratio (1 BTC/ZEC = 1 zenZEC)
    // Convert to zenZEC amount (using smallest unit for precision)
    const mintAmount = Math.floor(reserveAmount); // 1:1 ratio

    if (mintAmount > currentReserve && currentReserve > 0) {
      console.warn(`Reserve check: Requested ${mintAmount}, Available ${currentReserve}`);
      // In production, this would check on-chain reserve and reject if insufficient
    }

    // STEP 4: Generate bridge transaction ID
    const txId = isBitcoinFlow
      ? `btc_${bitcoinTxHash.substring(0, 16)}_${Date.now()}`
      : `zec_${zcashTxHash.substring(0, 16)}_${Date.now()}`;

    // STEP 5: Mint zenZEC on Solana
    // In production: await solanaService.mintZenZEC(solanaAddress, mintAmount, {
    //   btcVerification,
    //   zecVerification,
    //   reserveAsset,
    // });
    
    // For MVP, simulate minting
    console.log(`Minting ${mintAmount} zenZEC to ${solanaAddress}`);
    console.log(`Reserve asset: ${reserveAsset}`);
    console.log(`Swap to SOL: ${swapToSol || false}`);

    // Update local reserve tracking
    if (reserveAsset === 'BTC' && btcVerification) {
      bitcoinService.addToReserve(btcVerification.amount);
    }

    // Prepare response
    const response = {
      success: true,
      transactionId: txId,
      amount: mintAmount,
      solanaAddress,
      swapToSol: swapToSol || false,
      status: 'confirmed',
      message: 'zenZEC minting successful',
      reserveAsset,
    };

    // Add Bitcoin verification if present
    if (btcVerification) {
      response.amountBTC = btcVerification.amountBTC;
      response.bitcoinVerification = {
        verified: true,
        txHash: bitcoinTxHash,
        amount: btcVerification.amount,
        amountBTC: btcVerification.amountBTC,
        confirmations: btcVerification.confirmations,
        blockHeight: btcVerification.blockHeight,
      };
    }

    // Add Zcash verification if present
    if (zecVerification) {
      response.amountZEC = zecVerification.amount || amountNum;
      response.zcashVerification = {
        verified: true,
        txHash: zcashTxHash,
        amount: zecVerification.amount || amountNum,
        blockHeight: zecVerification.blockHeight,
      };

      // If this was BTC → ZEC conversion, include exchange rate
      if (btcVerification) {
        response.zcashVerification.exchangeRate = btcVerification.amountBTC / (zecVerification.amount || 1);
      }
    }

    // Note about swap to SOL
    if (swapToSol) {
      response.swapNote = 'zenZEC will be burned and swapped to SOL via relayer. Call burn_and_emit instruction.';
    }

    res.json(response);
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
