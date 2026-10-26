import { createContext, useContext, useState } from 'react';
import { VIEWS } from '../utils/constants';

const ViewContext = createContext();

// FAMILY HOUSEHOLDS — an invite link lands on the JOIN screen. The app has no
// router (it is a single-view SPA driven by `currentView`), so the initial view
// is decided here from the URL instead of a route. The invite token is a query
// parameter on the `/join` path (`/join?token=…` — Netlify serves index.html for
// it via `public/_redirects`), and JoinView reads the token back out of
// `viewData` or `window.location.search`.
function initialView() {
    if (typeof window === 'undefined') return VIEWS.DASHBOARD;
    const search = window.location.search ?? '';
    if (new URLSearchParams(search).get('token')) return VIEWS.JOIN;
    if (window.location.pathname === '/join') return VIEWS.JOIN;
    return VIEWS.DASHBOARD;
}

export function ViewProvider({ children }) {
    const [currentView, setCurrentViewState] = useState(initialView);
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
