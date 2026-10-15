/**
 * src/cv/pipeline.ts
 * Main-thread interface to the CV pipeline. Handles worker orchestration,
 * image downscaling, and download progress tracking.
 *
 * HONESTY CONTRACT: If the model fails to load or the worker errors,
 * we REJECT — we never synthesize fake detections. The Evidence Lab
 * shows a real error state and the user can draw boxes manually.
 */

import type {
  NormalizedDetection,
  PipelineAnalysisResult,
  WorkerProgressPayload,
} from './types';
import { mapDetectionsToItems, mapDetectionToItem } from './toItems';
import type { Item, MaterialClass } from '@/domain/types';

export type ProgressListener = (payload: WorkerProgressPayload) => void;

class ComputerVisionPipeline {
  private worker: Worker | null = null;
  private isReady = false;
  private isInitializing = false;
  private progressListeners = new Set<ProgressListener>();
  private activeDevice = 'wasm';
  private activeModel = 'Xenova/owlvit-base-patch32';
  private activeClip = 'Xenova/clip-vit-base-patch32';

  constructor() {
    // Schedule prefetch on browser idle
    if (typeof window !== 'undefined') {
      if ('requestIdleCallback' in window) {
        (window as any).requestIdleCallback(() => {
          this.prefetchWorker();
        });
      } else {
        setTimeout(() => this.prefetchWorker(), 2500);
      }
    }
  }

  public subscribeProgress(listener: ProgressListener) {
    this.progressListeners.add(listener);
    return () => this.progressListeners.delete(listener);
  }

  private notifyProgress(payload: WorkerProgressPayload) {
    this.progressListeners.forEach((l) => l(payload));
  }

  /** Dynamic model info for Evidence Lab header */
  public getModelInfo(): { detector: string; clip: string; device: string } {
    return {
      detector: this.activeModel,
      clip: this.activeClip,
      device: this.activeDevice,
    };
  }

  private getWorker(): Worker | null {
    if (this.worker) return this.worker;
    if (typeof window === 'undefined') return null;

    try {
      this.worker = new Worker(new URL('./worker.ts', import.meta.url), {
        type: 'module',
      });

      this.worker.onmessage = (e) => {
        const { type, payload, status, device, error, modelName } = e.data || {};
        if (type === 'PROGRESS' && payload) {
          this.notifyProgress(payload);
        } else if (type === 'STATUS') {
          if (status === 'ready') {
            this.isReady = true;
            this.activeDevice = device || 'wasm';
            if (modelName) this.activeModel = modelName;
            this.notifyProgress({ status: 'ready', task: `Ready [${this.activeDevice.toUpperCase()}]` });
          } else if (status === 'error') {
            this.notifyProgress({ status: 'error', task: error || 'Failed to load model' });
          }
        }
      };

      this.worker.onerror = (err) => {
        console.warn('CV Worker encountered error:', err);
        this.notifyProgress({ status: 'error', task: 'Worker script initialization failed' });
      };

      return this.worker;
    } catch (err) {
      console.warn('Unable to spawn CV worker:', err);
      return null;
    }
  }

  public prefetchWorker() {
    if (this.isInitializing || this.isReady) return;
    this.isInitializing = true;
    const worker = this.getWorker();
    if (worker) {
      worker.postMessage({ type: 'INIT', preferredDevice: 'webgpu' });
    }
  }

