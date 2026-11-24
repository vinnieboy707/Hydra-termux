import { ethers } from "ethers";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";
dotenv.config();

const network = ethers.Network.from(42161);
const provider = new ethers.JsonRpcProvider(
    process.env.ARBITRUM_RPC_URL || "https://arb1.arbitrum.io/rpc",
    network,
    { staticNetwork: network }
);

const contractAddr = ethers.getAddress(
    (process.env.CONTRACT_ADDRESS || "0x9dFF36775eAB4BbAe7c03eCb13ce8636791C4326").toLowerCase()
);

// Known Solidity function signatures to test against deployed PUSH4 opcodes
const CANDIDATE_SIGNATURES = [
    "initiateFlashLoan(address,uint256,bytes)",
    "executeOperation(address,uint256,uint256,address,bytes)",
    "uniswapV3SwapCallback(int256,int256,bytes)",
    "withdraw(address)",
    "withdraw(address,uint256)",
    "withdraw(uint256)",
    "withdraw()",
    "withdrawToken(address)",
    "withdrawToken(address,uint256)",
    "withdrawTokens(address)",
    "withdrawERC20(address)",
    "withdrawERC20(address,uint256)",
    "withdrawAll(address)",
    "withdrawAll()",
    "withdrawETH()",
    "withdrawETH(uint256)",
    "withdrawProfit(address)",
    "withdrawProfits(address)",
    "sweep(address)",
    "sweep(address,uint256)",
    "sweepTokens(address)",
    "sweepETH()",
    "rescueTokens(address)",
    "rescueERC20(address,uint256)",
    "emergencyWithdraw(address)",
    "emergencyWithdraw()",
    "owner()",
    "transferOwnership(address)"
];

async function inspectBytecode() {
    const bytecode = await provider.getCode(contractAddr);
    if (!bytecode || bytecode === "0x") {
        console.error(`❌ No contract bytecode found at ${contractAddr} on Arbitrum One.`);
        return;
    }

    console.log("================================================================");
    console.log(`📜 Contract:      ${contractAddr}`);
    console.log(`📦 Bytecode Size: ${(bytecode.length - 2) / 2} bytes`);
    console.log("----------------------------------------------------------------");

    // Extract all PUSH4 (0x63) 4-byte selectors from EVM runtime bytecode
    const hex = bytecode.slice(2);
    const extractedSelectors = new Set();
    for (let i = 0; i < hex.length - 10; i += 2) {
        const opcode = hex.slice(i, i + 2);
        if (opcode === "63") {
            const selector = "0x" + hex.slice(i + 2, i + 10).toLowerCase();
            if (selector !== "0xffffffff" && selector !== "0x00000000") {
                extractedSelectors.add(selector);
            }
        }
        // Skip immediate bytes for PUSH1..PUSH32 (0x60..0x7f)
        const opVal = parseInt(opcode, 16);
        if (opVal >= 0x60 && opVal <= 0x7f) {
            i += (opVal - 0x5f) * 2;
        }
    }

    const matched = [];
    const unmatched = new Set(extractedSelectors);

    for (const sig of CANDIDATE_SIGNATURES) {
        const sel = ethers.id(sig).slice(0, 10).toLowerCase();
        if (extractedSelectors.has(sel)) {
            matched.push({ selector: sel, signature: sig });
            unmatched.delete(sel);
        }
    }

    console.log("✅ Matched Function Selectors:");
    if (matched.length === 0) {
        console.log("   (None matched standard candidate list)");
    } else {
        for (const m of matched) {
            console.log(`   ${m.selector}  ->  ${m.signature}`);
        }
    }

    console.log("\n🔍 Remaining Unmatched PUSH4 Selectors in Bytecode:");
    console.log("  ", [...unmatched].join(", ") || "None");

    // Also scan local contracts/artifacts directory if present for exact ABI match
    const localSol = path.join(process.cwd(), "contracts", "ChronosFlashArb.sol");
    if (fs.existsSync(localSol)) {
        console.log("\n📄 Local contracts/ChronosFlashArb.sol withdrawal/sweep lines:");
        const lines = fs.readFileSync(localSol, "utf8").split("\n");
        lines.filter(l => /function\s+(withdraw|sweep|rescue|emergency)/i.test(l))
             .forEach(l => console.log("  ", l.trim()));
    }
    console.log("================================================================");
}

inspectBytecode().catch(console.error);
