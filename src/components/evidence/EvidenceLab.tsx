/**
 * src/components/evidence/EvidenceLab.tsx
 * Evidence Lab: In-browser CV inspection with live link to Sentinel digital twin.
 * Industrial HUD styling, DPDP-aware consent, corner-bracket overlays.
 */

'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { cvPipeline } from '@/cv/pipeline';
import type { NormalizedDetection, WorkerProgressPayload } from '@/cv/types';
import type { Item, MaterialClass, RouteId } from '@/domain/types';
import { ProvenanceChip } from '@/components/ProvenanceChip';
import { useSimulation } from '@/components/twin/SimulationContext';
import { SAFETY_FLOOR, evaluateGate, DEFAULT_GATE_POLICY } from '@/engine/gate';

interface EvidenceLabProps {
  className?: string;
  onRequestSecondOpinion?: (imageFile: string, item: Item) => void;
}

export function EvidenceLab({ className = '', onRequestSecondOpinion }: EvidenceLabProps) {
  const { loadPhotoScenario, activeSource } = useSimulation();

  // State
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [imageDims, setImageDims] = useState<{ width: number; height: number }>({ width: 0, height: 0 });
  const [status, setStatus] = useState<'idle' | 'loading' | 'analyzed' | 'error'>('idle');
  const [progressState, setProgressState] = useState<WorkerProgressPayload | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [detections, setDetections] = useState<NormalizedDetection[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [inferenceMeta, setInferenceMeta] = useState<{ timeMs: number; device: string; model: string } | null>(null);
  const [sentToTwinToast, setSentToTwinToast] = useState(false);

  // Manual Box Drawing
  const [isDrawMode, setIsDrawMode] = useState(false);
  const [drawStart, setDrawStart] = useState<{ x: number; y: number } | null>(null);
  const [drawCurrent, setDrawCurrent] = useState<{ x: number; y: number } | null>(null);
  const [manualLabel, setManualLabel] = useState('Suspected item');
  const [manualClass, setManualClass] = useState<MaterialClass>('recyclable');

  // Gemini Second Opinion Modal & State
  const [showGeminiModal, setShowGeminiModal] = useState(false);
  const [geminiLoading, setGeminiLoading] = useState(false);
  const [geminiOutput, setGeminiOutput] = useState<{
    advice: string;
    reasoning?: string;
    model: string;
    effectiveHazardProbability: number;
    cautionRaised: boolean;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Subscribe to worker download progress
  useEffect(() => {
    const unsubscribe = cvPipeline.subscribeProgress((payload) => {
      setProgressState(payload);
    });
    return () => {
      unsubscribe();
    };
  }, []);

  // Keyboard paste listener (Ctrl+V)
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.startsWith('image/')) {
          const file = items[i].getAsFile();
          if (file) handleProcessFile(file);
          break;
        }
      }
    };
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, []);

  // Process File Input
  const handleProcessFile = async (file: File) => {
    setErrorMessage(null);
    setDetections([]);
    setItems([]);
    setSelectedId(null);
    setSentToTwinToast(false);

    try {
      if (file.size > 8 * 1024 * 1024) {
        throw new Error('Image exceeds 8 MB safety limit. Please upload an image under 8 MB.');
      }
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
        throw new Error('Unsupported format. Please upload JPEG, PNG, or WebP.');
      }

      const { dataUrl, width, height } = await cvPipeline.prepareImage(file);
      setImageSrc(dataUrl);
      setImageDims({ width, height });
      setStatus('idle');
    } catch (err: any) {
      setStatus('error');
      setErrorMessage(err?.message || 'Unable to load image');
    }
  };

  // Run Inference
  const handleAnalyse = async () => {
    if (!imageSrc) return;
    setStatus('loading');
    setErrorMessage(null);

    try {
      const result = await cvPipeline.analyze(imageSrc);
      setDetections(result.detections);
      setItems(result.items);
      setInferenceMeta({
        timeMs: result.inferenceTimeMs,
        device: result.deviceUsed,
        model: result.modelName,
      });
      if (result.items.length > 0) {
        setSelectedId(result.items[0].id);
      }
      setStatus('analyzed');
    } catch (err: any) {
      setStatus('error');
      setErrorMessage(err?.message || 'Inference encountered an unexpected issue.');
    }
  };

  // Human Annotation: Start Drawing Box
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDrawMode || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
    setDrawStart({ x, y });
    setDrawCurrent({ x, y });
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDrawMode || !drawStart || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
    setDrawCurrent({ x, y });
  };

  const handleMouseUp = () => {
    if (!isDrawMode || !drawStart || !drawCurrent) {
      setDrawStart(null);
      setDrawCurrent(null);
      return;
    }

    const x = Math.min(drawStart.x, drawCurrent.x);
    const y = Math.min(drawStart.y, drawCurrent.y);
    const width = Math.abs(drawCurrent.x - drawStart.x);
    const height = Math.abs(drawCurrent.y - drawStart.y);

    if (width > 0.04 && height > 0.04) {
      const newItem = cvPipeline.createManualItem(
        { x, y, width, height },
        manualLabel,
        manualClass,
        imageSrc || undefined
      );

      const newDet: NormalizedDetection = {
        id: newItem.id,
        label: manualLabel,
        score: 1.0,
        box: { x, y, width, height },
        clipProbabilities: {
          recyclable: manualClass === 'recyclable' ? 0.95 : 0.05,
          reusable: manualClass === 'reusable' ? 0.95 : 0.05,
          biodegradable: manualClass === 'biodegradable' ? 0.95 : 0.05,
          hazardous: manualClass === 'hazardous' ? 0.95 : 0.05,
          batteryRisk: manualClass === 'hazardous' ? 0.85 : 0.0,
        },
        cropDataUrl: imageSrc || undefined,
        provenance: 'Human-verified',
      };

      setDetections((prev) => [...prev, newDet]);
      setItems((prev) => [...prev, newItem]);
      setSelectedId(newItem.id);
    }

    setDrawStart(null);
    setDrawCurrent(null);
    setIsDrawMode(false);
  };

  // Human Correction of Item Class
  const handleUpdateItemClass = (itemId: string, newClass: MaterialClass) => {
    setItems((prev) =>
      prev.map((it) => {
        if (it.id !== itemId) return it;

        const isHazard = newClass === 'hazardous';
        const updatedHazProb = isHazard ? Math.max(0.75, it.hazardProbability) : 0.05;
        const updatedConfidence = 0.95;

        const decision = evaluateGate(
          {
            hazardProbability: updatedHazProb,
            confidence: updatedConfidence,
            modelDisagreement: 0.0,
            predictedClass: newClass,
          },
          DEFAULT_GATE_POLICY
        );

        return {
          ...it,
          primaryClass: newClass,
          hazardProbability: updatedHazProb,
          overallConfidence: updatedConfidence,
          gateScore: Number(decision.gateScore.toFixed(4)),
          assignedRoute: decision.route,
          provenance: 'Human-verified',
          notes: it.notes,
        };
      })
    );
  };

  // Send to 3D Twin Live Link
  const handleSendToTwin = () => {
    if (items.length === 0) return;
    loadPhotoScenario(items);
    setSentToTwinToast(true);

    // Smooth scroll to twin viewport
    const twinEl = document.getElementById('twin');
    if (twinEl) {
      twinEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const handleConfirmGemini = async () => {
    if (!imageSrc || !selectedItem) return;
    setGeminiLoading(true);
    setShowGeminiModal(false);

    try {
      const res = await fetch('/api/second-opinion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageDataUrl: imageSrc,
          item: {
            id: selectedItem.id,
            name: selectedItem.name,
            primaryClass: selectedItem.primaryClass,
            hazardProbability: selectedItem.hazardProbability,
            overallConfidence: selectedItem.overallConfidence,
          },
        }),
      });

      if (!res.ok) {
        const errJson = await res.json();
        throw new Error(errJson.error || 'Failed to obtain Gemini second opinion');
      }

      const data = await res.json();
      setGeminiOutput(data);

      if (data.cautionRaised) {
        setItems((prev) =>
          prev.map((it) => {
            if (it.id !== selectedItem.id) return it;
            const updatedHazard = data.effectiveHazardProbability;
            const decision = evaluateGate(
              {
                hazardProbability: updatedHazard,
                confidence: it.overallConfidence,
                modelDisagreement: Math.min(1.0, (it.modelDisagreement || 0) + 0.25),
                predictedClass: it.primaryClass,
              },
              DEFAULT_GATE_POLICY
            );
            return {
              ...it,
              hazardProbability: updatedHazard,
              gateScore: Number(decision.gateScore.toFixed(4)),
              assignedRoute: decision.route,
              provenance: 'AI-generated',
            };
          })
        );
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Gemini second opinion request failed');
    } finally {
      setGeminiLoading(false);
    }
  };

  const selectedItem = items.find((it) => it.id === selectedId) || items[0] || null;
  const selectedDetection = detections.find((d) => d.id === selectedId) || detections[0] || null;

  return (
    <div className={`space-y-6 font-sans ${className}`} id="evidence-lab">
      {/* ------------------------------------------------------------------- */}
      {/* 1. Header & DPDP Privacy Notice                                     */}
      {/* ------------------------------------------------------------------- */}
      <div className="bg-bg-surface border border-border-subtle p-4 rounded-[2px] space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border-subtle pb-3">
          <div className="flex items-center gap-2.5">
            <span className="w-2.5 h-2.5 bg-amber-500 rounded-none animate-pulse" />
            <h2 className="text-sm font-mono font-bold uppercase tracking-wider text-text-primary">
              EVIDENCE LAB // CLIENT-SIDE CV INSPECTOR
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono text-text-muted">DEVICE:</span>
            <span className="text-[10px] font-mono font-bold text-amber-400 uppercase">
              {inferenceMeta ? inferenceMeta.device : 'WebGPU / WASM auto'}
            </span>
          </div>
        </div>

        {/* DPDP Compliance Notice */}
        <div
          role="note"
          aria-label="Privacy notice"
          className="text-xs font-mono text-text-secondary bg-[#090c10]/60 border border-border-subtle/80 p-3 rounded-[2px] space-y-1"
        >
          <div className="flex items-center gap-2 text-amber-400 font-bold text-[11px]">
            <span>[PRIVACY NOTICE]</span>
            <span className="text-text-muted font-normal">In-Browser Machine Learning</span>
          </div>
          <p className="leading-relaxed">
            Photos uploaded here are processed entirely in your browser using local client-side WebGPU/WASM models.
            Nothing is stored, logged, or uploaded to any server unless you explicitly click the optional second-opinion button.
            Please do not upload photographs of people, faces, or government identity documents.
          </p>
        </div>
      </div>

      {/* ------------------------------------------------------------------- */}
      {/* 2. Upload / Dropzone & Action Bar                                   */}
      {/* ------------------------------------------------------------------- */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
        <div className="md:col-span-8 bg-bg-surface border border-border-subtle p-3 rounded-[2px] flex flex-wrap items-center gap-2">
          {/* File Picker */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            id="photo-file-input"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleProcessFile(file);
            }}
          />
          {/* Camera Capture (Mobile) */}
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            id="camera-capture-input"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleProcessFile(file);
            }}
          />

          <button
            onClick={() => fileInputRef.current?.click()}
            className="px-3 py-1.5 bg-bg-elevated hover:bg-bg-primary border border-border-default hover:border-amber-500/50 text-text-primary text-xs font-mono rounded-[2px] transition-colors"
          >
            Upload Photo
          </button>

          <button
            onClick={() => cameraInputRef.current?.click()}
            className="px-3 py-1.5 bg-bg-elevated hover:bg-bg-primary border border-border-default hover:border-amber-500/50 text-text-primary text-xs font-mono rounded-[2px] transition-colors sm:inline-flex hidden"
          >
            Camera Capture
          </button>

          <span className="text-xs font-mono text-text-muted hidden sm:inline">|</span>
          <span className="text-xs font-mono text-text-muted hidden lg:inline">
            Drag &amp; drop or Ctrl+V paste (JPEG, PNG, WebP &le; 8 MB)
          </span>
        </div>

        {/* Action Controls */}
        <div className="md:col-span-4 bg-bg-surface border border-border-subtle p-3 rounded-[2px] flex items-center justify-end gap-2">
          <button
            disabled={!imageSrc || status === 'loading'}
            onClick={handleAnalyse}
            id="analyse-photo-btn"
            className="px-3 py-1.5 bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/40 text-amber-300 disabled:opacity-40 disabled:cursor-not-allowed text-xs font-mono font-bold rounded-[2px] transition-colors"
          >
            {status === 'loading' ? 'Inferring...' : 'Analyse photo'}
          </button>

          <button
            disabled={!imageSrc || status === 'loading'}
            onClick={() => setIsDrawMode(!isDrawMode)}
            id="add-box-hand-btn"
            className={`px-3 py-1.5 border text-xs font-mono rounded-[2px] transition-colors ${
              isDrawMode
                ? 'bg-amber-500 text-bg-primary border-amber-500 font-bold'
                : 'bg-bg-elevated border-border-default text-text-secondary hover:text-text-primary'
            }`}
          >
            {isDrawMode ? 'Cancel box' : 'Add box by hand'}
          </button>
        </div>
      </div>

      {/* ------------------------------------------------------------------- */}
      {/* 3. Model Download Progress Banner                                   */}
      {/* ------------------------------------------------------------------- */}
      {progressState && progressState.status === 'progress' && (
        <div
          role="status"
          aria-live="polite"
          className="bg-[#090c10] border border-amber-500/40 p-3 rounded-[2px] font-mono text-xs space-y-1.5 animate-pulse"
        >
          <div className="flex items-center justify-between text-amber-400">
            <span>MODEL CACHE FETCH // {progressState.task || progressState.file || 'Downloading weights...'}</span>
            <span>{progressState.progress !== undefined ? `${progressState.progress}%` : 'Loading...'}</span>
          </div>
          <div className="w-full h-1.5 bg-bg-surface rounded-none overflow-hidden border border-border-subtle">
            <div
              className="h-full bg-amber-500 transition-all duration-150"
              style={{ width: `${progressState.progress || 20}%` }}
            />
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------- */}
      {/* 4. Error Display State                                              */}
      {/* ------------------------------------------------------------------- */}
      {errorMessage && (
        <div
          role="alert"
          className="bg-bg-surface border border-amber-500/50 p-4 rounded-[2px] font-mono text-xs text-amber-300 space-y-1"
        >
          <div className="font-bold uppercase tracking-wider text-amber-400">[PIPELINE ADVISORY]</div>
          <p>{errorMessage}</p>
        </div>
      )}

      {/* ------------------------------------------------------------------- */}
      {/* 5. Main Canvas & Telemetry Inspection Stage                         */}
      {/* ------------------------------------------------------------------- */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Visual Viewport (Cols 1-7) */}
        <div className="lg:col-span-7 bg-bg-surface border border-border-subtle rounded-[2px] p-3 space-y-3">
          <div className="flex items-center justify-between border-b border-border-subtle pb-2 text-xs font-mono text-text-muted">
            <span>DETECTION MATRIX VIEWPORT</span>
            {isDrawMode && (
              <span className="text-amber-400 animate-pulse font-bold">
                [DRAG CURSOR OVER IMAGE TO ENCLOSE ITEM]
              </span>
            )}
          </div>

          <div
            ref={containerRef}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            className={`relative w-full aspect-[4/3] bg-[#070a0d] border border-border-subtle/80 overflow-hidden rounded-[2px] select-none ${
              isDrawMode ? 'cursor-crosshair' : 'cursor-default'
            }`}
          >
            {imageSrc ? (
              <>
                {/* Uploaded Image Base */}
                <img
                  src={imageSrc}
                  alt="Material intake evidence photo"
                  className="w-full h-full object-contain pointer-events-none"
                />

                {/* Bounding Box Corner-Bracket Overlays */}
                {detections.map((det) => {
                  const isSelected = det.id === selectedId;
                  const item = items.find((it) => it.id === det.id);
                  const isHazard =
                    (item && item.hazardProbability >= SAFETY_FLOOR) ||
                    det.label.includes('battery') ||
                    det.label.includes('bank') ||
                    det.label.includes('vape');

                  const boxBorderColor = isSelected
                    ? '#f59e0b'
                    : isHazard
                    ? '#d97706'
                    : '#38bdf8';

                  return (
                    <div
                      key={det.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedId(det.id);
                      }}
                      style={{
                        position: 'absolute',
                        left: `${det.box.x * 100}%`,
                        top: `${det.box.y * 100}%`,
                        width: `${det.box.width * 100}%`,
                        height: `${det.box.height * 100}%`,
                      }}
                      className="group cursor-pointer pointer-events-auto transition-transform"
                    >
                      {/* Industrial Corner Brackets */}
                      {/* Top-Left */}
                      <span
                        style={{ borderColor: boxBorderColor }}
                        className="absolute top-0 left-0 w-3 h-3 border-t-2 border-l-2"
                      />
                      {/* Top-Right */}
                      <span
                        style={{ borderColor: boxBorderColor }}
                        className="absolute top-0 right-0 w-3 h-3 border-t-2 border-r-2"
                      />
                      {/* Bottom-Left */}
                      <span
                        style={{ borderColor: boxBorderColor }}
                        className="absolute bottom-0 left-0 w-3 h-3 border-b-2 border-l-2"
                      />
                      {/* Bottom-Right */}
                      <span
                        style={{ borderColor: boxBorderColor }}
                        className="absolute bottom-0 right-0 w-3 h-3 border-b-2 border-r-2"
                      />

                      {/* Subtle Scrim Box Outline */}
                      <div
                        style={{ borderColor: boxBorderColor }}
                        className={`w-full h-full border border-dashed transition-opacity ${
                          isSelected ? 'opacity-90 bg-amber-500/10' : 'opacity-40 group-hover:opacity-75'
                        }`}
                      />

                      {/* Header Tag Reticle */}
                      <div
                        style={{
                          background: isSelected ? '#f59e0b' : '#090c10',
                          color: isSelected ? '#090c10' : boxBorderColor,
                          borderColor: boxBorderColor,
                        }}
                        className="absolute -top-5 left-0 px-1.5 py-0.5 text-[9px] font-mono font-bold tracking-wider uppercase border border-border-subtle whitespace-nowrap"
                      >
                        {det.label} [{(det.score * 100).toFixed(0)}%]
                      </div>
                    </div>
                  );
                })}

                {/* Active Drawing Rubberband Rect */}
                {drawStart && drawCurrent && (
                  <div
                    style={{
                      position: 'absolute',
                      left: `${Math.min(drawStart.x, drawCurrent.x) * 100}%`,
                      top: `${Math.min(drawStart.y, drawCurrent.y) * 100}%`,
                      width: `${Math.abs(drawCurrent.x - drawStart.x) * 100}%`,
                      height: `${Math.abs(drawCurrent.y - drawStart.y) * 100}%`,
                    }}
                    className="border-2 border-amber-500 bg-amber-500/20 pointer-events-none"
                  />
                )}
              </>
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center gap-3 p-6 text-center text-text-muted font-mono text-xs">
                <svg
                  className="w-12 h-12 text-border-strong"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                >
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <circle cx="8.5" cy="8.5" r="1.5" />
                  <polyline points="21 15 16 10 5 21" />
                </svg>
                <div>
                  NO ACTIVE EVIDENCE PHOTO
                  <div className="text-[10px] text-text-secondary mt-1">
                    Upload an image or drag &amp; drop to initiate local open-vocabulary vision scan
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Manual Drawing Selector Options */}
          {isDrawMode && (
            <div className="flex flex-wrap items-center gap-2 p-2.5 bg-bg-elevated border border-border-default rounded-[2px] font-mono text-xs">
              <span className="text-text-muted">Label:</span>
              <input
                type="text"
                value={manualLabel}
                onChange={(e) => setManualLabel(e.target.value)}
                className="px-2 py-1 bg-bg-primary border border-border-subtle text-text-primary text-xs rounded-[2px]"
              />
              <span className="text-text-muted ml-2">Class:</span>
              <select
                value={manualClass}
                onChange={(e) => setManualClass(e.target.value as MaterialClass)}
                className="px-2 py-1 bg-bg-primary border border-border-subtle text-text-primary text-xs rounded-[2px]"
              >
                <option value="recyclable">Recyclable</option>
                <option value="reusable">Reusable</option>
                <option value="biodegradable">Biodegradable</option>
                <option value="hazardous">Hazardous</option>
              </select>
            </div>
          )}
        </div>

        {/* Telemetry Inspection Panel (Cols 8-12) */}
        <div className="lg:col-span-5 bg-bg-surface border border-border-subtle rounded-[2px] p-3 space-y-4">
          <div className="flex items-center justify-between border-b border-border-subtle pb-2">
            <span className="text-xs font-mono text-text-muted uppercase tracking-wider">
              INSPECTION TELEMETRY // {selectedItem ? selectedItem.id : 'NO SELECTION'}
            </span>
            {selectedItem && (
              <ProvenanceChip provenance={selectedItem.provenance} showPrefix={false} />
            )}
          </div>

          {selectedItem ? (
            <div className="space-y-4 font-mono text-xs">
              {/* Item Identification */}
              <div className="bg-bg-elevated border border-border-subtle p-3 rounded-[2px] space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-text-muted text-[11px]">Primary Class:</span>
                  <span className="text-text-primary font-bold uppercase tracking-wider">
                    {selectedItem.primaryClass}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-text-muted text-[11px]">Hazard Probability:</span>
                  <span
                    className={
                      selectedItem.hazardProbability >= SAFETY_FLOOR
                        ? 'text-amber-400 font-bold'
                        : 'text-text-primary'
                    }
                  >
                    {(selectedItem.hazardProbability * 100).toFixed(1)}%
                    {selectedItem.hazardProbability >= SAFETY_FLOOR && ' [SAFETY FLOOR TRIGGERED]'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-text-muted text-[11px]">Overall Confidence:</span>
                  <span className="text-text-primary">
                    {(selectedItem.overallConfidence * 100).toFixed(1)}%
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-text-muted text-[11px]">Model Disagreement:</span>
                  <span className="text-amber-400">
                    {( (selectedItem.modelDisagreement || 0) * 100 ).toFixed(1)}%
                  </span>
                </div>
              </div>

              {/* Zero-Shot Class Probabilities Quiet Bars */}
              {selectedDetection?.clipProbabilities && (
                <div className="space-y-2 bg-bg-elevated/60 border border-border-subtle p-3 rounded-[2px]">
                  <div className="text-[10px] text-text-muted uppercase tracking-wider">
                    Zero-Shot CLIP Classification Probs:
                  </div>
                  {(['recyclable', 'reusable', 'biodegradable', 'hazardous'] as MaterialClass[]).map(
                    (cls) => {
                      const prob = selectedDetection.clipProbabilities?.[cls] || 0;
                      const isHaz = cls === 'hazardous';
                      return (
                        <div key={cls} className="space-y-1">
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="capitalize text-text-secondary">{cls}</span>
                            <span className={isHaz ? 'text-amber-400 font-bold' : 'text-text-primary'}>
                              {(prob * 100).toFixed(1)}%
                            </span>
                          </div>
                          <div className="w-full h-1 bg-bg-primary rounded-none overflow-hidden">
                            <div
                              className={`h-full ${isHaz ? 'bg-amber-500' : 'bg-slate-400'}`}
                              style={{ width: `${prob * 100}%` }}
                            />
                          </div>
                        </div>
                      );
                    }
                  )}
                </div>
              )}

              {/* Gate Routing Decision */}
              <div className="bg-[#090c10] border border-border-default p-3 rounded-[2px] space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-text-muted text-[11px]">Assigned Stream:</span>
                  <span className="text-amber-400 font-bold uppercase tracking-wider">
                    {selectedItem.assignedRoute}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-text-muted text-[11px]">Computed Gate Score:</span>
                  <span className="text-text-primary font-bold">
                    {selectedItem.gateScore.toFixed(3)}
                  </span>
                </div>
              </div>

              {/* Human Correction Fallback */}
              <div className="space-y-1.5 pt-1 border-t border-border-subtle">
                <div className="text-[10px] text-text-muted uppercase">Correct Material Class (Human Fallback):</div>
                <div className="grid grid-cols-2 gap-1.5">
                  {(['recyclable', 'reusable', 'biodegradable', 'hazardous'] as MaterialClass[]).map(
                    (cls) => (
                      <button
                        key={cls}
                        onClick={() => handleUpdateItemClass(selectedItem.id, cls)}
                        className={`px-2 py-1 border text-[10px] rounded-[2px] transition-colors capitalize ${
                          selectedItem.primaryClass === cls
                            ? 'bg-amber-500/20 border-amber-500 text-amber-300 font-bold'
                            : 'bg-bg-elevated border-border-subtle text-text-secondary hover:text-text-primary'
                        }`}
                      >
                        {cls}
                      </button>
                    )
                  )}
                </div>
              </div>

              {/* Gemini Second Opinion Action & Output */}
              <div className="pt-2 border-t border-border-subtle/80 space-y-2">
                <button
                  type="button"
                  onClick={() => setShowGeminiModal(true)}
                  className="w-full py-2 px-3 bg-bg-elevated hover:bg-bg-primary border border-border-strong text-text-secondary hover:text-text-primary text-xs font-mono rounded-[2px] transition-colors"
                >
                  Request Gemini Second Opinion
                </button>

                {geminiOutput && (
                  <div className="bg-[#090c10] border border-amber-500/40 p-3 rounded-[2px] space-y-1.5 text-xs font-mono">
                    <div className="flex items-center justify-between">
                      <span className="text-amber-400 font-bold uppercase text-[10px]">
                        GEMINI ADVISORY [{geminiOutput.model}]
                      </span>
                      <ProvenanceChip provenance="AI-generated" showPrefix={false} />
                    </div>
                    <div className="text-text-primary text-[11px] leading-relaxed">
                      {geminiOutput.advice}
                    </div>
                    {geminiOutput.reasoning && (
                      <div className="text-text-muted text-[10px]">
                        {geminiOutput.reasoning}
                      </div>
                    )}
                    {geminiOutput.cautionRaised && (
                      <div className="text-amber-400 font-bold text-[10px] pt-1 border-t border-border-subtle/60">
                        ⚠ CAUTION RAISED: Hazard probability increased to {(geminiOutput.effectiveHazardProbability * 100).toFixed(1)}%
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="py-12 text-center text-text-muted font-mono text-xs">
              No item selected. Upload an image and click a bounding box to inspect.
            </div>
          )}

          {/* ----------------------------------------------------------------- */}
          {/* Send to 3D Twin Action Button                                     */}
          {/* ----------------------------------------------------------------- */}
          <div className="pt-3 border-t border-border-subtle space-y-2">
            <button
              disabled={items.length === 0}
              onClick={handleSendToTwin}
              id="send-to-twin-btn"
              className="w-full py-2.5 px-4 bg-amber-500 hover:bg-amber-400 text-bg-primary font-mono text-xs font-bold uppercase tracking-wider rounded-[2px] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Send to twin
            </button>
            {sentToTwinToast && (
              <div className="text-[11px] font-mono text-amber-400 text-center animate-pulse">
                ✓ Items linked to Sentinel twin // Riding conveyor belt
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Explicit Consent Modal for Gemini Second Opinion */}
      {showGeminiModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="gemini-consent-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
        >
          <div className="w-full max-w-md bg-bg-surface border border-border-default p-5 rounded-[2px] font-mono text-xs space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-border-subtle pb-2">
              <span id="gemini-consent-title" className="text-amber-400 font-bold uppercase tracking-wider">
                EXTERNAL API CONSENT NOTICE
              </span>
              <button
                onClick={() => setShowGeminiModal(false)}
                className="text-text-muted hover:text-text-primary px-1"
                aria-label="Close dialog"
              >
                [X]
              </button>
            </div>

            <p className="text-text-secondary leading-relaxed">
              This sends this image to Google&apos;s Gemini API. The response will be used solely for secondary safety caution and is never stored on a server.
            </p>

            <div className="p-2.5 bg-bg-elevated border border-border-subtle text-[11px] text-text-muted space-y-1">
              <div>
                TARGET ITEM: <span className="text-text-primary font-bold">{selectedItem?.name}</span>
              </div>
              <div>
                LOCAL HAZARD:{' '}
                <span className="text-amber-400">
                  {((selectedItem?.hazardProbability || 0) * 100).toFixed(1)}%
                </span>
              </div>
              <div className="text-[10px] text-amber-500">
                RULE: Gemini may only RAISE caution, never lower it or override the safety floor.
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border-subtle">
              <button
                onClick={() => setShowGeminiModal(false)}
                className="px-3 py-1.5 bg-bg-elevated hover:bg-bg-primary border border-border-default text-text-secondary hover:text-text-primary rounded-[2px]"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmGemini}
                id="gemini-confirm-btn"
                className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-bg-primary font-bold rounded-[2px] transition-colors"
              >
                Send image to Gemini
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
