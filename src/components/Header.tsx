'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { ThemeToggle } from './ThemeToggle';

export function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border-subtle bg-bg-primary/90 backdrop-blur-md transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
        {/* Brand / Clickable Logo */}
        <Link
          href="/"
          className="flex items-center gap-2.5 group focus-visible:outline-2 focus-visible:outline-amber-500 rounded-[2px]"
          aria-label="Loopgate Home"
        >
          <div className="w-7 h-7 rounded-[2px] bg-bg-surface border border-border-strong flex items-center justify-center group-hover:border-amber-500 transition-colors">
            {/* SVG Mark */}
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
          <span className="hidden sm:inline-block px-1.5 py-0.2 text-[9px] font-mono uppercase tracking-widest border border-border-subtle text-text-muted rounded-[2px]">
            HUD v1.0
          </span>
        </Link>

        {/* Desktop Navigation */}
        <nav
          className="hidden md:flex items-center gap-6 text-xs uppercase tracking-wider font-mono text-text-secondary"
          aria-label="Main Navigation"
        >
          <Link
            href="/"
            className="text-text-primary border-b border-amber-500 pb-0.5 hover:text-amber-400 transition-colors"
          >
            Home
          </Link>
          <a
            href="#capabilities"
            className="hover:text-text-primary transition-colors"
          >
            Capabilities
          </a>
          <a
            href="#contracts"
            className="hover:text-text-primary transition-colors"
          >
            Domain Contracts
          </a>
          <a
            href="#scenario"
            className="hover:text-text-primary transition-colors"
          >
            Synthetic Data
          </a>
        </nav>

        {/* Actions: Theme Toggle + Mobile Menu Trigger */}
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
              <svg
                className="w-4 h-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M18 6 6 18" />
                <path d="m6 6 12 12" />
              </svg>
            ) : (
              <svg
                className="w-4 h-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
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
        >
          <Link
            href="/"
            onClick={() => setMobileMenuOpen(false)}
            className="block text-amber-500 py-1"
          >
            Home
          </Link>
          <a
            href="#capabilities"
            onClick={() => setMobileMenuOpen(false)}
            className="block text-text-secondary hover:text-text-primary py-1"
          >
            Capabilities
          </a>
          <a
            href="#contracts"
            onClick={() => setMobileMenuOpen(false)}
            className="block text-text-secondary hover:text-text-primary py-1"
          >
            Domain Contracts
          </a>
          <a
            href="#scenario"
            onClick={() => setMobileMenuOpen(false)}
            className="block text-text-secondary hover:text-text-primary py-1"
          >
            Synthetic Data
          </a>
        </div>
      )}
    </header>
  );
}
