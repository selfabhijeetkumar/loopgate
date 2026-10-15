'use client';

/**
 * src/app/dev/cv-smoke/page.tsx
 * Development-only smoke test page to isolate model loading and inference failures.
 * Tests isolated CLIP model first, then the full chain (OWL-ViT + CLIP).
 */

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { cvPipeline, type SmokeTestResult } from '@/cv/pipeline';
import type { WorkerProgressPayload } from '@/cv/types';

export default function CvSmokePage() {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [clipStatus, setClipStatus] = useState<'idle' | 'running' | 'success' | 'error'>('idle');
  const [clipResult, setClipResult] = useState<SmokeTestResult | null>(null);
  const [fullChainStatus, setFullChainStatus] = useState<'idle' | 'running' | 'success' | 'error'>('idle');
  const [fullChainResult, setFullChainResult] = useState<any | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [progress, setProgress] = useState<WorkerProgressPayload | null>(null);
  const [logs, setLogs] = useState<{ id: number; time: string; text: string; type: 'info' | 'warn' | 'err' }[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const addLog = (text: string, type: 'info' | 'warn' | 'err' = 'info') => {
    setLogs((prev) => [
      ...prev.slice(-100),
      {
        id: Date.now() + Math.random(),
        time: new Date().toLocaleTimeString(),
        text,
        type,
      },
    ]);
  };

  useEffect(() => {
    addLog('CV Smoke Diagnostic Harness mounted. Subscribing to worker progress...');
    const unsub = cvPipeline.subscribeProgress((p) => {
      setProgress(p);
      if (p.file) {
        addLog(`[FILE PROGRESS] ${p.file}: ${p.loaded || 0}/${p.total || 0} bytes (${p.progress || 0}%)`);
      } else if (p.task) {
        addLog(`[TASK] ${p.task}`);
      }
    });

    // Create a default test image on canvas (simple bottle drawing)
    const canvas = document.createElement('canvas');
    canvas.width = 400;
    canvas.height = 400;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(0, 0, 400, 400);
      // Draw green bottle
      ctx.fillStyle = '#10b981';
      ctx.fillRect(160, 100, 80, 220);
      ctx.fillStyle = '#059669';
      ctx.fillRect(180, 60, 40, 40);
      ctx.fillStyle = '#94a3b8';
      ctx.font = '14px monospace';
      ctx.fillText('TEST OBJECT: PLASTIC BOTTLE', 80, 360);
      setSelectedImage(canvas.toDataURL('image/jpeg', 0.9));
      addLog('Default synthetic bottle test image generated.');
    }

    return () => {
      unsub();
    };
  }, []);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setSelectedImage(reader.result as string);
      addLog(`Loaded uploaded file: ${file.name} (${(file.size / 1024).toFixed(1)} KB)`);
    };
    reader.readAsDataURL(file);
  };

  const handleTestClip = async () => {
    if (!selectedImage) return;
    setClipStatus('running');
    setErrorMessage(null);
    setClipResult(null);
    addLog('Starting ISOLATED CLIP model smoke test (Xenova/clip-vit-base-patch32)...');

    try {
      const result = await cvPipeline.runClipSmokeTest(selectedImage);
      setClipResult(result);
      setClipStatus('success');
      addLog(
        `✓ CLIP Smoke Test SUCCESS: Device=${result.device}, LoadTime=${result.loadTimeMs}ms, InferTime=${result.inferTimeMs}ms, Total=${result.totalTimeMs}ms`
      );
    } catch (err: any) {
      setClipStatus('error');
      setErrorMessage(err?.message || String(err));
      addLog(`✗ CLIP Smoke Test FAILED: ${err?.message || err}`, 'err');
    }
  };

  const handleTestFullChain = async () => {
    if (!selectedImage) return;
    setFullChainStatus('running');
    setErrorMessage(null);
    setFullChainResult(null);
    addLog('Starting FULL CHAIN smoke test (OWL-ViT detector + CLIP crop classifier)...');

    try {
      const res = await cvPipeline.analyze(selectedImage);
      setFullChainResult(res);
      setFullChainStatus('success');
      addLog(
        `✓ FULL CHAIN SUCCESS: ${res.detections.length} detections found in ${res.inferenceTimeMs}ms on ${res.deviceUsed}`
      );
    } catch (err: any) {
      setFullChainStatus('error');
      setErrorMessage(err?.message || String(err));
      addLog(`✗ FULL CHAIN FAILED: ${err?.message || err}`, 'err');
    }
  };

  return (
    <div className="min-h-screen bg-[#070a0d] text-text-primary font-mono p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border-default pb-4">
        <div>
          <h1 className="text-sm font-bold text-amber-400 uppercase tracking-wider">
            CV PIPELINE SMOKE TEST // /dev/cv-smoke
          </h1>
          <p className="text-xs text-text-muted mt-1">
            Isolated model download, ONNX Runtime WASM execution, and diagnostic tracing
          </p>
        </div>
        <Link
          href="/evidence"
          className="px-3 py-1.5 border border-border-default text-xs text-text-secondary hover:text-amber-400 hover:border-amber-500 transition-colors"
        >
          ← Return to Evidence Lab
        </Link>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Image & Actions */}
        <div className="lg:col-span-5 space-y-4">
          <div className="border border-border-default bg-bg-surface p-4 space-y-3">
            <div className="text-xs font-bold text-text-secondary flex justify-between">
              <span>TEST IMAGE PREVIEW</span>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="text-amber-400 hover:underline text-[11px]"
              >
                Upload Photo...
              </button>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileUpload}
            />
            {selectedImage ? (
              <img
                src={selectedImage}
                alt="Smoke test target"
                className="w-full h-48 object-contain bg-[#090c10] border border-border-subtle"
              />
            ) : (
              <div className="w-full h-48 flex items-center justify-center bg-[#090c10] text-text-muted text-xs">
                No image selected
              </div>
            )}

            {/* Test Actions */}
            <div className="pt-2 space-y-2">
              <button
                onClick={handleTestClip}
                disabled={clipStatus === 'running'}
                className="w-full py-2 px-3 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500 text-amber-300 font-bold text-xs uppercase tracking-wider disabled:opacity-50 transition-colors"
              >
                {clipStatus === 'running' ? 'Running CLIP...' : '1. Test Isolated CLIP (Single Model)'}
              </button>
              <button
                onClick={handleTestFullChain}
                disabled={fullChainStatus === 'running'}
                className="w-full py-2 px-3 bg-bg-elevated hover:bg-border-default border border-border-subtle text-text-primary text-xs uppercase tracking-wider disabled:opacity-50 transition-colors"
              >
                {fullChainStatus === 'running' ? 'Running Full Chain...' : '2. Test Full Chain (OWL-ViT + CLIP)'}
              </button>
            </div>
          </div>

          {/* Progress Indicator */}
          {progress && (
            <div className="border border-border-default bg-bg-surface p-4 space-y-2 text-xs">
              <div className="text-amber-400 font-bold uppercase text-[11px]">Download / Load Progress</div>
              <div className="text-text-muted truncate">
                File: <span className="text-text-primary">{progress.file || 'Initializing...'}</span>
              </div>
              <div className="w-full h-2 bg-[#090c10] border border-border-subtle">
                <div
                  className="h-full bg-amber-500 transition-all duration-150"
                  style={{ width: `${progress.progress || 0}%` }}
                />
              </div>
              <div className="flex justify-between text-[10px] text-text-muted">
                <span>{progress.progress !== undefined ? `${progress.progress}%` : 'Working...'}</span>
                {progress.loaded !== undefined && progress.total !== undefined && (
                  <span>
                    {(progress.loaded / 1024 / 1024).toFixed(1)} / {(progress.total / 1024 / 1024).toFixed(1)} MB
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Error Banner */}
          {errorMessage && (
            <div className="border border-red-500/50 bg-red-950/20 p-4 text-xs text-red-300 space-y-1">
              <div className="font-bold text-red-400 uppercase">[EXECUTION FAILURE]</div>
              <p className="break-all">{errorMessage}</p>
            </div>
          )}
        </div>

        {/* Right Column: Results & Live Log */}
        <div className="lg:col-span-7 space-y-4">
          {/* Results Card */}
          {(clipResult || fullChainResult) && (
            <div className="border border-border-default bg-bg-surface p-4 space-y-3 text-xs">
              <div className="text-amber-400 font-bold uppercase text-[11px] border-b border-border-subtle pb-2">
                EMPIRICAL MEASUREMENT TELEMETRY
              </div>

              {clipResult && (
                <div className="space-y-1.5">
                  <div className="text-text-secondary font-bold">CLIP Isolated Test Results:</div>
                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    <div>Model: <span className="text-text-primary">{clipResult.model}</span></div>
                    <div>Device: <span className="text-amber-400 uppercase">{clipResult.device}</span></div>
                    <div>Model Load: <span className="text-text-primary">{clipResult.loadTimeMs}ms</span></div>
                    <div>Inference: <span className="text-text-primary">{clipResult.inferTimeMs}ms</span></div>
                    <div>Total Time: <span className="text-text-primary">{clipResult.totalTimeMs}ms</span></div>
                  </div>
                  {Array.isArray(clipResult.result) && (
                    <div className="mt-2 space-y-1 border-t border-border-subtle pt-2">
                      <div className="text-[10px] text-text-muted uppercase">Class Probabilities:</div>
                      {clipResult.result.map((r: any, idx: number) => (
                        <div key={idx} className="flex justify-between text-[11px]">
                          <span className="truncate max-w-[70%]">{r.label}</span>
                          <span className="text-amber-400">{(r.score * 100).toFixed(1)}%</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {fullChainResult && (
                <div className="space-y-1.5 pt-2 border-t border-border-subtle">
                  <div className="text-text-secondary font-bold">Full Chain Results:</div>
                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    <div>Detections: <span className="text-text-primary">{fullChainResult.detections.length}</span></div>
                    <div>Inference Time: <span className="text-text-primary">{fullChainResult.inferenceTimeMs}ms</span></div>
                    <div>Device: <span className="text-amber-400 uppercase">{fullChainResult.deviceUsed}</span></div>
                    <div>Model: <span className="text-text-primary">{fullChainResult.modelName}</span></div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Diagnostics Log Console */}
          <div className="border border-border-default bg-[#090c10] p-3 text-xs space-y-2">
            <div className="flex justify-between items-center text-[10px] text-text-muted border-b border-border-subtle pb-1">
              <span>WORKER DIAGNOSTIC LOG (CSP / FETCH / PROGRESS)</span>
              <button
                onClick={() => setLogs([])}
                className="hover:text-text-primary transition-colors text-[10px]"
              >
                [Clear]
              </button>
            </div>
            <div className="h-64 overflow-y-auto space-y-1 font-mono text-[11px]">
              {logs.length === 0 ? (
                <div className="text-text-muted italic">No logs yet. Run a test to observe network &amp; execution events.</div>
              ) : (
                logs.map((log) => (
                  <div
                    key={log.id}
                    className={`leading-relaxed break-all ${
                      log.type === 'err'
                        ? 'text-red-400'
                        : log.type === 'warn'
                        ? 'text-amber-400'
                        : 'text-slate-300'
                    }`}
                  >
                    <span className="text-text-muted mr-2">[{log.time}]</span>
                    {log.text}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
