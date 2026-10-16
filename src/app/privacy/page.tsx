import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Privacy Policy | Loopgate',
  description:
    'Privacy policy for Loopgate. No personal data is collected. Photo processing happens entirely in your browser.',
};

export default function PrivacyPage() {
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
          <span className="text-text-secondary">Privacy Policy</span>
        </nav>

        {/* Header */}
        <div className="mb-10">
          <div className="flex items-center gap-2 mb-3">
            <span className="w-2 h-2 bg-amber-500 rounded-none" />
            <span className="text-[11px] font-mono uppercase tracking-widest text-text-secondary">
              Legal // Privacy Policy
            </span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-display font-bold text-text-primary mb-4 tracking-tight">
            Privacy <span className="text-amber-400">Policy</span>
          </h1>
          <p className="text-xs text-text-muted font-mono">
            Last updated: October 2026
          </p>
        </div>

        <div className="space-y-8 text-sm text-text-secondary font-sans leading-relaxed">

          <section aria-labelledby="overview-heading">
            <h2 id="overview-heading" className="text-base font-display font-bold text-text-primary mb-3">
              Overview
            </h2>
            <p>
              Loopgate is a student hackathon prototype. We collect <strong>no personal data</strong>.
              There are no accounts, no cookies for tracking, no analytics scripts, and no advertising.
              The application runs entirely in your browser for all computation.
            </p>
          </section>

          <section aria-labelledby="photos-heading">
            <h2 id="photos-heading" className="text-base font-display font-bold text-text-primary mb-3">
              Photos and Images
            </h2>
            <p>
              If you use the Evidence Lab to upload a photo, the image is processed entirely in your
              browser using a Web Worker. The pixel data is decoded on a canvas element, transferred
              to the worker thread as a binary ArrayBuffer, and used for model inference. The pixels
              are never transmitted to any server, never stored on disk, and never shared with any
              third party.
            </p>
            <p className="mt-2">
              When the Web Worker finishes processing, the image data is discarded and garbage
              collected. No copy is retained after the session closes.
            </p>
          </section>

          <section aria-labelledby="models-heading">
            <h2 id="models-heading" className="text-base font-display font-bold text-text-primary mb-3">
              Model Weights (Hugging Face CDN)
            </h2>
            <p>
              When the CV pipeline activates, your browser fetches ONNX model weight files from the
              Hugging Face CDN (<code className="text-xs bg-bg-surface px-1 py-0.5">huggingface.co</code>,{' '}
              <code className="text-xs bg-bg-surface px-1 py-0.5">cdn-lfs.huggingface.co</code>).
              This request is made directly from your browser, subject to Hugging Face&apos;s own
              privacy policy. Weights are cached by your browser using the Cache API for subsequent
              sessions.
            </p>
          </section>

          <section aria-labelledby="dpdp-heading">
            <h2 id="dpdp-heading" className="text-base font-display font-bold text-text-primary mb-3">
              Data Protection &amp; Indian DPDP Act Principles
            </h2>
            <p>
              Loopgate was built adhering to the core tenets of the Indian Digital Personal Data Protection (DPDP) Act, 2023 as an architectural design principle: data minimization, purpose limitation, transparency, and explicit user consent. We do not store, process, or sell personal identifiers.
            </p>
            <p className="mt-2 text-xs text-text-muted italic border-l-2 border-amber-500/60 pl-3 py-1">
              Legal notice: The above reference to the Indian DPDP Act represents a software engineering design philosophy for minimal data handling and does not constitute a formal legal compliance claim or warranty. This text is not legal advice.
            </p>
          </section>

          <section aria-labelledby="genai-heading">
            <h2 id="genai-heading" className="text-base font-display font-bold text-text-primary mb-3">
              AI Providers &amp; Explanation Endpoints
            </h2>
            <p>
              Loopgate supports optional generative AI explanations for personalized waste recommendations. The backend explanation router supports a failover chain across configured providers:
            </p>
            <ul className="list-disc list-inside mt-2 space-y-1 text-xs text-text-secondary">
              <li><strong>Google Gemini</strong> (Google Generative AI)</li>
              <li><strong>Groq</strong> (Groq Cloud Inference)</li>
              <li><strong>OpenRouter</strong> (Unified LLM Gateway)</li>
            </ul>
            <p className="mt-3">
              <strong>Simulated Data Only:</strong> Explanation requests sent to these providers contain <em>only</em> simulated engine numbers (hazard probability, gate score, material class, route). No photos, pixel buffers, filenames, or user personal data are ever included in explanation requests.
            </p>
            <p className="mt-2">
              <strong>Optional Second-Opinion Feature:</strong> Only the optional second-opinion button sends an image file, strictly to Google Gemini Vision, and only after an explicit on-screen user consent dialog is confirmed. Free-tier providers may maintain their own data-use terms; users can consult each provider&apos;s privacy policy directly.
            </p>
          </section>

          <section aria-labelledby="hosting-heading">
            <h2 id="hosting-heading" className="text-base font-display font-bold text-text-primary mb-3">
              Hosting
            </h2>
            <p>
              Loopgate is deployed on Vercel. Vercel may collect standard server access logs (IP
              addresses, request URLs, timestamps) for infrastructure purposes, subject to
              <a
                href="https://vercel.com/legal/privacy-policy"
                target="_blank"
                rel="noopener noreferrer"
                className="text-amber-400 hover:text-amber-300 transition-colors ml-1"
              >
                Vercel&apos;s Privacy Policy
              </a>
              . We do not access or process these logs.
            </p>
          </section>

          <section aria-labelledby="contact-heading">
            <h2 id="contact-heading" className="text-base font-display font-bold text-text-primary mb-3">
              Contact
            </h2>
            <p>
              For privacy questions, open an issue on the{' '}
              <a
                href="https://github.com/selfabhijeetkumar/loopgate"
                target="_blank"
                rel="noopener noreferrer"
                className="text-amber-400 hover:text-amber-300 transition-colors"
              >
                GitHub repository
              </a>
              .
            </p>
          </section>

        </div>

        {/* Footer links */}
        <div className="pt-8 mt-8 border-t border-border-subtle flex flex-wrap gap-4 text-xs font-mono text-text-muted">
          <Link href="/" className="hover:text-text-primary transition-colors">Home</Link>
          <Link href="/about" className="hover:text-text-primary transition-colors">About</Link>
          <Link href="/faq" className="hover:text-text-primary transition-colors">FAQ</Link>
          <Link href="/contact" className="hover:text-text-primary transition-colors">Contact</Link>
          <Link href="/terms" className="hover:text-text-primary transition-colors">Terms</Link>
        </div>
      </div>
    </main>
  );
}
