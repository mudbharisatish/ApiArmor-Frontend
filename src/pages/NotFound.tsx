import { Link } from 'react-router-dom';

export function NotFoundPage() {
  return (
    <div className="mx-auto max-w-[1180px] px-4 py-10 md:px-10">
      <div className="card p-8">
        <h2 className="text-[20px] font-semibold">This page doesn&rsquo;t exist</h2>
        <p className="mt-2 text-ink-2">The link may be old, or the item was removed.</p>
        <Link to="/" className="link mt-4 inline-block">
          Go to Home
        </Link>
      </div>
    </div>
  );
}
