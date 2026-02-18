import { createContext, useContext, useState } from 'react';
import { VIEWS } from '../utils/constants';

const ViewContext = createContext();

export function ViewProvider({ children }) {
    // Default to HOME, but could logic check for first-time user later
    const [currentView, setCurrentViewState] = useState(VIEWS.DASHBOARD);
    const [viewData, setViewData] = useState(null);

    const setCurrentView = (view, data = null) => {
        setCurrentViewState(view);
        setViewData(data);
    };

    const value = {
        currentView,
        setCurrentView,
        viewData,
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
