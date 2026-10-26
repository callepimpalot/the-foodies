import { useState } from 'react';
import { useHousehold } from '../context/HouseholdContext';
import { useAuth } from '../context/AuthContext';
import { useView } from '../context/ViewContext';
import { Button } from '../components/ui/Button';
import { BoardCard, TicketCard } from '../components/ui/TicketCard';
import { Check, Copy, Crown, User as UserIcon } from 'lucide-react';

/**
 * FAMILY HOUSEHOLDS — the household has two faces, and this screen is both of
 * them depending on whether there is a session:
 *
 *   signed in  -> Profile: the household name, who is in it, the invite action
 *                 (owner only), removing a member, and sign-out.
 *   signed out -> the legacy TASK_07 join screen (your code / join a code), now
 *                 the Q6 small-print path, with a sign-in affordance up front.
 *
 * Inviting is the Flow-B path the brief says must never be a code pasted into
 * WhatsApp: the owner taps Share and the OS share sheet sends a link. The code is
 * kept only as unadvertised small print for when a link gets mangled.
 */
export function HouseholdView() {
    const household = useHousehold();
    const {
        name, members = [], role, isOwner, isAuthed,
        joinCode, remote, status, join, forget, signOut,
        inviteMember, remove, rename,
    } = household;
    const { user } = useAuth();
    const { setCurrentView, VIEWS } = useView();

    const [code, setCode] = useState('');
    const [message, setMessage] = useState(null);
    const [copied, setCopied] = useState(false);
    const [inviteLink, setInviteLink] = useState(null);
    const [editingName, setEditingName] = useState(false);
    const [nameDraft, setNameDraft] = useState(name);

    const myUserId = user?.id;

    const doSignOut = async () => {
        setMessage(null);
        await signOut();
        setInviteLink(null);
    };

    const doInvite = async () => {
        setMessage(null);
        const result = await inviteMember();
        if (!result.ok) {
            setMessage('Could not create an invite. Make sure you have a connection and try again.');
            return;
        }
        const origin = window?.location?.origin ?? '';
        const link = `${origin}/join?token=${result.token}`;
        setInviteLink(link);

        // Prefer the OS share sheet — this is the whole point of Flow B.
        if (navigator?.share) {
            try {
                await navigator.share({ title: 'Join my Meal Buddy household', text: link, url: link });
            } catch { /* user dismissed the sheet; the link is still on screen */ }
        }
    };

    const doCopy = async (text) => {
        try {
            await navigator.clipboard.writeText(text);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch {
            setMessage('Copying is blocked here — select the link by hand.');
        }
    };

    const doRemove = async (memberUserId) => {
        if (!window.confirm('Remove this member? The household keeps everything they added.')) return;
        const result = await remove(memberUserId);
        if (!result.ok) setMessage('Could not remove that member.');
    };

    const doRename = async () => {
        const trimmed = (nameDraft ?? '').trim();
        if (!trimmed) return;
        await rename(trimmed);
        setEditingName(false);
    };

    // ---- signed out: the legacy join screen + a sign-in affordance ----------
    if (!isAuthed) {
        return (
            <div className="animate-fade-in pb-32 px-0">
                <header className="pt-8 pb-6">
                    <p className="t-eyebrow" style={{ color: 'var(--chalk-dim)' }}>Household</p>
                    <h1 className="t-heading-lg" style={{ color: 'var(--chalk)' }}>One kitchen, two phones</h1>
                    <p className="t-body mt-2" style={{ color: 'var(--chalk-dim)', maxWidth: '34rem' }}>
                        The best way to share is with an account — invite your housemate with a link.
                        The code below is the fallback for when a link gets mangled.
                    </p>
                </header>

                <BoardCard className="mb-6">
                    <p className="t-body" style={{ color: 'var(--chalk)' }}>
                        Sign in or create an account to invite someone properly.
                    </p>
                    <div className="mt-3 flex gap-3">
                        <Button variant="primary" onClick={() => setCurrentView(VIEWS.AUTH)}>Sign in</Button>
                    </div>
                </BoardCard>

                <TicketCard className="mb-6">
                    <p className="t-eyebrow" style={{ color: 'var(--ink-dim)' }}>Your code</p>
                    <div className="flex items-center justify-between gap-3 mt-2">
                        <span className="t-display" style={{ fontSize: '34px', color: 'var(--ink)', letterSpacing: '0.08em' }}>
                            {joinCode || '—'}
                        </span>
                        <Button variant="secondary" onClick={() => doCopy(joinCode)} disabled={!joinCode}>
                            <span className="flex items-center gap-2"><Copy size={16} /> {copied ? 'Copied' : 'Copy'}</span>
                        </Button>
                    </div>
                    <p className="t-body mt-3" style={{ color: 'var(--ink-dim)' }}>
                        Type this on the other phone, under &ldquo;Join a household&rdquo;.
                        {!remote && ' This one is device-local — it will not be found from another phone until the backend is connected.'}
                    </p>
                </TicketCard>

                <BoardCard>
                    <p className="t-eyebrow" style={{ color: 'var(--chalk-dim)' }}>Join a household</p>
                    <form className="flex flex-col gap-3 mt-3" onSubmit={async (e) => { e.preventDefault(); setMessage(null); const r = await join(code); if (!r.ok) setMessage('No household has that code. Codes are 8 characters, letters and numbers.'); }}>
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
                                fontFamily: 'var(--f-mono)', letterSpacing: '0.14em', fontSize: '18px',
                                color: 'var(--chalk)', background: 'var(--board)',
                                border: '1px solid var(--line)', borderRadius: 'var(--r-sm)',
                                padding: '14px 16px', textTransform: 'uppercase',
                            }}
                        />
                        <Button variant="primary" type="submit" disabled={status === 'joining'}>
                            {status === 'joining' ? 'Joining…' : 'Join'}
                        </Button>
                    </form>
                    {message && <p className="t-body mt-3" style={{ color: 'var(--grease)' }}>{message}</p>}
                    <div className="mt-4">
                        <Button variant="ghost" onClick={forget}>Start a new household on this device</Button>
                    </div>
                </BoardCard>
            </div>
        );
    }

    // ---- signed in: the profile ---------------------------------------------
    return (
        <div className="animate-fade-in pb-32 px-0">
            <header className="pt-8 pb-6">
                <p className="t-eyebrow" style={{ color: 'var(--chalk-dim)' }}>Household</p>
                <h1 className="t-heading-lg" style={{ color: 'var(--chalk)' }}>{name}</h1>
                <p className="t-body mt-2" style={{ color: 'var(--chalk-dim)', maxWidth: '34rem' }}>
                    Signed in as <span className="t-mono" style={{ color: 'var(--chalk)' }}>{user?.email}</span>
                    {role === 'owner' ? ' — owner' : ''}.
                </p>
            </header>

            {editingName ? (
                <BoardCard className="mb-6">
                    <div className="flex gap-2 items-end">
                        <input
                            type="text"
                            value={nameDraft}
                            onChange={(e) => setNameDraft(e.target.value)}
                            style={{
                                fontFamily: 'var(--f-body)', fontSize: '15px', color: 'var(--chalk)',
                                background: 'var(--board)', border: '1px solid var(--line)',
                                borderRadius: 'var(--r-sm)', padding: '12px 14px', flex: 1,
                            }}
                        />
                        <Button variant="primary" onClick={doRename}>Save</Button>
                        <Button variant="ghost" onClick={() => setEditingName(false)}>Cancel</Button>
                    </div>
                </BoardCard>
            ) : null}

            <BoardCard className="mb-6">
                <div className="flex items-center justify-between gap-3">
                    <p className="t-eyebrow" style={{ color: 'var(--chalk-dim)' }}>Members</p>
                    <Button variant="ghost" onClick={() => { setNameDraft(name); setEditingName(true); }}>Rename</Button>
                </div>

                <ul className="flex flex-col gap-2 mt-3">
                    {members.map((m) => (
                        <li key={m.userId} className="flex items-center justify-between gap-3 py-2" style={{ borderBottom: '1px solid var(--line)' }}>
                            <div className="flex items-center gap-2">
                                {m.role === 'owner' ? <Crown size={16} color="var(--grease)" /> : <UserIcon size={16} color="var(--chalk-dim)" />}
                                <span className="t-body" style={{ color: 'var(--chalk)' }}>
                                    {m.displayName || (m.userId === myUserId ? 'You' : 'Member')}
                                    {m.userId === myUserId ? ' (you)' : ''}
                                </span>
                                <span className="t-label" style={{ color: 'var(--chalk-dim)' }}>{m.role}</span>
                            </div>
                            {isOwner && m.userId !== myUserId && (
                                <Button variant="ghost" onClick={() => doRemove(m.userId)}>Remove</Button>
                            )}
                        </li>
                    ))}
                </ul>
                {!members.length && (
                    <p className="t-body mt-3" style={{ color: 'var(--chalk-dim)' }}>You are the only member so far. Invite someone below.</p>
                )}
            </BoardCard>

            {isOwner && (
                <BoardCard className="mb-6">
                    <p className="t-eyebrow" style={{ color: 'var(--chalk-dim)' }}>Invite someone</p>
                    <p className="t-body mt-2" style={{ color: 'var(--chalk-dim)' }}>
                        Send a link. They tap it, set a password, and they&rsquo;re in — no code to type.
                        The link works once and expires in a week.
                    </p>
                    <div className="mt-3 flex gap-3">
                        <Button variant="primary" onClick={doInvite}>Get an invite link</Button>
                    </div>
                    {inviteLink && (
                        <div className="mt-3">
                            <p className="t-mono" style={{ color: 'var(--chalk)', fontSize: '12px', wordBreak: 'break-all' }}>{inviteLink}</p>
                            <Button variant="secondary" onClick={() => doCopy(inviteLink)}>
                                <span className="flex items-center gap-2">{copied ? <Check size={16} /> : <Copy size={16} />} Copy link</span>
                            </Button>
                        </div>
                    )}
                </BoardCard>
            )}

            <BoardCard>
                <div className="flex items-center justify-between gap-3">
                    <div>
                        <p className="t-label" style={{ color: 'var(--chalk)' }}>Sign out</p>
                        <p className="t-body mt-1" style={{ color: 'var(--chalk-dim)' }}>
                            Clears this device&rsquo;s saved household data.
                        </p>
                    </div>
                    <Button variant="ghost" onClick={doSignOut}>Sign out</Button>
                </div>
            </BoardCard>

            {message && <p className="t-body mt-3" style={{ color: 'var(--grease)' }}>{message}</p>}
        </div>
    );
}