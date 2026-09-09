import React from 'react'
import ReactDOM from 'react-dom/client'
import App from '@/App.jsx'
import { registerServiceWorker } from '@/lib/registerSW'
import { applyTheme, readTheme } from '@/lib/theme'
import { watchInstallPrompt } from '@/lib/installPrompt'
import '@/index.css'

// Before the first paint, so a dark app never flashes a light background.
applyTheme(readTheme())

// The install event fires early and only once; miss it and there is no button.
watchInstallPrompt()

ReactDOM.createRoot(document.getElementById('root')).render(
  <App />
)

registerServiceWorker()
