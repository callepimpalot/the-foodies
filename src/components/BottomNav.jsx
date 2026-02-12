import React from 'react';
import { useView } from '../context/ViewContext';
import { Home, Map, Utensils, ShoppingBag } from 'lucide-react';

export function BottomNav() {
    const { currentView, setCurrentView, VIEWS } = useView();

    const navItems = [
        { id: VIEWS.DASHBOARD, label: 'Home', Icon: Home },
        { id: VIEWS.PLAN, label: 'Plan', Icon: Map },
        { id: VIEWS.RECIPES, label: 'Meals', Icon: Utensils },
        { id: VIEWS.SHOP, label: 'Shop', Icon: ShoppingBag },
    ];

    return (
        <div
            className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[9999] w-[90%] max-w-[400px] pointer-events-none"
            style={{
                transform: 'translate3d(-50%, 0, 0)',
                WebkitBackfaceVisibility: 'hidden',
                contain: 'layout'
            }}
        >
            <div className="pointer-events-auto flex items-center justify-between px-8 py-4 bg-white/90 dark:bg-zinc-900/90 backdrop-blur-xl border border-white/20 dark:border-zinc-800 shadow-xl shadow-black/10 rounded-full">
                {navItems.map((item) => {
                    const isActive = currentView === item.id;
                    const IconComponent = item.Icon;

                    return (
                        <button
                            key={item.id}
                            onClick={() => setCurrentView(item.id)}
                            className={`
                                relative flex items-center justify-center w-12 h-12 rounded-full transition-all duration-300
                                ${isActive
                                    ? 'bg-zinc-900 text-white shadow-lg scale-100'
                                    : 'text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 scale-90'
                                }
                                active:scale-95
                            `}
                        >
                            <IconComponent size={20} strokeWidth={isActive ? 2.5 : 2} />

                            {/* Active Dot Indicator (Optional, but adds polish) */}
                            {isActive && (
                                <span className="absolute -bottom-1 w-1 h-1 bg-zinc-900 dark:bg-zinc-500 rounded-full opacity-0" />
                            )}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
