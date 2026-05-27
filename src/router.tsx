import { lazy, Suspense } from 'react';
import { createHashRouter, Outlet } from 'react-router-dom';
import { App } from './App';

const Home = lazy(() => import('./pages/Home'));
const About = lazy(() => import('./pages/About'));
const SignalSandbox = lazy(() => import('./demos/01-signal-sandbox'));
const EncoderZoo = lazy(() => import('./demos/02-encoder-zoo'));
const FusionPlayground = lazy(() => import('./demos/03-fusion-playground'));
const ArchitectureDiff = lazy(() => import('./demos/04-architecture-diff'));
const DiffusionDenoising = lazy(() => import('./demos/05-diffusion-denoising'));
const ContactGate = lazy(() => import('./demos/06-contact-gate-live'));
const FailureModes = lazy(() => import('./demos/07-failure-modes'));

function SuspenseWrapper() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-64">
          <span className="font-mono text-text-secondary text-sm animate-pulse">
            Loading…
          </span>
        </div>
      }
    >
      <Outlet />
    </Suspense>
  );
}

export const router = createHashRouter([
  {
    element: <App />,
    children: [
      {
        element: <SuspenseWrapper />,
        children: [
          { index: true, element: <Home /> },
          { path: 'signal-sandbox', element: <SignalSandbox /> },
          { path: 'encoder-zoo', element: <EncoderZoo /> },
          { path: 'fusion-playground', element: <FusionPlayground /> },
          { path: 'architecture-diff', element: <ArchitectureDiff /> },
          { path: 'diffusion-denoising', element: <DiffusionDenoising /> },
          { path: 'contact-gate', element: <ContactGate /> },
          { path: 'failure-modes', element: <FailureModes /> },
          { path: 'about', element: <About /> },
        ],
      },
    ],
  },
]);
