import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useHousehold } from '../context/HouseholdContext';
import { useView } from '../context/ViewContext';
import { Button } from '../components/ui/Button';
import { BoardCard } from '../components/ui/TicketCard';

/**
 * FAMILY HOUSEHOLDS — the invite landing (Flow B), the screen the whole feature
 * stands or falls on.
 *
 * The invite token arrives in the URL / viewData and is never typed. The person
 * being invited creates an account (email + password) and, in the same breath,
 * redeems the single-use token — so she is a member the moment she signs in. No
 * "enter your household code", no household name to type, no decisions.
 *
 * The token is single-use and expires (7 days). A reused or expired token is
 * rejected by accept_invite() and surfaced here as a plain message.
 */
function readToken(viewData) {
    if (viewData?.token) return String(viewData.token);
    const params = new URLSearchParams(window?.location?.search ?? '');
    return params.get('token') ?? '';
}

export function JoinView() {
    const { signUp } = useAuth();
    const { accept, name } = useHousehold();
    const { setCurrentView, viewData, VIEWS } = useView();

    const [token] = useState(() => readToken(viewData));
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [busy, setBusy] = useState(false);
    // A missing token is known at mount and never changes, so it is initial
    // state rather than an effect that re-sets it.
    const [message, setMessage] = useState(() =>
        (readToken(viewData) ? null : 'This link has no invite in it. Ask for a new one.'));

    const submit = async (e) => {
        e.preventDefault();
        if (!token) return;

        setBusy(true);
        setMessage(null);

        const signup = await signUp(email, password);
        if (!signup.ok) {
            setBusy(false);
            setMessage(signup.error ?? 'Could not create your account.');
            return;
        }
        if (signup.needsConfirmation) {
            setBusy(false);
            setMessage('Check your email to confirm, then open the link again to finish joining.');
            return;
        }

        const result = await accept(token);
        setBusy(false);

        if (!result.ok) {
            setMessage(result.message ?? 'That invite did not work. It may have expired or already been used.');
            return;
        }

        setCurrentView(VIEWS.DASHBOARD);
    };

    return (
        <div className="animate-fade-in pb-32">
            <header className="pt-8 pb-6">
                <p className="t-eyebrow" style={{ color: 'var(--chalk-dim)' }}>Invitation</p>
                <h1 className="t-heading-lg" style={{ color: 'var(--chalk)' }}>
                    You&rsquo;ve been invited to {name || 'a household'}
                </h1>
                <p className="t-body mt-2" style={{ color: 'var(--chalk-dim)', maxWidth: '34rem' }}>
                    Set a password and you&rsquo;re in. No code, no names to type — the plan, the
                    list and the recipes are already here for you.
                </p>
            </header>

            <BoardCard>
                <form className="flex flex-col gap-3" onSubmit={submit}>
                    <label className="flex flex-col gap-1">
                        <span className="t-label" style={{ color: 'var(--chalk)', marginLeft: '10px' }}>Email</span>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            autoComplete="email"
                            required
                            style={{
                                fontFamily: 'var(--f-body)',
                                fontSize: '15px',
                                color: 'var(--chalk)',
                                background: 'var(--board)',
                                border: '1px solid var(--line)',
                                borderRadius: 'var(--r-sm)',
                                padding: '14px 16px',
                            }}
                        />
                    </label>

                    <label className="flex flex-col gap-1">
                        <span className="t-label" style={{ color: 'var(--chalk)', marginLeft: '10px' }}>Choose a password</span>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            autoComplete="new-password"
                            required
                            minLength={6}
                            style={{
                                fontFamily: 'var(--f-body)',
                                fontSize: '15px',
                                color: 'var(--chalk)',
                                background: 'var(--board)',
                                border: '1px solid var(--line)',
                                borderRadius: 'var(--r-sm)',
                                padding: '14px 16px',
                            }}
                        />
                    </label>

                    {message && (
                        <p className="t-body" style={{ color: 'var(--grease)' }}>{message}</p>
                    )}

                    <Button variant="primary" type="submit" disabled={busy || !token}>
                        {busy ? 'Joining…' : 'Join the household'}
                    </Button>
                </form>
            </BoardCard>
        </div>
    );
}