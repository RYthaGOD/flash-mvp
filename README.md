# FLASH — BTC → ZEC (shielded) → Solana Bridge (MVP)

This is a hackathon-ready DApp that demonstrates:

- User pays with BTC (via Cash App / Lightning – mocked here).
- Off-chain logic shields BTC into ZEC (conceptual step).
- A wrapped ZEC token (`zenZEC`) is minted on Solana.
- On Solana, the user can:
  - Hold `zenZEC`, or
  - Burn `zenZEC` and (in the full design) receive SOL via an off-chain relayer.

This repo focuses on the **Solana side** of the bridge (ZEC → zenZEC → SOL).

> ⚠️ **Not production-ready.** No audit. Do not use with real funds.

---

## Components

### `programs/zenz_bridge/` — Solana Program (Anchor)

The Solana program that:
- Initializes a global `Config` with:
  - `mint` (zenZEC SPL mint)
  - `authority` (admin / relayer)
  - `max_mint_per_tx` and `paused` flag
- **Mints zenZEC** to a user's token account (`mint_zenzec`)
- **Burns zenZEC** (`burn_zenzec`)
- **Burns + emits an event** (`burn_and_emit`) that a relayer can react to (e.g. to swap to SOL)

### `backend/` — Node.js + Express + Anchor Client

Backend server that:
- HTTP API `POST /api/bridge` to mint zenZEC for a given Solana address.
- Relayer listener that reacts to `BurnSwapEvent` and (in this MVP) sends a small demo amount of SOL from a relayer wallet.

### `frontend/` — React App

Simple UI where the user:
- Connects their Solana wallet
- Enters amount of zenZEC to bridge
- Chooses whether they *intend* to swap to SOL
- Calls backend `/api/bridge` to mint zenZEC

### `.github/workflows/ci.yml` — CI Workflow

GitHub Actions workflow that:
- Builds the Solana program
- Tests backend and frontend
- Runs linting

---

## How the Flow Maps to the Big Idea

Conceptually, the full FLASH flow is:

1. **User pays BTC** via Cash App Lightning.
2. **Off-chain backend**:
   - Locks BTC
   - Shields into ZEC (Zcash shielded note)
   - Proves possession (ZK/Halo2) — **future enhancement**
3. **Backend calls this Solana program** to mint `zenZEC` 1:1 with shielded ZEC.
4. **On Solana**:
   - User can hold zenZEC
   - Or call `burn_and_emit`, which triggers an off-chain relayer to swap to SOL and pay them out.

This repo implements step **3–4** + a mocked `/api/bridge` entrypoint.

---

## 🎯 Hackathon Demo

**All core workflows are ready to demo!** See [`HACKATHON_DEMO.md`](./HACKATHON_DEMO.md) for:
- Complete demo script (10 minutes)
- 5 demo workflows with step-by-step instructions
- Troubleshooting guide
- Presentation flow

**Quick Demo Test:**
```bash
# Test all workflows automatically
./scripts/demo-test.sh

# Expected: All tests pass ✓
```

**Key Demo Workflows:**
1. **Basic Bridge** (2 min) - Simple zenZEC minting
2. **Zcash Verification** (3 min) - Real ZEC transaction verification
3. **Full Privacy** (4 min) - Arcium MPC encrypted transactions
4. **Burn & Swap** (3 min) - Complete bridge lifecycle
5. **API Integration** (2 min) - Developer experience

---

## Quickstart (Localnet)

### Prerequisites

