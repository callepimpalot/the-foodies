import React, { useState, useEffect } from 'react';

export function SwipeDeck({ items, onSwipeLeft, onSwipeRight, onFinish, renderCard, currentIndex: externalIndex, onIndexChange }) {
    const [internalIndex, setInternalIndex] = useState(0);
    const currentIndex = externalIndex !== undefined ? externalIndex : internalIndex;

    const [dragStart, setDragStart] = useState(null);
    const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
    const [exitX, setExitX] = useState(0);
    const [isAnimating, setIsAnimating] = useState(false);

    const currentItem = items[currentIndex];
    const swipeThreshold = 100;

    useEffect(() => {
        if (currentIndex >= items.length && items.length > 0) {
            onFinish?.();
        }
    }, [currentIndex, items.length, onFinish]);

    // Drag Handlers
    const handleDragStart = (e) => {
        if (isAnimating) return;
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        setDragStart({ x: clientX, y: clientY });
    };

    const handleDragMove = (e) => {
        if (!dragStart || isAnimating) return;
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        setDragOffset({
            x: clientX - dragStart.x,
            y: clientY - dragStart.y
        });
    };

    const handleDragEnd = () => {
        if (!dragStart || isAnimating) return;

        if (Math.abs(dragOffset.x) > swipeThreshold) {
            triggerSwipe(dragOffset.x > 0 ? 'right' : 'left');
        } else {
            // Reset
            setIsAnimating(true);
            setDragOffset({ x: 0, y: 0 });
            setDragStart(null);
            setTimeout(() => setIsAnimating(false), 300);
        }
    };

    const triggerSwipe = (direction) => {
        setIsAnimating(true);
        const finalX = direction === 'right' ? 800 : -800;
        setExitX(finalX);

        setTimeout(() => {
            if (direction === 'right') {
                onSwipeRight(currentItem);
            } else {
                onSwipeLeft(currentItem);
            }

            const nextIndex = currentIndex + 1;
            if (onIndexChange) {
                onIndexChange(nextIndex);
            } else {
                setInternalIndex(nextIndex);
            }

            setExitX(0);
            setDragOffset({ x: 0, y: 0 });
            setDragStart(null);
            setIsAnimating(false);
        }, 300);
    };

    if (currentIndex >= items.length) {
        return null;
    }

    const rotation = (dragOffset.x / 20);
    const opacity = 1 - Math.abs(dragOffset.x) / 500;

    // Indicators
    const showRightIndicator = dragOffset.x > 50;
    const showLeftIndicator = dragOffset.x < -50;

    return (
        <div
            style={{
                position: 'relative',
                height: '420px',
                width: '100%',
                maxWidth: '350px',
                margin: '0 auto',
                perspective: '1000px',
                touchAction: 'none' // Prevent scrolling while dragging
            }}
            onMouseDown={handleDragStart}
            onMouseMove={handleDragMove}
            onMouseUp={handleDragEnd}
            onMouseLeave={handleDragEnd}
            onTouchStart={handleDragStart}
            onTouchMove={handleDragMove}
            onTouchEnd={handleDragEnd}
        >
            {/* Background card (preview of next) */}
            {currentIndex + 1 < items.length && (
                <div style={{
                    position: 'absolute',
                    top: '10px',
                    left: '50%',
                    transform: 'translateX(-50%) scale(0.95)',
                    width: '100%',
                    height: '100%',
                    opacity: 0.3,
                    zIndex: 0
                }}>
                    {renderCard(items[currentIndex + 1])}
                </div>
            )}

            {/* Active Card */}
            <div style={{
                position: 'absolute',
                width: '100%',
                height: '100%',
                transition: isAnimating ? 'all 0.3s ease-out' : 'none',
                transform: `translateX(${exitX || dragOffset.x}px) translateY(${dragOffset.y / 2}px) rotate(${exitX ? exitX / 20 : rotation}deg)`,
                opacity: exitX !== 0 ? 0 : 1,
                zIndex: 10,
                cursor: dragStart ? 'grabbing' : 'grab',
                userSelect: 'none'
            }}>
                {renderCard(currentItem)}

                {/* Visual Feedback Overlays */}
                {showRightIndicator && (
                    <div style={{
                        position: 'absolute',
                        top: '40px',
                        left: '20px',
                        border: '4px solid #4cd137',
                        color: '#4cd137',
                        padding: '5px 15px',
                        borderRadius: '8px',
                        fontSize: '2.2rem',
                        fontWeight: 'bold',
                        transform: 'rotate(-15deg)',
                        opacity: Math.min(Math.abs(dragOffset.x) / 100, 1),
                        pointerEvents: 'none',
                        background: 'rgba(76, 209, 55, 0.1)',
                        boxShadow: '0 0 20px rgba(76, 209, 55, 0.2)'
                    }}>
                        NEED IT!
                    </div>
                )}

                {showLeftIndicator && (
                    <div style={{
                        position: 'absolute',
                        top: '40px',
                        right: '20px',
                        border: '4px solid #7f8fa6',
                        color: '#f5f6fa',
                        padding: '5px 15px',
                        borderRadius: '8px',
                        fontSize: '2.2rem',
                        fontWeight: 'bold',
                        transform: 'rotate(15deg)',
                        opacity: Math.min(Math.abs(dragOffset.x) / 100, 1),
                        pointerEvents: 'none',
                        background: 'rgba(127, 143, 166, 0.2)',
                        boxShadow: '0 0 20px rgba(127, 143, 166, 0.2)'
                    }}>
                        GOT IT
                    </div>
                )}
            </div>


        </div>
    );
}
