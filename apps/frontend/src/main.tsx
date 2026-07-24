import 'leaflet/dist/leaflet.css';
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { enforceCurrentAppBuild } from './lib/appVersion';
import {
  authCallbackErrorRedirect,
  consumeAuthCallbackError,
  stashAuthCallbackError,
} from './lib/authCallbackUrl';
import { ensureRuntimeEnv } from './lib/loadRuntimeEnv';
import './styles/globals.css';

async function bootstrap() {
  enforceCurrentAppBuild();
  await ensureRuntimeEnv();

  // Strip auth errors before Supabase boots — detectSessionInUrl can hang on #error=...
  const authError = consumeAuthCallbackError();
  if (authError) {
    stashAuthCallbackError(authError);
    window.history.replaceState(null, '', authCallbackErrorRedirect(authError.code));
  }

  const { App } = await import('./app/App');

  if (import.meta.env.PROD && 'serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      void navigator.serviceWorker.register('/sw.js').catch(() => {
        // Installation remains available through the browser menu if registration fails.
      });
    });
  }

  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </React.StrictMode>,
  );
}

void bootstrap();
