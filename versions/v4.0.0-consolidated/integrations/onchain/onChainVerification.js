// ---------------------------------------------------------------------------
// IMPORTED INTO CHRONOS v4.0.0 (consolidation, 2026-11-24)
// Source project : vinnieboy707/Assets-in-control-
// Original path  : Assets-in-control-/server/onChainVerification.js
// Imported verbatim — not modified. Reads all secrets/RPC URLs from env vars.
// ---------------------------------------------------------------------------

const { ethers } = require('ethers');

/**
 * On-Chain Verification Utilities
 * Provides externally verifiable blockchain operations
 */

// Block explorer URLs for different chains
const BLOCK_EXPLORERS = {
  ethereum: 'https://etherscan.io',
  polygon: 'https://polygonscan.com',
  binance: 'https://bscscan.com',
  sepolia: 'https://sepolia.etherscan.io',
  mumbai: 'https://mumbai.polygonscan.com'
};

/**
 * Get block explorer URL for a transaction
 * @param {string} txHash - Transaction hash
 * @param {string} chain - Chain name
 * @returns {string} Block explorer URL
 */
function getTransactionUrl(txHash, chain) {
  const explorer = BLOCK_EXPLORERS[chain.toLowerCase()] || BLOCK_EXPLORERS.ethereum;
  return `${explorer}/tx/${txHash}`;
}

/**
 * Get block explorer URL for an address
 * @param {string} address - Wallet address
 * @param {string} chain - Chain name
 * @returns {string} Block explorer URL
 */
function getAddressUrl(address, chain) {
  const explorer = BLOCK_EXPLORERS[chain.toLowerCase()] || BLOCK_EXPLORERS.ethereum;
  return `${explorer}/address/${address}`;
}

/**
 * Get block explorer URL for a block
 * @param {number} blockNumber - Block number
 * @param {string} chain - Chain name
 * @returns {string} Block explorer URL
 */
function getBlockUrl(blockNumber, chain) {
  const explorer = BLOCK_EXPLORERS[chain.toLowerCase()] || BLOCK_EXPLORERS.ethereum;
  return `${explorer}/block/${blockNumber}`;
}

/**
 * Verify transaction on-chain and get receipt
 * @param {string} txHash - Transaction hash
 * @param {ethers.Provider} provider - Ethers provider
 * @returns {Promise<Object>} Transaction receipt with verification data
 */
async function verifyTransaction(txHash, provider) {
  try {
    const receipt = await provider.getTransactionReceipt(txHash);
    
    if (!receipt) {
      return {
        verified: false,
        error: 'Transaction not found or not mined yet'
      };
    }

    const block = await provider.getBlock(receipt.blockNumber);
    const currentBlock = await provider.getBlockNumber();
    const confirmations = currentBlock - receipt.blockNumber + 1; // +1 so a mined tx has at least 1 confirmation

    return {
      verified: true,
      txHash: receipt.hash,
      blockNumber: receipt.blockNumber,
      blockHash: receipt.blockHash,
      confirmations: confirmations,
      timestamp: block.timestamp,
      from: receipt.from,
      to: receipt.to,
      gasUsed: receipt.gasUsed.toString(),
      status: receipt.status === 1 ? 'success' : 'failed',
      logs: receipt.logs.length,
      contractAddress: receipt.contractAddress
    };
  } catch (error) {
    return {
      verified: false,
      error: error.message
    };
  }
}

/**
 * Get on-chain balance with verification data
 * @param {string} address - Wallet address
 * @param {ethers.Provider} provider - Ethers provider
 * @param {number} blockNumber - Optional block number for historical balance
 * @returns {Promise<Object>} Balance with verification data
 */
async function getVerifiableBalance(address, provider, blockNumber = null) {
  try {
    const balance = await provider.getBalance(address, blockNumber || 'latest');
    const currentBlock = await provider.getBlockNumber();
    const block = blockNumber ? await provider.getBlock(blockNumber) : await provider.getBlock(currentBlock);

    return {
      verified: true,
      address: address,
      balance: ethers.formatEther(balance),
      balanceWei: balance.toString(),
      blockNumber: block.number,
      blockHash: block.hash,
      timestamp: block.timestamp,
      verifiableAt: blockNumber || currentBlock
    };
  } catch (error) {
    return {
      verified: false,
      error: error.message
    };
  }
}

/**
 * Create verifiable transaction log entry
 * @param {Object} txData - Transaction data
 * @param {string} chain - Chain name
 * @returns {Object} Verifiable transaction log
 */
function createVerifiableLog(txData, chain) {
  const timestamp = new Date().toISOString();
  
  return {
    timestamp,
    chain,
    txHash: txData.hash,
    from: txData.from,
    to: txData.to,
    value: txData.value ? ethers.formatEther(txData.value) : '0',
    blockNumber: txData.blockNumber,
    explorerUrl: txData.hash ? getTransactionUrl(txData.hash, chain) : null,
    verifiable: true,
    verificationData: {
      blockHash: txData.blockHash,
      gasUsed: txData.gasUsed ? txData.gasUsed.toString() : null,
      status: txData.status
    }
  };
}

/**
 * Verify smart contract code on-chain
 * @param {string} contractAddress - Contract address
 * @param {ethers.Provider} provider - Ethers provider
 * @returns {Promise<Object>} Contract verification data
 */
async function verifyContract(contractAddress, provider) {
  try {
    const code = await provider.getCode(contractAddress);
    
    if (code === '0x') {
      return {
        verified: false,
        isContract: false,
        message: 'Address is not a contract'
      };
    }

    return {
      verified: true,
      isContract: true,
      contractAddress: contractAddress,
      bytecodeHash: ethers.keccak256(code),
      bytecodeSize: code.length / 2 - 1 // Remove '0x' and convert to bytes
    };
  } catch (error) {
    return {
      verified: false,
      error: error.message
    };
  }
}

/**
 * Get transaction history for an address (from events/logs)
 * @param {string} address - Wallet address
 * @param {ethers.Provider} provider - Ethers provider
 * @param {number} fromBlock - Starting block
 * @param {number} toBlock - Ending block
 * @returns {Promise<Array>} Transaction history
 */
async function getTransactionHistory(address, provider, fromBlock = 0, toBlock = 'latest') {
  try {
    const currentBlock = await provider.getBlockNumber();
    const endBlock = toBlock === 'latest' ? currentBlock : toBlock;
    
    // Limit the range to avoid RPC limits
    const maxRange = 10000;
    const actualFromBlock = Math.max(fromBlock, endBlock - maxRange);

    const logs = await provider.getLogs({
      fromBlock: actualFromBlock,
      toBlock: endBlock,
      address: address
    });

    return logs.map(log => ({
      blockNumber: log.blockNumber,
      blockHash: log.blockHash,
      txHash: log.transactionHash,
      address: log.address,
      topics: log.topics,
      data: log.data,
      logIndex: log.index
    }));
  } catch (error) {
    console.error('Error fetching transaction history:', error);
    return [];
  }
}

module.exports = {
  getTransactionUrl,
  getAddressUrl,
  getBlockUrl,
  verifyTransaction,
  getVerifiableBalance,
  createVerifiableLog,
  verifyContract,
  getTransactionHistory,
  BLOCK_EXPLORERS
};
