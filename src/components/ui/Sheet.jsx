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
    const dividerColor = isTicket ? 'var(--ticket-shadow)' : 'var(--line)';
    return (
        <div
            onClick={onClose}
            style={{
                position: 'fixed',
                inset: 0,
                zIndex: 60,
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
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'hidden',
                    borderBottomLeftRadius: 0,
                    borderBottomRightRadius: 0,
                }}
            >
                {/* Header — stays put; only the body below scrolls */}
                {(title || onClose) && (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 20px 12px', flexShrink: 0 }}>
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

                {/* Scrollable body — carries its own safe-area padding when there's no footer to carry it */}
                <div
                    style={{
                        overflowY: 'auto',
                        flex: 1,
                        minHeight: 0,
                        paddingTop: (title || onClose) ? 0 : 20,
                        paddingLeft: 20,
                        paddingRight: 20,
                        paddingBottom: footer ? 20 : 'calc(20px + env(safe-area-inset-bottom, 0px))',
                    }}
                >
                    {children}
                </div>

                {/* Footer — pinned below the scroll area, always reachable without scrolling past content */}
                {footer && (
                    <div
                        style={{
                            display: 'flex',
                            gap: '12px',
                            flexShrink: 0,
                            padding: `16px 20px calc(16px + env(safe-area-inset-bottom, 0px))`,
                            borderTop: `1px solid ${dividerColor}`,
                        }}
                    >
                        {footer}
                    </div>
                )}
            </div>
        </div>
    );
}
