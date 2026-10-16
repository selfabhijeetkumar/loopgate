/**
 * src/cv/pipeline.ts
 * Main-thread controller for in-browser computer vision.
 *
 * PHASE 4D HONESTY & STATE MACHINE:
 * 1. Strict worker termination on failure: After a WebGPU failure, the corrupted worker
 *    is terminated immediately and a fresh worker is spawned with device "wasm" only.
 * 2. Inference gating: If model loading fails, state becomes 'failed'. Calling analyze()
 *    immediately rejects and NEVER calls inference on an un-loaded pipeline.
 * 3. Fallback chain: Primary OWL-ViT -> Secondary DETR (Xenova/detr-resnet-50, generic COCO)
 *    -> Human-verified manual bounding box.
 * 4. Never synthesizes fake metrics or fake model scores.
 */

import type {
  NormalizedDetection,
  PipelineAnalysisResult,
  WorkerProgressPayload,
} from './types';
import { mapDetectionsToItems, mapDetectionToItem } from './toItems';
import type { Item, MaterialClass } from '@/domain/types';

export type ProgressListener = (payload: WorkerProgressPayload) => void;
export type PipelineState = 'idle' | 'loading' | 'ready' | 'failed';

export interface PreparedImage {
  dataUrl: string;
  buffer: ArrayBuffer;
  width: number;
  height: number;
}

export interface SmokeTestResult {
  test: string;
  model: string;
  device: string;
  dtype: string;
  loadTimeMs: number;
  inferTimeMs: number;
  totalTimeMs: number;
  result: any;
}

export class ComputerVisionPipeline {
  private worker: Worker | null = null;
  private state: PipelineState = 'idle';
  private lastError: string | null = null;
  private progressListeners = new Set<ProgressListener>();
  private activeDevice: 'webgpu' | 'wasm' = 'wasm';
  private activeModel = 'Xenova/owlvit-base-patch32';
  private activeClip = 'Xenova/clip-vit-base-patch32';
  private preferredDtype: 'fp32' | 'q8' = 'q8';
  private hasAttemptedWebGpu = false;

