const { LAMPORTS_PER_SOL, SystemProgram, Transaction } = require('@solana/web3.js');
const solanaService = require('./solana');

class RelayerService {
  constructor() {
    this.isListening = false;
    this.processedEvents = new Set();
  }

  /**
   * Start listening for BurnSwapEvent from the Solana program
   * When detected, send SOL to the user
   */
  async startListening() {
    if (this.isListening) {
      console.log('Relayer already listening');
      return;
    }

    console.log('Starting relayer listener for BurnSwapEvent...');
    this.isListening = true;

    try {
      const connection = solanaService.getConnection();
      const programId = solanaService.programId;

      // Subscribe to program logs
      connection.onLogs(
        programId,
        async (logs, context) => {
          try {
            await this.handleProgramLog(logs, context);
          } catch (error) {
            console.error('Error handling program log:', error);
          }
        },
        'confirmed'
      );

      console.log(`Relayer listening on program: ${programId.toString()}`);
    } catch (error) {
      console.error('Failed to start relayer listener:', error);
      this.isListening = false;
    }
  }

  async handleProgramLog(logs, context) {
    // Check if this is a BurnSwapEvent
    const eventSignature = 'BurnSwapEvent';
    
    if (!logs.logs.some(log => log.includes(eventSignature))) {
      return;
    }

    const signature = logs.signature;
    
    // Prevent duplicate processing
    if (this.processedEvents.has(signature)) {
      return;
    }
    
    this.processedEvents.add(signature);

    console.log(`Detected BurnSwapEvent in tx: ${signature}`);

    try {
      await this.processBurnSwapEvent(logs, signature);
    } catch (error) {
      console.error('Error processing burn swap event:', error);
      // Remove from processed set to allow retry
      this.processedEvents.delete(signature);
    }
  }

  async processBurnSwapEvent(logs, signature) {
    // Parse event data from logs
    // In a real implementation, parse the actual event data
    // For MVP, we'll extract basic info and send a demo amount of SOL

    console.log('Processing BurnSwapEvent...');

    const connection = solanaService.getConnection();
    const relayerKeypair = solanaService.relayerKeypair;

    if (!relayerKeypair) {
      console.error('Relayer keypair not configured, cannot send SOL');
      return;
    }

    // In a real implementation:
    // 1. Parse event to get user pubkey and amount
    // 2. Calculate SOL amount based on zenZEC amount
    // 3. Send SOL to user

    // For MVP demo, we'll log the action
    console.log('BurnSwapEvent processed successfully');
    console.log('In production, this would:');
    console.log('1. Parse user address and zenZEC amount from event');
    console.log('2. Calculate equivalent SOL amount');
    console.log('3. Transfer SOL from relayer wallet to user');
    
    // Example of what the real implementation would look like:
    /*
    const userPubkey = parseUserFromEvent(logs);
    const zenZECAmount = parseAmountFromEvent(logs);
    const solAmount = calculateSOLAmount(zenZECAmount);
    
    const transaction = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: relayerKeypair.publicKey,
        toPubkey: userPubkey,
        lamports: solAmount * LAMPORTS_PER_SOL,
      })
    );

    const txSignature = await connection.sendTransaction(
      transaction,
      [relayerKeypair]
    );

    console.log(`Sent ${solAmount} SOL to ${userPubkey.toString()}`);
    console.log(`Transaction: ${txSignature}`);
    */
  }

  stopListening() {
    this.isListening = false;
    console.log('Relayer listener stopped');
  }
}

module.exports = new RelayerService();
