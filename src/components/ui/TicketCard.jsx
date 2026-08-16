import React from 'react';

/**
 * The kraft-paper "ticket" card primitive.
 * `torn` adds the zigzag torn-top edge + punch hole (hero/plan cards).
 * `eyebrow` renders a small stamp badge above the title.
 */
export function TicketCard({ torn = false, eyebrow, className = '', children, ...props }) {
    const classes = ['card', torn ? 'card-torn' : '', className].filter(Boolean).join(' ');
    return (
        <div className={classes} style={{ position: 'relative', padding: torn ? '24px 20px 20px' : '20px' }} {...props}>
            {torn && <div className="card-punch" />}
            {eyebrow && <span className="badge-stamp" style={{ display: 'inline-block', transform: 'rotate(-2deg)' }}>{eyebrow}</span>}
            {children}
        </div>
    );
}

/** A card that sits directly on the board (dark-on-dark), for non-content chrome panels. */
export function BoardCard({ className = '', children, ...props }) {
    return (
        <div className={`card-board ${className}`.trim()} style={{ padding: '20px' }} {...props}>
            {children}
        </div>
    );
}
