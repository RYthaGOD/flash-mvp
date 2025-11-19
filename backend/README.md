# FLASH Bridge Backend

Node.js backend server for the FLASH BTC → ZEC → Solana Bridge.

## Setup

```bash
npm install
cp .env.example .env
# Edit .env with your configuration
npm start
```

## Environment Variables

```env
PORT=3001
SOLANA_RPC_URL=https://api.devnet.solana.com
SOLANA_NETWORK=devnet
PROGRAM_ID=Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS
ZENZEC_MINT=YourZenZECMintAddressHere
ENABLE_RELAYER=false
RELAYER_KEYPAIR_PATH=~/.config/solana/id.json
```

## API Endpoints

### `GET /`
API information

### `GET /health`
Health check

### `GET /api/bridge/info`
Bridge configuration and status

### `POST /api/bridge`
Mint zenZEC tokens

Request body:
```json
{
  "solanaAddress": "wallet_address",
  "amount": 1.5,
  "swapToSol": false
}
```

### `GET /api/bridge/transaction/:txId`
Get transaction status

## Relayer Service

The relayer listens for `BurnSwapEvent` from the Solana program and processes SOL swaps.

Enable with `ENABLE_RELAYER=true` in `.env`.

## Technology Stack

- Express.js
- @solana/web3.js
- @project-serum/anchor
- CORS, body-parser
