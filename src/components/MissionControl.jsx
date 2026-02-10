import React from 'react';
import { useArchetype } from '../context/ArchetypeContext';
import { MissionCard } from './MissionCard';

export function MissionControl() {
    const { activeArchetype, setActiveArchetype, archetypes } = useArchetype();

    return (
        <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: '1rem',
            marginTop: '2rem',
            width: '100%'
        }}>
            {archetypes.map((arch) => (
                <MissionCard
                    key={arch.id}
                    archetype={arch}
                    isActive={activeArchetype.id === arch.id}
                    onClick={() => setActiveArchetype(arch)}
                />
            ))}
        </div>
    );
}
