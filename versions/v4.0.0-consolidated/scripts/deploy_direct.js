import fs from 'fs';
import path from 'path';
import solc from 'solc';
import { ethers } from 'ethers';
import dotenv from 'dotenv';
dotenv.config();

async function main() {
    console.log("🚀 [DirectDeployer] Starting standalone compilation & deployment...");

    // 1. Read Solidity Contract Source
    const contractPath = path.resolve('contracts', 'ChronosFlashArb.sol');
    if (!fs.existsSync(contractPath)) {
        throw new Error(`Contract not found at ${contractPath}`);
    }
    const sourceCode = fs.readFileSync(contractPath, 'utf8');

    // 2. Setup Solc Standard Input JSON for OpenZeppelin imports
    function findImports(importPath) {
        try {
            if (importPath.startsWith('@openzeppelin/')) {
                const resolvedPath = path.resolve('node_modules', importPath);
                return { contents: fs.readFileSync(resolvedPath, 'utf8') };
            }
        } catch (e) {
            return { error: 'File not found' };
        }
        return { error: 'File not found' };
    }

    const input = {
        language: 'Solidity',
        sources: {
            'ChronosFlashArb.sol': { content: sourceCode }
        },
        settings: {
            optimizer: { enabled: true, runs: 200 },
            outputSelection: {
                '*': {
                    '*': ['abi', 'evm.bytecode']
                }
            }
        }
    };

    console.log("📦 [Compiler] Compiling ChronosFlashArb.sol via solc...");
    const output = JSON.parse(solc.compile(JSON.stringify(input), { import: findImports }));

    if (output.errors) {
        let hasError = false;
        output.errors.forEach(err => {
            console.error(err.formattedMessage);
            if (err.severity === 'error') hasError = true;
        });
        if (hasError) throw new Error("Compilation failed with errors.");
    }

    const contractData = output.contracts['ChronosFlashArb.sol']['ChronosFlashArb'];
    const abi = contractData.abi;
    const bytecode = contractData.evm.bytecode.object;
    console.log("✅ [Compiler] Compilation successful.");

    // 3. Connect to Arbitrum Sequencer with Static Network Configuration
    const rpcUrl = process.env.ARBITRUM_SEQUENCER_URL || 'https://arb1-sequencer.arbitrum.io/rpc';
    const customNetwork = new ethers.Network("arbitrum", 42161);
    const provider = new ethers.JsonRpcProvider(rpcUrl, customNetwork, { staticNetwork: customNetwork });

    const privateKey = process.env.PRIVATE_KEY;
    if (!privateKey) {
        throw new Error("❌ PRIVATE_KEY missing in .env environment variables.");
    }

    const wallet = new ethers.Wallet(privateKey, provider);
    console.log(`👤 Deployer Address: ${wallet.address}`);

    const balance = await provider.getBalance(wallet.address);
    console.log(`💰 Wallet Balance: ${ethers.formatEther(balance)} ETH`);

    // 4. Deploy Contract
    console.log("🚀 [Deployer] Broadcasting deployment transaction to Arbitrum Sequencer...");
    const factory = new ethers.ContractFactory(abi, bytecode, wallet);
    const contract = await factory.deploy();

    await contract.waitForDeployment();
    const address = await contract.getAddress();

    console.log(`✅ [Success] ChronosFlashArb deployed to: ${address}`);

    // 5. Save deployment address to state store
    const deploymentRecord = {
        address,
        network: 'arbitrum',
        timestamp: new Date().toISOString()
    };
    fs.writeFileSync(path.resolve('data', 'deployment.json'), JSON.stringify(deploymentRecord, null, 2));
    console.log("💾 Deployment record saved to data/deployment.json");
}

main().catch(err => {
    console.error("❌ [Deployer] Error:", err.message);
    process.exit(1);
});
