import React, { useState } from 'react';
import { JackpotModal } from '../components/Jackpot';
import { WeeklyCalendar } from '../components/WeeklyCalendar';
import { AutoPopulateModal } from '../components/AutoPopulateModal';
import { useArchetype } from '../context/ArchetypeContext';
import { usePlan } from '../context/PlanContext';
import { RecipeSelector } from '../components/RecipeSelector';

export function PlanView() {
    const { activeArchetype } = useArchetype();
    const { isPlanConfirmed, toggleConfirmation, weeklyPlan, addToPlan } = usePlan();

    // UI State
    const [viewMode, setViewMode] = useState('DEFAULT'); // DEFAULT, JACKPOT_SELECT
    const [showAutoModal, setShowAutoModal] = useState(false);
    const [jackpotTarget, setJackpotTarget] = useState(null); // { date, slot }
    const [manualSelect, setManualSelect] = useState(null); // { date, slot }

    const glowVar = activeArchetype.glow;
    const hasItemsInPlan = Object.keys(weeklyPlan).length > 0;

    const handleSlotClick = (dateStr, slot) => {
        if (viewMode === 'JACKPOT_SELECT') {
            setJackpotTarget({ date: dateStr, slot, dayName: new Date(dateStr).toLocaleDateString('en-US', { weekday: 'long' }) });
            setViewMode('DEFAULT');
        } else {
            // Default Manual Mode
            setManualSelect({ date: dateStr, slot });
        }
    };

    return (
        <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', position: 'relative' }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1rem' }}>
                <h2 className="title-display" style={{ fontSize: '2rem', margin: 0 }}>
                    {viewMode === 'JACKPOT_SELECT' ? 'Select a Meal to Spin!' : 'Planning HQ'}
                </h2>
            </div>

            {/* Main Calendar Area - Always Visible */}
            <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                <WeeklyCalendar
                    onSlotClick={handleSlotClick}
                    highlightMode={viewMode === 'JACKPOT_SELECT'}
                />
            </div>

            {/* Control Panel (Bottom) */}
            <div style={{
                marginTop: '1rem',
                background: 'rgba(0,0,0,0.2)',
                backdropFilter: 'blur(10px)',
                borderRadius: '24px 24px 0 0',
                padding: '1.5rem',
                borderTop: '1px solid rgba(255,255,255,0.05)'
            }}>
                {isPlanConfirmed ? (
                    <div style={{ textAlign: 'center' }}>
                        <p style={{ margin: 0, marginBottom: '1rem', color: '#10b981' }}>
                            Your plan is locked and ready for shopping!
                        </p>
                        <button
                            className="btn-primary"
                            onClick={toggleConfirmation}
                            style={{ width: '100%', background: 'rgba(255,255,255,0.1)' }}
                        >
                            Unlock Plan to Edit
                        </button>
                    </div>
                ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
                        {/* Auto Button */}
                        <div
                            className="glass-panel"
                            onClick={() => setShowAutoModal(true)}
                            style={{
                                padding: '1rem',
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '0.5rem',
                                cursor: 'pointer',
                                textAlign: 'center',
                                border: '1px solid rgba(255,255,255,0.05)'
                            }}
                        >
                            <span style={{ fontSize: '1.5rem' }}>✨</span>
                            <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>Auto Fill</span>
                        </div>

                        {/* Jackpot Button */}
                        <div
                            className="glass-panel"
                            onClick={() => setViewMode(viewMode === 'JACKPOT_SELECT' ? 'DEFAULT' : 'JACKPOT_SELECT')}
                            style={{
                                padding: '1rem',
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '0.5rem',
                                cursor: 'pointer',
                                textAlign: 'center',
                                border: viewMode === 'JACKPOT_SELECT' ? `1px solid rgb(${glowVar})` : '1px solid rgba(255,255,255,0.05)',
                                background: viewMode === 'JACKPOT_SELECT' ? `rgba(${glowVar}, 0.1)` : undefined,
                                transform: viewMode === 'JACKPOT_SELECT' ? 'scale(1.05)' : 'none',
                                transition: 'all 0.2s'
                            }}
                        >
                            <span style={{ fontSize: '1.5rem' }}>🎰</span>
                            <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>{viewMode === 'JACKPOT_SELECT' ? 'Cancel' : 'Jackpot'}</span>
                        </div>

                        {/* Clear/Confirm Button */}
                        {hasItemsInPlan ? (
                            <div
                                className="glass-panel"
                                onClick={toggleConfirmation}
                                style={{
                                    padding: '1rem',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '0.5rem',
                                    cursor: 'pointer',
                                    textAlign: 'center',
                                    background: `rgba(${glowVar}, 0.2)`,
                                    border: `1px solid rgba(${glowVar}, 0.3)`
                                }}
                            >
                                <span style={{ fontSize: '1.5rem' }}>✅</span>
                                <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>Confirm</span>
                            </div>
                        ) : (
                            <div
                                className="glass-panel"
                                style={{
                                    padding: '1rem',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '0.5rem',
                                    opacity: 0.5
                                }}
                            >
                                <span style={{ fontSize: '1.5rem' }}>Start</span>
                                <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>Planning</span>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Modals */}
            {showAutoModal && (
                <AutoPopulateModal onClose={() => setShowAutoModal(false)} />
            )}

            <JackpotModal
                isOpen={!!jackpotTarget}
                onClose={() => setJackpotTarget(null)}
                targetSlot={jackpotTarget}
            />

            {manualSelect && (
                <RecipeSelector
                    slot={manualSelect.slot}
                    onSelect={(recipe) => {
                        addToPlan(manualSelect.date, manualSelect.slot, recipe);
                        setManualSelect(null);
                    }}
                    onClose={() => setManualSelect(null)}
                />
            )}
        </div>
    );
}

