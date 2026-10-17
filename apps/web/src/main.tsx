import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { RootErrorBoundary } from './components/ErrorBoundary';
import { initAppearance } from './lib/appearance';
import { queryClient } from './lib/query-client';
import './index.css';
// Side effect: attach the beforeinstallprompt capture at startup, not at first
// render of the Profile tab — Chromium fires it once, on load (FEAT-008 AC5).
import './features/shell/useInstallPrompt';

// FEAT-016: index.html already painted the remembered scheme; this takes ownership
// (theme-color meta, live system-scheme changes).
initAppearance();

const rootElement = document.getElementById('root');
if (rootElement) {
  createRoot(rootElement).render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          {/* Last line of defence (BUG-011): screens have their own boundaries, so this
              only catches a crash in the router or a provider. */}
          <RootErrorBoundary>
            <App />
          </RootErrorBoundary>
        </BrowserRouter>
      </QueryClientProvider>
    </StrictMode>,
  );
}
