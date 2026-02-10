// Pixel Art Assets defined as 2D arrays / strings
// 1 = primary color, 2 = secondary/skin, 0 = transparent, 3 = white/eye, 4 = dark/outline

export const PIXEL_DOG = [
    [0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 1, 1, 1, 0, 0, 0],
    [0, 1, 1, 1, 1, 1, 0, 0],
    [1, 1, 3, 1, 3, 1, 1, 0],
    [1, 1, 1, 4, 1, 1, 1, 0],
    [0, 1, 1, 1, 1, 1, 0, 0],
    [0, 1, 1, 0, 1, 1, 0, 0],
    [0, 1, 0, 0, 0, 1, 0, 0]
];

export const PIXEL_PERSON = [
    [0, 0, 1, 1, 1, 1, 0, 0], // Hair/Hat
    [0, 1, 1, 1, 1, 1, 1, 0],
    [0, 2, 2, 2, 2, 2, 2, 0], // Face
    [0, 2, 3, 2, 2, 3, 2, 0], // Eyes
    [0, 2, 2, 4, 4, 2, 2, 0], // Mouth
    [1, 1, 1, 1, 1, 1, 1, 1], // Shirt
    [1, 1, 1, 1, 1, 1, 1, 1],
    [0, 0, 4, 0, 0, 4, 0, 0]  // Legs
];
export const PIXEL_TREE = [
    [0, 0, 0, 1, 1, 0, 0, 0],
    [0, 0, 1, 1, 1, 1, 0, 0],
    [0, 1, 1, 1, 1, 1, 1, 0],
    [0, 0, 1, 1, 1, 1, 0, 0],
    [0, 1, 1, 1, 1, 1, 1, 0],
    [1, 1, 1, 1, 1, 1, 1, 1],
    [0, 0, 0, 4, 4, 0, 0, 0],
    [0, 0, 0, 4, 4, 0, 0, 0]
];

export const PIXEL_CLOUD = [
    [0, 0, 0, 1, 1, 1, 0, 0],
    [0, 1, 1, 1, 1, 1, 1, 0],
    [1, 1, 1, 1, 1, 1, 1, 1],
    [0, 1, 1, 1, 1, 1, 1, 0]
];

export const PIXEL_SUN = [
    [0, 0, 1, 1, 1, 1, 0, 0],
    [0, 1, 2, 2, 2, 2, 1, 0],
    [1, 2, 2, 2, 2, 2, 2, 1],
    [1, 2, 2, 2, 2, 2, 2, 1],
    [1, 2, 2, 2, 2, 2, 2, 1],
    [1, 2, 2, 2, 2, 2, 2, 1],
    [0, 1, 2, 2, 2, 2, 1, 0],
    [0, 0, 1, 1, 1, 1, 0, 0]
];

export const PIXEL_BUILDING = [
    [0, 0, 1, 1, 1, 1, 0, 0],
    [0, 0, 1, 3, 3, 1, 0, 0],
    [0, 0, 1, 3, 3, 1, 0, 0],
    [0, 0, 1, 1, 1, 1, 0, 0],
    [0, 0, 1, 3, 3, 1, 0, 0],
    [0, 0, 1, 3, 3, 1, 0, 0],
    [0, 0, 1, 1, 1, 1, 0, 0],
    [0, 0, 1, 4, 4, 1, 0, 0]
];

export const PIXEL_HOUSE = [
    [0, 0, 0, 1, 1, 0, 0, 0],
    [0, 0, 1, 1, 1, 1, 0, 0],
    [0, 1, 1, 1, 1, 1, 1, 0],
    [1, 1, 1, 1, 1, 1, 1, 1],
    [0, 2, 2, 2, 2, 2, 2, 0],
    [0, 2, 3, 2, 2, 3, 2, 0],
    [0, 2, 2, 2, 2, 2, 2, 0],
    [0, 2, 2, 4, 4, 2, 2, 0]
];

export const PIXEL_LAMP = [
    [0, 0, 0, 1, 1, 0, 0, 0],
    [0, 0, 1, 2, 2, 1, 0, 0],
    [0, 0, 0, 1, 1, 0, 0, 0],
    [0, 0, 0, 4, 4, 0, 0, 0],
    [0, 0, 0, 4, 4, 0, 0, 0],
    [0, 0, 0, 4, 4, 0, 0, 0],
    [0, 0, 0, 4, 4, 0, 0, 0],
    [0, 0, 0, 4, 4, 0, 0, 0]
];

export const PIXEL_MOUNTAIN = [
    [0, 0, 0, 0, 1, 0, 0, 0],
    [0, 0, 0, 1, 1, 1, 0, 0],
    [0, 0, 1, 1, 1, 1, 1, 0],
    [0, 1, 1, 2, 1, 1, 1, 1],
    [1, 1, 2, 2, 2, 1, 1, 1]
];

