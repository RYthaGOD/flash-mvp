import React, { useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import axios from 'axios';
import './BridgeInterface.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

function BridgeInterface() {
  const { publicKey, connected } = useWallet();
  const [amount, setAmount] = useState('');
  const [swapToSol, setSwapToSol] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const handleBridge = async (e) => {
    e.preventDefault();
    
    if (!connected || !publicKey) {
      setError('Please connect your wallet first');
      return;
    }

    if (!amount || parseFloat(amount) <= 0) {
      setError('Please enter a valid amount');
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await axios.post(`${API_URL}/api/bridge`, {
        solanaAddress: publicKey.toString(),
        amount: parseFloat(amount),
        swapToSol: swapToSol,
      });

      setResult(response.data);
      setAmount('');
    } catch (err) {
      console.error('Bridge error:', err);
      setError(err.response?.data?.error || 'Failed to process bridge request');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bridge-container">
      <div className="bridge-card">
        <h1 className="bridge-title">FLASH Bridge</h1>
        <p className="bridge-subtitle">BTC → ZEC (shielded) → Solana</p>

        <div className="wallet-section">
          <WalletMultiButton />
        </div>

        {connected && (
          <>
            <div className="info-box">
              <p><strong>Connected Wallet:</strong></p>
              <p className="wallet-address">{publicKey.toString()}</p>
            </div>

            <form onSubmit={handleBridge} className="bridge-form">
              <div className="form-group">
                <label htmlFor="amount">Amount (zenZEC)</label>
                <input
                  id="amount"
                  type="number"
                  step="0.000001"
                  min="0"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.0"
                  disabled={loading}
                  required
                />
              </div>

              <div className="form-group checkbox-group">
                <label>
                  <input
                    type="checkbox"
                    checked={swapToSol}
                    onChange={(e) => setSwapToSol(e.target.checked)}
                    disabled={loading}
                  />
                  <span>Swap to SOL after minting</span>
                </label>
                <p className="helper-text">
                  {swapToSol 
                    ? 'zenZEC will be burned and SOL sent to your wallet via relayer'
                    : 'zenZEC tokens will be minted to your wallet'}
                </p>
              </div>

              <button 
                type="submit" 
                className="bridge-button"
                disabled={loading}
              >
                {loading ? 'Processing...' : 'Bridge to Solana'}
              </button>
            </form>

            {error && (
              <div className="message error-message">
                <strong>Error:</strong> {error}
              </div>
            )}

            {result && (
              <div className="message success-message">
                <h3>✓ Bridge Request Submitted</h3>
                <p><strong>Transaction ID:</strong> {result.transactionId}</p>
                <p><strong>Amount:</strong> {result.amount} zenZEC</p>
                <p><strong>Status:</strong> {result.status}</p>
                <p className="helper-text">{result.message}</p>
              </div>
            )}
          </>
        )}

        {!connected && (
          <div className="info-box">
            <p>Connect your Solana wallet to start bridging</p>
            <ul className="feature-list">
              <li>✓ Mock BTC payment via Cash App/Lightning</li>
              <li>✓ Shield BTC into ZEC (conceptual)</li>
              <li>✓ Mint zenZEC tokens on Solana</li>
              <li>✓ Optional: Burn zenZEC to receive SOL</li>
            </ul>
          </div>
        )}

        <div className="warning-box">
          ⚠️ <strong>MVP Demo Only</strong> — Not production-ready. No audit. Do not use with real funds.
        </div>
      </div>
    </div>
  );
}

export default BridgeInterface;
