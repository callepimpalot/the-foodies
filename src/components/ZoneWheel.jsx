
import React from 'react';

export function ZoneWheel({ categories, currentCategoryInfo, onZoneClick, categoryOrder }) {
    const containerRef = React.useRef(null);
    const apiRef = React.useRef({});

    // Sort categories based on user preference
    const sortedCategories = [...categories].sort((a, b) => {
        const indexA = categoryOrder.indexOf(a.id);
        const indexB = categoryOrder.indexOf(b.id);
        const safeA = indexA === -1 ? 999 : indexA;
        const safeB = indexB === -1 ? 999 : indexB;
        return safeA - safeB;
    });

    React.useEffect(() => {
        // Auto-scroll to center active item
        if (currentCategoryInfo && apiRef.current[currentCategoryInfo.id] && containerRef.current) {
            const activeEl = apiRef.current[currentCategoryInfo.id];
            const container = containerRef.current;

            const scrollLeft = activeEl.offsetLeft - (container.clientWidth / 2) + (activeEl.clientWidth / 2);

            container.scrollTo({
                left: scrollLeft,
                behavior: 'smooth'
            });
        }
    }, [currentCategoryInfo?.id]); // Only re-run if ID changes

    return (
        <div style={{ position: 'relative', width: '100%', height: '80px', marginTop: 'auto', marginBottom: '20px' }}>
            {/* Fade Gradients */}
            <div style={{
                position: 'absolute',
                left: 0, top: 0, bottom: 0, width: '20%',
                background: 'linear-gradient(to right, var(--color-bg), transparent)',
                zIndex: 10,
                pointerEvents: 'none'
            }} />
            <div style={{
                position: 'absolute',
                right: 0, top: 0, bottom: 0, width: '20%',
                background: 'linear-gradient(to left, var(--color-bg), transparent)',
                zIndex: 10,
                pointerEvents: 'none'
            }} />

            {/* Selection Indicator (Center Line) */}
            {/* Optional: Add a subtle indicator if desired, but size/opacity might be enough */}

            <div
                ref={containerRef}
                className="zone-wheel"
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    overflowX: 'auto',
                    gap: '20px',
                    padding: '0 50%', // Force center alignment
                    height: '100%',
                    scrollbarWidth: 'none',
                    msOverflowStyle: 'none',
                    scrollSnapType: 'x mandatory',
                    WebkitOverflowScrolling: 'touch'
                }}
            >
                <style>{`
                    .zone-wheel::-webkit-scrollbar {
                        display: none;
                    }
                `}</style>

                {sortedCategories.map(cat => {
                    const isActive = currentCategoryInfo?.id === cat.id;

                    return (
                        <div
                            key={cat.id}
                            ref={el => apiRef.current[cat.id] = el}
                            onClick={() => onZoneClick(cat.id)}
                            style={{
                                scrollSnapAlign: 'center',
                                flexShrink: 0,
                                cursor: 'pointer',
                                transition: 'all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1)',
                                opacity: isActive ? 1 : 0.4,
                                transform: isActive ? 'scale(1.2)' : 'scale(0.9)',
                                color: isActive ? 'var(--color-primary)' : 'var(--color-text-secondary)',
                                fontWeight: isActive ? 800 : 500,
                                fontSize: isActive ? '1.2rem' : '1rem',
                                letterSpacing: isActive ? '-0.02em' : 'normal',
                                textAlign: 'center',
                                whiteSpace: 'nowrap'
                            }}
                        >
                            {cat.name}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
