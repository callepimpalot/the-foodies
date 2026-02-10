import React, { useState } from 'react';
import { Inventory } from '../components/Inventory';
import { PantryCheckSession } from '../components/PantryCheckSession';

export function PantryView() {
    const [isChecking, setIsChecking] = useState(false);

    if (isChecking) {
        return <PantryCheckSession onComplete={() => setIsChecking(false)} />;
    }

    return (
        <div style={{ width: '100%', maxWidth: '800px', margin: '0 auto', height: '100%', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                    <h3 style={{ margin: 0 }}>Home Reset</h3>
                    <p style={{ margin: 0, fontSize: '0.8rem', opacity: 0.7 }}>Get your home ready for the week</p>
                </div>
                <button
                    className="btn-primary"
                    onClick={() => setIsChecking(true)}
                    style={{ padding: '0.75rem 1.5rem', boxShadow: '0 4px 12px rgba(var(--active-glow), 0.2)' }}
                >
                    Start Household Check ➔
                </button>
            </div>
            <Inventory />
        </div>
    );
}
