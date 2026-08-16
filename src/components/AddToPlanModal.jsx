import React, { useState } from 'react';
import { Sheet } from './ui/Sheet';
import { Button } from './ui/Button';

export function AddToPlanModal({ recipe, onClose, onConfirm }) {
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

    // Generate next 7 days
    const next7Days = Array.from({ length: 7 }, (_, i) => {
        const date = new Date();
        date.setDate(date.getDate() + i);
        return {
            date: date.toISOString().split('T')[0],
            weekday: date.toLocaleDateString('en-US', { weekday: 'short' }),
            day: date.getDate(),
        };
    });

    const handleConfirm = () => {
        onConfirm(selectedDate, recipe);
    };

    return (
        <Sheet
            title="Add to Plan"
            onClose={onClose}
            footer={
                <>
                    <Button variant="secondary" className="flex-1" onClick={onClose}>Cancel</Button>
                    <Button variant="primary" className="flex-[2]" onClick={handleConfirm}>Confirm</Button>
                </>
            }
        >
            <p className="t-label" style={{ color: 'var(--ink-dim)', marginBottom: '12px' }}>
                Select Day
            </p>
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                {next7Days.map((d) => {
                    const active = selectedDate === d.date;
                    return (
                        <button
                            key={d.date}
                            onClick={() => setSelectedDate(d.date)}
                            className="flex flex-col items-center gap-1 shrink-0 transition-colors"
                            style={{
                                minWidth: '62px',
                                padding: '12px 8px',
                                borderRadius: 'var(--r-md)',
                                border: `1px solid ${active ? 'var(--stamp)' : 'var(--ticket-shadow)'}`,
                                background: active ? 'var(--stamp-tint)' : 'transparent',
                                color: active ? 'var(--stamp)' : 'var(--ink-dim)',
                            }}
                        >
                            <span className="t-label" style={{ letterSpacing: '0.04em' }}>{d.weekday}</span>
                            <span className="t-mono" style={{ fontSize: '16px', fontWeight: 700 }}>{d.day}</span>
                        </button>
                    );
                })}
            </div>
        </Sheet>
    );
}
