'use strict';

/**
 * CHRONOS OS // GOOGLE DRIVE INTEGRATION & SYNC CLIENT
 * Mandate: Programmatically connect to Google Drive, list files, download documents,
 * and securely merge remote environment configurations (.env) and data into the system.
 */

const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');

class GoogleDriveClient {
    constructor({ credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS || './service_account.json', log = console } = {}) {
        this.credentialsPath = path.resolve(credentialsPath);
        this.log = log;
        this.auth = null;
        this.drive = null;
    }

    /**
     * Initializes authentication with Google Drive using a Service Account JSON or API Key.
     */
    async initialize() {
        if (!fs.existsSync(this.credentialsPath)) {
            throw new Error(`Google Drive credentials file not found at: ${this.credentialsPath}. Please provide service_account.json.`);
        }

        this.auth = new google.auth.GoogleAuth({
            keyFile: this.credentialsPath,
            scopes: ['https://www.googleapis.com/auth/drive.readonly', 'https://www.googleapis.com/auth/drive.file']
        });

        this.drive = google.drive({ version: 'v3', auth: this.auth });
        this.log.info('✅ [GoogleDriveClient]: Successfully authenticated with Google Drive.');
        return true;
    }

    /**
     * Lists files in Google Drive matching an optional query.
     */
    async listFiles(query = "trashed = false") {
        if (!this.drive) await this.initialize();
        const res = await this.drive.files.list({
            q: query,
            pageSize: 50,
            fields: 'files(id, name, mimeType, modifiedTime)',
        });
        return res.data.files || [];
    }

    /**
     * Downloads a file from Google Drive by file ID.
     */
    async downloadFile(fileId, destinationPath) {
        if (!this.drive) await this.initialize();
        const dest = fs.createWriteStream(destinationPath);
        const res = await this.drive.files.get(
            { fileId, alt: 'media' },
            { responseType: 'stream' }
        );

        return new Promise((resolve, reject) => {
            res.data
                .on('end', () => {
                    this.log.info(`✅ [GoogleDriveClient]: Downloaded file ID ${fileId} to ${destinationPath}`);
                    resolve(destinationPath);
                })
                .on('error', err => {
                    this.log.error('❌ [GoogleDriveClient]: Error downloading file:', err);
                    reject(err);
                })
                .pipe(dest);
        });
    }

    /**
     * Finds and syncs a remote `.env` or configuration file from Google Drive into the local workspace.
     */
    async syncRemoteEnv(fileName = '.env') {
        const files = await this.listFiles(`name = '${fileName}' and trashed = false`);
        if (files.length === 0) {
            this.log.warn(`⚠️ [GoogleDriveClient]: Remote file '${fileName}' not found in Google Drive.`);
            return false;
        }

        const remoteFile = files[0];
        const tempPath = path.resolve(`./remote_${fileName}`);
        await this.downloadFile(remoteFile.id, tempPath);

        // Merge contents safely into local file
        const remoteContent = fs.readFileSync(tempPath, 'utf8');
        const localPath = path.resolve(`./${fileName}`);
        let localContent = fs.existsSync(localPath) ? fs.readFileSync(localPath, 'utf8') : '';

        const remoteLines = remoteContent.split('\n');
        let addedCount = 0;

        for (const line of remoteLines) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith('#')) continue;
            const key = trimmed.split('=')[0];
            if (!localContent.includes(key)) {
                localContent += '\n' + trimmed;
                addedCount++;
            }
        }

        fs.writeFileSync(localPath, localContent);
        fs.unlinkSync(tempPath);
        this.log.info(`✅ [GoogleDriveClient]: Successfully synced and merged ${addedCount} keys from remote '${fileName}'.`);
        return true;
    }
}

module.exports = { GoogleDriveClient };

if (require.main === module) {
    (async () => {
        try {
            const client = new GoogleDriveClient();
            console.log('Testing Google Drive connectivity...');
            await client.initialize();
            const files = await client.listFiles();
            console.log(`Found ${files.length} files in Google Drive.`);
            files.forEach(f => console.log(` - ${f.name} (${f.id})`));
        } catch (err) {
            console.error('❌ Google Drive integration test failed:', err.message);
            console.log('📌 Note: Provide service_account.json to enable live Google Drive sync.');
        }
    })();
}
