/**
 * src/cv/worker.ts
 * Web Worker executing @huggingface/transformers pipelines off the main thread.
 * WebGPU preferred with automatic WASM fallback.
 *
 * PHASE 4C DIAGNOSTICS & HARDENING:
 * 1. securitypolicyviolation listener posts violations to main thread.
 * 2. Logging wrapper around self.fetch tracks every requested URL, redirect, status, and error.
 * 3. Local ORT wasm configuration (env.backends.onnx.wasm.wasmPaths = '/ort/') avoids jsdelivr.
 * 4. Image inputs accept raw pixel ArrayBuffers / Blobs, completely eliminating data: URI fetches.
 * 5. Explicit dtype: 'fp32' for webgpu, 'q8' for wasm.
 */

import { pipeline, env, RawImage } from '@huggingface/transformers';
import type { RawDetectorResult, NormalizedDetection } from './types';
import { nonMaxSuppression } from './nms';

// ---------------------------------------------------------------------------
// 1. CSP Violation Listener & Fetch Diagnostic Wrapper
// ---------------------------------------------------------------------------

self.addEventListener('securitypolicyviolation', (e: any) => {
  const detail = {
    blockedURI: e.blockedURI || 'unknown',
    violatedDirective: e.violatedDirective || 'unknown',
    effectiveDirective: e.effectiveDirective || 'unknown',
    originalPolicy: e.originalPolicy || 'unknown',
    disposition: e.disposition || 'enforce',
    statusCode: e.statusCode || 0,
  };
  console.error('[Worker CSP Violation]', detail);
  self.postMessage({
    type: 'CSP_VIOLATION',
    payload: detail,
  });
});

const originalFetch = self.fetch.bind(self);
self.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
  const start = performance.now();
  console.log(`[Worker Fetch] START: ${url}`);
  try {
    const response = await originalFetch(input, init);
    const duration = Math.round(performance.now() - start);
    console.log(
      `[Worker Fetch] SUCCESS: ${url} -> status ${response.status} (${duration}ms) [redirected: ${
        response.redirected ? response.url : 'no'
      }]`
    );
    self.postMessage({
      type: 'FETCH_EVENT',
      payload: {
        url,
        finalUrl: response.redirected ? response.url : url,
        status: response.status,
        duration,
        ok: response.ok,
      },
    });
    return response;
  } catch (err: any) {
    const duration = Math.round(performance.now() - start);
    console.error(`[Worker Fetch] FAILED: ${url} after ${duration}ms:`, err?.message || err);
    self.postMessage({
      type: 'FETCH_ERROR',
      payload: {
        url,
        error: err?.message || String(err),
        duration,
      },
    });
    throw err;
  }
};

// ---------------------------------------------------------------------------
// 2. Transformers.js & ONNX Runtime Environment Configuration
// ---------------------------------------------------------------------------

env.allowLocalModels = false;
env.useBrowserCache = true;

// Configure local ORT WASM paths to avoid external jsdelivr requests
if (!env.backends) (env as any).backends = {};
if (!env.backends.onnx) (env as any).backends.onnx = {};
if (!env.backends.onnx.wasm) (env as any).backends.onnx.wasm = {};
(env.backends.onnx.wasm as any).wasmPaths = '/ort/';
(env.backends.onnx.wasm as any).proxy = false;

const DETECTOR_QUERIES = [
  'bottle',
  'can',
  'cardboard box',
  'jacket or cloth',
  'food scrap',
  'power bank',
  'phone',
  'earbuds case',
  'vape pen',
  'aerosol can',
  'battery',
  'remote control',
  'mouse',
  'charger',
  'electronic device',
];

const CLIP_PROMPTS = [
  'a recyclable item such as a plastic bottle, aluminum can, or cardboard',
  'a reusable item such as clean cloth, apparel, or intact durable ware',
  'a biodegradable organic item such as food scrap, peel, or garden compost',
  'a hazardous item such as a lithium battery, electronic vape, phone, or aerosol can',
  'a high risk lithium battery, power bank, or electronic device containing batteries',
];

// Pipeline singletons inside worker scope
let detectorPipeline: any = null;
let classifierPipeline: any = null;
let currentDevice = 'wasm';
let activeModelName = 'Xenova/owlvit-base-patch32';
let activeClipName = 'Xenova/clip-vit-base-patch32';

function createProgressCallback(modelLabel: string) {
  return (p: any) => {
    self.postMessage({
      type: 'PROGRESS',
      payload: {
        status: p.status || 'progress',
        task: modelLabel,
        file: p.file,
        progress: p.progress !== undefined ? Math.round(p.progress) : undefined,
        loaded: p.loaded,
        total: p.total,
      },
    });
  };
}

