import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import CH55xBootloader from './ch55xbl.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <CH55xBootloader />
  </StrictMode>,
)
