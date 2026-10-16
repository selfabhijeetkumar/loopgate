import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Contact | Loopgate',
  description:
    'Contact information for the Loopgate project. Built for DSU Code Clash 2.0, Problem Statement 06.',
};

export default function ContactPage() {
  return (
    <main
      id="main-content"
      className="relative z-10 flex-1 flex flex-col min-h-screen text-text-primary"
    >
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20">

        {/* Breadcrumb */}
        <nav aria-label="Breadcrumb" className="mb-8 text-xs font-mono text-text-muted">
          <Link href="/" className="hover:text-text-primary transition-colors">Home</Link>
          <span className="mx-2">/</span>
          <span className="text-text-secondary">Contact</span>
        </nav>

        {/* Header */}
        <div className="mb-10">
          <div className="flex items-center gap-2 mb-3">
            <span className="w-2 h-2 bg-amber-500 rounded-none" />
            <span className="text-[11px] font-mono uppercase tracking-widest text-text-secondary">
              Project Contact
            </span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-display font-bold text-text-primary mb-4 tracking-tight">
            Contact <span className="text-amber-400">Loopgate</span>
          </h1>
          <p className="text-sm text-text-secondary font-sans leading-relaxed">
            Loopgate is a student hackathon project built for DSU Code Clash 2.0.
            There is no commercial entity behind it.
          </p>
        </div>

        {/* Contact Cards */}
        <div className="space-y-4 mb-10">
          <div className="border border-border-subtle bg-bg-surface/50 p-5 rounded-[2px]">
            <div className="text-[10px] font-mono uppercase tracking-wider text-text-muted mb-2">
              Team Contact &bull; NEXARC
            </div>
            <div className="text-base font-bold text-text-primary">Abhijeet Kumar (Team Lead)</div>
            <div className="text-xs text-text-secondary font-mono mt-1 mb-3">
              Dayananda Sagar University, Bengaluru &bull; DSU Code Clash 2.0 (PS06)
            </div>
            <a
              href="mailto:selfabhijeetkumar@gmail.com"
              className="inline-flex items-center gap-2 px-3 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/50 text-amber-300 font-mono text-xs rounded-[2px] transition-colors"
            >
              <span>selfabhijeetkumar@gmail.com</span>
            </a>
          </div>

          <div className="border border-border-subtle bg-bg-surface/50 p-5 rounded-[2px]">
            <div className="text-[10px] font-mono uppercase tracking-wider text-text-muted mb-2">
              GitHub Repository
            </div>
            <a
              href="https://github.com/selfabhijeetkumar/loopgate"
              target="_blank"
              rel="noopener noreferrer"
              className="text-amber-400 hover:text-amber-300 font-mono text-sm transition-colors break-all"
            >
              https://github.com/selfabhijeetkumar/loopgate
            </a>
            <p className="text-xs text-text-muted font-sans mt-2">
              All source code, issues, and documentation are available on GitHub.
              For questions, open a GitHub issue.
            </p>
          </div>

          <div className="border border-border-subtle bg-bg-surface/50 p-5 rounded-[2px]">
            <div className="text-[10px] font-mono uppercase tracking-wider text-text-muted mb-2">
              Judging Context
            </div>
            <p className="text-xs text-text-secondary font-sans leading-relaxed">
              This application is submitted to DSU Code Clash 2.0. Judges evaluate via the
              deployed link, GitHub repository, README, project presentation, and demo video.
              There is no live pitch session.
            </p>
          </div>
        </div>

        {/* Honesty note */}
        <div className="border border-amber-500/30 bg-amber-500/5 p-4 rounded-[2px] text-xs text-text-secondary font-sans leading-relaxed">
          <strong className="text-amber-400 font-mono uppercase text-[10px] tracking-wider">Note</strong>
          <br />
          Loopgate is a simulation prototype. It does not represent any commercial
          recycling service, does not collect personal data, and does not process real
          facility streams. All metrics are estimates.
        </div>

        {/* Footer links */}
        <div className="pt-8 mt-8 border-t border-border-subtle flex flex-wrap gap-4 text-xs font-mono text-text-muted">
          <Link href="/" className="hover:text-text-primary transition-colors">Home</Link>
          <Link href="/about" className="hover:text-text-primary transition-colors">About</Link>
          <Link href="/faq" className="hover:text-text-primary transition-colors">FAQ</Link>
          <Link href="/privacy" className="hover:text-text-primary transition-colors">Privacy</Link>
          <Link href="/terms" className="hover:text-text-primary transition-colors">Terms</Link>
        </div>
      </div>
    </main>
  );
}
