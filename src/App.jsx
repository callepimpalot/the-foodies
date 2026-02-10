import { useState } from 'react'
import { BottomNav } from './components/BottomNav'
import { useView } from './context/ViewContext'
import { useArchetype } from './context/ArchetypeContext'
import { FamilyProvider } from './context/FamilyContext'
import { MissionControl } from './components/MissionControl'
import { FamilyProfile } from './components/profile/FamilyProfile'

// Views
import { HomeView } from './views/HomeView'
import { PlanView } from './views/PlanView'
import { RecipeView } from './views/RecipeView'
import { ShopView } from './views/ShopView'
import { PantryView } from './views/PantryView'
import { BottomShoppingSheet } from './components/BottomShoppingSheet'

function AppContent() {
  const { currentView, VIEWS } = useView();
  // const { activeArchetype } = useArchetype();
  const [showProfile, setShowProfile] = useState(false);

  // Top Icons Component
  const TopIcons = () => (
    <div style={{
      position: 'absolute',
      top: '1.5rem',
      right: '1.5rem',
      display: 'flex',
      gap: '1rem',
      zIndex: 50
    }}>
      <button
        onClick={() => setShowProfile(!showProfile)}
        style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: 'var(--color-text-primary)' }}
      >
        👤
      </button>
      <button
        style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: 'var(--color-text-primary)' }}
      >
        ⚙️
      </button>
    </div>
  );

  // Render Logic
  const renderView = () => {
    // If Profile Overlay is open, show FamilyProfile
    if (showProfile) {
      return (
        <FamilyProfile onClose={() => setShowProfile(false)} />
      );
    }

    switch (currentView) {
      case VIEWS.DASHBOARD: return <HomeView />;
      case VIEWS.PLAN: return <PlanView />;
      case VIEWS.RECIPES: return <RecipeView />;
      case VIEWS.SHOP: return <ShopView />;
      case VIEWS.PANTRY: return <PantryView />;
      case VIEWS.PROFILE: return (
        <FamilyProfile onClose={() => setShowProfile(false)} />
      );
      default: return <HomeView />;
    }
  };

  return (
    <>
      <div className="ambient-background" />

      <TopIcons />

      <main style={{
        maxWidth: '1200px',
        margin: '0 auto',
        padding: 'var(--spacing-container)',
        paddingBottom: '6rem', // Space for bottom nav
        minHeight: '100vh',
      }}>
        {renderView()}
      </main>

      {!showProfile && <BottomShoppingSheet />}
      {!showProfile && <BottomNav />}
    </>
  )
}

function App() {
  return (
    <FamilyProvider>
      <AppContent />
    </FamilyProvider>
  );
}

export default App
