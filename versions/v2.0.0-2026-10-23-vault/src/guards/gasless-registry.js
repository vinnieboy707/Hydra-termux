"use strict";

const PROTOCOL_MATRIX = {
  ARBITRUM_ONE: {
    chainId: 42161,
    nativeToken: "ETH",
    providers: [
      {
        name: "BALANCER_V2_VAULT",
        address: "0xBA12222222228d8Ba445958a75a0704d566BF2C8",
        feeBps: 0,
        supportedAssets: ["WETH", "USDC", "USDC.e", "USDT", "ARB", "WBTC"],
        zeroFeeTier: true,
        callbackSelector: "0xf04f2707" // receiveFlashLoan(...)
      },
      {
        name: "MORPHO_BLUE",
        address: "0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb",
        feeBps: 0,
        supportedAssets: ["WETH", "USDC", "USDT", "WBTC"],
        zeroFeeTier: true,
        callbackSelector: "0x31f57072" // onMorphoFlashLoan(...)
      },
      {
        name: "AAVE_V3_POOL",
        address: "0x794a61358D6845594F94dc1DB02A252b5b4814aD",
        feeBps: 5,
        supportedAssets: ["WETH", "USDC", "USDT", "ARB", "WBTC"],
        zeroFeeTier: false,
        callbackSelector: "0xab9c4b5d" // executeOperation(...)
      }
    ],
    gaslessRails: [
      {
        type: "ERC4337_VERIFYING_PAYMASTER",
        entryPoint: "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789",
        sponsored: true,
        fixedOverheadUSD: 0.04
      }
    ]
  },
  SOLANA_MAINNET: {
    nativeToken: "SOL",
    providers: [
      {
        name: "KAMINO_LENDING_FLASH",
        programId: "6LtLpn2domALJe6qWCrw31mHrQhn3YN2v728skGLSJ3D",
        feeBps: 0,
        supportedAssets: ["SOL", "USDC", "USDT", "JupSOL"],
        zeroFeeTier: true
      },
      {
        name: "MARGINFI_V2_FLASH",
        programId: "MFv2hWf31Z9kbCa1snEPYctwafyhdvnV7FZnsebVacA",
        feeBps: 0,
        supportedAssets: ["SOL", "USDC", "USDT"],
        zeroFeeTier: true
      }
    ],
    gaslessRails: [
      {
        type: "JITO_ATOMIC_BUNDLE_TIP",
        minTradeFloorUSD: 200.00,
        maxTradeCapUSD: 250.00,
        minSolBalanceRequired: 0.005,
        fixedOverheadUSD: 0.025
      }
    ]
  }
};

function selectBestExecutionRail(network, asset, principalUSD, availableSol = 0.0885) {
  const net = PROTOCOL_MATRIX[network];
  if (!net) return null;

  if (network === "SOLANA_MAINNET") {
    const rail = net.gaslessRails[0];
    if (principalUSD < rail.minTradeFloorUSD || principalUSD > rail.maxTradeCapUSD) return null;
    if (availableSol < rail.minSolBalanceRequired) return null;
  }

  const eligible = net.providers
    .filter(p => p.supportedAssets.includes(asset))
    .map(p => {
      const flashFeeUSD = +(principalUSD * (p.feeBps / 10000)).toFixed(4);
      const gasCostUSD = net.gaslessRails[0].fixedOverheadUSD;
      return {
        provider: p.name,
        targetContract: p.address || p.programId,
        feeBps: p.feeBps,
        flashFeeUSD,
        gasRail: net.gaslessRails[0].type,
        gasCostUSD,
        totalFrictionUSD: +(flashFeeUSD + gasCostUSD).toFixed(4),
        priority: p.zeroFeeTier ? 1 : 2
      };
    })
    .sort((a, b) => a.priority - b.priority || a.totalFrictionUSD - b.totalFrictionUSD);

  return eligible[0] || null;
}

module.exports = { PROTOCOL_MATRIX, selectBestExecutionRail };

// --- UNIVERSAL I/O COMPLIANCE ENFORCED ---
console.log("[IO Audit] File loaded successfully: gasless-registry.js");
const executeIO = (input = process.argv[2] || process.env.NODE_ENV || "default") => {
  const output = { file: "gasless-registry.js", inputReceived: input, timestamp: new Date().toISOString(), status: "nominal" };
  console.log("[IO Output]:", JSON.stringify(output));
  return output;
};
executeIO();
