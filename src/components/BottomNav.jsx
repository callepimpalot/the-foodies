import React from 'react';
import { useView } from '../context/ViewContext';
import { useArchetype } from '../context/ArchetypeContext';

const Icons = {
    Home: ({ active }) => (
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill={active ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
            <polyline points="9 22 9 12 15 12 15 22"></polyline>
        </svg>
    ),
    Plan: ({ active }) => (
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill={active ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
            <line x1="16" y1="2" x2="16" y2="6"></line>
            <line x1="8" y1="2" x2="8" y2="6"></line>
            <line x1="3" y1="10" x2="21" y2="10"></line>
        </svg>
    ),
    Recipes: ({ active }) => (
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill={active ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
            <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
        </svg>
    ),
    Shop: ({ active }) => (
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill={active ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="9" cy="21" r="1"></circle>
            <circle cx="20" cy="21" r="1"></circle>
            <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path>
        </svg>
    )
};

export function BottomNav() {
    const { currentView, setCurrentView, VIEWS } = useView();
    // const { activeArchetype } = useArchetype(); // Removed unused

    const navItems = [
        { id: VIEWS.DASHBOARD, label: 'Home', Icon: Icons.Home },
        { id: VIEWS.PLAN, label: 'Plan', Icon: Icons.Plan },
        { id: VIEWS.RECIPES, label: 'Recipes', Icon: Icons.Recipes },
        { id: VIEWS.SHOP, label: 'Shop', Icon: Icons.Shop },
    ];

    return (
        <div style={{
            position: 'fixed',
            bottom: 0,
            left: 0,
            width: '100%',
            background: 'rgba(255, 255, 255, 0.9)', // Slightly more opaque
            backdropFilter: 'blur(20px)',
            borderTop: '1px solid rgba(0, 0, 0, 0.05)',
            display: 'flex',
            justifyContent: 'space-around',
            padding: '12px 16px 32px 16px', // Adjusted padding
            zIndex: 100,
            boxShadow: '0 -4px 20px rgba(0,0,0,0.02)'
        }}>
            {navItems.map((item) => {
                const isActive = currentView === item.id;
                const IconComponent = item.Icon;

                return (
                    <button
                        key={item.id}
                        onClick={() => setCurrentView(item.id)}
                        style={{
                            background: 'transparent',
                            border: 'none',
                            color: isActive ? 'var(--color-primary)' : 'var(--color-text-tertiary)', // Use theme colors
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: '4px',
                            fontSize: '0.75rem',
                            fontWeight: isActive ? 600 : 500,
                            cursor: 'pointer',
                            transition: 'all 0.2s ease',
                            flex: 1, // Distribute space evenly
                            padding: '8px 0'
                        }}
                    >
                        <div style={{
                            transition: 'transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)',
                            transform: isActive ? 'translateY(-2px)' : 'none'
                        }}>
                            <IconComponent active={isActive} />
                        </div>
                        <span style={{
                            opacity: isActive ? 1 : 0.8,
                            transform: isActive ? 'scale(1)' : 'scale(0.95)',
                            transition: 'all 0.2s'
                        }}>
                            {item.label}
                        </span>
                    </button>
                );
            })}
        </div>
    );
}
