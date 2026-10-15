import { notFound } from 'next/navigation';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Engine Sandbox | Loopgate Dev',
  description: 'Development-only engine playground for the Loopgate gate engine.',
  robots: { index: false, follow: false },
};

/**
 * Layout for /dev/* routes.
 *
 * This layout calls notFound() in production, which causes Next.js to render
 * the custom 404 page for ALL routes under /dev/. This means the route is
 * completely invisible to end users and search engines in production builds.
 *
 * In development (npm run dev), this layout renders normally.
 */
export default function DevLayout({ children }: { children: React.ReactNode }) {
  if (process.env.NODE_ENV !== 'development') {
    notFound();
  }

  return (
    <div className="flex-1 flex flex-col">
      {/* Dev banner */}
      <div className="bg-amber-500/10 border-b border-amber-500/30 py-1.5 px-4 text-center">
        <span className="text-[11px] font-mono text-amber-400 uppercase tracking-widest">
          [DEV SANDBOX] -- This route is not rendered in production
        </span>
      </div>
      {children}
    </div>
  );
}
