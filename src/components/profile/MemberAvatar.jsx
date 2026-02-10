import React, { useRef, useEffect } from 'react';
import { drawPixelSprite, PIXEL_DOG, PIXEL_PERSON, PIXEL_DAD, PIXEL_MOM, PIXEL_KID, PALETTES } from './pixelArtUtils';

export function MemberAvatar({ type, style = {}, walking = false }) {
    const canvasRef = useRef(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        const scale = 5;

        canvas.width = 8 * scale;
        canvas.height = 8 * scale;

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        let sprite = PIXEL_PERSON;
        if (type === 'DAD') sprite = PIXEL_DAD;
        else if (type === 'MOM') sprite = PIXEL_MOM;
        else if (type === 'KID') sprite = PIXEL_KID;
        else if (type === 'PET') sprite = PIXEL_DOG;

        const palette = PALETTES[type];

        drawPixelSprite(ctx, 0, 0, sprite, palette, scale);

    }, [type]);

    return (
        <div style={{
            width: '40px',
            height: '40px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            filter: 'drop-shadow(2px 2px 0 rgba(0,0,0,0.2))',
            imageRendering: 'pixelated',
            animation: walking ? 'bob 0.5s infinite alternate' : 'none',
            ...style
        }}>
            <canvas ref={canvasRef} style={{ width: '100%', height: '100%' }} />
            <style>
                {`
                @keyframes bob {
                    from { transform: translateY(0); }
                    to { transform: translateY(-4px); }
                }
                `}
            </style>
        </div>
    );
}
