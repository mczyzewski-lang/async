import { Link } from 'react-router';

export default function NotFound() {
  return (
    <div className="safe-x safe-top flex min-h-[70dvh] flex-col items-center justify-center text-center">
      <p className="font-display text-3xl font-light">Ta ścieżka prowadzi donikąd.</p>
      <p className="mt-2 text-ink-soft">Wróćmy na matę.</p>
      <Link to="/" className="btn-primary mt-6">Strona główna</Link>
    </div>
  );
}
