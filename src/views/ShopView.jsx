import React, { useMemo, useState } from 'react';
import { Check } from 'lucide-react';
import { usePlan } from '../context/PlanContext';
import { buildShoppingList, CATEGORY_ORDER } from '../lib/consolidateIngredients';

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
        <div className="min-h-full bg-[#09090b] text-[#e4e4e7] px-[24px] pt-[32px] pb-[24px]">
            <div className="flex flex-col items-start gap-1 mb-[24px]">
                <span className="font-sans font-semibold text-[10px] uppercase text-[#c9a96e] tracking-[0.12em]">
                    SHOP
                </span>
                <h2 className="font-display font-black text-[clamp(28px,7vw,36px)] text-[#fafafa] leading-none">
                    Shopping List
                </h2>
            </div>

            {!isPlanConfirmed && (
                <div className="rounded-[18px] border border-dashed border-[#3f3f46] bg-[#18181b] p-[24px] text-center">
                    <p className="font-display italic text-[18px] text-[#71717a]">Your plan is still in draft.</p>
                    <p className="font-sans font-light text-[13px] text-[#52525b] mt-[8px] max-w-[280px] mx-auto">
                        Confirm your week in the Plan tab to lock in your meals and generate your list.
                    </p>
                </div>
            )}

            {isPlanConfirmed && items.length === 0 && (
                <div className="rounded-[18px] border border-[#3f3f46] bg-[#18181b] p-[24px] text-center">
                    <p className="font-display italic text-[18px] text-[#71717a]">Nothing to shop for.</p>
                    <p className="font-sans font-light text-[13px] text-[#52525b] mt-[8px]">
                        Your locked days don't have any recipes with ingredients yet.
                    </p>
                </div>
            )}

            {isPlanConfirmed && items.length > 0 && !allChecked && (
                <div className="flex flex-col gap-[24px]">
                    {grouped.map(({ category, items: catItems }) => (
                        <div key={category} className="flex flex-col gap-[8px]">
                            <span className="font-sans font-semibold text-[10px] uppercase text-[#71717a] tracking-[0.12em]">
                                {category}
                            </span>
                            <div className="flex flex-col rounded-[14px] border border-[#3f3f46] overflow-hidden">
                                {catItems.map((item, idx) => {
                                    const checked = checkedKeys.has(item.key);
                                    return (
                                        <button
                                            key={item.key}
                                            onClick={() => toggleChecked(item.key)}
                                            className={`flex items-center gap-[12px] p-[14px] min-h-[44px] text-left bg-[#18181b] ${idx !== catItems.length - 1 ? 'border-b border-[#27272a]' : ''}`}
                                        >
                                            <span className={`w-[22px] h-[22px] rounded-full border flex items-center justify-center shrink-0 ${checked ? 'bg-[#4ade80] border-[#4ade80]' : 'border-[#3f3f46]'}`}>
                                                {checked && <Check size={13} strokeWidth={3} className="text-[#09090b]" />}
                                            </span>
                                            <span className={`flex-1 font-sans text-[14px] ${checked ? 'text-[#52525b] line-through' : 'text-[#e4e4e7]'}`}>
                                                {item.name}
                                            </span>
                                            {item.quantity != null && (
                                                <span className="font-mono text-[12px] text-[#71717a]">
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
                <div className="rounded-[18px] border border-[#3f3f46] bg-[#18181b] p-[24px] text-center">
                    <p className="font-display italic text-[20px] text-[#fafafa]">Shop complete.</p>
                    <p className="font-sans font-light text-[13px] text-[#71717a] mt-[8px]">Great week ahead.</p>
                </div>
            )}
        </div>
    );
}
