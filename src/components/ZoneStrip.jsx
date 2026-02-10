import React from 'react';

export function ZoneStrip({ categories, currentCategoryInfo, onZoneClick, categoryOrder }) {
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
    }, [currentCategoryInfo]);

    return (
        <div
            ref={containerRef}
            className="zone-strip"
            style={{
                display: 'flex',
                overflowX: 'auto',
                gap: '12px',
                padding: '12px 50% 12px 50%', // Big padding to allow first/last items to center
                marginBottom: '10px',
                scrollbarWidth: 'none', // Firefox
                msOverflowStyle: 'none', // IE
                WebkitOverflowScrolling: 'touch'
            }}
        >
            <style>{`
                .zone-strip::-webkit-scrollbar {
                    display: none;
                }
            `}</style>

            {sortedCategories.map(cat => {
                const isActive = currentCategoryInfo?.id === cat.id;
                // We'll add counts/progress later if needed, for now just names

                return (
                    <button
                        key={cat.id}
                        ref={el => apiRef.current[cat.id] = el}
                        onClick={() => onZoneClick(cat.id)}
                        style={{
                            background: isActive ? '#1A1C1E' : 'rgba(0, 0, 0, 0.05)', // Black active background
                            color: isActive ? '#ffffff' : 'var(--color-text-secondary)',
                            border: isActive ? 'none' : '1px solid rgba(0, 0, 0, 0.05)',
                            padding: '8px 16px',
                            borderRadius: '20px',
                            fontSize: '0.9rem',
                            fontWeight: isActive ? 600 : 500,
                            whiteSpace: 'nowrap',
                            cursor: 'pointer',
                            flexShrink: 0,
                            transition: 'all 0.2s ease',
                            boxShadow: isActive ? '0 4px 12px rgba(0, 0, 0, 0.2)' : 'none',
                            transform: isActive ? 'scale(1.05)' : 'scale(1)'
                        }}
                    >
                        {cat.name}
                    </button>
                );
            })}
        </div>
    );
}