  /**
   * Resizes large images to max 1024px maintaining aspect ratio to prevent memory pressure.
   */
  public async prepareImage(fileOrDataUrl: File | string): Promise<{
    dataUrl: string;
    width: number;
    height: number;
  }> {
    return new Promise((resolve, reject) => {
      let src = '';
      let objectUrl: string | null = null;

      if (typeof fileOrDataUrl === 'string') {
        src = fileOrDataUrl;
      } else {
        if (fileOrDataUrl.size > 8 * 1024 * 1024) {
          reject(new Error('File size exceeds the 8 MB safety limit.'));
          return;
        }
        if (!['image/jpeg', 'image/png', 'image/webp'].includes(fileOrDataUrl.type)) {
          reject(new Error('Unsupported file type. Please upload JPEG, PNG, or WebP.'));
          return;
        }
        objectUrl = URL.createObjectURL(fileOrDataUrl);
        src = objectUrl;
      }

      const img = new Image();
      img.onload = () => {
        const maxDim = 1024;
        let w = img.naturalWidth || img.width;
        let h = img.naturalHeight || img.height;

        if (w > maxDim || h > maxDim) {
          if (w > h) {
            h = Math.round((h * maxDim) / w);
            w = maxDim;
          } else {
            w = Math.round((w * maxDim) / h);
            h = maxDim;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          if (objectUrl) URL.revokeObjectURL(objectUrl);
          resolve({ dataUrl: src, width: w, height: h });
          return;
        }

        ctx.drawImage(img, 0, 0, w, h);
        // toDataURL used only for worker postMessage transfer (not fetch)
        const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
        if (objectUrl) URL.revokeObjectURL(objectUrl);
        resolve({ dataUrl, width: w, height: h });
      };

      img.onerror = () => {
        if (objectUrl) URL.revokeObjectURL(objectUrl);
        reject(new Error('Corrupt or unreadable image file.'));
      };

      img.src = src;
    });
  }

  /**
   * Analyzes an image with OWL-ViT and CLIP inside the Web Worker.
   * REJECTS if the worker is unavailable or the model errors.
   * Never synthesizes fake detections.
   */
  public async analyze(
    fileOrDataUrl: File | string,
    scoreThreshold = 0.12
  ): Promise<PipelineAnalysisResult> {
    const { dataUrl, width, height } = await this.prepareImage(fileOrDataUrl);
    const worker = this.getWorker();

    if (!worker) {
      throw new Error(
        'Web Worker could not be started. Check browser security settings or try a different browser.'
      );
    }

    return new Promise((resolve, reject) => {
      const handler = (e: MessageEvent) => {
        const { type, detections, inferenceTimeMs, deviceUsed, modelName, error } = e.data || {};

        if (type === 'RESULT') {
          worker.removeEventListener('message', handler);
          if (modelName) this.activeModel = modelName;
          if (deviceUsed) this.activeDevice = deviceUsed;
          const items = mapDetectionsToItems(detections);
          resolve({
            items,
            detections,
            inferenceTimeMs,
            deviceUsed: deviceUsed || this.activeDevice,
            modelName: modelName || this.activeModel,
            imageDimensions: { width, height },
          });
        } else if (type === 'ERROR') {
          worker.removeEventListener('message', handler);
          // HONESTY: reject, do NOT synthesize boxes
          reject(new Error(`Model inference failed: ${error}`));
        }
      };

      worker.addEventListener('message', handler);
      worker.postMessage({
        type: 'ANALYZE',
        imageDataUrl: dataUrl,
        imageWidth: width,
        imageHeight: height,
        detectorScoreThreshold: scoreThreshold,
        detectorIouThreshold: 0.45,
      });

      // 90s for first model download on slow connections
      setTimeout(() => {
        worker.removeEventListener('message', handler);
        reject(new Error(
          'Inference timed out after 90 seconds. The model may still be downloading. ' +
          'Please wait for download to complete and try again.'
        ));
      }, 90_000);
    });
  }

  /**
   * Creates a human-verified item from a user-drawn bounding box.
   * Always provenance: 'Human-verified', never 'Model-inferred'.
   */
  public createManualItem(
    box: { x: number; y: number; width: number; height: number },
    label: string,
    materialClass: MaterialClass,
    imageCropDataUrl?: string
  ): Item {
    const isHazard = materialClass === 'hazardous';
    const detection: NormalizedDetection = {
      id: `manual-${Date.now().toString(36)}`,
      label,
      score: 1.0,
      box,
      clipProbabilities: {
        recyclable: materialClass === 'recyclable' ? 0.95 : 0.05,
        reusable: materialClass === 'reusable' ? 0.95 : 0.05,
        biodegradable: materialClass === 'biodegradable' ? 0.95 : 0.05,
        hazardous: isHazard ? 0.95 : 0.05,
        batteryRisk: isHazard ? 0.85 : 0.0,
      },
      cropDataUrl: imageCropDataUrl,
      provenance: 'Human-verified',
    };

    return mapDetectionToItem(detection, 0, { provenance: 'Human-verified' });
  }
}

export const cvPipeline = new ComputerVisionPipeline();
