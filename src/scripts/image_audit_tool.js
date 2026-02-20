import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const recipesPath = path.join(__dirname, '../../final_recipes.json');

try {
    const rawData = fs.readFileSync(recipesPath, 'utf8');
    const recipes = JSON.parse(rawData);

    console.log('# 📸 Recipe Image Audit (Full Scan)\n');

    let count = 0;

    recipes.forEach((recipe) => {
        const isPlaceholder = !recipe.image_url || recipe.image_url.includes('unsplash');

        if (isPlaceholder) {
            count++;
            const ingredients = recipe.ingredients.map(i => i.item).slice(0, 3).join(', ');

            console.log(`## ${count}. ${recipe.title}`);
            console.log(`   * **Current:** ${recipe.image_url ? 'Unsplash Placeholder' : 'Missing'}`);
            console.log(`   * **Ingredients:** ${recipe.ingredients.map(i => i.item).join(', ')}`);
            console.log(`   * **Prompt Key:** "${ingredients}"\n`);
        }
    });

    if (count === 0) {
        console.log("No placeholder images found! All recipes have custom assets.");
    }

} catch (error) {
    console.error("Error reading recipes:", error);
}
