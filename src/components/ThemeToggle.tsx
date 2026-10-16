'use client';

import React, { useEffect, useState } from 'react';

export function ThemeToggle() {
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem('loopgate-theme');
      if (stored === 'light' || stored === 'dark') {
        setTheme(stored);
        document.documentElement.setAttribute('data-theme', stored);
      } else {
        document.documentElement.setAttribute('data-theme', 'dark');
      }
    } catch {
      // localStorage may fail in restricted/private contexts
      document.documentElement.setAttribute('data-theme', 'dark');
    }
    setMounted(true);
  }, []);

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    document.documentElement.setAttribute('data-theme', next);
    try {
      localStorage.setItem('loopgate-theme', next);
    } catch {
      // Ignore write errors in storage-restricted environments
    }
  };

  // Prevent hydration mismatch
  if (!mounted) {
    return (
      <button
        type="button"
        aria-label="Toggle visual theme"
        className="w-8 h-8 flex items-center justify-center rounded-[2px] border border-border-subtle bg-bg-surface text-text-secondary hover:border-border-strong transition-colors"
      >
        <span className="w-3.5 h-3.5 block" />
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
      title={`Current: ${theme.toUpperCase()} mode`}
      className="w-8 h-8 flex items-center justify-center rounded-[2px] border border-border-subtle bg-bg-surface text-text-secondary hover:text-text-primary hover:border-border-strong focus-visible:outline-2 focus-visible:outline-amber-500 transition-colors"
    >
      {theme === 'dark' ? (
        // Sun SVG icon for switching to light
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
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2" />
          <path d="M12 20v2" />
          <path d="m4.93 4.93 1.41 1.41" />
          <path d="m17.66 17.66 1.41 1.41" />
          <path d="M2 12h2" />
          <path d="M20 12h2" />
          <path d="m6.34 17.66-1.41 1.41" />
          <path d="m19.07 4.93-1.41 1.41" />
        </svg>
      ) : (
        // Moon SVG icon for switching to dark
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
          <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
        </svg>
      )}
    </button>
  );
}
