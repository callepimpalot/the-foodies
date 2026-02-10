import React, { useEffect, useRef } from 'react';
import { useFamily } from '../../context/FamilyContext';
import {
    drawPixelSprite,
    PIXEL_TREE, PIXEL_CLOUD, PIXEL_BUILDING, PIXEL_MOUNTAIN, PIXEL_HOUSE, PIXEL_LAMP, PIXEL_SUN,
    PIXEL_DOG, PIXEL_DAD, PIXEL_MOM, PIXEL_KID, PIXEL_PERSON, // Fallback
    PALETTES
} from './pixelArtUtils';

export function BackgroundCanvas({ style }) {
    const { familyData } = useFamily();
    const canvasRef = useRef(null);
    const membersRef = useRef([]);

    // Initialize member positions
    useEffect(() => {
        membersRef.current = familyData.members.map(m => ({
            ...m,
            x: Math.random() * window.innerWidth,
            y: window.innerHeight * 0.7 + Math.random() * (window.innerHeight * 0.1), // Foreground/Ground level
            targetX: Math.random() * window.innerWidth,
            speed: 0.3 + Math.random() * 0.4,
            state: 'IDLE',
            timer: Math.random() * 100
        }));
    }, [familyData.members]);

    useEffect(() => {
        console.log('BackgroundCanvas: Updated Pixel Art Render - v2');
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        let animationFrameId;

        const resize = () => {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
        };
        window.addEventListener('resize', resize);
        resize();

        // --- SCENE COMPOSITION ---
        const groundLevel = canvas.height * 0.65;
        const bgElements = [];

        // Helper to add elements
        const addEl = (sprite, palette, x, yOffset, scale) => {
            bgElements.push({ sprite, palette, x, y: groundLevel + yOffset, scale });
        };

        // Generate Theme Specific Layout
        if (style === 'RURAL') {
            // Mountains in back
            for (let i = 0; i < canvas.width; i += 200) {
                addEl(PIXEL_MOUNTAIN, PALETTES.MOUNTAIN, i, -100, 15);
            }
            // Trees and occasional House
            for (let i = 50; i < canvas.width; i += 150) {
                if (Math.random() > 0.7) {
                    addEl(PIXEL_HOUSE, { ...PALETTES.HOUSE, primary: '#e74c3c' }, i, -60, 8);
                } else {
                    addEl(PIXEL_TREE, PALETTES.TREE, i, -40, 6);
                }
            }
            // Sun
            addEl(PIXEL_SUN, PALETTES.SUN, canvas.width - 100, -300, 8);
        }
        else if (style === 'CITY') {
            // Skyline
            for (let i = 0; i < canvas.width; i += 120) {
                const heightVar = Math.random() * 50;
                addEl(PIXEL_BUILDING, { ...PALETTES.BUILDING, primary: i % 240 === 0 ? '#34495e' : '#7f8c8d' }, i, -80 - heightVar, 10 + (heightVar / 10));
            }
            // Street Lamps
            for (let i = 30; i < canvas.width; i += 200) {
                addEl(PIXEL_LAMP, PALETTES.LAMP, i, -40, 5);
            }
        }
        else if (style === 'SUBURBAN') {
            // Houses in a row
            for (let i = 100; i < canvas.width; i += 300) {
                const color = ['#3498db', '#e74c3c', '#f1c40f'][Math.floor(Math.random() * 3)];
                addEl(PIXEL_HOUSE, { ...PALETTES.HOUSE, primary: color }, i, -60, 8);
                addEl(PIXEL_TREE, PALETTES.TREE, i - 80, -30, 5); // Tree in yard
            }
            // Sun
            addEl(PIXEL_SUN, PALETTES.SUN, 100, -300, 8);
        }
        else if (style === 'COASTAL') {
            // Water horizon drawn in render
            // Palm Trees (using Tree sprite with different palette for now logic)
            for (let i = 20; i < canvas.width; i += 180) {
                addEl(PIXEL_TREE, { ...PALETTES.TREE, primary: '#2ecc71', outline: '#8B4513' }, i, -50, 7);
            }
            addEl(PIXEL_SUN, PALETTES.SUN, canvas.width / 2, -250, 10);
        }
        else if (style === 'NORDIC') {
            // Mountains
            for (let i = 0; i < canvas.width; i += 250) {
                addEl(PIXEL_MOUNTAIN, { ...PALETTES.MOUNTAIN, primary: '#ecf0f1', skin: '#bdc3c7' }, i, -120, 18);
            }
            // Pine Trees (darker)
            for (let i = 40; i < canvas.width; i += 100) {
                addEl(PIXEL_TREE, { ...PALETTES.TREE, primary: '#2c3e50', skin: '#95a5a6' }, i, -40, 6);
            }
            // Cabin
            addEl(PIXEL_HOUSE, { ...PALETTES.HOUSE, primary: '#8B4513' }, canvas.width / 2, -60, 8);
        }
        else {
            // Default Rural
            for (let i = 0; i < canvas.width; i += 150) addEl(PIXEL_TREE, PALETTES.TREE, i, -40, 6);
        }

        // Clouds (common)
        const clouds = [];
        for (let i = 0; i < 6; i++) {
            clouds.push({
                x: Math.random() * canvas.width,
                y: Math.random() * (canvas.height * 0.4),
                speed: 0.1 + Math.random() * 0.2,
                scale: 4 + Math.random() * 2
            });
        }

        const render = () => {
            if (!canvas) return;
            const width = canvas.width;
            const height = canvas.height;

            ctx.clearRect(0, 0, width, height);

            // Sky Background
            let skyGradient = ctx.createLinearGradient(0, 0, 0, height);
            if (style === 'CITY') { skyGradient.addColorStop(0, '#1a2a6c'); skyGradient.addColorStop(1, '#b21f1f'); }
            else if (style === 'RURAL' || style === 'SUBURBAN') { skyGradient.addColorStop(0, '#87CEEB'); skyGradient.addColorStop(1, '#E0F6FF'); }
            else if (style === 'COASTAL') { skyGradient.addColorStop(0, '#2980b9'); skyGradient.addColorStop(1, '#6dd5fa'); }
            else if (style === 'NORDIC') { skyGradient.addColorStop(0, '#2c3e50'); skyGradient.addColorStop(1, '#bdc3c7'); } // Snowy sky
            else { skyGradient.addColorStop(0, '#87CEEB'); skyGradient.addColorStop(1, '#E0F6FF'); }

            ctx.fillStyle = skyGradient;
            ctx.fillRect(0, 0, width, height);

            // Sun/Moon/Back elements could be drawn here

            // Ground
            let groundColor = '#90EE90';
            if (style === 'CITY') groundColor = '#555';
            if (style === 'COASTAL') groundColor = '#F4A460'; // Sand
            if (style === 'NORDIC') groundColor = '#ecf0f1'; // Snow

            ctx.fillStyle = groundColor;
            ctx.fillRect(0, groundLevel, width, height - groundLevel);

            // Ocean for Coastal
            if (style === 'COASTAL') {
                ctx.fillStyle = '#3498db';
                ctx.fillRect(0, groundLevel + 50, width, height);
            }

            // Draw Clouds
            clouds.forEach(cloud => {
                cloud.x += cloud.speed;
                if (cloud.x > width) cloud.x = -100;
                drawPixelSprite(ctx, cloud.x, cloud.y, PIXEL_CLOUD, PALETTES.CLOUD, cloud.scale);
            });

            // Draw Background Elements
            bgElements.forEach(el => {
                drawPixelSprite(ctx, el.x, el.y, el.sprite, el.palette, el.scale);
            });

            // Update & Draw Members
            membersRef.current.forEach(member => {
                // AI Logic (Wander)
                member.timer--;
                if (member.timer <= 0) {
                    member.timer = 100 + Math.random() * 200;
                    member.state = Math.random() > 0.4 ? 'WALK' : 'IDLE';
                    member.targetX = Math.random() * width;
                }
                if (member.state === 'WALK') {
                    const dx = member.targetX - member.x;
                    if (Math.abs(dx) > 1) {
                        member.x += Math.sign(dx) * member.speed;
                    } else {
                        member.state = 'IDLE';
                    }
                }

                // Determine Sprite based on exact type
                let sprite = PIXEL_PERSON;
                if (member.type === 'DAD') sprite = PIXEL_DAD;
                else if (member.type === 'MOM') sprite = PIXEL_MOM;
                else if (member.type === 'KID') sprite = PIXEL_KID;
                else if (member.type === 'PET') sprite = PIXEL_DOG;

                const palette = PALETTES[member.type] || PALETTES.DAD;
                const bob = member.state === 'WALK' ? Math.sin(Date.now() / 150) * 3 : 0;

                // Flip Logic
                const scale = 5;
                const isFlipped = member.targetX < member.x && member.state === 'WALK';

                ctx.save();
                ctx.translate(member.x, member.y + bob); // Use calculated Y from init which is relative to ground
                if (isFlipped) {
                    ctx.scale(-1, 1);
                    ctx.translate(-8 * scale, 0);
                }

                drawPixelSprite(ctx, 0, 0, sprite, palette, scale);
                ctx.restore();

                // Name tag
                ctx.fillStyle = 'white';
                ctx.strokeStyle = 'black';
                ctx.lineWidth = 2;
                ctx.font = 'bold 12px monospace';
                ctx.textAlign = 'center';
                ctx.strokeText(member.name, member.x + (8 * scale) / 2, member.y - 10 + bob);
                ctx.fillText(member.name, member.x + (8 * scale) / 2, member.y - 10 + bob);
            });

            animationFrameId = requestAnimationFrame(render);
        };

        render();

        return () => {
            window.removeEventListener('resize', resize);
            cancelAnimationFrame(animationFrameId);
        };
    }, [style, familyData.members]);

    return (
        <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            zIndex: 0
        }}>
            <canvas
                ref={canvasRef}
                style={{ width: '100%', height: '100%', display: 'block', imageRendering: 'pixelated' }}
            />
        </div>
    );
}
