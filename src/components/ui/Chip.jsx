import React from 'react';

/**
 * Tag / badge / filter pill primitive.
 * `variant="filter"` is an interactive toggle (active = stamp-tinted).
 * `variant="tag"` is a static label (difficulty, category, etc).
 */
export function Chip({ variant = 'tag', active = false, label, onClick, className = '', children, ...props }) {
    if (variant === 'filter') {
        return (
            <button
                onClick={onClick}
                className={className}
                style={{
                    fontFamily: 'var(--f-mono)',
                    fontSize: '11px',
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                    padding: '8px 14px',
                    borderRadius: 'var(--r-sm)',
                    whiteSpace: 'nowrap',
                    flexShrink: 0,
                    transition: 'background var(--t-fast), color var(--t-fast), border-color var(--t-fast)',
                    background: active ? 'var(--stamp-tint)' : 'transparent',
                    color: active ? 'var(--stamp)' : 'var(--chalk-dim)',
                    border: `1px solid ${active ? 'var(--stamp)' : 'var(--line)'}`,
                    cursor: 'pointer',
                }}
                {...props}
            >
                {label ?? children}
            </button>
        );
    }

    return (
        <span className={`tag ${className}`.trim()} {...props}>
            {label ?? children}
        </span>
    );
}
