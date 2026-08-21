import React, { useMemo } from 'react';
import { Check } from 'lucide-react';
import { usePlan } from '../context/PlanContext';
import { useInventory } from '../context/InventoryContext';
import { useShop } from '../context/ShopContext';
import { buildShoppingList, CATEGORY_ORDER } from '../lib/consolidateIngredients';
import { BoardCard } from '../components/ui/TicketCard';
import { Button } from '../components/ui/Button';

export function ShopView() {
    const { weeklyPlan, isPlanConfirmed } = usePlan();
    const { toggleFlag } = useInventory();
    const { checkedKeys, toggleChecked, resetList, householdSnapshot } = useShop();

    const recipeItems = useMemo(
        () => (isPlanConfirmed ? buildShoppingList(weeklyPlan) : []),
        [weeklyPlan, isPlanConfirmed]
    );

    const grouped = useMemo(() => {
        const byCategory = {};
        recipeItems.forEach((item) => {
            (byCategory[item.category] ??= []).push(item);
        });
        return CATEGORY_ORDER
            .filter((c) => byCategory[c]?.length)
            .map((c) => ({ category: c, items: byCategory[c] }));
    }, [recipeItems]);

    const toggleHousehold = (item) => {
        toggleChecked(`household|${item.id}`);
        toggleFlag(item.id);
    };

    const hasRecipeItems = recipeItems.length > 0;
    const hasHouseholdItems = householdSnapshot.length > 0;
    const totalCount = recipeItems.length + householdSnapshot.length;
    const allChecked = totalCount > 0 && checkedKeys.size === totalCount;

    return (
        <div className="min-h-full bg-board text-chalk pt-6 pb-6">
            <div className="flex items-start justify-between gap-3 mb-6">
                <div className="flex flex-col items-start gap-1">
                    <span className="t-eyebrow text-chalkDim">Shop</span>
                    <h2 className="t-heading-lg">Shopping List</h2>
                </div>
                {totalCount > 0 && (
                    <Button variant="ghost" onClick={resetList} className="shrink-0">
                        Reset list
                    </Button>
                )}
            </div>

            {!allChecked && hasHouseholdItems && (
                <div className="flex flex-col gap-2 mb-6">
                    <span className="t-eyebrow text-chalkDim">Household</span>
                    <div className="list-ticket">
                        {householdSnapshot.map((item) => {
                            const key = `household|${item.id}`;
                            const checked = checkedKeys.has(key);
                            return (
                                <button
                                    key={key}
                                    onClick={() => toggleHousehold(item)}
                                    className="list-row w-full text-left bg-transparent cursor-pointer"
                                >
                                    <span
                                        className={`w-5 h-5 rounded-xs border flex items-center justify-center shrink-0 transition-colors ${checked ? 'bg-done border-done' : 'border-ticketShadow'
                                            }`}
                                    >
                                        {checked && <Check size={12} strokeWidth={3} className="text-ticket" />}
                                    </span>
                                    <span className={`flex-1 t-body ${checked ? 'text-done line-through' : 'text-ink'}`}>
                                        {item.emoji} {item.name}
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}

            {!isPlanConfirmed && !allChecked && (
                <BoardCard className="border-dashed text-center">
                    <p className="empty-state text-lg">Your plan is still in draft.</p>
                    <p className="t-body text-chalkDim mt-2 max-w-[280px] mx-auto">
                        Confirm your week in the Plan tab to lock in your meals and generate your list.
                    </p>
                </BoardCard>
            )}

            {isPlanConfirmed && !hasRecipeItems && !hasHouseholdItems && (
                <BoardCard className="text-center">
                    <p className="empty-state text-lg">Nothing to shop for.</p>
                    <p className="t-body text-chalkDim mt-2">
                        Your locked days don't have any recipes with ingredients yet.
                    </p>
                </BoardCard>
            )}

            {hasRecipeItems && !allChecked && (
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

            {allChecked && (
                <BoardCard className="text-center flex flex-col items-center gap-4">
                    <div>
                        <p className="t-heading-md italic text-chalk">Shop complete.</p>
                        <p className="t-body text-chalkDim mt-2">Great week ahead.</p>
                    </div>
                    <Button variant="ghost" onClick={resetList}>Reset list</Button>
                </BoardCard>
            )}
        </div>
    );
}
