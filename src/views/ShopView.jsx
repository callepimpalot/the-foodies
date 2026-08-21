import React, { useMemo, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { usePlan } from '../context/PlanContext';
import { useInventory } from '../context/InventoryContext';
import { useShop } from '../context/ShopContext';
import { buildShoppingList, CATEGORY_ORDER, formatMeasure } from '../lib/consolidateIngredients';
import { BoardCard } from '../components/ui/TicketCard';
import { Button } from '../components/ui/Button';

const dayLabel = (date) => {
    if (!date) return '';
    const d = new Date(date);
    return Number.isNaN(d?.getTime?.()) ? date : d.toLocaleDateString('en-US', { weekday: 'short' });
};

// One line of the "why is this on my list?" breakdown. Shows the recipe's own
// wording when it differs from the row's label, so a merged row never hides what
// the recipe actually asked for. Leftover days contribute no ingredients by
// design — they're attributed back to the day that was actually shopped for.
function SourceLine({ source, rowName }) {
    const wording = source?.name && source?.name !== rowName ? source.name : null;
    const amount = formatMeasure(source?.quantity, source?.unit);
    const leftovers = source?.leftoverDates ?? [];

    return (
        <li className="flex items-baseline justify-between gap-3">
            <span className="t-body text-inkDim min-w-0">
                <span className="t-mono text-xs">{dayLabel(source?.date)}</span>
                {' · '}
                {source?.recipeTitle}
                {wording ? <span className="italic"> ({wording})</span> : null}
                {leftovers.length > 0 && (
                    <span className="t-mono text-xs">
                        {' '}+ leftovers {leftovers.map(dayLabel).join(', ')}
                    </span>
                )}
            </span>
            {amount && <span className="t-mono text-xs text-inkDim shrink-0">{amount}</span>}
        </li>
    );
}

export function ShopView() {
    const { weeklyPlan, isPlanConfirmed } = usePlan();
    const { toggleFlag } = useInventory();
    const { checkedKeys, toggleChecked, resetList, householdSnapshot } = useShop();
    const [expandedKeys, setExpandedKeys] = useState(() => new Set());

    const toggleExpanded = (key) => {
        setExpandedKeys((prev) => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key); else next.add(key);
            return next;
        });
    };

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
                                    // The chevron's presence is itself information: this
                                    // number is a sum. A chevron revealing "1 for Stew" on
                                    // a row that already says "1" is a broken promise.
                                    const sources = item?.sources ?? [];
                                    const canExpand = sources.length > 1;
                                    const expanded = canExpand && expandedKeys.has(item.key);
                                    return (
                                        // Not a <button> — the checkbox and the chevron are
                                        // sibling controls. Nesting one inside the other is
                                        // invalid HTML and the taps misfire.
                                        <div key={item.key} className="list-row flex-col items-stretch gap-0">
                                            <div className="flex items-center gap-3">
                                                <button
                                                    type="button"
                                                    onClick={() => toggleChecked(item.key)}
                                                    aria-pressed={checked}
                                                    className="flex flex-1 min-w-0 items-center gap-3 min-h-11 text-left bg-transparent cursor-pointer"
                                                >
                                                    <span
                                                        className={`w-5 h-5 rounded-xs border flex items-center justify-center shrink-0 transition-colors ${checked ? 'bg-done border-done' : 'border-ticketShadow'
                                                            }`}
                                                    >
                                                        {checked && <Check size={12} strokeWidth={3} className="text-ticket" />}
                                                    </span>
                                                    <span className={`flex-1 min-w-0 t-body ${checked ? 'text-done line-through' : 'text-ink'}`}>
                                                        {item.name}
                                                    </span>
                                                    {item.quantityLabel && (
                                                        <span className={`t-mono text-xs shrink-0 ${checked ? 'text-done' : 'text-inkDim'}`}>
                                                            {item.quantityLabel}
                                                        </span>
                                                    )}
                                                </button>
                                                {canExpand && (
                                                    <button
                                                        type="button"
                                                        onClick={() => toggleExpanded(item.key)}
                                                        aria-expanded={expanded}
                                                        aria-label={`Show what ${item.name} is for`}
                                                        className="w-11 h-11 -mr-3 flex items-center justify-center shrink-0 bg-transparent cursor-pointer text-inkDim"
                                                    >
                                                        <ChevronDown
                                                            size={18}
                                                            className={`transition-transform ${expanded ? 'rotate-180' : ''}`}
                                                        />
                                                    </button>
                                                )}
                                            </div>
                                            {expanded && (
                                                <ul className="flex flex-col gap-1 pb-3 pl-8 pr-3">
                                                    {sources.map((source, i) => (
                                                        <SourceLine
                                                            key={`${item.key}|${source?.date}|${i}`}
                                                            source={source}
                                                            rowName={item.name}
                                                        />
                                                    ))}
                                                </ul>
                                            )}
                                        </div>
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
