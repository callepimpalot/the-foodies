import React from 'react';
import { useInventory } from '../context/InventoryContext';
import { Inventory } from '../components/Inventory';
import { Button } from '../components/ui/Button';
import { TicketCard } from '../components/ui/TicketCard';

export function PantryView() {
    const { items, clearFlags } = useInventory();
    const flaggedCount = items.filter(i => i.flagged).length;

    return (
        <div className="w-full max-w-[800px] mx-auto h-full flex flex-col gap-8">
            <TicketCard torn eyebrow="Weekly Ritual">
                <div className="flex items-center justify-between gap-4 flex-wrap" style={{ marginTop: '4px' }}>
                    <div>
                        <h3 className="t-heading-md">Household Essentials</h3>
                        <p className="t-body" style={{ color: 'var(--ink-dim)', marginTop: '4px' }}>
                            {flaggedCount === 0 ? (
                                'All good — tap anything you need to restock'
                            ) : (
                                <>
                                    <span className="t-mono">{flaggedCount}</span>{' '}
                                    {flaggedCount === 1 ? 'item' : 'items'} flagged
                                </>
                            )}
                        </p>
                    </div>
                    {flaggedCount > 0 && (
                        <Button variant="ghost" onClick={clearFlags} className="shrink-0">
                            Clear All
                        </Button>
                    )}
                </div>
            </TicketCard>
            <Inventory />
        </div>
    );
}
