import { createRoot } from 'react-dom/client';
import '@fontsource-variable/inter';
import '@fontsource-variable/space-grotesk';
import '@fontsource-variable/baloo-2';
import '@fontsource-variable/jetbrains-mono';
import './index.css';
import App from './App';
import { RenderPage } from './ui/RenderPage';

const render = new URLSearchParams(location.search).get('render');
// No StrictMode: drei <Html> labels create nested roots that do not survive double-mounted effects.
createRoot(document.getElementById('root')!).render(render ? <RenderPage /> : <App />);
