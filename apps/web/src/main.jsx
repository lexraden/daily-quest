import React from 'react'
import ReactDOM from 'react-dom/client'
import App from '@/App.jsx'
import { registerServiceWorker } from '@/lib/registerSW'
import '@/index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <App />
)

registerServiceWorker()
