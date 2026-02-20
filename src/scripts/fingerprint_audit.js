import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const recipesPath = path.join(__dirname, '../../final_recipes.json');

try {
    const rawData = fs.readFileSync(recipesPath, 'utf8');
    const recipes = JSON.parse(rawData);

    console.log('# 🕵️ Placeholder Fingerprint & Mass Filter\n');

    // 1. Identify Target
    const targetName = "Salmon & Asparagus";
    const target = recipes.find(r => r.title === targetName);

    if (!target) {
        console.error(`❌ Target "${targetName}" not found!`);
        process.exit(1);
    }

    const fingerprintUrl = target.image_url;
    console.log(`**Target:** ${targetName}`);
    console.log(`**Fingerprint URL:** ${fingerprintUrl}\n`);

    // 2. The Great Filter (Exact Match)
    const exactMatches = recipes.filter(r => r.image_url === fingerprintUrl);

    console.log(`## 🎯 Exact Match Victims (${exactMatches.length})`);
    exactMatches.forEach(r => console.log(`- ${r.title}`));

    // 3. Pattern Match (All Unsplash)
    // Check if it looks like a generic Unsplash ID
    const unsplashPattern = "images.unsplash.com";
    const allUnsplash = recipes.filter(r => r.image_url && r.image_url.includes(unsplashPattern));

    if (allUnsplash.length > exactMatches.length) {
        console.log(`\n## 🌊 Unsplash Pattern Victims (${allUnsplash.length})`);
        console.log(`(These share the '${unsplashPattern}' domain pattern)`);
        // List first 10 to avoid spamming if huge
        allUnsplash.forEach((r, i) => {
            if (i < 10) console.log(`- ${r.title}`);
        });
        if (allUnsplash.length > 10) console.log(`... and ${allUnsplash.length - 10} more.`);
    }

} catch (error) {
    console.error("Error:", error);
}
