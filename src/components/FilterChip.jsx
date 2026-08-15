import React from 'react';

export function FilterChip({ label, active, onClick }) {
    return (
        <button
            onClick={onClick}
            style={{
                padding: '0.5rem 1rem',
                borderRadius: 'var(--radius-pill)',
                fontFamily: 'var(--font-ui)',
                fontWeight: 600,
                fontSize: '0.8rem',
                whiteSpace: 'nowrap',
                flexShrink: 0,
                transition: 'all var(--transition-fast)',
                background: active ? 'var(--gold-bg)' : 'rgba(255,255,255,0.05)',
                color: active ? 'var(--gold)' : 'var(--zinc-400)',
                border: `1px solid ${active ? 'var(--gold-border)' : 'rgba(255,255,255,0.1)'}`,
                cursor: 'pointer',
            }}
        >
            {label}
        </button>
    );
}
