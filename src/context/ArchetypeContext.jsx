import { useState, useEffect } from 'react';
import { ArchetypeContext, ARCHETYPES } from './archetypes';

export function ArchetypeProvider({ children }) {
    const [activeArchetype, setActiveArchetype] = useState(() => {
        try {
            const saved = localStorage.getItem('meal_buddy_archetype');
            return saved ? JSON.parse(saved) : ARCHETYPES.TRAINING;
        } catch (e) {
            console.error('Failed to parse archetype:', e);
            return ARCHETYPES.TRAINING;
        }
    });

    // Effect to sync CSS variable with state
    useEffect(() => {
        document.documentElement.style.setProperty('--active-glow', activeArchetype.glow);
        localStorage.setItem('meal_buddy_archetype', JSON.stringify(activeArchetype));
    }, [activeArchetype]);

    const value = {
        activeArchetype,
        setActiveArchetype,
        archetypes: Object.values(ARCHETYPES)
    };

    return (
        <ArchetypeContext.Provider value={value}>
            {children}
        </ArchetypeContext.Provider>
    );
}
