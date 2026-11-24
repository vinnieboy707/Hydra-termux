const fs = require("fs");
const path = require("path");
const { ethers } = require("ethers");
require("dotenv").config();

async function main() {
    const solc = require("solc");
    const contractPath = path.join(process.cwd(), "contracts", "ChronosFlashArbitrageMaxOptimized.sol");
    const source = fs.readFileSync(contractPath, "utf8");

    const input = {
        language: "Solidity",
        sources: {
            "ChronosFlashArbitrageMaxOptimized.sol": { content: source }
        },
        settings: {
            viaIR: true,
            optimizer: { enabled: true, runs: 200 },
            outputSelection: { "*": { "*": ["abi", "evm.bytecode.object"] } }
        }
    };

    console.log("🛠️ Compiling Stack-Optimized Contract (viaIR: true)...");
    const output = JSON.parse(solc.compile(JSON.stringify(input)));

    if (output.errors) {
        for (const err of output.errors) {
            if (err.severity === "error") {
                throw new Error(err.formattedMessage);
            }
        }
    }

    const compiled = output.contracts["ChronosFlashArbitrageMaxOptimized.sol"]["ChronosFlashArbitrageMaxOptimized"];
    const abi = compiled.abi;
    const bytecode = "0x" + compiled.evm.bytecode.object;

    const rpcUrl = process.env.ARBITRUM_RPC_URL || "https://arb1.arbitrum.io/rpc";
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
    const balancerVault = "0xBA12222222228d8Ba445958a75a0704d566BF2C8";

    console.log(`🚀 Deploying from ${wallet.address} to Arbitrum One...`);
    const factory = new ethers.ContractFactory(abi, bytecode, wallet);
    const contract = await factory.deploy(balancerVault);
    await contract.waitForDeployment();

    const deployedAddress = await contract.getAddress();
    console.log(`✅ Deployed New Contract at: ${deployedAddress}`);

    const onchainCode = await provider.getCode(deployedAddress);
    const callbackSel = ethers.id("uniswapV3SwapCallback(int256,int256,bytes)").slice(2, 10);
    const flashSel = ethers.id("initiateFlashLoan(address,uint256,bytes)").slice(2, 10);
    console.log(`🔍 Verified Selectors -> initiateFlashLoan (0x${flashSel}): ${onchainCode.includes(flashSel)} | uniswapV3SwapCallback (0x${callbackSel}): ${onchainCode.includes(callbackSel)}`);

    const envPath = path.join(process.cwd(), ".env");
    let envContent = fs.existsSync(envPath) ? fs.readFileSync(envPath, "utf8") : "";
    if (envContent.includes("CONTRACT_ADDRESS=")) {
        envContent = envContent.replace(/CONTRACT_ADDRESS=.*/g, `CONTRACT_ADDRESS=${deployedAddress}`);
    } else {
        envContent += `\nCONTRACT_ADDRESS=${deployedAddress}\n`;
    }
    fs.writeFileSync(envPath, envContent);
    console.log(`📝 Updated .env with CONTRACT_ADDRESS=${deployedAddress}`);
}

main().catch(err => {
    console.error("Deployment Failed:", err.message);
    process.exit(1);
});
