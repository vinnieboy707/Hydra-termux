import admin from "firebase-admin";
import fs from "node:fs";
import path from "node:path";

let initialized = false;

function initFirebase() {
  if (initialized) return;
  const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH || path.resolve("config/firebase-service-account.json");
  if (fs.existsSync(serviceAccountPath)) {
    const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, "utf8"));
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
    initialized = true;
    console.log("🔥 Firebase Admin SDK initialized successfully.");
  } else {
    console.warn("⚠️ Warning: Firebase service account not found. Running in local ledger mode.");
  }
}

export async function syncTradeToFirebase(tradeData) {
  try {
    initFirebase();
    if (!initialized) return;
    const db = admin.firestore();
    await db.collection("chronos_trades").doc(tradeData.txHash || Date.now().toString()).set({
      ...tradeData,
      timestamp: admin.firestore.FieldValue.serverTimestamp()
    });
    console.log(`☁️ Trade synced to Firestore: ${tradeData.txHash}`);
  } catch (err) {
    console.error(`❌ Firebase sync error: ${err.message}`);
  }
}
