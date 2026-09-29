import React, { useState } from 'react';
import { useHousehold } from '../context/HouseholdContext';
import { usePlan } from '../context/PlanContext';
import { useInventory } from '../context/InventoryContext';
import { useShop } from '../context/ShopContext';
import { Button } from '../components/ui/Button';
import { BoardCard, TicketCard } from '../components/ui/TicketCard';
import { Copy, Wifi, WifiOff } from 'lucide-react';

/**
 * TASK_07 — the whole of the join flow, in one screen.
 *
 * TASK_07 asks for a minimal screen: show your household code, or enter someone
 * else's. That is literally all this is. No accounts, no email, no household
 * names to invent. TASK_12 replaces the middle of it with an invite link — see
 * the notes at the bottom of the migration for why the code is the small-print
 * path there and the primary path here.
 *
 * It also does one thing TASK_07 does not ask for and that the feature genuinely
 * needs: it says out loud whether this household is real or device-local. Without
 * that, "why can't Lærke see the plan" has no answer on screen, and the failure
 * mode is a person concluding the feature is broken rather than unconfigured.
 */
export function HouseholdView() {
    const { id, joinCode, remote, ready, status, error, join, forget } = useHousehold();
    const planSync = usePlan().syncStatus;
    const shopSync = useShop().syncStatus;
    const pantrySync = useInventory().syncStatus;

    const [code, setCode] = useState('');
    const [message, setMessage] = useState(null);
    const [copied, setCopied] = useState(false);

    const syncStates = [planSync, shopSync, pantrySync];
    const anyOffline = syncStates.includes('offline');
    const anySyncing = syncStates.includes('syncing');

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(joinCode);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch {
            // Clipboard access is denied on some browsers and all insecure origins.
            // The code is on screen and selectable, so this is a nicety, not a path.
            setMessage('Copying is blocked here — the code is above, select it by hand.');
        }
    };

    const handleJoin = async (e) => {
        e.preventDefault();
        setMessage(null);
        const result = await join(code);
        if (result.ok) {
            setCode('');
            setMessage('Joined. The plan, the list and the pantry on this device are now the household\'s.');
            return;
        }
        const reasons = {
            empty: 'Type the code from the other phone first.',
            not_found: 'No household has that code. Codes are 8 characters, letters and numbers.',
            unsupported: 'This build has no backend configured, so codes cannot be looked up. Sharing needs Supabase connected.',
            error: 'Could not reach the server. Try again when you have signal.',
        };
        setMessage(reasons[result.reason] ?? 'That did not work. Try again.');
    };

    return (
        <div className="animate-fade-in pb-32 px-0">
            <header className="pt-8 pb-6">
                <p className="t-eyebrow" style={{ color: 'var(--chalk-dim)' }}>Household</p>
                <h1 className="t-heading-lg" style={{ color: 'var(--chalk)' }}>One kitchen, two phones</h1>
                <p className="t-body mt-2" style={{ color: 'var(--chalk-dim)', maxWidth: '34rem' }}>
                    Plan on one phone and shop from the other. There is no account yet —
                    the code below <em>is</em> the key, so send it to someone you cook with and
                    nobody else.
                </p>
            </header>

            {/* The status line is the honest part of this screen. */}
            <BoardCard className="mb-6">
                <div className="flex items-center gap-2">
                    {anyOffline ? <WifiOff size={16} color="var(--grease)" /> : <Wifi size={16} color="var(--done)" />}
                    <span className="t-label" style={{ color: 'var(--chalk)' }}>
                        {anyOffline ? 'Working from this device' : anySyncing ? 'Syncing…' : 'Shared'}
                    </span>
                </div>
                <p className="t-body mt-2" style={{ color: 'var(--chalk-dim)' }}>
                    {anyOffline
                        ? 'The server is unreachable, or Supabase is not configured in this build. Everything still works and is saved on this device; it will sync when the connection is back.'
                        : 'Changes sync between the phones in this household. Edits made offline are kept and sent when the connection returns.'}
                </p>
                <p className="t-mono mt-3" style={{ color: 'var(--chalk-dim)', fontSize: '11px', wordBreak: 'break-all' }}>
                    household {ready ? (id ?? '—') : 'creating…'}
                </p>
            </BoardCard>

            <TicketCard className="mb-6">
                <p className="t-eyebrow" style={{ color: 'var(--ink-dim)' }}>Your code</p>
                <div className="flex items-center justify-between gap-3 mt-2">
                    <span className="t-display" style={{ fontSize: '34px', color: 'var(--ink)', letterSpacing: '0.08em' }}>
                        {joinCode || '—'}
                    </span>
                    <Button variant="secondary" onClick={handleCopy} disabled={!joinCode}>
                        <span className="flex items-center gap-2">
                            <Copy size={16} /> {copied ? 'Copied' : 'Copy'}
                        </span>
                    </Button>
                </div>
                <p className="t-body mt-3" style={{ color: 'var(--ink-dim)' }}>
                    Type this on the other phone, under &ldquo;Join a household&rdquo;.
                    {!remote && ' This one is device-local — it will not be found from another phone until the backend is connected.'}
                </p>
            </TicketCard>

            <BoardCard>
                <p className="t-eyebrow" style={{ color: 'var(--chalk-dim)' }}>Join a household</p>
                <form className="flex flex-col gap-3 mt-3" onSubmit={handleJoin}>
                    <input
                        type="text"
                        value={code}
                        onChange={(e) => setCode(e.target.value.toUpperCase())}
                        placeholder="ABCDEFGH"
                        autoComplete="off"
                        spellCheck={false}
                        maxLength={12}
                        inputMode="text"
                        style={{
                            fontFamily: 'var(--f-mono)',
                            letterSpacing: '0.14em',
                            fontSize: '18px',
                            color: 'var(--chalk)',
                            background: 'var(--board)',
                            border: '1px solid var(--line)',
                            borderRadius: 'var(--r-sm)',
                            padding: '14px 16px',
                            textTransform: 'uppercase',
                        }}
                    />
                    <Button variant="primary" type="submit" disabled={status === 'joining'}>
                        {status === 'joining' ? 'Joining…' : 'Join'}
                    </Button>
                </form>
                {message && (
                    <p className="t-body mt-3" style={{ color: 'var(--grease)' }}>{message}</p>
                )}
                {error && !message && (
                    <p className="t-body mt-3" style={{ color: 'var(--chalk-dim)' }}>
                        Last join attempt reported: {String(error)}.
                    </p>
                )}
                <p className="t-body mt-4" style={{ color: 'var(--chalk-dim)' }}>
                    Joining swaps this device onto the other household — its plan and list
                    become the ones you see. Your own still exists; you are simply not looking
                    at it. Nothing already saved is deleted.
                </p>
                <div className="mt-4 flex flex-wrap gap-3">
                    <Button variant="ghost" onClick={forget}>
                        Start a new household on this device
                    </Button>
                </div>
            </BoardCard>
        </div>
    );
}
