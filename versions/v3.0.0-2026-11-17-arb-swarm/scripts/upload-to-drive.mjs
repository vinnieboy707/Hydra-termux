import fs from "fs";
import path from "path";
import { createRequire } from "module";
import dotenv from "dotenv";
dotenv.config();

const require = createRequire(import.meta.url);
const { google } = require("googleapis");
const archiver = require("archiver");

const FOLDER_ID = process.env.GOOGLE_DRIVE_FOLDER_ID;

async function archiveWorkspace() {
    const zipPath = path.join(process.cwd(), `chronos_backup_${Date.now()}.zip`);
    const output = fs.createWriteStream(zipPath);
    const archive = archiver("zip", { zlib: { level: 9 } });

    return new Promise((resolve, reject) => {
        output.on("close", () => resolve(zipPath));
        archive.on("error", (err) => reject(err));
        archive.pipe(output);

        if (fs.existsSync("logs")) archive.directory(path.join(process.cwd(), "logs"), "logs");
        if (fs.existsSync("data")) archive.directory(path.join(process.cwd(), "data"), "data");
        if (fs.existsSync("artifacts")) archive.directory(path.join(process.cwd(), "artifacts"), "artifacts");
        if (fs.existsSync(".env")) archive.file(path.join(process.cwd(), ".env"), { name: ".env" });

        archive.finalize();
    });
}

async function uploadBackup() {
    const zipPath = await archiveWorkspace();
    console.log(`📦 Workspace archived to: ${zipPath}`);

    const auth = new google.auth.GoogleAuth({
        keyFile: process.env.GOOGLE_APPLICATION_CREDENTIALS,
        scopes: ["https://www.googleapis.com/auth/drive.file"]
    });

    const drive = google.drive({ version: "v3", auth });
    const fileMetadata = {
        name: path.basename(zipPath),
        parents: FOLDER_ID ? [FOLDER_ID] : undefined
    };
    const media = {
        mimeType: "application/zip",
        body: fs.createReadStream(zipPath)
    };

    const response = await drive.files.create({
        requestBody: fileMetadata,
        media: media,
        fields: "id, name"
    });

    console.log(`☁️ [GOOGLE DRIVE] Backup uploaded successfully! File ID: ${response.data.id}`);
    fs.unlinkSync(zipPath);
}

uploadBackup().catch(console.error);
