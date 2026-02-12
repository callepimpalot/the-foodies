import { useState } from 'react'
import { User, Bell } from 'lucide-react'
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

  // Render Logic
  const renderView = () => {
    // If Profile Overlay is open, show FamilyProfile
    if (showProfile) {
      return (
        <FamilyProfile onClose={() => setShowProfile(false)} />
      );
    }

    switch (currentView) {
      case VIEWS.DASHBOARD: return <HomeView onOpenProfile={() => setShowProfile(true)} />;
      case VIEWS.PLAN: return <PlanView />;
      case VIEWS.RECIPES: return <RecipeView />;
      case VIEWS.SHOP: return <ShopView />;
      case VIEWS.PANTRY: return <PantryView />;
      case VIEWS.PROFILE: return (
        <FamilyProfile onClose={() => setShowProfile(false)} />
      );
      default: return <HomeView onOpenProfile={() => setShowProfile(true)} />;
    }
  };

  return (
    <div className="relative h-[100dvh] w-full overflow-hidden flex flex-col bg-zinc-50">
      <div className="ambient-background" />

      {/* Scrollable Content Area */}
      <main
        className="flex-1 overflow-y-auto overflow-x-hidden scroll-smooth"
        style={{ paddingBottom: '8rem' }} // Extra safety padding for dock
      >
        <div style={{
          maxWidth: '1200px',
          margin: '0 auto',
          padding: 'var(--spacing-container)',
          paddingTop: '0',
          minHeight: '100%',
        }}>
          {renderView()}
        </div>
      </main>

      {!showProfile && <BottomShoppingSheet />}
      {!showProfile && <BottomNav />}
    </div>
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
