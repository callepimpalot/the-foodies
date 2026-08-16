import React, { useMemo, useState } from 'react';
import { Check } from 'lucide-react';
import { usePlan } from '../context/PlanContext';
import { buildShoppingList, CATEGORY_ORDER } from '../lib/consolidateIngredients';
import { BoardCard } from '../components/ui/TicketCard';

export function ShopView() {
    const { weeklyPlan, isPlanConfirmed } = usePlan();
    const [checkedKeys, setCheckedKeys] = useState(() => new Set());

    const items = useMemo(
        () => (isPlanConfirmed ? buildShoppingList(weeklyPlan) : []),
        [weeklyPlan, isPlanConfirmed]
    );

    const grouped = useMemo(() => {
        const byCategory = {};
        items.forEach((item) => {
            (byCategory[item.category] ??= []).push(item);
        });
        return CATEGORY_ORDER
            .filter((c) => byCategory[c]?.length)
            .map((c) => ({ category: c, items: byCategory[c] }));
    }, [items]);

    const toggleChecked = (key) => {
        setCheckedKeys((prev) => {
            const next = new Set(prev);
            next.has(key) ? next.delete(key) : next.add(key);
            return next;
        });
    };

    const allChecked = items.length > 0 && checkedKeys.size === items.length;

    return (
        <div className="min-h-full bg-board text-chalk px-6 pt-8 pb-6">
            <div className="flex flex-col items-start gap-1 mb-6">
                <span className="t-eyebrow text-chalkDim">Shop</span>
                <h2 className="t-heading-lg">Shopping List</h2>
            </div>

            {!isPlanConfirmed && (
                <BoardCard className="border-dashed text-center">
                    <p className="empty-state text-lg">Your plan is still in draft.</p>
                    <p className="t-body text-chalkDim mt-2 max-w-[280px] mx-auto">
                        Confirm your week in the Plan tab to lock in your meals and generate your list.
                    </p>
                </BoardCard>
            )}

            {isPlanConfirmed && items.length === 0 && (
                <BoardCard className="text-center">
                    <p className="empty-state text-lg">Nothing to shop for.</p>
                    <p className="t-body text-chalkDim mt-2">
                        Your locked days don't have any recipes with ingredients yet.
                    </p>
                </BoardCard>
            )}

            {isPlanConfirmed && items.length > 0 && !allChecked && (
                <div className="flex flex-col gap-6">
                    {grouped.map(({ category, items: catItems }) => (
                        <div key={category} className="flex flex-col gap-2">
                            <span className="t-eyebrow text-chalkDim">{category}</span>
                            <div className="list-ticket">
                                {catItems.map((item) => {
                                    const checked = checkedKeys.has(item.key);
                                    return (
                                        <button
                                            key={item.key}
                                            onClick={() => toggleChecked(item.key)}
                                            className="list-row w-full text-left bg-transparent cursor-pointer"
                                        >
                                            <span
                                                className={`w-5 h-5 rounded-xs border flex items-center justify-center shrink-0 transition-colors ${checked ? 'bg-done border-done' : 'border-ticketShadow'
                                                    }`}
                                            >
                                                {checked && <Check size={12} strokeWidth={3} className="text-ticket" />}
                                            </span>
                                            <span className={`flex-1 t-body ${checked ? 'text-done line-through' : 'text-ink'}`}>
                                                {item.name}
                                            </span>
                                            {item.quantity != null && (
                                                <span className="t-mono text-xs text-inkDim">
                                                    {Math.round(item.quantity * 10) / 10}{item.unit ?? ''}
                                                </span>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {isPlanConfirmed && allChecked && (
                <BoardCard className="text-center">
                    <p className="t-heading-md italic text-chalk">Shop complete.</p>
                    <p className="t-body text-chalkDim mt-2">Great week ahead.</p>
                </BoardCard>
            )}
        </div>
    );
}
