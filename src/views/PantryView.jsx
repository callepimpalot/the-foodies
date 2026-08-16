import React, { useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { Inventory } from '../components/Inventory';
import { PantryCheckSession } from '../components/PantryCheckSession';
import { Button } from '../components/ui/Button';
import { TicketCard } from '../components/ui/TicketCard';

export function PantryView() {
    const [isChecking, setIsChecking] = useState(false);

    if (isChecking) {
        return <PantryCheckSession onComplete={() => setIsChecking(false)} />;
    }

    return (
        <div className="w-full max-w-[800px] mx-auto h-full flex flex-col gap-8">
            <TicketCard torn eyebrow="Weekly Ritual">
                <div className="flex items-center justify-between gap-4 flex-wrap" style={{ marginTop: '4px' }}>
                    <div>
                        <h3 className="t-heading-md">Home Reset</h3>
                        <p className="t-body" style={{ color: 'var(--ink-dim)', marginTop: '4px' }}>
                            Get your home ready for the week
                        </p>
                    </div>
                    <Button
                        variant="primary"
                        onClick={() => setIsChecking(true)}
                        className="flex items-center gap-2 shrink-0"
                    >
                        Start Household Check
                        <ArrowRight size={16} />
                    </Button>
                </div>
            </TicketCard>
            <Inventory />
        </div>
    );
}
