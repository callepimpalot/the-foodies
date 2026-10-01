import { createContext, useContext } from 'react';

/**
 * Non-component exports for the archetype feature.
 *
 * These live outside `ArchetypeContext.jsx` on purpose: `react-refresh` (the
 * Vite fast-refresh lint rule) requires a module that exports a component to
 * export nothing else, and this file exports no components at all.
 */

export const ArchetypeContext = createContext();

export const ARCHETYPES = {
    TRAINING: {
        id: 'TRAINING',
        label: 'The Solo High-Performer',
        description: 'Focus on protein targets and easy digestion.',
        glow: 'var(--glow-training)',
        accent: 'gold'
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

export function useArchetype() {
    const context = useContext(ArchetypeContext);
    if (!context) {
        throw new Error('useArchetype must be used within an ArchetypeProvider');
    }
    return context;
}
