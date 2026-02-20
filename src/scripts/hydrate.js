import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawnSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const mappings = [
    { file: 'avocado_toast_1771616474642.png', title: 'Avocado Toast with Egg', dest: 'avocado_toast.png' },
    { file: 'burning_love_1771616605251.png', title: 'Burning Love (Brændende Kærlighed)', dest: 'burning_love.png' },
    { file: 'chicken_broccoli_1771616637196.png', title: 'High-Protein Chicken & Broccoli', dest: 'chicken_broccoli.png' },
    { file: 'cod_mustard_1771616590045.png', title: 'Cod with Mustard Sauce', dest: 'cod_mustard.png' },
    { file: 'dream_cake_1771616544559.png', title: 'Dream Cake (Drømmekage)', dest: 'dream_cake.png' },
    { file: 'kale_apple_salad_1771616669597.png', title: 'Kale Salad with Apples', dest: 'kale_apple_salad.png' },
    { file: 'lentil_soup_1771616460610.png', title: 'Lentil Soup', dest: 'lentil_soup.png' },
    { file: 'quinoa_salad_1771616438127.png', title: 'Quinoa Salad Bowl', dest: 'quinoa_salad.png' },
    { file: 'roast_beef_open_1771616558958.png', title: 'Open-Faced Roast Beef', dest: 'roast_beef_open.png' },
    { file: 'rye_porridge_1771616517189.png', title: 'Rye Bread Porridge (Øllebrød)', dest: 'rye_porridge.png' },
    { file: 'salmon_asparagus_1771616423460.png', title: 'Salmon & Asparagus', dest: 'salmon_asparagus.png' },
    { file: 'salmon_tartine_1771616502014.png', title: 'Nordic Smoked Salmon Tartine', dest: 'salmon_tartine.png' },
    { file: 'shrimp_cocktail_1771616574112.png', title: 'Shrimp Cocktail (Rejecocktail)', dest: 'shrimp_cocktail.png' },
    { file: 'tuna_sandwich_1771616488295.png', title: 'Tuna Salad Sandwich', dest: 'tuna_sandwich.png' }
];

const sourceDir = 'C:\\Users\\cjipa\\.gemini\\antigravity\\brain\\4e7078a7-b408-423b-8584-29541e56b7a0';
const destDir = path.join(__dirname, '../../public/assets/recipe-refresh');

if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
}

for (const map of mappings) {
    const sourcePath = path.join(sourceDir, map.file);
    const destPath = path.join(destDir, map.dest);

    if (fs.existsSync(sourcePath)) {
        fs.copyFileSync(sourcePath, destPath);
        console.log(`Copied ${map.file} to ${map.dest}`);

        // Convert "Salmon & Asparagus" to "Salmon and Asparagus" specifically for the command line simulation,
        // though the child_process spawn array natively handles '&' anyway. But let's verify our Ampersand fix
        // by passing the version with 'and' if it had an ampersand.
        const safeTitle = map.title.replace(/&/g, 'and');
        const imageUrl = `/assets/recipe-refresh/${map.dest}`;

        console.log(`Updating Supabase for "${safeTitle}"...`);
        const result = spawnSync('node', [
            path.join(__dirname, 'update_supabase_image.js'),
            safeTitle,
            imageUrl
        ], { stdio: 'inherit' });

        if (result.error) {
            console.error(`Failed to execute update for ${safeTitle}`, result.error);
        }
    } else {
        console.warn(`Source file not found: ${sourcePath}`);
    }
}
console.log('Hydration complete!');
