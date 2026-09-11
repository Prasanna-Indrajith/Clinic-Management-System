import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import './index.css';
import App from './App.jsx';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <App />
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: {
            background: 'var(--color-surface)',
            color: 'var(--color-text)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-md)',
            fontFamily: 'var(--font-body)',
            fontSize: 'var(--text-sm)',
          },
          success: {
            iconTheme: { primary: 'var(--color-success)', secondary: 'var(--color-base)' },
          },
          error: {
            iconTheme: { primary: 'var(--color-danger)', secondary: 'var(--color-base)' },
          },
        }}
      />
    </BrowserRouter>
  </StrictMode>
);
