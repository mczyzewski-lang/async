import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';
import { useStore } from './store/useStore';

// test / automation hook (read-only use recommended)
(window as unknown as { __stairStudio: typeof useStore }).__stairStudio = useStore;

createRoot(document.getElementById('root')!).render(
  <App />,
);
