import { Activity, Compass, Flower2, Sun } from 'lucide-react';
import { NavLink, Outlet, ScrollRestoration, useLocation } from 'react-router';

const TABS = [
  { to: '/', label: 'Dziś', icon: Sun, end: true },
  { to: '/explore', label: 'Pozycje', icon: Compass },
  { to: '/practice', label: 'Praktyka', icon: Flower2 },
  { to: '/progress', label: 'Postępy', icon: Activity },
];

const FULLSCREEN = [/^\/pose\//, /^\/practice\/play/, /^\/onboarding/, /^\/dev\//, /^\/breathe/];

export function AppShell() {
  const { pathname } = useLocation();
  const full = FULLSCREEN.some((r) => r.test(pathname));
  return (
    <div className="mx-auto min-h-dvh w-full max-w-[1100px]">
      <main className={full ? '' : 'pb-28'}>
        <Outlet />
      </main>
      {!full && (
        <nav
          aria-label="Nawigacja główna"
          className="glass fixed inset-x-0 bottom-0 z-40 border-t border-ink/5 pb-[max(env(safe-area-inset-bottom),0.4rem)]"
        >
          <ul className="mx-auto flex max-w-xl items-stretch justify-around px-2 pt-1.5">
            {TABS.map(({ to, label, icon: Icon, end }) => (
              <li key={to} className="flex-1">
                <NavLink
                  to={to}
                  end={end}
                  className={({ isActive }) =>
                    `flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-2xl text-[11px] font-semibold tracking-wide transition-colors ${isActive ? 'text-ink' : 'text-ink-soft/80'}`
                  }
                >
                  {({ isActive }) => (
                    <>
                      <Icon size={22} strokeWidth={isActive ? 1.9 : 1.5} />
                      {label}
                    </>
                  )}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      )}
      <ScrollRestoration />
    </div>
  );
}
