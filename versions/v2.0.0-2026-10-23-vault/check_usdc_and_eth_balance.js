'use strict';
const { ethers } = require('ethers');

const walletAddresses = [
    "0xB2B33E9464c060aF8e6B95eaF77FE3954e7E13A0"
];

const usdcContracts = {
    "Arbitrum One": {
        rpc: "https://arb1.arbitrum.io/rpc",
        chainId: 42161,
        usdc: "0xaf88d065e77c8cc2239301c5e013f01b493fcff5",
        decimals: 6
    },
    "Base": {
        rpc: "https://mainnet.base.org",
        chainId: 8453,
        usdc: "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
        decimals: 6
    }
};

const ERC20_ABI = [
    "function balanceOf(address owner) view returns (uint256)"
];

async function checkTokenAndEthBalances() {
    console.log('========================================================');
    console.log('CHRONOS OS // ROBUST COMPREHENSIVE ETH & USDC BALANCE AUDIT');
    console.log('========================================================');

    for (const addr of walletAddresses) {
        console.log(`\n--------------------------------------------------------`);
        console.log(`🔍 Auditing Wallet: ${addr}`);
        console.log(`--------------------------------------------------------`);

        for (const [netName, netConfig] of Object.entries(usdcContracts)) {
            try {
                const networkObj = new ethers.Network(netName.toLowerCase().replace(/\s+/g, '-'), netConfig.chainId);
                const provider = new ethers.JsonRpcProvider(netConfig.rpc, networkObj, { staticNetwork: networkObj });
                
                // 1. Check ETH balance (Gas Money)
                let ethFormatted = "0.0";
                try {
                    const ethBalance = await provider.getBalance(addr);
                    ethFormatted = ethers.formatEther(ethBalance);
                } catch (ethErr) {
                    console.warn(`⚠️ [${netName}] ETH balance query failed: ${ethErr.message}`);
                }

                // 2. Check USDC balance with robust contract code check & BAD_DATA catch
                let usdcFormatted = "0.0";
                try {
                    const code = await provider.getCode(netConfig.usdc);
                    if (code && code !== '0x') {
                        const usdcContract = new ethers.Contract(netConfig.usdc, ERC20_ABI, provider);
                        const usdcBalance = await usdcContract.balanceOf(addr);
                        usdcFormatted = ethers.formatUnits(usdcBalance, netConfig.decimals);
                    } else {
                        console.warn(`⚠️ [${netName}] USDC contract not deployed or unreachable at ${netConfig.usdc}`);
                    }
                } catch (usdcErr) {
                    console.warn(`⚠️ [${netName}] USDC query recovered from error: ${usdcErr.code || usdcErr.message}`);
                }

                console.log(`🌐 [${netName}]`);
                console.log(`   - Native ETH (Gas): ${ethFormatted} ETH`);
                console.log(`   - USDC Balance (Capital): $${usdcFormatted} USDC`);
            } catch (err) {
                console.warn(`⚠️ [${netName}] RPC provider connection error: ${err.message}`);
            }
        }
    }
    console.log('\n========================================================');
    console.log('ROBUST AUDIT COMPLETED SUCCESSFULLY.');
    console.log('========================================================');
}

if (require.main === module) {
    checkTokenAndEthBalances().catch(console.error);
}

module.exports = { checkTokenAndEthBalances };
