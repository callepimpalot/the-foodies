import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

import { ArchetypeProvider } from './context/ArchetypeContext'
import { ViewProvider } from './context/ViewContext'
import { AuthProvider } from './context/AuthContext'
import { HouseholdProvider } from './context/HouseholdContext'
import { InventoryProvider } from './context/InventoryContext'
import { PlanProvider } from './context/PlanContext'
import { ShopProvider } from './context/ShopContext'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ArchetypeProvider>
      <ViewProvider>
        <AuthProvider>
          <HouseholdProvider>
            <InventoryProvider>
              <PlanProvider>
                <ShopProvider>
                  <App />
                </ShopProvider>
              </PlanProvider>
            </InventoryProvider>
          </HouseholdProvider>
        </AuthProvider>
      </ViewProvider>
    </ArchetypeProvider>
  </React.StrictMode>,
)
