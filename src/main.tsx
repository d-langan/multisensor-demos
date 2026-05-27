import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import { TalkModeProvider } from './lib/useTalkMode';
import { router } from './router';
import './styles/globals.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <TalkModeProvider>
      <RouterProvider router={router} />
    </TalkModeProvider>
  </StrictMode>,
);
