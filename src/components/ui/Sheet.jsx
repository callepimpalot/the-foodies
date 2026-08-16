import React from 'react';
import { X } from 'lucide-react';

/**
 * Shared bottom-sheet / modal wrapper. Replaces the hand-rolled
 * overlay+panel markup that used to be duplicated in every modal.
 *
 * - `surface="ticket"` (default) — kraft-paper panel, for content pulled
 *   off the rail (recipe detail, filters, add-to-plan).
 * - `surface="board"` — dark chrome panel, for app-level chrome (settings,
 *   pickers that aren't "about a recipe").
 */
export function Sheet({ onClose, title, footer, surface = 'ticket', children }) {
    const isTicket = surface === 'ticket';
    return (
        <div
            onClick={onClose}
            style={{
                position: 'fixed',
                inset: 0,
                zIndex: 50,
                display: 'flex',
                alignItems: 'flex-end',
                justifyContent: 'center',
                background: 'rgba(20, 33, 27, 0.72)',
                backdropFilter: 'blur(6px)',
            }}
        >
            <div
                className={`animate-slide-up ${isTicket ? 'card' : 'card-board'}`}
                onClick={(e) => e.stopPropagation()}
                style={{
                    width: '100%',
                    maxWidth: '480px',
                    maxHeight: '88vh',
                    overflowY: 'auto',
                    borderBottomLeftRadius: 0,
                    borderBottomRightRadius: 0,
                    padding: '20px 20px calc(20px + env(safe-area-inset-bottom, 0px))',
                }}
            >
                {(title || onClose) && (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                        {title ? <h2 className="t-heading-md">{title}</h2> : <span />}
                        {onClose && (
                            <button
                                onClick={onClose}
                                className="icon-btn"
                                style={isTicket ? { borderColor: 'var(--ticket-shadow)', color: 'var(--ink-dim)' } : undefined}
                                aria-label="Close"
                            >
                                <X size={16} />
                            </button>
                        )}
                    </div>
                )}

                {children}

                {footer && (
                    <div style={{ display: 'flex', gap: '12px', marginTop: '20px' }}>
                        {footer}
                    </div>
                )}
            </div>
        </div>
    );
}
