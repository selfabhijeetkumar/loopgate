import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('Navigation Targets and Integrity', () => {
  const headerContent = fs.readFileSync(
    path.resolve(process.cwd(), 'src/components/Header.tsx'),
    'utf-8'
  );
  const pageContent = fs.readFileSync(
    path.resolve(process.cwd(), 'src/app/page.tsx'),
    'utf-8'
  );

  const REQUIRED_NAV_SECTIONS = ['twin', 'decision', 'streams', 'assumptions'];

  it('all required in-page nav sections exist in Header.tsx', () => {
    REQUIRED_NAV_SECTIONS.forEach((sectionId) => {
      expect(headerContent).toContain(`href: '#${sectionId}'`);
    });
  });

  it('all required section IDs exist in page.tsx', () => {
    REQUIRED_NAV_SECTIONS.forEach((sectionId) => {
      // Must contain id="twin", id="decision", etc.
      expect(pageContent).toContain(`id="${sectionId}"`);
    });
  });

  it('does not contain deprecated or removed nav links', () => {
    // Old links that linked nowhere useful
    expect(headerContent).not.toContain("href: '#capabilities'");
    expect(headerContent).not.toContain("href: '#contracts'");
    expect(headerContent).not.toContain("href: '#scenario'");
  });

  it('renders dev engine link only in development mode in Header', () => {
    // isDev flag must gate /dev/engine link
    expect(headerContent).toContain('isDev');
    expect(headerContent).toContain('{isDev && (');
    expect(headerContent).toContain('/dev/engine');
  });

  it('clears active nav state at hero scroll position to prevent false DECISION highlight', () => {
    expect(headerContent).toContain('if (window.scrollY < 280)');
    expect(headerContent).toContain('setActiveSection(null)');
  });
});
