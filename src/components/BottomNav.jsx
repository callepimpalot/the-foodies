import React from 'react';
import { useView } from '../context/ViewContext';
import { Home, Map, Utensils, ShoppingBag, ScanLine, Package } from 'lucide-react';

export function BottomNav() {
    const { currentView, setCurrentView, VIEWS } = useView();

    const navItems = [
        { id: VIEWS.DASHBOARD, label: 'Home', Icon: Home },
        { id: VIEWS.CAPTURE, label: 'Capture', Icon: ScanLine },
        { id: VIEWS.PLAN, label: 'Plan', Icon: Map },
        { id: VIEWS.RECIPES, label: 'Recipes', Icon: Utensils },
        { id: VIEWS.SHOP, label: 'Shop', Icon: ShoppingBag },
        { id: VIEWS.PANTRY, label: 'Pantry', Icon: Package },
    ];

    return (
        <nav className="nav-bar">
            {navItems.map((item) => {
                const isActive = currentView === item.id;
                const IconComponent = item.Icon;

                return (
                    <button
                        key={item.id}
                        onClick={() => setCurrentView(item.id)}
                        className={`nav-item ${isActive ? 'active' : ''}`}
                    >
                        <span className="nav-item-dot">
                            <IconComponent size={18} strokeWidth={isActive ? 2.25 : 1.75} />
                        </span>
                        {item.label}
                    </button>
                );
            })}
        </nav>
    );
}
