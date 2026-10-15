import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('Styling & Design Tokens Guard', () => {
  const rootDir = path.resolve(__dirname, '../../');
  const globalsCssPath = path.join(rootDir, 'src/app/globals.css');
  const postcssConfigPath = path.join(rootDir, 'postcss.config.mjs');

  it('ensures PostCSS config exists and configures @tailwindcss/postcss', () => {
    expect(fs.existsSync(postcssConfigPath)).toBe(true);
    const content = fs.readFileSync(postcssConfigPath, 'utf8');
    expect(content).toContain('@tailwindcss/postcss');
  });

  it('ensures globals.css defines core Industrial HUD design tokens', () => {
    expect(fs.existsSync(globalsCssPath)).toBe(true);
    const css = fs.readFileSync(globalsCssPath, 'utf8');
    
    // Core Tailwind import
    expect(css).toContain('@import "tailwindcss";');
    
    // Core tokens
    expect(css).toContain('--bg-primary');
    expect(css).toContain('--signal-hazard');
    expect(css).toContain('--font-display');
    expect(css).toContain('--font-mono');
    
    // Space Grotesk and JetBrains Mono fonts
    expect(css).toContain('Space Grotesk');
    expect(css).toContain('JetBrains Mono');

    // Skip to main content accessibility guard (.sr-only)
    expect(css).toContain('.sr-only');
    expect(css).toContain('position: absolute !important');
  });

  it('verifies that compiled CSS bundle (if present) contains critical classes and tokens', () => {
    const cssDir = path.join(rootDir, '.next/static/css');
    if (fs.existsSync(cssDir)) {
      const files = fs.readdirSync(cssDir).filter((f) => f.endsWith('.css'));
      if (files.length > 0) {
        let allCss = '';
        for (const file of files) {
          allCss += fs.readFileSync(path.join(cssDir, file), 'utf8') + '\n';
        }
        expect(allCss).toContain('sr-only');
        expect(allCss).toContain('bg-primary');
        expect(allCss).toContain('Space Grotesk');
        expect(allCss).toContain('JetBrains Mono');
      }
    }
  });
});
