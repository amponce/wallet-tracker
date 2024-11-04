import { NextResponse } from 'next/server';

const HELIUS_API_KEY = process.env.HELIUS_API_KEY;
const HELIUS_API = `https://api.helius.xyz/v0`;
const SOL_ADDRESS = 'So11111111111111111111111111111111111111112';

let transactions = [];
let lastTransactionTimes = new Map();
let monitoringInterval = null;
let trackedWallets = new Set();
let tokenCache = new Map();

async function getTokenInfo(address) {
    // Don't look up SOL address
    if (address === SOL_ADDRESS) return null;
    
    if (tokenCache.has(address)) {
        return tokenCache.get(address);
    }

    try {
        // Try Birdeye first for token info
        const response = await fetch(`https://public-api.birdeye.so/public/token/${address}`, {
            headers: {
                'x-api-key': process.env.BIRDEYE_API_KEY
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            if (data.success) {
                const tokenInfo = {
                    symbol: data.data.symbol,
                    name: data.data.name,
                    decimals: data.data.decimals
                };
                tokenCache.set(address, tokenInfo);
                return tokenInfo;
            }
        }
    } catch (error) {
        console.error('Error fetching token info:', error);
    }

    return null;
}

async function getWalletTransactions(wallet) {
    try {
        const url = `${HELIUS_API}/addresses/${wallet}/transactions?api-key=${HELIUS_API_KEY}`;
        const response = await fetch(url);

        if (!response.ok) {
            throw new Error(`Helius API error: ${response.status}`);
        }

        const data = await response.json();
        
        // Filter for actual token buys (exclude SOL transfers)
        const buyTxs = data.filter(tx => {
            // Look for token transfers to the wallet
            const tokenTransfer = tx.tokenTransfers?.find(t => 
                t.toUserAccount === wallet && 
                t.mint !== SOL_ADDRESS
            );

            // Look for SOL spent
            const solSpent = tx.nativeTransfers?.find(t =>
                t.fromUserAccount === wallet &&
                t.amount > 0
            );

            return tokenTransfer && solSpent;
        });

        // Process transactions with token info
        const processedTxs = await Promise.all(buyTxs.map(async tx => {
            const tokenTransfer = tx.tokenTransfers.find(t => 
                t.toUserAccount === wallet && 
                t.mint !== SOL_ADDRESS
            );
            
            if (!tokenTransfer) return null;

            const tokenInfo = await getTokenInfo(tokenTransfer.mint);
            
            // Calculate SOL spent
            const solSpent = tx.nativeTransfers
                .filter(t => t.fromUserAccount === wallet)
                .reduce((sum, t) => sum + t.amount, 0) / 1e9;

            return {
                signature: tx.signature,
                wallet,
                tokenAddress: tokenTransfer.mint,
                tokenSymbol: tokenInfo?.symbol || 'Unknown',
                tokenName: tokenInfo?.name || 'Unknown Token',
                tokenAmount: tokenTransfer.tokenAmount,
                solSpent,
                time: new Date(tx.timestamp * 1000).toISOString(),
                type: 'BUY',
                timestamp: tx.timestamp
            };
        }));

        return processedTxs.filter(tx => tx !== null);
    } catch (error) {
        console.error(`Error fetching transactions for ${wallet}:`, error);
        return [];
    }
}

async function monitorWallets() {
    try {
        const newTransactions = [];
        
        for (const wallet of trackedWallets) {
            const newTxs = await getWalletTransactions(wallet);
            const lastTime = lastTransactionTimes.get(wallet) || 0;
            
            const recentTxs = newTxs.filter(tx => tx.timestamp > lastTime);

            if (recentTxs.length > 0) {
                lastTransactionTimes.set(wallet, Math.max(...recentTxs.map(tx => tx.timestamp)));
                newTransactions.push(...recentTxs);
            }
        }

        if (newTransactions.length > 0) {
            // Sort by timestamp descending (newest first)
            transactions.unshift(...newTransactions);
            transactions.sort((a, b) => b.timestamp - a.timestamp);
            transactions = transactions.slice(0, 100); // Keep last 100
        }
    } catch (error) {
        console.error('Error monitoring wallets:', error);
    }
}

export async function POST(request) {
    try {
        const body = await request.json();
        const { wallets = [] } = body;

        trackedWallets = new Set(wallets);
        
        if (monitoringInterval) {
            clearInterval(monitoringInterval);
        }

        // Get initial transactions
        transactions = [];
        for (const wallet of trackedWallets) {
            const walletTxs = await getWalletTransactions(wallet);
            transactions.push(...walletTxs);
        }

        // Sort by timestamp descending
        transactions.sort((a, b) => b.timestamp - a.timestamp);
        transactions = transactions.slice(0, 100);

        // Update last transaction times
        for (const wallet of trackedWallets) {
            const walletTxs = transactions.filter(tx => tx.wallet === wallet);
            if (walletTxs.length > 0) {
                lastTransactionTimes.set(wallet, Math.max(...walletTxs.map(tx => tx.timestamp)));
            }
        }

        monitoringInterval = setInterval(monitorWallets, 60000);
        
        return NextResponse.json({ 
            message: 'Monitoring started',
            wallets: Array.from(trackedWallets)
        });
    } catch (error) {
        console.error('Error in POST handler:', error);
        return NextResponse.json({ error: 'Failed to start monitoring' }, { status: 500 });
    }
}

export async function GET() {
    // Sort by timestamp before sending
    const sortedTransactions = [...transactions].sort((a, b) => b.timestamp - a.timestamp);
    return NextResponse.json(sortedTransactions);
}