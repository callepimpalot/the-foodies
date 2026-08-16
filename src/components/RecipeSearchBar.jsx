import React from 'react';
import { Search, X } from 'lucide-react';

export function RecipeSearchBar({ value, onChange }) {
    return (
        <div className="input flex items-center gap-2 w-full">
            <Search size={18} strokeWidth={1.5} color="var(--chalk-dim)" style={{ flexShrink: 0 }} />
            <input
                type="text"
                inputMode="search"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder="Search recipes, ingredients, tags..."
                className="flex-1 bg-transparent outline-none t-body"
                style={{ color: 'var(--chalk)', border: 'none', padding: 0 }}
            />
            {value && (
                <button
                    onClick={() => onChange('')}
                    aria-label="Clear search"
                    style={{ color: 'var(--chalk-dim)', display: 'flex', flexShrink: 0, background: 'none', border: 'none', cursor: 'pointer' }}
                >
                    <X size={16} strokeWidth={1.5} />
                </button>
            )}
        </div>
    );
}
