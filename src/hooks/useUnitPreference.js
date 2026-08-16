import { useState } from 'react';
import { getUnitSystem, setUnitSystem as persistUnitSystem } from '../lib/unitPreference';

// Thin React wrapper around the localStorage-backed unit preference, for the toggle UI.
export function useUnitPreference() {
    const [unitSystem, setUnitSystemState] = useState(getUnitSystem);

    const setUnitSystem = (value) => {
        setUnitSystemState(persistUnitSystem(value));
    };

    return { unitSystem, setUnitSystem };
}
