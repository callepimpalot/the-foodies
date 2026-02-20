import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const recipesPath = path.join(__dirname, '../../final_recipes.json');

try {
    const rawData = fs.readFileSync(recipesPath, 'utf8');
    const recipes = JSON.parse(rawData);

    console.log('# 🔍 Strict Null/Empty Image Audit\n');

    const missing = recipes.filter(r => !r.image_url || r.image_url.trim() === '');

    if (missing.length === 0) {
        console.log("✅ Zero recipes found with null/empty image_url.");
        console.log("Note: This scan ignored Unsplash placeholders.");
    } else {
        missing.forEach((recipe, index) => {
            console.log(`${index + 1}. ${recipe.title}`);
            console.log(`   - Ingredients: ${recipe.ingredients.map(i => i.item).slice(0, 3).join(', ')}`);
        });
    }

} catch (error) {
    console.error("Error:", error);
}
