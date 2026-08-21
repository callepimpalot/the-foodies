import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

import { ArchetypeProvider } from './context/ArchetypeContext'
import { ViewProvider } from './context/ViewContext'
import { InventoryProvider } from './context/InventoryContext'
import { PlanProvider } from './context/PlanContext'
import { ShopProvider } from './context/ShopContext'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ArchetypeProvider>
      <ViewProvider>
        <InventoryProvider>
          <PlanProvider>
            <ShopProvider>
              <App />
            </ShopProvider>
          </PlanProvider>
        </InventoryProvider>
      </ViewProvider>
    </ArchetypeProvider>
  </React.StrictMode>,
)
