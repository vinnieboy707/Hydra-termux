require('dotenv').config();
const { ethers } = require('ethers');
const fs = require('fs');
const solc = require('solc');

async function main() {
    console.log("🚀 [Chronos OS] Initializing direct Solidity compilation & deployment...");

    const rpcUrl = process.env.ARBITRUM_RPC_URL || "https://arb1.arbitrum.io/rpc";
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    
    const privateKey = process.env.PRIVATE_KEY;
    if (!privateKey) {
        console.error("❌ [Error] PRIVATE_KEY not found in environment.");
        process.exit(1);
    }
    const wallet = new ethers.Wallet(privateKey, provider);
    console.log(`👛 [Deployer]: ${wallet.address}`);

    // Read contract source
    const sourceCode = fs.readFileSync('./contracts/ChronosFlashArbitrageMaxOptimized.sol', 'utf8');

    // Setup solc input
    const input = {
        language: 'Solidity',
        sources: {
            'ChronosFlashArbitrageMaxOptimized.sol': { content: sourceCode }
        },
        settings: {
            optimizer: { enabled: true, runs: 200 },
            outputSelection: {
                '*': { '*': ['abi', 'evm.bytecode'] }
            }
        }
    };

    console.log("⚙️ [Solc] Compiling contract natively...");
    const output = JSON.parse(solc.compile(JSON.stringify(input)));
    
    if (output.errors) {
        output.errors.forEach(err => console.error(err.formattedMessage));
        if (output.errors.some(e => e.severity === 'error')) {
            process.exit(1);
        }
    }

    const contractFile = output.contracts['ChronosFlashArbitrageMaxOptimized.sol']['ChronosFlashArbitrageMaxOptimized'];
    const abi = contractFile.abi;
    const bytecode = contractFile.evm.bytecode.object;

    console.log("📦 [Deployment] Broadcasting transaction to Arbitrum One...");
    const factory = new ethers.ContractFactory(abi, bytecode, wallet);
    
    // Balancer V2 Vault on Arbitrum One
    const BALANCER_VAULT = "0xBA12222222228d8Ba445958a75a0704d566BF2C8";
    
    const contract = await factory.deploy(BALANCER_VAULT);
    console.log(`⏳ [Pending] Tx Hash: ${contract.deploymentTransaction().hash}`);
    
    await contract.waitForDeployment();
    const address = await contract.getAddress();
    
    console.log(`✅ [Success] ChronosFlashArbitrageMaxOptimized deployed to: ${address}`);
}

main().catch(console.error);
