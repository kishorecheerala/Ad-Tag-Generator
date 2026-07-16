import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { TestPageRoute } from './features/test-page/TestPageRoute.tsx'

const isTestPage = window.location.pathname.replace(/\/+$/, '') === '/testpage'

createRoot(document.getElementById('root')!).render(
  <StrictMode>{isTestPage ? <TestPageRoute /> : <App />}</StrictMode>,
)
