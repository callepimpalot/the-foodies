import React from 'react';
import { X } from 'lucide-react';
import { FilterChip } from './FilterChip';

export function RecipeFilterSheet({ groups, activeKeys, onToggle, onClear, onClose }) {
    return (
        <div
            style={{
                position: 'fixed',
                inset: 0,
                zIndex: 110,
                background: 'rgba(0,0,0,0.5)',
                backdropFilter: 'blur(8px)',
                display: 'flex',
                alignItems: 'flex-end',
                justifyContent: 'center',
            }}
            onClick={onClose}
        >
            <div
                onClick={(e) => e.stopPropagation()}
                className="animate-slide-up"
                style={{
                    width: '100%',
                    maxWidth: '600px',
                    maxHeight: '80vh',
                    background: 'var(--zinc-900)',
                    borderTop: '1px solid var(--zinc-700)',
                    borderRadius: 'var(--radius-xl) var(--radius-xl) 0 0',
                    padding: '1.5rem 1.5rem 2rem',
                    overflowY: 'auto',
                    color: 'var(--zinc-200)',
                }}
            >
                <div style={{ width: 40, height: 4, background: 'var(--zinc-700)', borderRadius: 2, margin: '0 auto 1.5rem' }} />

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                    <h3 className="t-heading-md" style={{ margin: 0 }}>Filters</h3>
                    <button onClick={onClose} aria-label="Close filters" style={{ color: 'var(--zinc-500)', display: 'flex' }}>
                        <X size={20} strokeWidth={1.5} />
                    </button>
                </div>

                {groups.map((group) => (
                    <div key={group.id} style={{ marginBottom: '1.75rem' }}>
                        <p className="t-eyebrow" style={{ marginBottom: '0.75rem' }}>{group.label}</p>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                            {group.options.map((option) => {
                                const key = `${group.id}:${option.id}`;
                                return (
                                    <FilterChip
                                        key={key}
                                        label={option.label}
                                        active={activeKeys.includes(key)}
                                        onClick={() => onToggle(key)}
                                    />
                                );
                            })}
                        </div>
                    </div>
                ))}

                <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
                    <button className="btn-secondary" style={{ flex: 1 }} onClick={onClear}>Clear all</button>
                    <button className="btn-primary" style={{ flex: 2 }} onClick={onClose}>Show results</button>
                </div>
            </div>
        </div>
    );
}
