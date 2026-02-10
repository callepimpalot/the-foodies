import React from 'react';

export function PreferenceSlider({ label, value, onChange, min, max, leftLabel, rightLabel, color = 'var(--color-primary)' }) {
    return (
        <div style={{ marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <span style={{ fontWeight: '600' }}>{label}</span>
                <span style={{ color: 'var(--color-text-secondary)', fontSize: '0.9rem' }}>
                    {value > 50 ? rightLabel : leftLabel} ({value})
                </span>
            </div>
            <div style={{ position: 'relative', height: '24px', display: 'flex', alignItems: 'center' }}>
                {/* Track */}
                <div style={{
                    width: '100%',
                    height: '8px',
                    background: 'var(--color-surface-dim)',
                    borderRadius: '4px',
                    position: 'absolute'
                }} />

                {/* Fill */}
                <div style={{
                    width: `${((value - min) / (max - min)) * 100}%`,
                    height: '8px',
                    background: color,
                    borderRadius: '4px',
                    position: 'absolute'
                }} />

                {/* Input */}
                <input
                    type="range"
                    min={min}
                    max={max}
                    value={value}
                    onChange={(e) => onChange(Number(e.target.value))}
                    style={{
                        width: '100%',
                        position: 'absolute',
                        opacity: 0,
                        cursor: 'pointer',
                        height: '100%'
                    }}
                />

                {/* Thumb Visual (simple circle) */}
                <div style={{
                    width: '20px',
                    height: '20px',
                    background: '#fff',
                    border: `2px solid ${color}`,
                    borderRadius: '50%',
                    position: 'absolute',
                    left: `calc(${((value - min) / (max - min)) * 100}% - 10px)`,
                    pointerEvents: 'none',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.25rem', fontSize: '0.8rem', color: 'var(--color-text-tertiary)' }}>
                <span>{leftLabel}</span>
                <span>{rightLabel}</span>
            </div>
        </div>
    );
}
