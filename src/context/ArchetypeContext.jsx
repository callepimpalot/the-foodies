import { createContext, useContext, useState, useEffect } from 'react';

const ArchetypeContext = createContext();

export const ARCHETYPES = {
    TRAINING: {
        id: 'TRAINING',
        label: 'The Solo High-Performer',
        description: 'Focus on protein targets and easy digestion.',
        glow: 'var(--glow-training)',
        accent: 'cyan'
    },
    FAMILY: {
        id: 'FAMILY',
        label: 'The Family Orchestrator',
        description: 'Bulk prep, kid-friendly swaps, and efficiency.',
        glow: 'var(--glow-family)',
        accent: 'amber'
    },
    STUDENT: {
        id: 'STUDENT',
        label: 'The Culinary Student',
        description: 'Focus on skill-building and technique.',
        glow: 'var(--glow-student)',
        accent: 'green'
    },
    MINIMALIST: {
        id: 'MINIMALIST',
        label: 'The Minimalist',
        description: '15-minute meals and high-efficiency runs.',
        glow: 'var(--glow-minimalist)',
        accent: 'pink'
    }
};

export function ArchetypeProvider({ children }) {
    const [activeArchetype, setActiveArchetype] = useState(() => {
        const saved = localStorage.getItem('meal_buddy_archetype');
        return saved ? JSON.parse(saved) : ARCHETYPES.TRAINING;
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

export function useArchetype() {
    const context = useContext(ArchetypeContext);
    if (!context) {
        throw new Error('useArchetype must be used within an ArchetypeProvider');
    }
    return context;
}
