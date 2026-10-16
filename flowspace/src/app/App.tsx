import { lazy, Suspense } from 'react';
import { createBrowserRouter, createMemoryRouter, RouterProvider } from 'react-router';
import { AppShell } from './AppShell';
import { Loading } from './Loading';
import { preloadCharacter } from '@/three/rig/characterAsset';

/** Routes that render the instructor wait for the precomputed character mesh. */
const with3d = <T,>(load: () => Promise<T>) => () => Promise.all([load(), preloadCharacter()]).then(([m]) => m);

const Home = lazy(with3d(() => import('@/routes/Home')));
const Onboarding = lazy(() => import('@/routes/Onboarding'));
const Explore = lazy(() => import('@/routes/Explore'));
const PoseLearn = lazy(with3d(() => import('@/routes/PoseLearn')));
const PracticeConfig = lazy(() => import('@/routes/PracticeConfig'));
const PracticePreview = lazy(() => import('@/routes/PracticePreview'));
const PracticePlay = lazy(with3d(() => import('@/routes/PracticePlay')));
const Breathe = lazy(() => import('@/routes/Breathe'));
const Routines = lazy(() => import('@/routes/Routines'));
const Progress = lazy(() => import('@/routes/Progress'));
const Settings = lazy(with3d(() => import('@/routes/Settings')));
const PoseLab = lazy(with3d(() => import('@/dev/PoseLab')));
const PoseGrid = lazy(with3d(() => import('@/dev/PoseGrid')));
const NotFound = lazy(() => import('@/routes/NotFound'));

const s = (el: React.ReactNode) => <Suspense fallback={<Loading />}>{el}</Suspense>;

const routes = [
  {
    element: <AppShell />,
    children: [
      { path: '/', element: s(<Home />) },
      { path: '/onboarding', element: s(<Onboarding />) },
      { path: '/explore', element: s(<Explore />) },
      { path: '/pose/:slug', element: s(<PoseLearn />) },
      { path: '/practice', element: s(<PracticeConfig />) },
      { path: '/practice/preview', element: s(<PracticePreview />) },
      { path: '/practice/play', element: s(<PracticePlay />) },
      { path: '/breathe', element: s(<Breathe />) },
      { path: '/routines', element: s(<Routines />) },
      { path: '/progress', element: s(<Progress />) },
      { path: '/settings', element: s(<Settings />) },
      { path: '/dev/pose-lab', element: s(<PoseLab />) },
      { path: '/dev/pose-grid', element: s(<PoseGrid />) },
      { path: '*', element: s(<NotFound />) },
    ],
  },
];

// Embedded previews (sandboxed frames) use an in-memory router; the PWA uses real URLs.
const router = import.meta.env.VITE_MEMORY_ROUTER ? createMemoryRouter(routes) : createBrowserRouter(routes);

export function App() {
  return <RouterProvider router={router} />;
}