- [Solana CLI](https://docs.solana.com/cli/install-solana-cli-tools)
- [Anchor CLI](https://www.anchor-lang.com/docs/installation) (v0.29.0)
- [Node.js](https://nodejs.org/) (v18+)
- [Rust](https://rustup.rs/)

### 1. Start a Local Validator

```bash
solana-test-validator --reset
```

Keep this running in a separate terminal.

### 2. Build and Deploy the Solana Program

```bash
# Build the program
anchor build

# Deploy to localnet
anchor deploy

# Note the program ID and update Anchor.toml if needed
```

### 3. Initialize the Bridge Config

You'll need to create the zenZEC SPL token mint and initialize the bridge config. This can be done via the Anchor CLI or a custom script.

```bash
# Example: Create mint and initialize config
# This is a simplified example - adjust for your setup
solana-keygen new -o keypair.json
anchor run initialize
```

### 4. Start the Backend Server

```bash
cd backend

# Copy environment variables
cp .env.example .env

# Edit .env with your configuration:
# - PROGRAM_ID (from anchor deploy)
# - ZENZEC_MINT (your SPL token mint)
# - ENABLE_RELAYER=true (if you want relayer active)

# Install dependencies
npm install

# Start server
npm start
```

Backend runs on `http://localhost:3001`

### 5. Start the Frontend

```bash
cd frontend

# Install dependencies
npm install

# Start development server
npm start
```

Frontend runs on `http://localhost:3000`

### 6. Use the Bridge

1. Open `http://localhost:3000` in your browser
2. Connect your Solana wallet (Phantom, Solflare, etc.)
3. Enter the amount of zenZEC you want to bridge
4. Optionally check "Swap to SOL after minting"
5. Click "Bridge to Solana"

---

## Architecture

```
┌─────────────┐
│  BTC Payment│  (Cash App / Lightning - mocked)
│  (User)     │
└──────┬──────┘
       │
       v
┌─────────────┐
│  Shield ZEC │  (Conceptual - off-chain)
│  (Backend)  │
└──────┬──────┘
       │
       v
┌─────────────────────────────────┐
│  Mint zenZEC on Solana          │
│  (POST /api/bridge)             │
│  Backend → Solana Program       │
└──────┬──────────────────────────┘
       │
       v
┌─────────────────────────────────┐
│  User Holds zenZEC              │
│  OR                             │
│  Burns zenZEC (burn_and_emit)   │
└──────┬──────────────────────────┘
       │
       v
┌─────────────────────────────────┐
│  Relayer Detects BurnSwapEvent  │
│  Sends SOL to User              │
└─────────────────────────────────┘
```

---

## Testing

### Solana Program Tests

```bash
anchor test
```

### Backend Tests

```bash
cd backend
npm test
```

### Frontend Tests

```bash
cd frontend
npm test
```

---

## Environment Variables

### Backend `.env`

```env
PORT=3001
SOLANA_RPC_URL=https://api.devnet.solana.com
SOLANA_NETWORK=devnet
PROGRAM_ID=Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS
ZENZEC_MINT=YourZenZECMintAddressHere
ENABLE_RELAYER=false
RELAYER_KEYPAIR_PATH=~/.config/solana/id.json
```

### Frontend `.env`

```env
REACT_APP_API_URL=http://localhost:3001
```

---

## API Endpoints

### GET `/`
Returns API information and available endpoints.

### GET `/health`
Health check endpoint.

### GET `/api/bridge/info`
Get bridge configuration and status.

### POST `/api/bridge`
Mint zenZEC tokens.

**Request Body:**
```json
{
  "solanaAddress": "User's Solana wallet address",
  "amount": 1.5,
  "swapToSol": false
}
```

**Response:**
```json
{
  "success": true,
  "transactionId": "tx_id_here",
  "amount": 1.5,
  "solanaAddress": "address_here",
  "swapToSol": false,
  "status": "pending",
  "message": "zenZEC minting initiated"
}
```

### GET `/api/bridge/transaction/:txId`
Get transaction status.

---

## Future Enhancements

- **Real BTC Integration**: Integrate with Cash App API or Lightning Network
- **ZK Proofs**: Implement Halo2 proofs for ZEC shielding verification
- **Full Relayer**: Complete relayer implementation with actual SOL swaps
- **Cross-chain Oracle**: Price oracle for accurate ZEC↔SOL conversion
- **Security Audit**: Professional audit before mainnet deployment
- **Multi-signature Authority**: Decentralized control over bridge config
- **Rate Limiting**: Prevent spam and abuse
- **Transaction History**: Track all bridge transactions
- **Frontend Improvements**: Better UX, transaction status tracking, history

---

## Security Considerations

⚠️ **This is an MVP for demonstration purposes only.**

For production use, you would need:

1. **Smart contract audit** by professional auditors
2. **Formal verification** of critical logic
3. **Multi-sig authority** instead of single admin
4. **Rate limiting** and fraud detection
5. **Insurance fund** for bridge operations
6. **Real ZK proofs** for ZEC shielding verification
7. **Secure key management** for relayer
8. **Price oracle** integration
9. **Emergency pause** mechanisms
10. **Comprehensive testing** including edge cases

---

## License

MIT

---

## Contributing

This is a hackathon MVP. Contributions welcome!

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

---

## Support

For issues and questions, please open a GitHub issue.

---

**Built with ❤️ for the Solana hackathon**