async function initPipelines(preferredDevice: 'webgpu' | 'wasm' = 'webgpu') {
  let deviceToUse = preferredDevice;
  if (preferredDevice === 'webgpu') {
    if (typeof navigator === 'undefined' || !(navigator as any).gpu) {
      deviceToUse = 'wasm';
    }
  }

  try {
    if (!detectorPipeline) {
      const progressCb = createProgressCallback('Loading detector (OWL-ViT)...');
      try {
        const dtype = deviceToUse === 'webgpu' ? 'fp32' : 'q8';
        detectorPipeline = await pipeline('zero-shot-object-detection', 'Xenova/owlvit-base-patch32', {
          device: deviceToUse as any,
          dtype: dtype as any,
          progress_callback: progressCb,
        });
        currentDevice = deviceToUse;
        activeModelName = 'Xenova/owlvit-base-patch32';
      } catch (gpuErr) {
        console.warn('WebGPU init failed for OWL-ViT, falling back to WASM q8:', gpuErr);
        detectorPipeline = await pipeline('zero-shot-object-detection', 'Xenova/owlvit-base-patch32', {
          device: 'wasm',
          dtype: 'q8' as any,
          progress_callback: progressCb,
        });
        currentDevice = 'wasm';
        activeModelName = 'Xenova/owlvit-base-patch32';
      }
    }

    if (!classifierPipeline) {
      const progressCb = createProgressCallback('Loading classifier (CLIP)...');
      try {
        const dtype = currentDevice === 'webgpu' ? 'fp32' : 'q8';
        classifierPipeline = await pipeline('zero-shot-image-classification', 'Xenova/clip-vit-base-patch32', {
          device: currentDevice as any,
          dtype: dtype as any,
          progress_callback: progressCb,
        });
      } catch (clipErr) {
        console.warn('Classifier fallback to WASM q8:', clipErr);
        classifierPipeline = await pipeline('zero-shot-image-classification', 'Xenova/clip-vit-base-patch32', {
          device: 'wasm',
          dtype: 'q8' as any,
          progress_callback: progressCb,
        });
      }
    }

    self.postMessage({
      type: 'STATUS',
      status: 'ready',
      device: currentDevice,
      modelName: activeModelName,
      clipName: activeClipName,
    });
  } catch (err: any) {
    self.postMessage({
      type: 'STATUS',
      status: 'error',
      error: err?.message || String(err),
    });
  }
}

/**
 * Isolated Smoke Test for single model (CLIP only)
 */
async function smokeTestClip(
  imageBuffer?: ArrayBuffer,
  imageBlob?: Blob,
  width?: number,
  height?: number,
  channels: 1 | 2 | 3 | 4 = 4
) {
  const startTime = performance.now();
  try {
    let rawImage: RawImage;
    if (imageBuffer && width && height) {
      rawImage = new RawImage(new Uint8ClampedArray(imageBuffer), width, height, channels);
    } else if (imageBlob) {
      rawImage = await RawImage.fromBlob(imageBlob);
    } else {
      throw new Error('No valid image data buffer provided for smoke test.');
    }

    const loadStart = performance.now();
    const clipProgress = createProgressCallback('Loading isolated CLIP model...');
    const clip = await pipeline('zero-shot-image-classification', 'Xenova/clip-vit-base-patch32', {
      device: 'wasm',
      dtype: 'q8' as any,
      progress_callback: clipProgress,
    });
    const loadTimeMs = Math.round(performance.now() - loadStart);

    const inferStart = performance.now();
    const result = await clip(rawImage, CLIP_PROMPTS);
    const inferTimeMs = Math.round(performance.now() - inferStart);
    const totalTimeMs = Math.round(performance.now() - startTime);

    self.postMessage({
      type: 'SMOKE_CLIP_RESULT',
      result,
      loadTimeMs,
      inferTimeMs,
      totalTimeMs,
      device: 'wasm',
      model: 'Xenova/clip-vit-base-patch32',
    });
  } catch (err: any) {
    self.postMessage({
      type: 'SMOKE_CLIP_ERROR',
      error: err?.message || String(err),
    });
  }
}

