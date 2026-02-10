import React, { useState } from 'react';

export function AddToPlanModal({ recipe, onClose, onConfirm }) {
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
    const [selectedType, setSelectedType] = useState('dinner');

    // Generate next 7 days
    const next7Days = Array.from({ length: 7 }, (_, i) => {
        const date = new Date();
        date.setDate(date.getDate() + i);
        return {
            date: date.toISOString().split('T')[0],
            label: date.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric' }),
            fullLabel: date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
        };
    });

    const handleConfirm = () => {
        onConfirm(selectedDate, selectedType, recipe);
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div
                className="card animate-slide-up"
                onClick={(e) => e.stopPropagation()}
                style={{
                    width: '100%',
                    maxWidth: '400px',
                    padding: '24px',
                    margin: '16px'
                }}
            >
                <h2 className="title-lg" style={{ marginBottom: '24px', textAlign: 'center' }}>
                    Add to Plan
                </h2>

                <div style={{ marginBottom: '24px' }}>
                    <label className="title-md" style={{ display: 'block', marginBottom: '12px' }}>
                        Select Day
                    </label>
                    <div className="section-scroll" style={{ padding: '4px 0 12px 0', margin: '0' }}>
                        {next7Days.map((day) => (
                            <button
                                key={day.date}
                                onClick={() => setSelectedDate(day.date)}
                                style={{
                                    minWidth: '70px',
                                    padding: '12px 8px',
                                    borderRadius: '12px',
                                    border: selectedDate === day.date ? '2px solid var(--color-primary)' : '1px solid var(--color-surface-dim)',
                                    background: selectedDate === day.date ? 'var(--color-primary-dim)' : 'var(--color-surface)',
                                    color: selectedDate === day.date ? 'var(--color-primary)' : 'var(--color-text-secondary)',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    gap: '4px',
                                    flexShrink: 0
                                }}
                            >
                                <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>{day.label.split(' ')[0]}</span>
                                <span style={{ fontSize: '1rem', fontWeight: 700 }}>{day.label.split(' ')[1]}</span>
                            </button>
                        ))}
                    </div>
                </div>

                <div style={{ marginBottom: '24px' }}>
                    <label className="title-md" style={{ display: 'block', marginBottom: '12px' }}>
                        Meal Type
                    </label>
                    <div style={{ display: 'flex', gap: '12px' }}>
                        {['breakfast', 'lunch', 'dinner'].map((type) => (
                            <button
                                key={type}
                                onClick={() => setSelectedType(type)}
                                style={{
                                    flex: 1,
                                    padding: '12px',
                                    borderRadius: '12px',
                                    border: selectedType === type ? '2px solid var(--color-primary)' : '1px solid var(--color-surface-dim)',
                                    background: selectedType === type ? 'var(--color-primary-dim)' : 'var(--color-surface)',
                                    color: selectedType === type ? 'var(--color-primary)' : 'var(--color-text-secondary)',
                                    fontWeight: 600,
                                    textTransform: 'capitalize',
                                    cursor: 'pointer'
                                }}
                            >
                                {type}
                            </button>
                        ))}
                    </div>
                </div>

                <div style={{ display: 'flex', gap: '12px', marginTop: '32px' }}>
                    <button
                        className="btn-primary"
                        style={{ flex: 1, background: 'var(--color-surface-dim)', color: 'var(--color-text-secondary)', boxShadow: 'none' }}
                        onClick={onClose}
                    >
                        Cancel
                    </button>
                    <button
                        className="btn-primary"
                        style={{ flex: 2 }}
                        onClick={handleConfirm}
                    >
                        Confirm
                    </button>
                </div>
            </div>
        </div>
    );
}
