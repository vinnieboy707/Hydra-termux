import { ethers } from "ethers";
import solc from "solc";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";
dotenv.config();

const BALANCER_VAULT = ethers.getAddress("0xBA12222222228d8Ba445958a75a0704d566BF2C8");
const SOL_PATH = path.join(process.cwd(), "contracts", "ChronosFlashArbitrageV2.sol");
const ARTIFACT_PATH = path.join(process.cwd(), "artifacts", "ChronosFlashArbitrageV2.json");

async function compileAndDeploy() {
    if (!fs.existsSync(SOL_PATH)) {
        throw new Error(`Missing source file: ${SOL_PATH}`);
    }

    const source = fs.readFileSync(SOL_PATH, "utf8");
    const input = {
        language: "Solidity",
        sources: {
            "ChronosFlashArbitrageV2.sol": { content: source }
        },
        settings: {
            optimizer: { enabled: true, runs: 200 },
            viaIR: true,
            outputSelection: {
                "*": {
                    "*": ["abi", "evm.bytecode.object"]
                }
            }
        }
    };

    console.log("⚙️ Compiling ChronosFlashArbitrageV2.sol...");
    const output = JSON.parse(solc.compile(JSON.stringify(input)));

    if (output.errors) {
        const fatal = output.errors.filter(e => e.severity === "error");
        if (fatal.length > 0) {
            console.error(fatal.map(e => e.formattedMessage).join("\n"));
            process.exit(1);
        }
    }

    const contractArtifact = output.contracts["ChronosFlashArbitrageV2.sol"]["ChronosFlashArbitrageV2"];
    const abi = contractArtifact.abi;
    const bytecode = "0x" + contractArtifact.evm.bytecode.object;

    fs.mkdirSync(path.dirname(ARTIFACT_PATH), { recursive: true });
    fs.writeFileSync(ARTIFACT_PATH, JSON.stringify({ abi, bytecode }, null, 2));
    console.log(`📦 Saved compiled artifact -> ${ARTIFACT_PATH} (${(bytecode.length - 2) / 2} bytes)`);

    const network = ethers.Network.from(42161);
    const provider = new ethers.JsonRpcProvider(
        process.env.ARBITRUM_RPC_URL || "https://arb1.arbitrum.io/rpc",
        network,
        { staticNetwork: network }
    );

    const pk = process.env.PRIVATE_KEY;
    if (!pk) throw new Error("PRIVATE_KEY missing in .env");

    const wallet = new ethers.Wallet(pk, provider);
    const balance = await provider.getBalance(wallet.address);
    console.log(`🔑 Deployer EOA: ${wallet.address} | Gas Balance: ${ethers.formatEther(balance)} ETH`);

    if (balance < ethers.parseEther("0.001")) {
        throw new Error("Insufficient ETH gas for deployment (need at least 0.001 ETH).");
    }

    const factory = new ethers.ContractFactory(abi, bytecode, wallet);
    console.log(`🚀 Deploying ChronosFlashArbitrageV2(balancerVault=${BALANCER_VAULT}) to Arbitrum One...`);

    const contract = await factory.deploy(BALANCER_VAULT);
    const deployTx = contract.deploymentTransaction();
    console.log(`⏳ Broadcasted Tx: ${deployTx.hash}. Waiting for confirmation...`);

    await contract.waitForDeployment();
    const deployedAddress = await contract.getAddress();

    const [onChainOwner, onChainVault] = await Promise.all([
        contract.owner(),
        contract.balancerVault()
    ]);

    console.log("================================================================");
    console.log(`✅ DEPLOYED ChronosFlashArbitrageV2: ${deployedAddress}`);
    console.log(`   Verified owner():         ${onChainOwner}`);
    console.log(`   Verified balancerVault(): ${onChainVault}`);
    console.log("================================================================");

    // Update CONTRACT_ADDRESS in .env
    const envPath = path.join(process.cwd(), ".env");
    let envContent = fs.existsSync(envPath) ? fs.readFileSync(envPath, "utf8") : "";
    if (/^CONTRACT_ADDRESS=/m.test(envContent)) {
        envContent = envContent.replace(/^CONTRACT_ADDRESS=.*/m, `CONTRACT_ADDRESS=${deployedAddress}`);
    } else {
        envContent += `\nCONTRACT_ADDRESS=${deployedAddress}\n`;
    }
    fs.writeFileSync(envPath, envContent);
    console.log(`📝 Updated CONTRACT_ADDRESS=${deployedAddress} in .env`);
}

compileAndDeploy().catch((err) => {
    console.error("❌ Deployment failed:", err);
    process.exit(1);
});
