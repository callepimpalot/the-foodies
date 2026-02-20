import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import https from 'https';
import http from 'http';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const recipesPath = path.join(__dirname, '../../final_recipes.json');

async function checkUrl(url) {
    return new Promise((resolve) => {
        if (!url || !url.startsWith('http')) {
            resolve({ status: 'Invalid URL', ok: false });
            return;
        }

        const client = url.startsWith('https') ? https : http;

        const req = client.request(url, { method: 'HEAD', timeout: 5000 }, (res) => {
            resolve({ status: res.statusCode, ok: res.statusCode >= 200 && res.statusCode < 300 });
        });

        req.on('error', (err) => {
            resolve({ status: `Error: ${err.message}`, ok: false });
        });

        req.on('timeout', () => {
            req.destroy();
            resolve({ status: 'Timeout', ok: false });
        });

        req.end();
    });
}

async function validateImages() {
    try {
        const rawData = fs.readFileSync(recipesPath, 'utf8');
        const recipes = JSON.parse(rawData);

        console.log('# 🚨 Broken Links Report\n');
        console.log('| Recipe Name | Broken URL | HTTP Status |');
        console.log('| :--- | :--- | :--- |');

        let brokenCount = 0;

        for (const recipe of recipes) {
            const url = recipe.image_url;
            const result = await checkUrl(url);

            if (!result.ok) {
                brokenCount++;
                console.log(`| ${recipe.title} | \`${url}\` | **${result.status}** |`);
            }
        }

        if (brokenCount === 0) {
            console.log('\n✅ All image URLs are valid and accessible.');
        } else {
            console.log(`\n**Total Broken Links:** ${brokenCount}`);
        }

    } catch (error) {
        console.error("Error:", error);
    }
}

validateImages();
