import React from 'react';
import { FilterChip } from './FilterChip';
import { Sheet } from './ui/Sheet';
import { Button } from './ui/Button';

export function RecipeFilterSheet({ groups, activeKeys, onToggle, onClear, onClose }) {
    return (
        <Sheet
            onClose={onClose}
            title="Filters"
            surface="board"
            footer={
                <>
                    <Button variant="secondary" onClick={onClear} style={{ flex: 1 }}>Clear all</Button>
                    <Button variant="primary" onClick={onClose} style={{ flex: 2 }}>Show results</Button>
                </>
            }
        >
            {groups.map((group) => (
                <div key={group.id} style={{ marginBottom: 'var(--sp-6)' }}>
                    <p className="t-eyebrow" style={{ marginBottom: 'var(--sp-3)', color: 'var(--chalk-dim)' }}>{group.label}</p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--sp-2)' }}>
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
        </Sheet>
    );
}
