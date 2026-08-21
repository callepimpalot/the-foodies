import { useEffect, useRef, useState } from 'react';

/**
 * useWakeLock — keeps the screen awake using the native Screen Wake Lock API.
 *
 * Requests a 'screen' wake lock on mount and holds it for the lifetime of the
 * calling component. The lock is auto-released by the browser whenever the
 * document becomes hidden (tab switch, app switch, screen off) and is NOT
 * restored automatically — this hook re-acquires it on 'visibilitychange'.
 *
 * Feature-detects `navigator.wakeLock` and no-ops silently when unsupported.
 * request() can reject (hidden document, OS low-power mode); that rejection
 * is caught and reflected in state, never thrown.
 *
 * @returns {{ isActive: boolean, isSupported: boolean }}
 */
export function useWakeLock() {
    const [isActive, setIsActive] = useState(false);
    const isSupported = typeof navigator !== 'undefined' && 'wakeLock' in navigator;
    const sentinelRef = useRef(null);

    useEffect(() => {
        if (!isSupported) return undefined;

        let cancelled = false;

        const releaseSentinel = () => {
            const sentinel = sentinelRef.current;
            sentinelRef.current = null;
            if (sentinel) {
                sentinel.removeEventListener?.('release', handleRelease);
                sentinel.release?.().catch(() => {});
            }
        };

        const handleRelease = () => {
            sentinelRef.current = null;
            if (!cancelled) setIsActive(false);
        };

        const acquire = async () => {
            try {
                const sentinel = await navigator.wakeLock.request('screen');
                if (cancelled) {
                    // Component unmounted while the request was in flight — release immediately.
                    sentinel.release?.().catch(() => {});
                    return;
                }
                sentinelRef.current = sentinel;
                sentinel.addEventListener?.('release', handleRelease);
                setIsActive(true);
            } catch {
                // Rejects when the document is hidden or the device refuses (e.g. low-power
                // mode). Not a crash — just reflect that we don't hold the lock.
                if (!cancelled) setIsActive(false);
            }
        };

        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible' && !sentinelRef.current) {
                acquire();
            }
        };

        acquire();
        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            cancelled = true;
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            releaseSentinel();
            setIsActive(false);
        };
    }, [isSupported]);

    return { isActive, isSupported };
}
