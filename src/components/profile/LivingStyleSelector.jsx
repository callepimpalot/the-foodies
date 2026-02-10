import React, { useRef, useEffect } from 'react';
import { useFamily } from '../../context/FamilyContext';
import {
    drawPixelSprite,
    PIXEL_TREE, PIXEL_BUILDING, PIXEL_SNOWFLAKE, PIXEL_WAVE, PIXEL_HOUSE, PIXEL_MOUNTAIN,
    PALETTES
} from './pixelArtUtils';

const STYLES = [
    { id: 'RURAL', label: 'Rural', sprite: PIXEL_TREE, palette: PALETTES.TREE },
    { id: 'CITY', label: 'City', sprite: PIXEL_BUILDING, palette: PALETTES.BUILDING },
    { id: 'NORDIC', label: 'Nordic', sprite: PIXEL_SNOWFLAKE, palette: PALETTES.SNOW },
    { id: 'COASTAL', label: 'Coastal', sprite: PIXEL_WAVE, palette: PALETTES.WAVE },
    { id: 'SUBURBAN', label: 'Suburbs', sprite: PIXEL_HOUSE, palette: PALETTES.HOUSE }
];

function PixelIcon({ sprite, palette, scale = 3 }) {
    const canvasRef = useRef(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');

        canvas.width = 8 * scale;
        canvas.height = 8 * scale;

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        drawPixelSprite(ctx, 0, 0, sprite, palette, scale);
    }, [sprite, palette, scale]);

    return (
        <canvas ref={canvasRef} style={{ width: 8 * scale, height: 8 * scale, imageRendering: 'pixelated' }} />
    );
}

export function LivingStyleSelector() {
    const { familyData, updateLivingStyle } = useFamily();

    return (
        <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))',
            gap: '1rem'
        }}>
            {STYLES.map((style) => (
                <button
                    key={style.id}
                    onClick={() => updateLivingStyle(style.id)}
                    style={{
                        background: familyData.livingStyle === style.id
                            ? 'var(--color-primary)'
                            : 'var(--color-surface-dim)',
                        color: familyData.livingStyle === style.id
                            ? 'white'
                            : 'var(--color-text-primary)',
                        border: 'none',
                        borderRadius: '16px',
                        padding: '1rem',
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '0.5rem',
                        transition: 'all 0.2s ease',
                        boxShadow: familyData.livingStyle === style.id
                            ? '0 8px 16px rgba(255, 71, 87, 0.3)'
                            : 'none',
                        transform: familyData.livingStyle === style.id
                            ? 'scale(1.05)'
                            : 'scale(1)'
                    }}
                >
                    <PixelIcon sprite={style.sprite} palette={style.palette} scale={5} />
                    <span style={{ fontWeight: '600', fontSize: '0.9rem' }}>{style.label}</span>
                </button>
            ))}
        </div>
    );
}
