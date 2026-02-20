import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const recipesPath = path.join(__dirname, '../../final_recipes.json');

try {
    const rawData = fs.readFileSync(recipesPath, 'utf8');
    const recipes = JSON.parse(rawData);

    console.log('# 🎯 Impacted Recipe Audit\n');
    console.log('| Recipe Name | Current Bad URL | Shared By Count |');
    console.log('| :--- | :--- | :--- |');

    const targets = [
        "Salmon & Asparagus",
        "Quinoa Salad Bowl",
        "Lentil Soup",
        "Avocado Toast with Egg"
    ];

    targets.forEach(name => {
        // Fuzzy match to handle "Bowl" suffix differences if any
        const recipe = recipes.find(r => r.title.includes(name) || r.title === name);

        if (recipe) {
            const url = recipe.image_url;
            // Count how many TOTAL recipes have this exact URL
            const count = recipes.filter(r => r.image_url === url).length;
            // output row
            console.log(`| ${recipe.title} | \`${url}\` | ${count} |`);
        } else {
            console.log(`| ${name} | **NOT FOUND** | 0 |`);
        }
    });

} catch (error) {
    console.error("Error:", error);
}
