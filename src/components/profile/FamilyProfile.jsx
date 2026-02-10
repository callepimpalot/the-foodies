import React, { useState } from 'react';
import { useFamily } from '../../context/FamilyContext';
import { BackgroundCanvas } from './BackgroundCanvas';
import { LivingStyleSelector } from './LivingStyleSelector';
import { MemberAvatar } from './MemberAvatar';
import { PreferenceSlider } from './PreferenceSlider';

const TABS = [
    { id: 'HOME', label: 'Our Home' },
    { id: 'CREW', label: 'The Crew' },
    { id: 'RULES', label: 'Kitchen Rules' }
];

const MEMBER_TYPES = [
    { type: 'DAD', label: 'Dad', icon: '👨' },
    { type: 'MOM', label: 'Mom', icon: '👩' },
    { type: 'KID', label: 'Kid', icon: '👶' },
    { type: 'PET', label: 'Pet', icon: '🐶' } // Generic pet
];

const ALLERGIES = ['Peanuts', 'Dairy', 'Gluten', 'Eggs', 'Shellfish', 'Soy'];

export function FamilyProfile({ onClose }) {
    const {
        familyData,
        updateFamilyName,
        addMember,
        removeMember,
        updatePreferences,
        toggleAllergy
    } = useFamily();
    const [activeTab, setActiveTab] = useState('HOME');

    const handleAddMember = (type) => {
        const count = familyData.members.filter(m => m.type === type).length;
        addMember({
            type,
            name: `${type.charAt(0) + type.slice(1).toLowerCase()} ${count + 1}`,
            avatar: 'default'
        });
    };

    return (
        <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            zIndex: 100,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column'
        }}>
            {/* Background Layer */}
            <BackgroundCanvas style={familyData.livingStyle} />

            {/* Header / Nav */}
            <div style={{
                position: 'relative',
                zIndex: 10,
                padding: '1rem 2rem',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                background: 'rgba(255,255,255,0.1)',
                backdropFilter: 'blur(10px)',
                borderBottom: '1px solid rgba(255,255,255,0.2)'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <button
                        onClick={onClose}
                        style={{
                            background: 'rgba(0,0,0,0.2)',
                            border: 'none',
                            color: 'white',
                            width: '40px',
                            height: '40px',
                            borderRadius: '50%',
                            fontSize: '1.2rem',
                            cursor: 'pointer'
                        }}
                    >
                        ←
                    </button>
                    <input
                        value={familyData.name}
                        onChange={(e) => updateFamilyName(e.target.value)}
                        style={{
                            background: 'transparent',
                            border: 'none',
                            color: 'white',
                            fontSize: '1.5rem',
                            fontWeight: 'bold',
                            textShadow: '0 2px 4px rgba(0,0,0,0.3)',
                            width: '300px'
                        }}
                    />
                </div>

                <div style={{ display: 'flex', gap: '1rem' }}>
                    {TABS.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            style={{
                                background: activeTab === tab.id ? 'white' : 'rgba(255,255,255,0.2)',
                                color: activeTab === tab.id ? 'var(--color-primary)' : 'white',
                                border: 'none',
                                padding: '0.5rem 1.5rem',
                                borderRadius: '20px',
                                cursor: 'pointer',
                                fontWeight: '600',
                                transition: 'all 0.2s ease'
                            }}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Content Overlay */}
            <div style={{
                position: 'relative',
                zIndex: 10,
                flex: 1,
                padding: '2rem',
                overflowY: 'auto',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'start'
            }}>
                <div style={{
                    background: 'rgba(255, 255, 255, 0.85)',
                    backdropFilter: 'blur(20px)',
                    borderRadius: '24px',
                    padding: '2rem',
                    width: '100%',
                    maxWidth: '800px',
                    boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
                    animation: 'fadeIn 0.3s ease-out'
                }}>
                    <style>{`@keyframes fadeIn { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }`}</style>

                    {activeTab === 'HOME' && (
                        <div>
                            <h2 className="title-lg" style={{ marginBottom: '1.5rem' }}>Where do we live?</h2>
                            <LivingStyleSelector />
                            <p style={{ marginTop: '1rem', color: '#666' }}>
                                This sets the vibe for your meal planning environment!
                            </p>
                        </div>
                    )}

                    {activeTab === 'CREW' && (
                        <div>
                            <h2 className="title-lg" style={{ marginBottom: '1.5rem' }}>Family Members</h2>

                            {/* Member List */}
                            <div style={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
                                gap: '1rem',
                                marginBottom: '2rem'
                            }}>
                                {familyData.members.map(member => (
                                    <div key={member.id} style={{
                                        background: 'white',
                                        padding: '1rem',
                                        borderRadius: '16px',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        alignItems: 'center',
                                        boxShadow: 'var(--shadow-sm)',
                                        position: 'relative'
                                    }}>
                                        <button
                                            onClick={() => removeMember(member.id)}
                                            style={{
                                                position: 'absolute',
                                                top: '-8px',
                                                right: '-8px',
                                                background: 'var(--color-primary)',
                                                color: 'white',
                                                border: '2px solid white',
                                                borderRadius: '50%',
                                                width: '26px',
                                                height: '26px',
                                                cursor: 'pointer',
                                                fontSize: '1rem',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                zIndex: 5,
                                                boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                                            }}
                                            aria-label="Remove member"
                                        >
                                            ×
                                        </button>
                                        <MemberAvatar type={member.type} />
                                        <span style={{ fontWeight: '600', marginTop: '0.5rem' }}>{member.name}</span>
                                        <span style={{ fontSize: '0.8rem', color: '#999' }}>{member.type}</span>
                                    </div>
                                ))}

                                {familyData.members.length === 0 && (
                                    <div style={{ gridColumn: '1 / -1', textAlign: 'center', color: '#999', padding: '2rem' }}>
                                        No members yet. Add some below!
                                    </div>
                                )}
                            </div>

                            <h3 className="title-md" style={{ marginBottom: '1rem' }}>Add Member</h3>
                            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                                {MEMBER_TYPES.map(type => (
                                    <button
                                        key={type.type}
                                        onClick={() => handleAddMember(type.type)}
                                        className="btn-primary" // Reuse class but override styles if needed
                                        style={{
                                            background: 'var(--color-surface)',
                                            color: 'var(--color-text-primary)',
                                            border: '1px solid var(--color-surface-dim)',
                                            boxShadow: 'none',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '0.5rem'
                                        }}
                                    >
                                        <span>{type.icon}</span>
                                        Add {type.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {activeTab === 'RULES' && (
                        <div>
                            <h2 className="title-lg" style={{ marginBottom: '1.5rem' }}>Kitchen Rules</h2>

                            <PreferenceSlider
                                label="Cook Time Priority"
                                value={familyData.preferences.cookTime}
                                onChange={(val) => updatePreferences({ cookTime: val })}
                                min={15}
                                max={120}
                                leftLabel="Quick (15m)"
                                rightLabel="Feast (2h)"
                            />

                            <PreferenceSlider
                                label="Meal Complexity"
                                value={familyData.preferences.complexity}
                                onChange={(val) => updatePreferences({ complexity: val })}
                                min={0}
                                max={100}
                                leftLabel="Simple"
                                rightLabel="Gourmet"
                                color="var(--color-accent)"
                            />

                            <h3 className="title-md" style={{ marginTop: '2rem', marginBottom: '1rem' }}>No-Go List (Allergies)</h3>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                                {ALLERGIES.map(allergy => {
                                    const isActive = familyData.allergies.includes(allergy);
                                    return (
                                        <button
                                            key={allergy}
                                            onClick={() => toggleAllergy(allergy)}
                                            style={{
                                                padding: '0.5rem 1rem',
                                                borderRadius: '20px',
                                                border: isActive ? 'none' : '1px solid var(--color-surface-dim)',
                                                background: isActive ? 'var(--color-warning)' : 'white',
                                                color: isActive ? 'white' : 'var(--color-text-primary)',
                                                cursor: 'pointer',
                                                fontWeight: isActive ? '600' : '400',
                                                transition: 'all 0.2s ease'
                                            }}
                                        >
                                            {allergy}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
