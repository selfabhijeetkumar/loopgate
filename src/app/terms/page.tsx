import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Terms of Use | Loopgate',
  description:
    'Terms of use for Loopgate. This is a hackathon prototype for educational purposes only.',
};

export default function TermsPage() {
  return (
    <main
      id="main-content"
      className="relative z-10 flex-1 flex flex-col min-h-screen text-text-primary"
    >
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20">

        {/* Breadcrumb */}
        <nav aria-label="Breadcrumb" className="mb-8 text-xs font-mono text-text-muted">
          <Link href="/" className="hover:text-text-primary transition-colors">Home</Link>
          <span className="mx-2">/</span>
          <span className="text-text-secondary">Terms of Use</span>
        </nav>

        {/* Header */}
        <div className="mb-10">
          <div className="flex items-center gap-2 mb-3">
            <span className="w-2 h-2 bg-amber-500 rounded-none" />
            <span className="text-[11px] font-mono uppercase tracking-widest text-text-secondary">
              Legal // Terms of Use
            </span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-display font-bold text-text-primary mb-4 tracking-tight">
            Terms of <span className="text-amber-400">Use</span>
          </h1>
          <p className="text-xs text-text-muted font-mono">
            Last updated: October 2026
          </p>
        </div>

        <div className="space-y-8 text-sm text-text-secondary font-sans leading-relaxed">

          <section aria-labelledby="nature-heading">
            <h2 id="nature-heading" className="text-base font-display font-bold text-text-primary mb-3">
              1. Nature of the Application
            </h2>
            <p>
              Loopgate is a <strong>prototype simulation</strong> built as a student project for
              DSU Code Clash 2.0, Problem Statement 06. It is provided for educational and
              demonstration purposes only.
            </p>
            <p className="mt-2">
              All metrics, classifications, gate scores, route decisions, and throughput figures
              displayed are <strong>simulation estimates</strong>. They are produced by a
              deterministic engine running on a fixed scenario manifest and do not represent
              real recycling facility data, regulatory-approved safety thresholds, or
              engineering-certified performance claims.
            </p>
          </section>

          <section aria-labelledby="no-warranty-heading">
            <h2 id="no-warranty-heading" className="text-base font-display font-bold text-text-primary mb-3">
              2. No Warranty
            </h2>
            <p>
              Loopgate is provided &quot;as is&quot; without any warranty of any kind, express or
              implied, including but not limited to warranties of merchantability, fitness for a
              particular purpose, or non-infringement. The author makes no claim that the simulation
              reflects real-world recycling outcomes.
            </p>
          </section>

          <section aria-labelledby="no-liability-heading">
            <h2 id="no-liability-heading" className="text-base font-display font-bold text-text-primary mb-3">
              3. Limitation of Liability
            </h2>
            <p>
              In no event shall the author be liable for any damages arising from the use or
              inability to use this application. This application is not intended for use in
              any real safety-critical decision-making process.
            </p>
          </section>

          <section aria-labelledby="intellectual-property-heading">
            <h2 id="intellectual-property-heading" className="text-base font-display font-bold text-text-primary mb-3">
              4. Intellectual Property
            </h2>
            <p>
              Original application code is licensed under the Apache 2.0 License. See the{' '}
              <a
                href="https://github.com/selfabhijeetkumar/loopgate/blob/main/LICENSE"
                target="_blank"
                rel="noopener noreferrer"
                className="text-amber-400 hover:text-amber-300 transition-colors"
              >
                LICENSE
              </a>{' '}
              file. Third-party libraries and model weights retain their own licenses.
              A full list of third-party assets is available in{' '}
              <a
                href="https://github.com/selfabhijeetkumar/loopgate/blob/main/ASSETS.md"
                target="_blank"
                rel="noopener noreferrer"
                className="text-amber-400 hover:text-amber-300 transition-colors"
              >
                ASSETS.md
              </a>
              .
            </p>
          </section>

          <section aria-labelledby="ml-model-heading">
            <h2 id="ml-model-heading" className="text-base font-display font-bold text-text-primary mb-3">
              5. Machine Learning Model Outputs
            </h2>
            <p>
              The in-browser CV pipeline produces probabilistic outputs from open-source models
              (DETR ResNet-50, CLIP ViT-B/32). These outputs are experimental and may be
              incorrect. They are displayed for educational purposes and carry provenance labels
              to that effect. Do not rely on model outputs for real-world safety decisions.
            </p>
          </section>

          <section aria-labelledby="modifications-heading">
            <h2 id="modifications-heading" className="text-base font-display font-bold text-text-primary mb-3">
              6. Modifications
            </h2>
            <p>
              These terms may be updated at any time. The current version is always available
              at this URL. Continued use of the application constitutes acceptance of the current
              terms.
            </p>
          </section>

        </div>

        {/* Footer links */}
        <div className="pt-8 mt-8 border-t border-border-subtle flex flex-wrap gap-4 text-xs font-mono text-text-muted">
          <Link href="/" className="hover:text-text-primary transition-colors">Home</Link>
          <Link href="/about" className="hover:text-text-primary transition-colors">About</Link>
          <Link href="/faq" className="hover:text-text-primary transition-colors">FAQ</Link>
          <Link href="/contact" className="hover:text-text-primary transition-colors">Contact</Link>
          <Link href="/privacy" className="hover:text-text-primary transition-colors">Privacy</Link>
        </div>
      </div>
    </main>
  );
}
