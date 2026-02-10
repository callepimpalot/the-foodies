import React, { useState } from 'react';
import { usePlan } from '../context/PlanContext';
import { RecipeSelector } from './RecipeSelector';

export function WeeklyCalendar({ onSlotClick, highlightMode = false }) {
    const { weeklyPlan, isPlanConfirmed, addToPlan, removeFromPlan, updateServings } = usePlan();
    const [selecting, setSelecting] = useState(null); // { date, slot } - fallback if no onSlotClick

    // Generate next 7 days
    const days = Array.from({ length: 7 }, (_, i) => {
        const d = new Date();
        d.setDate(d.getDate() + i);
        return {
            dateStr: d.toISOString().split('T')[0],
            dayName: d.toLocaleDateString('en-US', { weekday: 'short' }),
            dayNum: d.getDate()
        };
    });

    const handleSlotInteraction = (date, slot) => {
        if (isPlanConfirmed) return;

        if (onSlotClick) {
            onSlotClick(date, slot);
        } else {
            setSelecting({ date, slot });
        }
    };

    return (
        <div className="glass-panel" style={{ padding: '1.5rem', height: '100%', overflowX: 'auto', opacity: isPlanConfirmed ? 0.8 : 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <h3 style={{ margin: 0, fontSize: '1.5rem' }}>Weekly Plan</h3>
                {isPlanConfirmed && (
                    <span style={{ fontSize: '0.9rem', background: 'rgba(52, 211, 153, 0.2)', color: '#10b981', padding: '6px 16px', borderRadius: '50px', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
                        ✓ Plan Confirmed
                    </span>
                )}
            </div>

            <div style={{ display: 'flex', gap: '1.5rem', minWidth: '100%', paddingBottom: '1rem' }}>
                {days.map(day => (
                    <div key={day.dateStr} style={{
                        minWidth: '200px',
                        background: 'rgba(0,0,0,0.2)',
                        borderRadius: '24px',
                        padding: '1.5rem', // Increased padding
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '1rem',
                        border: '1px solid rgba(255,255,255,0.05)',
                        boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
                    }}>
                        <div style={{ textAlign: 'center', marginBottom: '0.5rem' }}>
                            <div style={{ fontSize: '1rem', color: 'var(--color-text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '1px' }}>{day.dayName}</div>
                            <div style={{ fontSize: '2.5rem', fontWeight: 800, lineHeight: 1 }}>{day.dayNum}</div>
                        </div>

                        {/* Slots */}
                        {['Breakfast', 'Lunch', 'Dinner'].map(slot => {
                            const entry = weeklyPlan[day.dateStr]?.[slot.toLowerCase()];
                            const meal = entry?.recipe;
                            const servings = entry?.servings || 2;
                            const isFilled = !!meal;

                            return (
                                <div
                                    key={slot}
                                    className={`glass-panel animate-squish ${meal ? 'active-meal' : ''}`}
                                    onClick={() => !meal && handleSlotInteraction(day.dateStr, slot.toLowerCase())}
                                    style={{
                                        minHeight: '120px', // Decent big
                                        fontSize: '0.9rem',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        textAlign: 'center',
                                        border: meal ? '1px solid rgba(var(--active-glow), 0.3)' :
                                            highlightMode && !meal ? '2px dashed rgba(var(--active-glow), 0.5)' :
                                                '1px dashed rgba(255,255,255,0.1)',
                                        background: highlightMode && !meal ? 'rgba(var(--active-glow), 0.05)' : undefined,
                                        cursor: isPlanConfirmed ? 'default' : 'pointer',
                                        position: 'relative',
                                        padding: '1rem',
                                        transition: 'all 0.3s var(--spring-easing)',
                                        animation: highlightMode && !meal ? 'pulse 2s infinite' : 'none'
                                    }}
                                >
                                    {meal ? (
                                        <>
                                            <div style={{ width: '100%', height: '60px', overflow: 'hidden', borderRadius: '16px', marginBottom: '0.5rem' }}>
                                                <img
                                                    src={meal.image}
                                                    alt={meal.title}
                                                    style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.9 }}
                                                />
                                            </div>
                                            <div style={{ fontWeight: 800, color: '#fff', marginBottom: '0.8rem', lineHeight: 1.1, fontSize: '0.8rem', textTransform: 'uppercase' }}>{meal.title}</div>

                                            {/* Servings Control */}
                                            <div
                                                style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', background: 'rgba(0,0,0,0.4)', padding: '6px 14px', borderRadius: '50px' }}
                                                onClick={(e) => e.stopPropagation()}
                                            >
                                                <button
                                                    disabled={isPlanConfirmed || servings <= 1}
                                                    onClick={() => updateServings(day.dateStr, slot.toLowerCase(), servings - 1)}
                                                    style={{ background: 'none', border: 'none', color: '#fff', opacity: isPlanConfirmed ? 0.3 : 0.8, cursor: 'pointer', fontSize: '1.2rem', padding: 0, width: '20px' }}
                                                >-</button>
                                                <span style={{ fontSize: '0.9rem', fontWeight: 900 }}>{servings}</span>
                                                <button
                                                    disabled={isPlanConfirmed}
                                                    onClick={() => updateServings(day.dateStr, slot.toLowerCase(), servings + 1)}
                                                    style={{ background: 'none', border: 'none', color: '#fff', opacity: isPlanConfirmed ? 0.3 : 0.8, cursor: 'pointer', fontSize: '1.2rem', padding: 0, width: '20px' }}
                                                >+</button>
                                            </div>

                                            {!isPlanConfirmed && (
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        removeFromPlan(day.dateStr, slot.toLowerCase());
                                                    }}
                                                    style={{
                                                        position: 'absolute',
                                                        top: '-10px',
                                                        right: '-10px',
                                                        background: '#ef4444',
                                                        border: '2px solid #1a1b1e',
                                                        borderRadius: '50%',
                                                        width: '28px',
                                                        height: '28px',
                                                        color: '#fff',
                                                        fontSize: '14px',
                                                        cursor: 'pointer',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        boxShadow: '0 4px 12px rgba(239, 68, 68, 0.4)'
                                                    }}
                                                >✕</button>
                                            )}
                                        </>
                                    ) : (
                                        <div style={{ opacity: isPlanConfirmed ? 0.2 : 0.6 }}>
                                            <div style={{ fontSize: '1.5rem', marginBottom: '0.2rem' }}>{highlightMode ? '🎯' : '+'}</div>
                                            <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase' }}>{slot}</span>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                ))}
            </div>


            {
                selecting && (
                    <RecipeSelector
                        slot={selecting.slot}
                        onSelect={(recipe) => {
                            addToPlan(selecting.date, selecting.slot, recipe);
                            setSelecting(null);
                        }}
                        onClose={() => setSelecting(null)}
                    />
                )
            }
        </div>
    );
}

