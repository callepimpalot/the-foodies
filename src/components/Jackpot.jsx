import React, { useState, useEffect } from 'react';
import { useInventory } from '../context/InventoryContext';
import { useArchetype } from '../context/ArchetypeContext';
import { generateJackpot } from '../utils/jackpotLogic';
import { usePlan } from '../context/PlanContext';

const REEL_ICONS = ['🥦', '🥩', '🍝', '🥘', '🥗', '🍔', '🍕', '🍱', '🌮', '🍜'];

export function JackpotModal({ isOpen, onClose, targetSlot }) {
    const { items } = useInventory();
    const { activeArchetype } = useArchetype();
    const { addToPlan } = usePlan();

    const [result, setResult] = useState(null);
    const [isSpinning, setIsSpinning] = useState(false);
    const [pantryOnly, setPantryOnly] = useState(true);
    const [currentIcon, setCurrentIcon] = useState(REEL_ICONS[0]);

    // Reset state when opening
    useEffect(() => {
        if (isOpen) {
            setResult(null);
            setIsSpinning(false);
        }
    }, [isOpen]);

    // Slot Machine Animation Effect
    useEffect(() => {
        let interval;
        if (isSpinning) {
            interval = setInterval(() => {
                const randomIcon = REEL_ICONS[Math.floor(Math.random() * REEL_ICONS.length)];
                setCurrentIcon(randomIcon);
            }, 100); // Change icon every 100ms
        }
        return () => clearInterval(interval);
    }, [isSpinning]);

    const handleSpin = () => {
        setIsSpinning(true);
        setResult(null);

        // Spin duration 2 seconds
        setTimeout(() => {
            const winner = generateJackpot(activeArchetype.id, items, pantryOnly);

            if (!winner && pantryOnly) {
                setResult({
                    title: "No Exact Matches",
                    description: "Try Shopping Mode!",
                    image: "/brain/386ec0de-b643-417d-9eb5-f92f958dbda0/chicken_broccoli_premium_1770464090264.png",
                    score: 0,
                    time: "-",
                    isFailure: true
                });
            } else {
                setResult(winner);
            }

            setIsSpinning(false);
        }, 2000);
    };

    const handleAccept = () => {
        if (targetSlot && result && !result.isFailure) {
            addToPlan(targetSlot.date, targetSlot.slot, result);
            onClose();
            // TODO: Toast
        }
    };

    if (!isOpen || !activeArchetype) return null;

    const glowVar = activeArchetype.glow;

    return (
        <div style={{
            position: 'fixed',
            top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.85)',
            backdropFilter: 'blur(12px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 2000,
            animation: 'fadeIn 0.2s ease-out'
        }} onClick={onClose}>
            <div
                onClick={e => e.stopPropagation()}
                className="glass-panel"
                style={{
                    width: '90%',
                    maxWidth: '400px',
                    padding: '2rem',
                    textAlign: 'center',
                    border: `1px solid rgba(${glowVar}, 0.3)`,
                    boxShadow: `0 0 50px rgba(${glowVar}, 0.1)`,
                    position: 'relative',
                    animation: 'scaleUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
                }}
            >
                <button
                    onClick={onClose}
                    style={{
                        position: 'absolute',
                        top: '1rem',
                        right: '1rem',
                        background: 'none',
                        border: 'none',
                        color: 'var(--color-text-secondary)',
                        fontSize: '1.5rem',
                        cursor: 'pointer'
                    }}
                >×</button>

                <h2 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>Jackpot Spin</h2>
                <div style={{ fontSize: '0.9rem', color: 'var(--color-text-secondary)', marginBottom: '2rem' }}>
                    {targetSlot ? `For ${targetSlot.dayName} ${targetSlot.slot}` : 'Spin for a meal'}
                </div>

                {!result && !isSpinning && (
                    <>
                        <div style={{ marginBottom: '2rem' }}>
                            <div style={{ fontSize: '4rem' }}>🎰</div>
                        </div>

                        {/* Toggle Switch */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '1rem', marginBottom: '2rem' }}>
                            <span style={{ fontSize: '0.9rem', color: !pantryOnly ? `rgb(${glowVar})` : 'var(--color-text-secondary)' }}>Any</span>
                            <div
                                onClick={() => setPantryOnly(!pantryOnly)}
                                style={{
                                    width: '48px',
                                    height: '24px',
                                    background: `rgba(${glowVar}, 0.3)`,
                                    borderRadius: '12px',
                                    position: 'relative',
                                    cursor: 'pointer'
                                }}
                            >
                                <div style={{
                                    width: '18px',
                                    height: '18px',
                                    background: '#fff',
                                    borderRadius: '50%',
                                    position: 'absolute',
                                    top: '3px',
                                    left: pantryOnly ? '26px' : '4px',
                                    transition: 'left 0.2s ease'
                                }} />
                            </div>
                            <span style={{ fontSize: '0.9rem', color: pantryOnly ? `rgb(${glowVar})` : 'var(--color-text-secondary)' }}>Pantry Only</span>
                        </div>

                        <button
                            onClick={handleSpin}
                            className="btn-primary"
                            style={{
                                width: '100%',
                                fontSize: '1.2rem',
                                padding: '1rem',
                                borderRadius: '50px',
                                boxShadow: `0 0 20px rgba(${glowVar}, 0.4)`
                            }}
                        >
                            SPIN
                        </button>
                    </>
                )}

                {isSpinning && (
                    <div style={{ padding: '2rem 0' }}>
                        <div style={{
                            fontSize: '5rem',
                            marginBottom: '1rem',
                            animation: 'bounce 0.1s infinite alternate'
                        }}>
                            {currentIcon}
                        </div>
                        <div style={{ color: `rgb(${glowVar})`, animation: 'pulse 1s infinite' }}>
                            Finding a match...
                        </div>
                    </div>
                )}

                {result && (
                    <div style={{ animation: 'fadeIn 0.5s ease-out' }}>
                        <div style={{
                            position: 'relative',
                            width: '100%',
                            height: '180px',
                            borderRadius: '16px',
                            overflow: 'hidden',
                            marginBottom: '1.5rem',
                            border: `2px solid rgba(${glowVar}, 0.5)`
                        }}>
                            <img
                                src={result.image}
                                alt={result.title}
                                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                            />
                            {!result.isFailure && (
                                <div style={{
                                    position: 'absolute',
                                    bottom: 0,
                                    left: 0,
                                    right: 0,
                                    background: 'linear-gradient(to top, rgba(0,0,0,0.9), transparent)',
                                    padding: '1rem',
                                    paddingTop: '3rem'
                                }}>
                                    <div style={{ color: '#fff', fontWeight: 700, fontSize: '1.1rem' }}>{result.title}</div>
                                </div>
                            )}
                        </div>

                        {result.isFailure ? (
                            <div style={{ marginBottom: '2rem' }}>
                                <p>No perfect matches found in pantry.</p>
                                <button className="btn-primary" onClick={() => setPantryOnly(false)}>Try All Recipes</button>
                            </div>
                        ) : (
                            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
                                <button
                                    className="btn-primary"
                                    onClick={handleSpin}
                                    style={{ background: 'transparent', border: `1px solid rgba(${glowVar}, 0.3)` }}
                                >
                                    Retry
                                </button>
                                <button
                                    className="btn-primary"
                                    onClick={handleAccept}
                                    style={{ flex: 1 }}
                                >
                                    Accept Match
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
