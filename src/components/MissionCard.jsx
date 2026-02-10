import React from 'react';

export function MissionCard({ archetype, isActive, onClick }) {
    // Use the CSS variable directly in rgba/rgb functions
    // e.g. rgba(var(--glow-training), 0.6) is valid CSS3
    const glowVar = archetype.glow;

    return (
        <div
            onClick={onClick}
            className={`glass-panel ${isActive ? 'active' : ''}`}
            style={{
                padding: '1.5rem',
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'all 0.3s ease',
                border: isActive ? `1px solid rgba(${glowVar}, 0.6)` : '1px solid var(--color-glass-border)',
                boxShadow: isActive ? `0 0 20px rgba(${glowVar}, 0.2)` : 'none',
                transform: isActive ? 'scale(1.02)' : 'scale(1)',
                position: 'relative',
                overflow: 'hidden'
            }}
        >
            {/* Selection Indicator */}
            {isActive && (
                <div style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '4px',
                    height: '100%',
                    backgroundColor: `rgb(${glowVar})`
                }} />
            )}

            <h3 style={{
                fontSize: '1.25rem',
                fontWeight: 600,
                marginBottom: '0.5rem',
                color: isActive ? '#fff' : 'var(--color-text-secondary)'
            }}>
                {archetype.label}
            </h3>
            <p style={{
                fontSize: '0.9rem',
                color: 'var(--color-text-secondary)',
                lineHeight: 1.4
            }}>
                {archetype.description}
            </p>
        </div>
    );
}
