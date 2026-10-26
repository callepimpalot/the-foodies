import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useView } from '../context/ViewContext';
import { Button } from '../components/ui/Button';

/**
 * FAMILY HOUSEHOLDS — sign in / sign up.
 *
 * The one screen that stands between "one device" and "one household". It is
 * deliberately small: an email, a password, and one primary action. There is no
 * household code and no join field here — onboarding through an invite link is
 * the feature's own separate screen (JoinView), and the join code is unadvertised
 * small print in the Household screen.
 */
export function AuthView() {
    const { signIn, signUp } = useAuth();
    const { setCurrentView, VIEWS } = useView();

    const [mode, setMode] = useState('in'); // 'in' | 'up'
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [message, setMessage] = useState(null);
    const [busy, setBusy] = useState(false);

    const submit = async (e) => {
        e.preventDefault();
        setBusy(true);
        setMessage(null);

        const result = mode === 'in'
            ? await signIn(email, password)
            : await signUp(email, password);

        setBusy(false);

        if (!result.ok) {
            setMessage(result.error ?? 'That did not work. Try again.');
            return;
        }

        if (result.needsConfirmation) {
            setMessage('Check your email to confirm your address, then come back and sign in.');
            return;
        }

        // Signed in. The HouseholdContext now resolves the household from
        // membership; land on the household screen so the owner sees their members.
        setCurrentView(VIEWS.DASHBOARD);
    };

    return (
        <div className="animate-fade-in pb-32">
            <header className="pt-8 pb-6">
                <p className="t-eyebrow" style={{ color: 'var(--chalk-dim)' }}>Account</p>
                <h1 className="t-heading-lg" style={{ color: 'var(--chalk)' }}>
                    {mode === 'in' ? 'Sign in' : 'Create your account'}
                </h1>
                <p className="t-body mt-2" style={{ color: 'var(--chalk-dim)', maxWidth: '34rem' }}>
                    {mode === 'in'
                        ? 'Come back to your household on any device. Your plan, list and recipes are saved to your account.'
                        : 'Set an email and password so your household can be shared — and survives a new phone.'}
                </p>
            </header>

            <form className="flex flex-col gap-3" style={{ maxWidth: '26rem' }} onSubmit={submit}>
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
                    <span className="t-label" style={{ color: 'var(--chalk)', marginLeft: '10px' }}>Password</span>
                    <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        autoComplete={mode === 'in' ? 'current-password' : 'new-password'}
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

                <Button variant="primary" type="submit" disabled={busy}>
                    {busy ? '…' : mode === 'in' ? 'Sign in' : 'Create account'}
                </Button>
            </form>

            <div className="mt-4">
                <Button variant="ghost" onClick={() => { setMode(mode === 'in' ? 'up' : 'in'); setMessage(null); }}>
                    {mode === 'in' ? 'No account? Create one' : 'Already have an account? Sign in'}
                </Button>
            </div>
        </div>
    );
}