import { lazy, Suspense } from 'react';
import { createBrowserRouter, RouterProvider } from 'react-router';
import { AppShell } from './AppShell';
import { Loading } from './Loading';

const Home = lazy(() => import('@/routes/Home'));
const Onboarding = lazy(() => import('@/routes/Onboarding'));
const Explore = lazy(() => import('@/routes/Explore'));
const PoseLearn = lazy(() => import('@/routes/PoseLearn'));
const PracticeConfig = lazy(() => import('@/routes/PracticeConfig'));
const PracticePreview = lazy(() => import('@/routes/PracticePreview'));
const PracticePlay = lazy(() => import('@/routes/PracticePlay'));
const Breathe = lazy(() => import('@/routes/Breathe'));
const Routines = lazy(() => import('@/routes/Routines'));
const Progress = lazy(() => import('@/routes/Progress'));
const Settings = lazy(() => import('@/routes/Settings'));
const PoseLab = lazy(() => import('@/dev/PoseLab'));
const PoseGrid = lazy(() => import('@/dev/PoseGrid'));
const NotFound = lazy(() => import('@/routes/NotFound'));

const s = (el: React.ReactNode) => <Suspense fallback={<Loading />}>{el}</Suspense>;

const router = createBrowserRouter([
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
]);

export function App() {
  return <RouterProvider router={router} />;
}
