import { StrictMode } from 'react';
import ReactDOM from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App';
import './index.css';

const updateSW = registerSW({
  immediate: true,
  onRegisteredSW(_swUrl, registration) {
    if (!registration) {
      return;
    }

    const checkInterval = import.meta.env.DEV ? 60 * 1000 : 60 * 60 * 1000;
    setInterval(() => {
      registration.update();
    }, checkInterval);
  },
  onNeedRefresh() {
    updateSW(true);
  },
  onOfflineReady() {
    console.log('Worven is ready to work offline.');
  },
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

requestAnimationFrame(() => {
  document.documentElement.classList.remove('preload');
  document.body.classList.remove('preload');
});