// Distinct Avatars
export const PIXEL_DAD = [
    [0, 0, 1, 1, 1, 1, 0, 0], // Short hair
    [0, 0, 1, 1, 1, 1, 0, 0],
    [0, 0, 2, 2, 2, 2, 0, 0], // Face
    [0, 0, 4, 2, 2, 4, 0, 0], // Glasses/Eyes
    [0, 0, 2, 2, 2, 2, 0, 0],
    [1, 1, 1, 1, 1, 1, 1, 1], // Shirt
    [1, 1, 1, 1, 1, 1, 1, 1],
    [0, 0, 4, 0, 0, 4, 0, 0]  // Pants
];

export const PIXEL_MOM = [
    [0, 1, 1, 1, 1, 1, 1, 0], // Long hair top
    [1, 1, 1, 1, 1, 1, 1, 1], // Long hair sides
    [1, 0, 2, 2, 2, 2, 0, 1],
    [1, 0, 2, 3, 3, 2, 0, 1],
    [1, 0, 2, 2, 2, 2, 0, 1],
    [0, 0, 1, 1, 1, 1, 0, 0], // Dress/Shirt
    [0, 1, 1, 1, 1, 1, 1, 0],
    [0, 1, 1, 0, 0, 1, 1, 0]
];

export const PIXEL_KID = [
    [0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 4, 4, 0, 0, 0], // Cap
    [0, 0, 1, 1, 1, 1, 0, 0],
    [0, 0, 2, 2, 2, 2, 0, 0],
    [0, 0, 2, 3, 3, 2, 0, 0],
    [0, 0, 1, 1, 1, 1, 0, 0], // Small body
    [0, 0, 1, 1, 1, 1, 0, 0],
    [0, 0, 4, 0, 0, 4, 0, 0]
];

export const PIXEL_WAVE = [
    [0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 1, 1, 1, 0],
    [0, 0, 1, 1, 2, 2, 2, 1],
    [0, 1, 2, 2, 2, 2, 2, 1],
    [1, 2, 2, 2, 2, 2, 2, 2],
    [0, 0, 0, 0, 0, 0, 0, 0]
];

export const PIXEL_SNOWFLAKE = [
    [0, 0, 1, 0, 1, 0, 0, 0],
    [1, 0, 1, 0, 1, 0, 1, 0],
    [0, 1, 1, 1, 1, 1, 0, 0],
    [0, 0, 1, 1, 1, 0, 0, 0],
    [0, 1, 1, 1, 1, 1, 0, 0],
    [1, 0, 1, 0, 1, 0, 1, 0],
    [0, 0, 1, 0, 1, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0]
];

export const PALETTES = {
    DAD: { primary: '#3498db', skin: '#ffdab9', outline: '#2c3e50' },
    MOM: { primary: '#e74c3c', skin: '#ffdab9', outline: '#c0392b' },
    KID: { primary: '#f1c40f', skin: '#ffdab9', outline: '#f39c12' },
    PET: { primary: '#8e44ad', skin: '#d2b4de', outline: '#5b2c6f' },
    TREE: { primary: '#2ecc71', skin: '#27ae60', outline: '#8B4513' },
    CLOUD: { primary: '#ffffff', skin: '#e6e6e6', outline: '#b3b3b3' },
    BUILDING: { primary: '#95a5a6', skin: '#7f8c8d', outline: '#2c3e50' },
    MOUNTAIN: { primary: '#808B96', skin: '#566573', outline: '#2C3E50' },
    HOUSE: { primary: '#e74c3c', skin: '#c0392b', outline: '#2c3e50' },
    LAMP: { primary: '#f1c40f', skin: '#f39c12', outline: '#2c3e50' },
    SUN: { primary: '#f1c40f', skin: '#f39c12', outline: '#e67e22' },
    WAVE: { primary: '#2980b9', skin: '#6dd5fa', outline: '#1a2a6c' },
    SNOW: { primary: '#bdc3c7', skin: '#ecf0f1', outline: '#2c3e50' }
};

export function drawPixelSprite(ctx, x, y, sprite, palette, scale = 4) {
    if (!sprite || !palette) return;

    sprite.forEach((row, rowIndex) => {
        row.forEach((pixel, colIndex) => {
            if (pixel === 0) return;

            let color = '';
            switch (pixel) {
                case 1: color = palette.primary; break;
                case 2: color = palette.skin; break;
                case 3: color = '#ffffff'; // Windows/Eyes
                    // Random light flicker for buildings?
                    if (palette === PALETTES.BUILDING && Math.random() > 0.9) color = '#ffff00';
                    break;
                case 4: color = palette.outline; break;
                default: color = '#000';
            }

            ctx.fillStyle = color;
            ctx.fillRect(
                x + (colIndex * scale),
                y + (rowIndex * scale),
                scale,
                scale
            );
        });
    });
}
