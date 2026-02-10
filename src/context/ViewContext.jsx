import { createContext, useContext, useState } from 'react';
import { VIEWS } from '../utils/constants';

const ViewContext = createContext();

export function ViewProvider({ children }) {
    // Default to HOME, but could logic check for first-time user later
    const [currentView, setCurrentView] = useState(VIEWS.DASHBOARD);

    // Helper to go back to home? Or just set view directly.
    // We can add history stack later if needed.

    const value = {
        currentView,
        setCurrentView,
        VIEWS
    };

    return (
        <ViewContext.Provider value={value}>
            {children}
        </ViewContext.Provider>
    );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useView() {
    const context = useContext(ViewContext);
    if (!context) {
        throw new Error('useView must be used within a ViewProvider');
    }
    return context;
}
