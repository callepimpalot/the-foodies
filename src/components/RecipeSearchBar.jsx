import React from 'react';
import { Search, X } from 'lucide-react';

export function RecipeSearchBar({ value, onChange }) {
    return (
        <div
            className="flex items-center gap-2 w-full"
            style={{
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 'var(--radius-lg)',
                padding: '0.75rem 1rem',
            }}
        >
            <Search size={18} strokeWidth={1.5} color="var(--zinc-500)" style={{ flexShrink: 0 }} />
            <input
                type="text"
                inputMode="search"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder="Search recipes, ingredients, tags..."
                className="flex-1 bg-transparent outline-none text-sm"
                style={{ color: 'var(--zinc-200)', fontFamily: 'var(--font-ui)', border: 'none', padding: 0 }}
            />
            {value && (
                <button
                    onClick={() => onChange('')}
                    aria-label="Clear search"
                    style={{ color: 'var(--zinc-500)', display: 'flex', flexShrink: 0 }}
                >
                    <X size={16} strokeWidth={1.5} />
                </button>
            )}
        </div>
    );
}
