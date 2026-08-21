import React, { useState } from 'react';
import { Check, X, Pencil, BookOpen, Sparkles, Eye } from 'lucide-react';
import { REJECTION_REASONS } from '../lib/dishCuration';
import { resolveDishTitle, resolveDishTags } from '../hooks/useDishCuration';
import { Button } from './ui/Button';
import { RecipeDetailSheet } from './RecipeDetailSheet';

const COUNT_OPTIONS = [3, 4, 5, 6, 7];

// Phase 1 of the AI Week Planner: curate a pool of dishes one at a time — Keep, Modify ("beef
// instead of pork"), or Reject-with-a-reason — before any of them touch a specific day. Replaces
// the day-list/composer region entirely while active; WeekPlanChat swaps back to the existing
// placement UI once curation.phase becomes 'done'.
export function DishCurationFlow({ curation, recipes, libraryShortlist }) {
    const { phase, targetCount, acceptedDishes, currentDish, busy, error, begin, confirmCount, keep, reject, rejectForSomethingNew, modify } = curation;
    const [openingMessage, setOpeningMessage] = useState('');
    const [customCount, setCustomCount] = useState('');
    const [showModify, setShowModify] = useState(false);
    const [modifyText, setModifyText] = useState('');
    const [showRejectReasons, setShowRejectReasons] = useState(false);
    const [showSomethingNew, setShowSomethingNew] = useState(false);
    const [somethingNewText, setSomethingNewText] = useState('');
    const [showDetails, setShowDetails] = useState(false);

    const handleBegin = () => {
        if (!openingMessage.trim() || busy) return;
        begin(openingMessage.trim(), libraryShortlist, recipes);
    };

    const handleModifySubmit = () => {
        if (!modifyText.trim() || busy) return;
        modify(modifyText.trim(), recipes);
        setModifyText('');
        setShowModify(false);
    };

    const handleReject = (reason) => {
        setShowRejectReasons(false);
        reject(reason, libraryShortlist, recipes);
    };

    const handleSomethingNewSubmit = () => {
        if (busy) return;
        rejectForSomethingNew(somethingNewText.trim(), libraryShortlist, recipes);
        setSomethingNewText('');
        setShowSomethingNew(false);
        setShowRejectReasons(false);
    };

    if (phase === 'entry') {
        return (
            <div className="flex-1 flex flex-col items-center justify-center text-center gap-4 px-6">
                <Sparkles size={22} strokeWidth={1.5} style={{ color: 'var(--grease)' }} />
                <p className="t-heading-sm italic" style={{ color: 'var(--chalk)' }}>
                    Tell me about your week
                </p>
                <p className="t-body" style={{ color: 'var(--chalk-dim)', maxWidth: '280px' }}>
                    "4 meals, make them interesting" — say how many and what matters to you. I'll bring you dishes one at a time to keep, tweak, or swap out.
                </p>
                <div className="w-full flex flex-col gap-2" style={{ maxWidth: '360px' }}>
                    <textarea
                        value={openingMessage}
                        onChange={(e) => setOpeningMessage(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleBegin(); } }}
                        placeholder="4 meals, make them interesting..."
                        rows={2}
                        disabled={busy}
                        className="input w-full resize-none disabled:opacity-50"
                    />
                    {error && <p className="t-body" style={{ color: 'var(--destructive)', fontSize: '13px' }}>{error}</p>}
                    <Button variant="primary" onClick={handleBegin} disabled={busy || !openingMessage.trim()} className="w-full disabled:opacity-30 disabled:cursor-not-allowed">
                        {busy ? 'Thinking...' : 'Start'}
                    </Button>
                </div>
            </div>
        );
    }

    if (phase === 'count') {
        return (
            <div className="flex-1 flex flex-col items-center justify-center text-center gap-4 px-6">
                <p className="t-heading-sm italic" style={{ color: 'var(--chalk)' }}>
                    How many meals?
                </p>
                <div className="flex flex-wrap gap-2 justify-center" style={{ maxWidth: '320px' }}>
                    {COUNT_OPTIONS.map((n) => (
                        <button
                            key={n}
                            onClick={() => confirmCount(n, libraryShortlist, recipes)}
                            disabled={busy}
                            className="t-mono rounded-sm"
                            style={{ width: '48px', height: '48px', background: 'var(--board-2)', border: '1px solid var(--line)', color: 'var(--chalk)', fontSize: '16px' }}
                        >
                            {n}
                        </button>
                    ))}
                </div>
                <div className="flex gap-2 items-center">
                    <input
                        type="number"
                        min="1"
                        max="20"
                        value={customCount}
                        onChange={(e) => setCustomCount(e.target.value)}
                        placeholder="Other"
                        disabled={busy}
                        className="input"
                        style={{ width: '80px', textAlign: 'center' }}
                    />
                    <Button
                        variant="secondary"
                        disabled={busy || !customCount || Number(customCount) < 1}
                        onClick={() => confirmCount(Number(customCount), libraryShortlist, recipes)}
                    >
                        Use this
                    </Button>
                </div>
                {error && <p className="t-body" style={{ color: 'var(--destructive)', fontSize: '13px' }}>{error}</p>}
            </div>
        );
    }

    // phase === 'reviewing' (or transiently 'done' mid-render, before the parent swaps views away)
    if (phase !== 'reviewing') return null;

    const title = currentDish ? resolveDishTitle(currentDish, recipes) : null;
    const tags = currentDish ? resolveDishTags(currentDish, recipes).slice(0, 3) : [];
    // Full recipe to skim before deciding — either the dish's own body (generated, or a library
    // dish already modified in place) or a lookup into the library by id. Read-only: no
    // onAddToPlan/onCookNow here, this is just "let me see the ingredients" before Keep/Reject/Modify.
    const dishRecipe = currentDish
        ? (currentDish.recipe ?? (currentDish.source === 'library' ? recipes?.find((r) => r.id === currentDish.recipeId) : null))
        : null;

    return (
        <div className="flex-1 relative min-h-0">
        <div className="h-full flex flex-col px-6 pt-4 pb-24 gap-4 overflow-y-auto">
            <p className="t-eyebrow shrink-0" style={{ color: 'var(--grease)' }}>
                Dish {acceptedDishes.length + 1} of {targetCount}
            </p>

            {acceptedDishes.length > 0 && (
                <div className="flex flex-wrap gap-[6px] shrink-0">
                    {acceptedDishes.map((d, i) => (
                        // Not .badge-grease here — that class is styled for text on the light ticket
                        // card (dark ink on a light tint), but this strip sits directly on the dark
                        // app background, where it rendered as near-invisible dark-on-dark text.
                        <span
                            key={i}
                            className="t-mono"
                            style={{
                                display: 'inline-flex', alignItems: 'center', gap: '4px',
                                padding: '4px 8px', borderRadius: 'var(--r-xs)', fontSize: '10px',
                                background: 'var(--board-2)', border: '1px solid var(--grease)', color: 'var(--chalk)',
                            }}
                        >
                            <Check size={9} strokeWidth={2} style={{ color: 'var(--grease)' }} />
                            {resolveDishTitle(d, recipes)}
                        </span>
                    ))}
                </div>
            )}

            {busy && !currentDish && (
                <p className="t-body italic animate-pulse" style={{ color: 'var(--chalk-dim)' }}>Finding a dish...</p>
            )}

            {error && <p className="t-body" style={{ color: 'var(--destructive)', fontSize: '13px' }}>{error}</p>}

            {currentDish && (
                // shrink-0 is load-bearing: this card is itself a flex column AND a flex *item* of
                // the scrollable container above. Flex items default to flex-shrink:1, so without
                // this, a long title/reasoning didn't make the container scroll — it squeezed the
                // card down to fit instead, clipping content via .card's own overflow:hidden (proved
                // by forcing a 400px spacer inside it and watching it render at 57px, compressed, not
                // scrolled). shrink-0 forces the card to its natural content height so the *container*
                // is what overflows and scrolls, not the card silently shrinking.
                <div className="card shrink-0" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div className="flex items-center gap-2">
                        {currentDish.source === 'library'
                            ? <span className="badge-grease" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><BookOpen size={9} strokeWidth={2} /> Library</span>
                            : <span className="badge-grease" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><Sparkles size={9} strokeWidth={2} /> New idea</span>}
                    </div>

                    <h3 className="t-heading-md" style={{ color: 'var(--ink)' }}>{title}</h3>

                    {dishRecipe && (
                        <button
                            onClick={() => setShowDetails(true)}
                            className="flex items-center gap-1 self-start"
                            style={{ color: 'var(--stamp)', fontSize: '12px' }}
                        >
                            <Eye size={13} strokeWidth={1.5} /> View full recipe
                        </button>
                    )}

                    {tags.length > 0 && (
                        <div className="flex flex-wrap gap-[6px]">
                            {tags.map((t) => <span key={t} className="tag">{t}</span>)}
                        </div>
                    )}

                    {currentDish.reasoning && (
                        <p className="t-body italic" style={{ color: 'var(--ink-dim)', fontSize: '13px' }}>{currentDish.reasoning}</p>
                    )}

                    {showModify ? (
                        <div className="flex flex-col gap-2">
                            <input
                                autoFocus
                                value={modifyText}
                                onChange={(e) => setModifyText(e.target.value)}
                                onKeyDown={(e) => { if (e.key === 'Enter') handleModifySubmit(); }}
                                placeholder="e.g. beef instead of pork"
                                disabled={busy}
                                className="input w-full disabled:opacity-50"
                            />
                            <div className="flex gap-2">
                                <Button variant="ghost" onClick={() => { setShowModify(false); setModifyText(''); }} className="flex-1">Cancel</Button>
                                <Button variant="primary" onClick={handleModifySubmit} disabled={busy || !modifyText.trim()} className="flex-1 disabled:opacity-30">
                                    {busy ? 'Applying...' : 'Apply change'}
                                </Button>
                            </div>
                        </div>
                    ) : showRejectReasons ? (
                        <div className="flex flex-col gap-2">
                            <span className="t-body" style={{ color: 'var(--chalk-dim)', fontSize: '12px' }}>What's wrong with it?</span>
                            <div className="flex flex-wrap gap-2">
                                {REJECTION_REASONS.map((reason) => (
                                    <button
                                        key={reason}
                                        onClick={() => handleReject(reason)}
                                        disabled={busy}
                                        className="t-label rounded-sm"
                                        style={{ padding: '8px 12px', background: 'var(--board-2)', border: '1px solid var(--line)', color: 'var(--chalk)' }}
                                    >
                                        {reason}
                                    </button>
                                ))}
                            </div>

                            {/* Distinct from the reason chips above — those still pick from the library
                                again, just steered away from whatever was wrong. This skips the library
                                entirely: a hard override in the prompt, not a soft hint, since "prefer
                                library" otherwise wins by default. */}
                            {showSomethingNew ? (
                                <div className="flex flex-col gap-2">
                                    <input
                                        autoFocus
                                        value={somethingNewText}
                                        onChange={(e) => setSomethingNewText(e.target.value)}
                                        onKeyDown={(e) => { if (e.key === 'Enter') handleSomethingNewSubmit(); }}
                                        placeholder="e.g. something with lamb (optional)"
                                        disabled={busy}
                                        className="input w-full disabled:opacity-50"
                                    />
                                    <div className="flex gap-2">
                                        <Button variant="ghost" onClick={() => { setShowSomethingNew(false); setSomethingNewText(''); }} className="flex-1">Cancel</Button>
                                        <Button variant="primary" onClick={handleSomethingNewSubmit} disabled={busy} className="flex-1 disabled:opacity-30">
                                            {busy ? 'Finding...' : 'Get new idea'}
                                        </Button>
                                    </div>
                                </div>
                            ) : (
                                <button
                                    onClick={() => setShowSomethingNew(true)}
                                    disabled={busy}
                                    className="flex items-center justify-center gap-1 rounded-sm disabled:opacity-30"
                                    style={{ padding: '10px', border: '1px dashed var(--line)', color: 'var(--grease)' }}
                                >
                                    <Sparkles size={14} strokeWidth={1.5} /> Something different — not in my library
                                </button>
                            )}

                            <button
                                onClick={() => { setShowRejectReasons(false); setShowSomethingNew(false); }}
                                className="t-body self-start"
                                style={{ color: 'var(--chalk-dim)', fontSize: '12px' }}
                            >
                                Never mind
                            </button>
                        </div>
                    ) : (
                        <div className="flex flex-col gap-2">
                            {/* Reject/Modify as equal-width secondary actions; Keep on its own full-width
                                row below as the primary action — it's the fastest, most common tap, so
                                it gets the easiest thumb target rather than fighting two other buttons
                                for space on one line (which, at true phone width, doesn't fit at all —
                                flex-1 children don't shrink below their content's natural width without
                                min-width:0, so a three-across row here overflowed the card). */}
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setShowRejectReasons(true)}
                                    disabled={busy}
                                    className="flex-1 flex items-center justify-center gap-1 rounded-sm disabled:opacity-30"
                                    style={{ padding: '12px', minWidth: 0, background: 'var(--board-2)', border: '1px solid var(--line)', color: 'var(--destructive)' }}
                                >
                                    <X size={16} strokeWidth={1.5} /> Reject
                                </button>
                                <button
                                    onClick={() => setShowModify(true)}
                                    disabled={busy}
                                    className="flex-1 flex items-center justify-center gap-1 rounded-sm disabled:opacity-30"
                                    style={{ padding: '12px', minWidth: 0, background: 'var(--board-2)', border: '1px solid var(--line)', color: 'var(--chalk)' }}
                                >
                                    <Pencil size={16} strokeWidth={1.5} /> Modify
                                </button>
                            </div>
                            <button
                                onClick={() => keep(libraryShortlist, recipes)}
                                disabled={busy}
                                className="w-full flex items-center justify-center gap-1 rounded-sm disabled:opacity-30"
                                style={{ padding: '14px', background: 'var(--done)', color: 'var(--board)' }}
                            >
                                <Check size={16} strokeWidth={2} /> Keep
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>

            {/* Signals "scroll for more" instead of the card looking like it just stops at the screen
                edge — the same missing cue that made the day-list look broken before it was fixed there. */}
            <div
                className="absolute bottom-0 left-0 right-0 h-8 pointer-events-none"
                style={{ background: 'linear-gradient(to bottom, transparent, var(--board))' }}
            />

            {showDetails && dishRecipe && (
                <RecipeDetailSheet recipe={dishRecipe} onClose={() => setShowDetails(false)} />
            )}
        </div>
    );
}
