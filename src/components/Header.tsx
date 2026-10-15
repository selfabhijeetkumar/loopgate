'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { ThemeToggle } from './ThemeToggle';

const NAV_LINKS = [
  { label: 'Twin', href: '#twin' },
  { label: 'Replay', href: '#replay' },
  { label: 'Evidence', href: '#evidence' },
  { label: 'Decision', href: '#decision' },
  { label: 'Streams', href: '#streams' },
  { label: 'Assumptions', href: '#assumptions' },
];

const SECTION_IDS = NAV_LINKS.map((l) => l.href.slice(1));

function smoothScrollTo(id: string) {
  const el = document.getElementById(id);
  if (el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

export function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const isDev = process.env.NODE_ENV === 'development';

  /* ------------------------------------------------------------------
   * Scroll-spy: robust offset-based tracking with Hero clearance
   * ------------------------------------------------------------------ */
  useEffect(() => {
    const handleScroll = () => {
      if (typeof window === 'undefined') return;

      // Clear active section whenever scroll is in the hero area
      if (window.scrollY < 280) {
        setActiveSection(null);
        return;
      }

      let matched: string | null = null;
      for (const id of SECTION_IDS) {
        const el = document.getElementById(id);
        if (el) {
          const rect = el.getBoundingClientRect();
          if (rect.top <= 240 && rect.bottom >= 140) {
            matched = id;
            break;
          }
        }
      }

      setActiveSection(matched);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleNavClick = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    e.preventDefault();
    setMobileMenuOpen(false);
    smoothScrollTo(href.slice(1));
  };

  const navLinkClass = (href: string) => {
    const isActive = activeSection === href.slice(1);
    return [
      'relative transition-colors duration-150',
      isActive
        ? 'text-text-primary after:absolute after:bottom-0 after:left-0 after:right-0 after:h-[1px] after:bg-amber-500'
        : 'text-text-secondary hover:text-text-primary',
    ].join(' ');
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border-subtle bg-bg-primary/90 backdrop-blur-md transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
        {/* Brand */}
        <Link
          href="/"
          className="flex items-center gap-2.5 group focus-visible:outline-2 focus-visible:outline-amber-500 rounded-[2px]"
          aria-label="Loopgate Home"
        >
          <div className="w-7 h-7 rounded-[2px] bg-bg-surface border border-border-strong flex items-center justify-center group-hover:border-amber-500 transition-colors">
            <svg
              className="w-4 h-4 text-slate-300 group-hover:text-amber-500 transition-colors"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <path d="M7 8h10" />
              <path d="M7 16h10" />
              <circle cx="12" cy="12" r="2" fill="#f59e0b" stroke="none" />
            </svg>
          </div>
          <span className="font-display font-bold tracking-wider text-sm sm:text-base text-text-primary">
            LOOP<span className="text-amber-500">GATE</span>
          </span>
          <span className="hidden sm:inline-block px-1.5 py-0.5 text-[9px] font-mono uppercase tracking-widest border border-border-subtle text-text-muted rounded-[2px]">
            HUD v1.0
          </span>
        </Link>

        {/* Desktop Navigation */}
        <nav
          className="hidden md:flex items-center gap-6 text-xs uppercase tracking-wider font-mono"
          aria-label="Main Navigation"
        >
          {NAV_LINKS.map(({ label, href }) => (
            <a
              key={href}
              href={href}
              onClick={(e) => handleNavClick(e, href)}
              className={navLinkClass(href)}
              aria-current={activeSection === href.slice(1) ? 'location' : undefined}
            >
              {label}
            </a>
          ))}
          {isDev && (
            <Link
              href="/dev/engine"
              className="ml-2 px-2.5 py-1 border border-amber-600/50 text-amber-400 hover:border-amber-500 hover:text-amber-300 rounded-[2px] transition-colors text-[10px]"
            >
              Dev Engine
            </Link>
          )}
        </nav>

        {/* Actions */}
        <div className="flex items-center gap-3">
          <ThemeToggle />

          {/* Mobile Menu Button */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden w-8 h-8 flex items-center justify-center rounded-[2px] border border-border-subtle bg-bg-surface text-text-secondary hover:text-text-primary focus-visible:outline-2 focus-visible:outline-amber-500"
            aria-expanded={mobileMenuOpen}
            aria-controls="mobile-menu"
            aria-label="Toggle navigation menu"
          >
            {mobileMenuOpen ? (
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M18 6 6 18" />
                <path d="m6 6 12 12" />
              </svg>
            ) : (
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <line x1="4" x2="20" y1="12" y2="12" />
                <line x1="4" x2="20" y1="6" y2="6" />
                <line x1="4" x2="20" y1="18" y2="18" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div
          id="mobile-menu"
          className="md:hidden border-b border-border-subtle bg-bg-surface px-4 py-4 space-y-3 font-mono text-xs uppercase tracking-wider"
          role="navigation"
          aria-label="Mobile navigation"
        >
          {NAV_LINKS.map(({ label, href }) => (
            <a
              key={href}
              href={href}
              onClick={(e) => handleNavClick(e, href)}
              aria-current={activeSection === href.slice(1) ? 'location' : undefined}
              className={[
                'block py-1.5 transition-colors',
                activeSection === href.slice(1)
                  ? 'text-amber-400 border-l-2 border-amber-500 pl-2'
                  : 'text-text-secondary hover:text-text-primary pl-2',
              ].join(' ')}
            >
              {label}
            </a>
          ))}
          {isDev && (
            <Link
              href="/dev/engine"
              onClick={() => setMobileMenuOpen(false)}
              className="block py-1.5 pl-2 text-amber-500 hover:text-amber-400 border-l-2 border-amber-600/40"
            >
              Dev Engine
            </Link>
          )}
        </div>
      )}
    </header>
  );
}
