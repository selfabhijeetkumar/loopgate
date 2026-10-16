'use client';

/**
 * src/app/dev/cv-smoke/page.tsx
 * Development-only smoke test harness to isolate model loading and inference failures.
 *
 * Requirements for Step 0.3:
 * (a) CLIP image classification alone on one image (wasm)
 * (b) OWL-ViT alone with WebGPU disabled completely, testing fp32 and q8 separately
 * (c) DETR (Xenova/detr-resnet-50) generic COCO detector alone
 * (d) Full chain (detector boxes then CLIP crop classification)
 */

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { cvPipeline, type SmokeTestResult } from '@/cv/pipeline';
import type { WorkerProgressPayload } from '@/cv/types';

export default function CvSmokePage() {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [activeTest, setActiveTest] = useState<string | null>(null);
  const [smokeResult, setSmokeResult] = useState<SmokeTestResult | null>(null);
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

  const generateTestImage = (type: 'bottle' | 'phone' | 'charger' | 'earbuds') => {
    const canvas = document.createElement('canvas');
    canvas.width = 480;
    canvas.height = 480;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Dark tabletop background
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, 480, 480);
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1;
    for (let x = 0; x < 480; x += 40) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, 480);
      ctx.stroke();
    }
    for (let y = 0; y < 480; y += 40) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(480, y);
      ctx.stroke();
    }

    if (type === 'bottle') {
      // Bottle body (green plastic)
      ctx.fillStyle = '#059669';
      ctx.fillRect(190, 140, 100, 240);
      // Neck & cap
      ctx.fillStyle = '#10b981';
      ctx.fillRect(220, 80, 40, 60);
      ctx.fillStyle = '#34d399';
      ctx.fillRect(215, 60, 50, 20);
      // Label
      ctx.fillStyle = '#e2e8f0';
      ctx.fillRect(195, 200, 90, 70);
      ctx.fillStyle = '#0f172a';
      ctx.font = '12px monospace';
      ctx.fillText('SPRING WATER', 200, 240);
    } else if (type === 'phone') {
      // Smartphone body (black slate with screen)
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(160, 80, 160, 320);
      ctx.fillStyle = '#090d16';
      ctx.fillRect(170, 100, 140, 280);
      ctx.fillStyle = '#f59e0b';
      ctx.fillRect(200, 210, 80, 20);
      ctx.fillStyle = '#ffffff';
      ctx.font = '10px monospace';
      ctx.fillText('LI-ION 4000mAh', 195, 245);
    } else if (type === 'charger') {
      // Power adapter brick & cable
      ctx.fillStyle = '#cbd5e1';
      ctx.fillRect(180, 180, 120, 120);
      // Prongs
      ctx.fillStyle = '#94a3b8';
      ctx.fillRect(205, 130, 20, 50);
      ctx.fillRect(255, 130, 20, 50);
      // USB port
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(220, 300, 40, 15);
    } else if (type === 'earbuds') {
      // Earbuds case
      ctx.fillStyle = '#f8fafc';
      ctx.beginPath();
      ctx.ellipse(240, 240, 80, 60, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = 2;
      ctx.stroke();
      // LED indicator
      ctx.fillStyle = '#10b981';
      ctx.beginPath();
      ctx.arc(240, 240, 5, 0, Math.PI * 2);
      ctx.fill();
    }

    const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
    setSelectedImage(dataUrl);
    addLog(`Generated test object image: ${type.toUpperCase()}`);
  };

  useEffect(() => {
    addLog('Mounted CV Smoke Test harness. Subscribing to telemetry...');
    const unsub = cvPipeline.subscribeProgress((p) => {
      setProgress(p);
      if (p.file) {
        addLog(`[DOWNLOAD] ${p.file}: ${(p.loaded ? (p.loaded / 1024 / 1024).toFixed(1) : 0)} MB (${p.progress || 0}%)`);
      } else if (p.task) {
        addLog(`[TASK] ${p.task}`);
      }
    });

    // Default to bottle object
    generateTestImage('bottle');

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

  const runTest = async (testType: 'CLIP' | 'OWL_VIT_Q8' | 'OWL_VIT_FP32' | 'DETR_COCO') => {
    if (!selectedImage) return;
    setActiveTest(testType);
    setErrorMessage(null);
    setSmokeResult(null);
    setFullChainResult(null);
    addLog(`>>> STARTING ISOLATED TEST: ${testType} on WASM`);

    try {
      const res = await cvPipeline.runIsolatedSmokeTest(testType, selectedImage);
      setSmokeResult(res);
      addLog(
        `✓ SUCCESS [${testType}]: Model=${res.model}, Dtype=${res.dtype}, Load=${res.loadTimeMs}ms, Infer=${res.inferTimeMs}ms, Total=${res.totalTimeMs}ms`
      );
      console.log(`[CV SMOKE RESULT: ${testType}]`, res);
    } catch (err: any) {
      setErrorMessage(err?.message || String(err));
      addLog(`✗ FAILED [${testType}]: ${err?.message || err}`, 'err');
      console.error(`[CV SMOKE FAILED: ${testType}]`, err);
    } finally {
      setActiveTest(null);
    }
  };

  const runFullChainTest = async (detector: 'Xenova/owlvit-base-patch32' | 'Xenova/detr-resnet-50') => {
    if (!selectedImage) return;
    setActiveTest(`FULL_CHAIN_${detector.includes('detr') ? 'DETR' : 'OWL'}`);
    setErrorMessage(null);
    setSmokeResult(null);
    setFullChainResult(null);
    addLog(`>>> STARTING FULL CHAIN TEST with ${detector} + CLIP crop classifier`);

    try {
      cvPipeline.setPreferredDetector(detector);
      const res = await cvPipeline.analyze(selectedImage);
      setFullChainResult(res);
      addLog(
        `✓ FULL CHAIN SUCCESS: ${res.detections.length} boxes found in ${res.inferenceTimeMs}ms on ${res.deviceUsed} (${res.modelName})`
      );
      console.log('[CV FULL CHAIN RESULT]', res);
    } catch (err: any) {
      setErrorMessage(err?.message || String(err));
      addLog(`✗ FULL CHAIN FAILED: ${err?.message || err}`, 'err');
      console.error('[CV FULL CHAIN FAILED]', err);
    } finally {
      setActiveTest(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#070a0d] text-text-primary font-mono p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border-default pb-4">
        <div>
          <h1 className="text-sm font-bold text-amber-400 uppercase tracking-wider">
            CV PIPELINE ISOLATION HARNESS // /dev/cv-smoke
          </h1>
          <p className="text-xs text-text-muted mt-1">
            Isolate CLIP classification, OWL-ViT q8/fp32 session creation, and DETR fallback
          </p>
        </div>
        <Link
          href="/evidence"
          className="px-3 py-1.5 border border-border-default text-xs text-text-secondary hover:text-amber-400 hover:border-amber-500 transition-colors"
        >
          ← Return to Evidence Lab
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Image Selection & Action Triggers */}
        <div className="lg:col-span-5 space-y-4">
          <div className="border border-border-default bg-bg-surface p-4 space-y-3">
            <div className="flex justify-between items-center text-xs font-bold text-text-secondary">
              <span>TEST OBJECT PHOTO</span>
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

            {/* Quick Object Selection */}
            <div className="grid grid-cols-4 gap-1 text-[11px]">
              {(['bottle', 'phone', 'charger', 'earbuds'] as const).map((obj) => (
                <button
                  key={obj}
                  onClick={() => generateTestImage(obj)}
                  className="py-1 px-1.5 border border-border-subtle bg-bg-elevated hover:border-amber-500/50 text-text-secondary hover:text-amber-300 text-center uppercase tracking-tight text-[10px]"
                >
                  {obj}
                </button>
              ))}
            </div>

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

            {/* Isolation Action Buttons */}
            <div className="pt-2 space-y-2">
              <div className="text-[10px] text-text-muted uppercase tracking-wider font-bold">
                1. Single Model Isolation (WASM)
              </div>
              <button
                id="smoke-clip-btn"
                onClick={() => runTest('CLIP')}
                disabled={!!activeTest}
                className="w-full py-2 px-3 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/60 text-amber-300 font-bold text-xs uppercase tracking-wider disabled:opacity-50 transition-colors text-left flex justify-between"
              >
                <span>(a) CLIP Classification (WASM q8)</span>
                <span>{activeTest === 'CLIP' ? 'Running...' : 'Run'}</span>
              </button>

              <button
                id="smoke-owlvit-q8-btn"
                onClick={() => runTest('OWL_VIT_Q8')}
                disabled={!!activeTest}
                className="w-full py-2 px-3 bg-bg-elevated hover:bg-border-default border border-border-subtle text-text-primary text-xs uppercase tracking-wider disabled:opacity-50 transition-colors text-left flex justify-between"
              >
                <span>(b1) OWL-ViT Detector (WASM q8)</span>
                <span>{activeTest === 'OWL_VIT_Q8' ? 'Running...' : 'Run'}</span>
              </button>

              <button
                id="smoke-owlvit-fp32-btn"
                onClick={() => runTest('OWL_VIT_FP32')}
                disabled={!!activeTest}
                className="w-full py-2 px-3 bg-bg-elevated hover:bg-border-default border border-border-subtle text-text-primary text-xs uppercase tracking-wider disabled:opacity-50 transition-colors text-left flex justify-between"
              >
                <span>(b2) OWL-ViT Detector (WASM fp32)</span>
                <span>{activeTest === 'OWL_VIT_FP32' ? 'Running...' : 'Run'}</span>
              </button>

              <button
                id="smoke-detr-coco-btn"
                onClick={() => runTest('DETR_COCO')}
                disabled={!!activeTest}
                className="w-full py-2 px-3 bg-bg-elevated hover:bg-border-default border border-border-subtle text-text-primary text-xs uppercase tracking-wider disabled:opacity-50 transition-colors text-left flex justify-between"
              >
                <span>(b3) DETR ResNet-50 Fallback (WASM q8)</span>
                <span>{activeTest === 'DETR_COCO' ? 'Running...' : 'Run'}</span>
              </button>

              <div className="text-[10px] text-text-muted uppercase tracking-wider font-bold pt-2">
                2. Full Chain (Detector + CLIP Crop Classifier)
              </div>
              <button
                id="smoke-full-chain-owl-btn"
                onClick={() => runFullChainTest('Xenova/owlvit-base-patch32')}
                disabled={!!activeTest}
                className="w-full py-2 px-3 bg-bg-elevated hover:bg-border-default border border-border-subtle text-text-primary text-xs uppercase tracking-wider disabled:opacity-50 transition-colors text-left flex justify-between"
              >
                <span>(c1) Full Chain: OWL-ViT + CLIP</span>
                <span>{activeTest?.startsWith('FULL_CHAIN_OWL') ? 'Running...' : 'Run'}</span>
              </button>
              <button
                id="smoke-full-chain-detr-btn"
                onClick={() => runFullChainTest('Xenova/detr-resnet-50')}
                disabled={!!activeTest}
                className="w-full py-2 px-3 bg-bg-elevated hover:bg-border-default border border-border-subtle text-text-primary text-xs uppercase tracking-wider disabled:opacity-50 transition-colors text-left flex justify-between"
              >
                <span>(c2) Full Chain: DETR Fallback + CLIP</span>
                <span>{activeTest?.startsWith('FULL_CHAIN_DETR') ? 'Running...' : 'Run'}</span>
              </button>
            </div>
          </div>

          {/* Progress Indicator */}
          {progress && progress.status === 'progress' && (
            <div className="border border-border-default bg-bg-surface p-4 space-y-2 text-xs">
              <div className="text-amber-400 font-bold uppercase text-[11px]">Download / Load Progress</div>
              <div className="text-text-muted truncate">
                File: <span className="text-text-primary">{progress.file || progress.task || 'Working...'}</span>
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

        {/* Right Column: Telemetry & Log Console */}
        <div className="lg:col-span-7 space-y-4">
          {/* Results Telemetry Card */}
          {(smokeResult || fullChainResult) && (
            <div className="border border-border-default bg-bg-surface p-4 space-y-3 text-xs">
              <div className="text-amber-400 font-bold uppercase text-[11px] border-b border-border-subtle pb-2">
                MEASURED EMPIRICAL TELEMETRY
              </div>

              {smokeResult && (
                <div className="space-y-2">
                  <div className="text-text-secondary font-bold uppercase text-[11px]">
                    Isolated Run: {smokeResult.test}
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    <div>Model: <span className="text-text-primary">{smokeResult.model}</span></div>
                    <div>Device: <span className="text-amber-400 uppercase">{smokeResult.device}</span></div>
                    <div>Dtype: <span className="text-text-primary uppercase">{smokeResult.dtype}</span></div>
                    <div>Session Load: <span className="text-text-primary">{smokeResult.loadTimeMs}ms</span></div>
                    <div>Inference: <span className="text-text-primary">{smokeResult.inferTimeMs}ms</span></div>
                    <div>Total Execution: <span className="text-text-primary">{smokeResult.totalTimeMs}ms</span></div>
                  </div>

                  {Array.isArray(smokeResult.result) && (
                    <div className="mt-2 space-y-1 border-t border-border-subtle pt-2">
                      <div className="text-[10px] text-text-muted uppercase font-bold">
                        Output ({smokeResult.result.length} items):
                      </div>
                      <div className="max-h-40 overflow-y-auto space-y-1">
                        {smokeResult.result.map((r: any, idx: number) => (
                          <div key={idx} className="flex justify-between text-[11px] font-mono bg-[#090c10] p-1 border border-border-subtle">
                            <span className="truncate max-w-[70%]">{r.label}</span>
                            <span className="text-amber-400">{(r.score * 100).toFixed(1)}%</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {fullChainResult && (
                <div className="space-y-2 pt-2 border-t border-border-subtle">
                  <div className="text-text-secondary font-bold uppercase text-[11px]">
                    Full Chain Results: {fullChainResult.modelName}
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    <div>Detections: <span className="text-text-primary font-bold">{fullChainResult.detections.length}</span></div>
                    <div>Inference Time: <span className="text-text-primary">{fullChainResult.inferenceTimeMs}ms</span></div>
                    <div>Device: <span className="text-amber-400 uppercase">{fullChainResult.deviceUsed}</span></div>
                    <div>Detector: <span className="text-text-primary">{fullChainResult.modelName}</span></div>
                  </div>

                  {fullChainResult.detections.length > 0 && (
                    <div className="mt-2 space-y-1">
                      <div className="text-[10px] text-text-muted uppercase font-bold">5-Box Run Telemetry:</div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-[10px] border border-border-subtle">
                          <thead>
                            <tr className="bg-[#090c10] text-text-muted border-b border-border-subtle">
                              <th className="p-1">Label</th>
                              <th className="p-1">Conf</th>
                              <th className="p-1">CLIP Rec/Haz</th>
                              <th className="p-1">HazProb</th>
                              <th className="p-1">Disagreement</th>
                            </tr>
                          </thead>
                          <tbody>
                            {fullChainResult.items.slice(0, 5).map((item: any, idx: number) => (
                              <tr key={idx} className="border-b border-border-subtle">
                                <td className="p-1 text-text-primary font-bold">{item.name}</td>
                                <td className="p-1 text-text-secondary">{(item.overallConfidence * 100).toFixed(0)}%</td>
                                <td className="p-1 text-text-secondary">
                                  {item.materialProbabilities?.recyclable?.toFixed(2)} / {item.materialProbabilities?.hazardous?.toFixed(2)}
                                </td>
                                <td className="p-1 text-amber-400 font-bold">{item.hazardProbability?.toFixed(2)}</td>
                                <td className="p-1 text-text-muted">{item.modelDisagreement?.toFixed(2)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Diagnostic Console */}
          <div className="border border-border-default bg-[#090c10] p-3 text-xs space-y-2">
            <div className="flex justify-between items-center text-[10px] text-text-muted border-b border-border-subtle pb-1">
              <span>WORKER TELEMETRY STREAM (NETWORK / LOAD / SESSIONS)</span>
              <button
                onClick={() => setLogs([])}
                className="hover:text-text-primary transition-colors text-[10px]"
              >
                [Clear]
              </button>
            </div>
            <div className="h-72 overflow-y-auto space-y-1 font-mono text-[11px]">
              {logs.length === 0 ? (
                <div className="text-text-muted italic">Click an isolation test on the left to measure session creation.</div>
              ) : (
                logs.map((log) => (
                  <div
                    key={log.id}
                    className={`leading-relaxed break-all ${
                      log.type === 'err'
                        ? 'text-red-400 font-bold'
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
