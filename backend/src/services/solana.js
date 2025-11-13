const { Connection, PublicKey, Keypair, clusterApiUrl } = require('@solana/web3.js');
const { AnchorProvider, Program, web3 } = require('@project-serum/anchor');
const fs = require('fs');
const path = require('path');

// Load IDL
let idl;
try {
  const idlPath = path.join(__dirname, '../../../target/idl/zenz_bridge.json');
  if (fs.existsSync(idlPath)) {
    idl = JSON.parse(fs.readFileSync(idlPath, 'utf8'));
  }
} catch (error) {
  console.warn('IDL not found, some functionality may be limited');
}

class SolanaService {
  constructor() {
    const network = process.env.SOLANA_NETWORK || 'devnet';
    const rpcUrl = process.env.SOLANA_RPC_URL || clusterApiUrl(network);
    
    this.connection = new Connection(rpcUrl, 'confirmed');
    this.programId = new PublicKey(process.env.PROGRAM_ID || 'Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS');
    
    // Load relayer keypair if available
    this.relayerKeypair = this.loadRelayerKeypair();
  }

  loadRelayerKeypair() {
    try {
      const keypairPath = process.env.RELAYER_KEYPAIR_PATH || path.join(process.env.HOME, '.config/solana/id.json');
      if (fs.existsSync(keypairPath)) {
        const keypairData = JSON.parse(fs.readFileSync(keypairPath, 'utf8'));
        return Keypair.fromSecretKey(Uint8Array.from(keypairData));
      }
    } catch (error) {
      console.warn('Relayer keypair not loaded:', error.message);
    }
    return null;
  }

  getConnection() {
    return this.connection;
  }

  getProgram() {
    if (!idl || !this.relayerKeypair) {
      throw new Error('IDL or relayer keypair not available');
    }

    const wallet = {
      publicKey: this.relayerKeypair.publicKey,
      signTransaction: async (tx) => {
        tx.partialSign(this.relayerKeypair);
        return tx;
      },
      signAllTransactions: async (txs) => {
        return txs.map((tx) => {
          tx.partialSign(this.relayerKeypair);
          return tx;
        });
      },
    };

    const provider = new AnchorProvider(
      this.connection,
      wallet,
      { commitment: 'confirmed' }
    );

    return new Program(idl, this.programId, provider);
  }

  async getConfigPDA() {
    const [configPda] = await PublicKey.findProgramAddress(
      [Buffer.from('config')],
      this.programId
    );
    return configPda;
  }

  async mintZenZEC(userAddress, amount) {
    if (!this.relayerKeypair) {
      throw new Error('Relayer keypair not configured');
    }

    const program = this.getProgram();
    const configPda = await this.getConfigPDA();
    const userPubkey = new PublicKey(userAddress);

    // Get or create user token account
    // In a real implementation, you'd need to handle token account creation
    const userTokenAccount = await this.getOrCreateTokenAccount(userPubkey);

    const tx = await program.methods
      .mintZenzec(new web3.BN(amount))
      .accounts({
        config: configPda,
        mint: process.env.ZENZEC_MINT,
        userTokenAccount: userTokenAccount,
        authority: this.relayerKeypair.publicKey,
        tokenProgram: web3.TOKEN_PROGRAM_ID,
      })
      .rpc();

    return tx;
  }

  async getOrCreateTokenAccount(userPubkey) {
    // Placeholder: In real implementation, use getAssociatedTokenAddress
    // and create if needed
    return userPubkey;
  }
}

module.exports = new SolanaService();
