import { useView } from './context/ViewContext'
import { BottomNav } from './components/BottomNav'

// Views
import { HomeView } from './views/HomeView'
import { PlanView } from './views/PlanView'
import { RecipeView } from './views/RecipeView'
import { ShopView } from './views/ShopView'
import { PantryView } from './views/PantryView'
import { CookModeView } from './views/CookModeView'
import { CaptureView } from './views/CaptureView'

function AppContent() {
  const { currentView, VIEWS } = useView();

  // Render Logic
  const renderView = () => {
    switch (currentView) {
      case VIEWS.DASHBOARD: return <HomeView />;
      case VIEWS.PLAN: return <PlanView />;
      case VIEWS.RECIPES: return <RecipeView />;
      case VIEWS.SHOP: return <ShopView />;
      case VIEWS.PANTRY: return <PantryView />;
      case VIEWS.CAPTURE: return <CaptureView />;
      case VIEWS.COOK_MODE: return <CookModeView />;
      default: return <HomeView />;
    }
  };

  return (
    <div className="relative h-[100dvh] w-full overflow-hidden flex flex-col">
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

      <BottomNav />
    </div>
  )
}

function App() {
  return <AppContent />;
}

export default App