  constructor() {
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

  public getState(): PipelineState {
    return this.state;
  }

  public getLastError(): string | null {
    return this.lastError;
  }

  public subscribeProgress(listener: ProgressListener) {
    this.progressListeners.add(listener);
    return () => this.progressListeners.delete(listener);
  }

  private notifyProgress(payload: WorkerProgressPayload) {
    this.progressListeners.forEach((l) => l(payload));
  }

  public getModelInfo(): { detector: string; clip: string; device: string; state: PipelineState } {
    return {
      detector: this.activeModel,
      clip: this.activeClip,
      device: this.activeDevice,
      state: this.state,
    };
  }

  public setPreferredDetector(modelName: 'Xenova/owlvit-base-patch32' | 'Xenova/detr-resnet-50') {
    if (this.activeModel !== modelName) {
      this.activeModel = modelName;
      this.terminateWorker();
      this.initWorker(this.activeDevice);
    }
  }

  public terminateWorker() {
    if (this.worker) {
      try {
        this.worker.terminate();
      } catch (err) {
        console.warn('[CV Pipeline] Error terminating worker:', err);
      }
      this.worker = null;
    }
    if (typeof window !== 'undefined') {
      delete (window as any).__LOOPGATE_CV_WORKER__;
    }
    this.state = 'idle';
  }

  private createWorkerInstance(): Worker | null {
    if (typeof window === 'undefined') return null;

    try {
      const worker = new Worker(new URL('./worker.ts', import.meta.url), {
        type: 'module',
      });

      worker.addEventListener('message', (e) => {
        const { type, payload, status, device, error, modelName, clipName, detectorModel } = e.data || {};

        if (type === 'PROGRESS' && payload) {
          this.notifyProgress(payload);
        } else if (type === 'STATUS') {
          if (status === 'ready') {
            this.state = 'ready';
            this.lastError = null;
            this.activeDevice = device || 'wasm';
            if (modelName) this.activeModel = modelName;
            if (clipName) this.activeClip = clipName;
            this.notifyProgress({
              status: 'ready',
              task: `Ready [${this.activeDevice.toUpperCase()}]`,
            });
          }
        } else if (type === 'LOAD_FAILED') {
          console.warn(`[CV Pipeline] Worker reported LOAD_FAILED on device="${device}":`, error);
          if (device === 'webgpu' && !this.hasAttemptedWebGpu) {
            // STEP 0.2: NO RETRY IN CORRUPTED SESSION.
            // Terminate the WebGPU worker immediately and spawn a fresh worker with device "wasm" only.
            this.hasAttemptedWebGpu = true;
            console.log('[CV Pipeline] Terminating corrupted WebGPU worker and spawning clean WASM worker...');
            this.terminateWorker();
            this.initWorker('wasm');
          } else {
            // WASM failed or hard failure: transition to 'failed' and never call inference
            this.state = 'failed';
            this.lastError = error;
            this.notifyProgress({
              status: 'error',
              task: `Model load failed: ${error}`,
            });
          }
        } else if (type === 'CSP_VIOLATION') {
          console.error('[CV WORKER CSP VIOLATION]', payload);
        } else if (type === 'FETCH_ERROR') {
          console.error('[CV WORKER FETCH FAILED]', payload);
        }
      });

      worker.onerror = (err) => {
        console.warn('[CV Pipeline] Worker unhandled script error:', err);
        this.state = 'failed';
        this.lastError = 'Worker script initialization failed';
        this.notifyProgress({ status: 'error', task: 'Worker script initialization failed' });
      };

      return worker;
    } catch (err: any) {
      console.warn('Unable to spawn CV worker:', err);
      this.state = 'failed';
      this.lastError = err?.message || 'Unable to instantiate worker thread.';
      return null;
    }
  }

  public initWorker(preferredDevice: 'webgpu' | 'wasm' = 'wasm', detectorModel = this.activeModel) {
    if (this.worker && this.state === 'loading') return;

    this.terminateWorker();
    this.state = 'loading';
    this.lastError = null;
    this.activeDevice = preferredDevice;
    this.activeModel = detectorModel;
    this.preferredDtype = preferredDevice === 'webgpu' ? 'fp32' : 'q8';

    const worker = this.createWorkerInstance();
    if (!worker) {
      this.state = 'failed';
      this.lastError = 'Browser does not support Web Workers';
      return;
    }

    this.worker = worker;
    if (typeof window !== 'undefined') {
      (window as any).__LOOPGATE_CV_WORKER__ = this.worker;
    }

    worker.postMessage({
      type: 'INIT',
      preferredDevice,
      dtype: this.preferredDtype,
      detectorModel: this.activeModel,
      clipModel: this.activeClip,
    });
  }

  public prefetchWorker() {
    if (this.state !== 'idle') return;
    // Default to wasm for maximum reliability on all hardware
    this.initWorker('wasm');
  }

  public async prepareImage(fileOrDataUrl: File | string): Promise<PreparedImage> {
    return new Promise((resolve, reject) => {
      let src = '';
      let objectUrl: string | null = null;

      if (typeof fileOrDataUrl === 'string') {
        src = fileOrDataUrl;
      } else {
        if (fileOrDataUrl.size > 8 * 1024 * 1024) {
          reject(new Error('File size exceeds 8 MB safety limit.'));
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
          resolve({ dataUrl: src, buffer: new ArrayBuffer(0), width: w, height: h });
          return;
        }

        ctx.drawImage(img, 0, 0, w, h);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
        const imgData = ctx.getImageData(0, 0, w, h);
        if (objectUrl) URL.revokeObjectURL(objectUrl);
        resolve({ dataUrl, buffer: imgData.data.buffer, width: w, height: h });
      };

      img.onerror = () => {
        if (objectUrl) URL.revokeObjectURL(objectUrl);
        reject(new Error('Corrupt or unreadable image file.'));
      };

      img.src = src;
    });
  }

  /**
   * Run isolated smoke tests in /dev/cv-smoke
   */
  public async runIsolatedSmokeTest(
    testType: 'CLIP' | 'OWL_VIT_Q8' | 'OWL_VIT_FP32' | 'DETR_COCO',
    fileOrDataUrl: File | string
  ): Promise<SmokeTestResult> {
    const { buffer, width, height } = await this.prepareImage(fileOrDataUrl);

    // Spawn a clean dedicated worker for smoke test to prevent session cross-contamination
    const smokeWorker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        smokeWorker.terminate();
        reject(new Error(`Smoke test ${testType} timed out after 240 seconds.`));
      }, 240_000);

      smokeWorker.addEventListener('message', (e) => {
        const { type, test, model, device, dtype, loadTimeMs, inferTimeMs, totalTimeMs, result, error, payload } =
          e.data || {};

        if (type === 'PROGRESS' && payload) {
          this.notifyProgress(payload);
        } else if (type === 'SMOKE_RESULT') {
          clearTimeout(timeout);
          smokeWorker.terminate();
          resolve({ test, model, device, dtype, loadTimeMs, inferTimeMs, totalTimeMs, result });
        } else if (type === 'SMOKE_ERROR') {
          clearTimeout(timeout);
          smokeWorker.terminate();
          reject(new Error(`Smoke test failed: ${error}`));
        }
      });

