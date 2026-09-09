import React from 'react'
import ReactDOM from 'react-dom/client'
import App from '@/App.jsx'
import { registerServiceWorker } from '@/lib/registerSW'
import { applyTheme, readTheme } from '@/lib/theme'
import '@/index.css'

// Before the first paint, so a dark app never flashes a light background.
applyTheme(readTheme())

ReactDOM.createRoot(document.getElementById('root')).render(
  <App />
)

registerServiceWorker()
