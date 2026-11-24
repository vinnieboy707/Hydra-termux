import fs from "fs";
import path from "path";
import zlib from "zlib";
import { createRequire } from "module";
import dotenv from "dotenv";
dotenv.config();

const require = createRequire(import.meta.url);
const { google } = require("googleapis");
const FOLDER_ID = process.env.GOOGLE_DRIVE_FOLDER_ID;

function getAllFiles(dirPath, arrayOfFiles) {
    const files = fs.readdirSync(dirPath);
    arrayOfFiles = arrayOfFiles || [];
    files.forEach((file) => {
        if (file === "node_modules" || file === ".git" || file.endsWith(".zip") || file.endsWith(".gz") || file === "service_account.json") return;
        const fullPath = path.join(dirPath, file);
        if (fs.statSync(fullPath).isDirectory()) {
            arrayOfFiles = getAllFiles(fullPath, arrayOfFiles);
        } else {
            arrayOfFiles.push(fullPath);
        }
    });
    return arrayOfFiles;
}

async function uploadSmartContractsAndDocs() {
    const targets = ["contracts", "artifacts", "scripts", "logs", "data"];
    let allFiles = [];
    targets.forEach(t => {
        if (fs.existsSync(t)) {
            allFiles = allFiles.concat(getAllFiles(t));
        }
    });
    if (fs.existsSync(".env")) allFiles.push(".env");

    const bundleName = `chronos_workspace_backup_${Date.now()}.json`;
    const bundleData = {};

    for (const file of allFiles) {
        try {
            bundleData[file] = fs.readFileSync(file, "utf8");
        } catch {}
    }

    const jsonString = JSON.stringify(bundleData, null, 2);
    const compressed = zlib.gzipSync(jsonString);
    const uploadPath = path.join(process.cwd(), bundleName + ".gz");
    fs.writeFileSync(uploadPath, compressed);

    console.log(`📦 Bundled ${Object.keys(bundleData).length} files into ${uploadPath} (${(compressed.length / 1024).toFixed(1)} KB)`);

    // Use Application Default Credentials (ADC) / local Google auth
    const auth = new google.auth.GoogleAuth({
        scopes: ["https://www.googleapis.com/auth/drive.file"]
    });

    const drive = google.drive({ version: "v3", auth });
    const fileMetadata = {
        name: path.basename(uploadPath),
        parents: FOLDER_ID ? [FOLDER_ID] : undefined
    };
    const media = {
        mimeType: "application/gzip",
        body: fs.createReadStream(uploadPath)
    };

    const response = await drive.files.create({
        requestBody: fileMetadata,
        media: media,
        fields: "id, name"
    });

    console.log(`☁️ [GOOGLE DRIVE] Smart contracts, scripts, and logs uploaded successfully! File ID: ${response.data.id}`);
    fs.unlinkSync(uploadPath);
}

uploadSmartContractsAndDocs().catch((err) => {
    console.error("❌ Upload failed:", err);
    process.exit(1);
});