      if (testType === 'CLIP') {
        smokeWorker.postMessage(
          {
            type: 'SMOKE_CLIP',
            imageBuffer: buffer,
            imageWidth: width,
            imageHeight: height,
          },
          [buffer]
        );
      } else if (testType === 'OWL_VIT_Q8') {
        smokeWorker.postMessage(
          {
            type: 'SMOKE_DETECTOR',
            modelName: 'Xenova/owlvit-base-patch32',
            dtype: 'q8',
            device: 'wasm',
            imageBuffer: buffer,
            imageWidth: width,
            imageHeight: height,
          },
          [buffer]
        );
      } else if (testType === 'OWL_VIT_FP32') {
        smokeWorker.postMessage(
          {
            type: 'SMOKE_DETECTOR',
            modelName: 'Xenova/owlvit-base-patch32',
            dtype: 'fp32',
            device: 'wasm',
            imageBuffer: buffer,
            imageWidth: width,
            imageHeight: height,
          },
          [buffer]
        );
      } else if (testType === 'DETR_COCO') {
        smokeWorker.postMessage(
          {
            type: 'SMOKE_DETECTOR',
            modelName: 'Xenova/detr-resnet-50',
            dtype: 'q8',
            device: 'wasm',
            imageBuffer: buffer,
            imageWidth: width,
            imageHeight: height,
          },
          [buffer]
        );
      }
    });
  }

  /**
   * Main inference entrypoint:
   * HONESTY RULE: If load failed or worker is broken, immediately reject.
   * NEVER call detectorPipeline or synthesize fake output.
   */
  public async analyze(
    fileOrDataUrl: File | string,
    scoreThreshold = 0.12
  ): Promise<PipelineAnalysisResult> {
    if (this.state === 'failed') {
      throw new Error(`Model loading failed: ${this.lastError || 'Unknown load error'}. Inference cannot run.`);
    }

    if (!this.worker || this.state === 'idle') {
      this.initWorker('wasm');
    }

    const { dataUrl, buffer, width, height } = await this.prepareImage(fileOrDataUrl);

    // If still loading, wait for ready before sending ANALYZE
    if (this.state === 'loading') {
      await new Promise<void>((resolve, reject) => {
        const checkInterval = setInterval(() => {
          if (this.state === 'ready') {
            clearInterval(checkInterval);
            resolve();
          } else if (this.state === 'failed') {
            clearInterval(checkInterval);
            reject(new Error(`Model loading failed: ${this.lastError || 'Session initialization error'}`));
          }
        }, 100);

        setTimeout(() => {
          clearInterval(checkInterval);
          if (this.state !== 'ready') {
            reject(new Error('Model loading timed out while awaiting ready status.'));
          }
        }, 60_000);
      });
    }

    if (!this.worker || this.state !== 'ready') {
      throw new Error('Pipeline worker not ready to process image.');
    }

    const worker = this.worker;

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        worker.removeEventListener('message', handler);
        reject(new Error('Inference timed out after 240 seconds.'));
      }, 240_000);

      const handler = (e: MessageEvent) => {
        const { type, detections, inferenceTimeMs, deviceUsed, modelName, error } = e.data || {};

        if (type === 'RESULT') {
          clearTimeout(timeout);
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
          clearTimeout(timeout);
          worker.removeEventListener('message', handler);
          reject(new Error(`Model inference failed: ${error}`));
        }
      };

      worker.addEventListener('message', handler);
      worker.postMessage(
        {
          type: 'ANALYZE',
          imageBuffer: buffer,
          imageDataUrl: dataUrl,
          imageWidth: width,
          imageHeight: height,
          detectorScoreThreshold: scoreThreshold,
          detectorIouThreshold: 0.45,
          channels: 4,
        },
        [buffer]
      );
    });
  }

  public createManualItem(
    box: { x: number; y: number; width: number; height: number },
    label: string,
    materialClass: MaterialClass,
    imageCropDataUrl?: string
  ): Item {
    const detection: NormalizedDetection = {
      id: `manual-${Date.now().toString(36)}`,
      label: label.trim() || 'Human Box',
      score: 1.0,
      box,
      clipProbabilities: undefined,
      cropDataUrl: imageCropDataUrl,
      provenance: 'Human-verified',
    };

    return mapDetectionToItem(detection, 0, {
      provenance: 'Human-verified',
      manualClass: materialClass,
    });
  }
}

export const cvPipeline = new ComputerVisionPipeline();
