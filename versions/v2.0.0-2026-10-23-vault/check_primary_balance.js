import { ethers } from "ethers";

async function checkBalance() {
  const provider = new ethers.JsonRpcProvider("https://arb1.arbitrum.io/rpc");
  // Use lowercase or properly checksummed address format for ethers v6
  const rawAddress = "0x52a7b22f26189912c05b22b122a1239f8263158a";
  const checksumAddress = ethers.getAddress(rawAddress);
  
  console.log("========================================================");
  console.log("CHRONOS OS // PRIMARY SWARM EXECUTOR WALLET CHECK");
  console.log("========================================================");
  try {
    const balance = await provider.getBalance(checksumAddress);
    console.log(`[+] Executor Address: ${checksumAddress}`);
    console.log(`[+] Live Balance: ${ethers.formatEther(balance)} ETH`);
  } catch (err) {
    console.log("[!] Balance check error:", err.message);
  }
}
checkBalance();
