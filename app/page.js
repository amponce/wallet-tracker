'use client'
import React, { useEffect, useState } from 'react';
import { Copy, ExternalLink, Trash2 } from 'lucide-react';

export default function Home() {
  const [transactions, setTransactions] = useState([]);
  const [wallets, setWallets] = useState([]);
  const [newWallet, setNewWallet] = useState('');
  const [isMonitoring, setIsMonitoring] = useState(false);

  useEffect(() => {
    const savedWallets = localStorage.getItem('trackedWallets');
    if (savedWallets) {
      setWallets(JSON.parse(savedWallets));
    }
    startMonitoring();
  }, []);

  useEffect(() => {
    const interval = setInterval(fetchTransactions, 60000);
    return () => clearInterval(interval);
  }, []);

  const startMonitoring = async () => {
    try {
      const response = await fetch('/api/monitor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wallets })
      });
      if (response.ok) {
        setIsMonitoring(true);
        fetchTransactions();
      }
    } catch (error) {
      console.error('Error starting monitoring:', error);
    }
  };

  const fetchTransactions = async () => {
    try {
      const response = await fetch('/api/monitor');
      if (response.ok) {
        const data = await response.json();
        setTransactions(data);
      }
    } catch (error) {
      console.error('Error fetching transactions:', error);
    }
  };

  const addWallet = (e) => {
    e.preventDefault();
    if (newWallet && !wallets.includes(newWallet)) {
      const updatedWallets = [...wallets, newWallet];
      setWallets(updatedWallets);
      localStorage.setItem('trackedWallets', JSON.stringify(updatedWallets));
      setNewWallet('');
      startMonitoring();
    }
  };

  const removeWallet = (wallet) => {
    const updatedWallets = wallets.filter(w => w !== wallet);
    setWallets(updatedWallets);
    localStorage.setItem('trackedWallets', JSON.stringify(updatedWallets));
    startMonitoring();
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <main className="container mx-auto px-4 py-8">
        <div className="bg-gray-800 rounded-lg shadow-lg">
          {/* Header */}
          <div className="px-6 py-4 border-b border-gray-700 flex justify-between items-center">
            <h1 className="text-xl font-bold">Wallet Tracker</h1>
            <span className={`px-3 py-1 rounded-full text-sm ${
              isMonitoring ? 'bg-green-900 text-green-300' : 'bg-yellow-900 text-yellow-300'
            }`}>
              {isMonitoring ? 'Monitoring' : 'Starting...'}
            </span>
          </div>

          {/* Wallet Management */}
          <div className="p-6 border-b border-gray-700">
            <form onSubmit={addWallet} className="mb-4">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newWallet}
                  onChange={(e) => setNewWallet(e.target.value)}
                  placeholder="Enter wallet address to track"
                  className="flex-1 px-4 py-2 bg-gray-700 rounded border border-gray-600 text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
                />
                <button
                  type="submit"
                  className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                >
                  Add Wallet
                </button>
              </div>
            </form>

            {/* Tracked Wallets */}
            <div className="space-y-2">
              {wallets.map((wallet) => (
                <div key={wallet} className="flex items-center justify-between px-4 py-3 bg-gray-700 rounded">
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-sm">{wallet.slice(0, 6)}...{wallet.slice(-4)}</span>
                    <button
                      onClick={() => copyToClipboard(wallet)}
                      className="p-1 hover:bg-gray-600 rounded"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                  </div>
                  <button
                    onClick={() => removeWallet(wallet)}
                    className="text-red-400 hover:text-red-300 p-1 rounded"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Transaction Table */}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Token</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Amount</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">SOL</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Wallet</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Time</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700">
                {transactions.map((tx, index) => (
                  <tr key={index} className="hover:bg-gray-700">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{tx.tokenSymbol}</span>
                        <button
                          onClick={() => copyToClipboard(tx.tokenAddress)}
                          className="text-gray-400 hover:text-gray-300"
                        >
                          <Copy className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                    <td className="px-6 py-4 font-mono">
                      {Number(tx.tokenAmount).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 font-mono">
                      {tx.solSpent.toFixed(3)}
                    </td>
                    <td className="px-6 py-4 font-mono text-sm">
                      {tx.wallet.slice(0, 4)}...{tx.wallet.slice(-4)}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      {new Date(tx.time).toLocaleString()}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex gap-3">
                        <a
                          href={`https://solscan.io/tx/${tx.signature}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-400 hover:text-blue-300"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </a>
                        <a
                          href={`https://birdeye.so/token/${tx.tokenAddress}?chain=solana`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-400 hover:text-blue-300"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}