async function analyze(
  imageBuffer: ArrayBuffer | undefined,
  imageBlob: Blob | undefined,
  imageDataUrl: string | undefined,
  imageWidth: number,
  imageHeight: number,
  scoreThreshold = 0.12,
  iouThreshold = 0.45,
  channels: 1 | 2 | 3 | 4 = 4
) {
  const startTime = performance.now();

  if (!detectorPipeline || !classifierPipeline) {
    await initPipelines();
  }

  // Construct RawImage without data: URL fetch
  let rawImage: RawImage;
  if (imageBuffer) {
    rawImage = new RawImage(new Uint8ClampedArray(imageBuffer), imageWidth, imageHeight, channels);
  } else if (imageBlob) {
    rawImage = await RawImage.fromBlob(imageBlob);
  } else if (imageDataUrl && !imageDataUrl.startsWith('data:')) {
    rawImage = await RawImage.fromURL(imageDataUrl);
  } else {
    throw new Error('Image data must be transferred as ArrayBuffer or Blob to prevent CSP data: violation.');
  }

  // 1. STAGE 1: Open-vocabulary detection with OWL-ViT
  const rawDetections = await detectorPipeline(rawImage, DETECTOR_QUERIES, {
    threshold: scoreThreshold,
  });

  const parsedProposals: RawDetectorResult[] = (rawDetections || []).map((d: any) => ({
    label: d.label,
    score: d.score,
    box: {
      xmin: d.box.xmin,
      ymin: d.box.ymin,
      xmax: d.box.xmax,
      ymax: d.box.ymax,
    },
  }));

  // Non-maximum suppression
  const nmsFiltered = nonMaxSuppression(parsedProposals, iouThreshold, scoreThreshold);

  // 2. STAGE 2: Crop each box and run CLIP zero-shot classification
  const results: NormalizedDetection[] = [];

  for (let i = 0; i < nmsFiltered.length; i++) {
    const det = nmsFiltered[i];
    const { xmin, ymin, xmax, ymax } = det.box;

    const normX = Math.max(0, Math.min(1, xmin / imageWidth));
    const normY = Math.max(0, Math.min(1, ymin / imageHeight));
    const normW = Math.max(0.01, Math.min(1 - normX, (xmax - xmin) / imageWidth));
    const normH = Math.max(0.01, Math.min(1 - normY, (ymax - ymin) / imageHeight));

    let clipProbs = {
      recyclable: 0.25,
      reusable: 0.25,
      biodegradable: 0.25,
      hazardous: 0.25,
      batteryRisk: 0.0,
    };

    let cropDataUrl: string | undefined = undefined;

    try {
      const cropped = await rawImage.crop([
        Math.round(xmin),
        Math.round(ymin),
        Math.round(xmax),
        Math.round(ymax),
      ]);

      cropDataUrl = cropped.toDataURL();
      const clipOutput = await classifierPipeline(cropped, CLIP_PROMPTS);

      if (Array.isArray(clipOutput)) {
        const findScore = (match: string) => {
          const item = clipOutput.find((o: any) => o.label.includes(match));
          return item ? item.score : 0;
        };

        const recScore = findScore('recyclable');
        const reuScore = findScore('reusable');
        const bioScore = findScore('biodegradable');
        const hazScore = findScore('hazardous');
        const batScore = findScore('lithium battery');

        const total4 = recScore + reuScore + bioScore + hazScore || 1;
        clipProbs = {
          recyclable: Number((recScore / total4).toFixed(4)),
          reusable: Number((reuScore / total4).toFixed(4)),
          biodegradable: Number((bioScore / total4).toFixed(4)),
          hazardous: Number((hazScore / total4).toFixed(4)),
          batteryRisk: Number(batScore.toFixed(4)),
        };
      }
    } catch (cropErr) {
      console.warn('Crop/classify error for box:', cropErr);
    }

    results.push({
      id: `cv-det-${i + 1}`,
      label: det.label,
      score: det.score,
      box: {
        x: normX,
        y: normY,
        width: normW,
        height: normH,
      },
      clipProbabilities: clipProbs,
      cropDataUrl,
      provenance: 'Model-inferred',
    });
  }

  const inferenceTimeMs = Math.round(performance.now() - startTime);

  self.postMessage({
    type: 'RESULT',
    detections: results,
    inferenceTimeMs,
    deviceUsed: currentDevice,
    modelName: activeModelName,
  });
}

self.addEventListener('message', async (e: MessageEvent) => {
  const { type } = e.data || {};

  if (type === 'INIT') {
    await initPipelines(e.data.preferredDevice);
  } else if (type === 'SMOKE_CLIP') {
    await smokeTestClip(
      e.data.imageBuffer,
      e.data.imageBlob,
      e.data.imageWidth,
      e.data.imageHeight,
      e.data.channels
    );
  } else if (type === 'ANALYZE') {
    try {
      await analyze(
        e.data.imageBuffer,
        e.data.imageBlob,
        e.data.imageDataUrl,
        e.data.imageWidth,
        e.data.imageHeight,
        e.data.detectorScoreThreshold,
        e.data.detectorIouThreshold,
        e.data.channels
      );
    } catch (err: any) {
      self.postMessage({
        type: 'ERROR',
        error: err?.message || String(err),
      });
    }
  }
});
