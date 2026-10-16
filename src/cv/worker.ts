/**
 * src/cv/worker.ts
 * Off-main-thread Web Worker executing @huggingface/transformers pipelines.
 *
 * PHASE 4D HARDENED ARCHITECTURE:
 * 1. Strict single-device lifecycle: NO retry inside a corrupted worker session.
 *    If WebGPU fails, post LOAD_FAILED and STOP. The main thread terminates this worker
 *    and spawns a fresh worker with device="wasm" only.
 * 2. Inference gating: detectorPipeline and classifierPipeline are stored ONLY after
 *    successful load. If load fails, analyze() immediately rejects and NEVER calls inference.
 * 3. Isolated smoke tests for /dev/cv-smoke:
 *    - CLIP alone (WASM q8)
 *    - OWL-ViT alone (WASM fp32 and q8)
 *    - DETR alone (Xenova/detr-resnet-50 fallback)
 *    - Full chain (Detector boxes + CLIP crop classification)
 */

import { pipeline, env, RawImage } from '@huggingface/transformers';
import type { RawDetectorResult, NormalizedDetection } from './types';
import { nonMaxSuppression } from './nms';

// ---------------------------------------------------------------------------
// 1. Diagnostics & CSP / Fetch Monitoring
// ---------------------------------------------------------------------------

self.addEventListener('securitypolicyviolation', (e: any) => {
  const detail = {
    blockedURI: e.blockedURI || 'unknown',
    violatedDirective: e.violatedDirective || 'unknown',
    effectiveDirective: e.effectiveDirective || 'unknown',
    statusCode: e.statusCode || 0,
  };
  console.error('[Worker CSP Violation]', detail);
  self.postMessage({ type: 'CSP_VIOLATION', payload: detail });
});

const originalFetch = self.fetch.bind(self);
self.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
  const start = performance.now();
  try {
    const response = await originalFetch(input, init);
    const duration = Math.round(performance.now() - start);
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
    console.error(`[Worker Fetch Error] ${url} after ${duration}ms:`, err?.message || err);
    self.postMessage({
      type: 'FETCH_ERROR',
      payload: { url, error: err?.message || String(err), duration },
    });
    throw err;
  }
};

// ---------------------------------------------------------------------------
// 2. Transformers.js / ONNX Runtime Environment
// ---------------------------------------------------------------------------

env.allowLocalModels = false;
env.useBrowserCache = true;

// Configure local ORT WASM paths
if (!env.backends) (env as any).backends = {};
if (!env.backends.onnx) (env as any).backends.onnx = {};
if (!env.backends.onnx.wasm) (env as any).backends.onnx.wasm = {};
(env.backends.onnx.wasm as any).wasmPaths = '/ort/';
(env.backends.onnx.wasm as any).proxy = false;

export const DETECTOR_QUERIES = [
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

export const CLIP_PROMPTS = [
  'a recyclable item such as a plastic bottle, aluminum can, or cardboard',
  'a reusable item such as clean cloth, apparel, or intact durable ware',
  'a biodegradable organic item such as food scrap, peel, or garden compost',
  'a hazardous item such as a lithium battery, electronic vape, phone, or aerosol can',
  'a high risk lithium battery, power bank, or electronic device containing batteries',
];

// ---------------------------------------------------------------------------
// 3. State Machine & Pipeline Instances
// ---------------------------------------------------------------------------

export type PipelineLoadStatus = 'idle' | 'loading' | 'ready' | 'failed';

let detectorPipeline: any = null;
let classifierPipeline: any = null;
let loadStatus: PipelineLoadStatus = 'idle';
let loadError: string | null = null;
let activeDevice: 'webgpu' | 'wasm' = 'wasm';
let activeDetectorModel = 'Xenova/detr-resnet-50';
let activeClipModel = 'Xenova/clip-vit-base-patch32';

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

/**
 * Initialize pipelines with strict single-device contract.
 * NEVER retry in a corrupted session inside the same worker.
 */
async function initPipelines(options?: {
  preferredDevice?: 'webgpu' | 'wasm';
  dtype?: 'fp32' | 'q8';
  detectorModel?: string;
  clipModel?: string;
}) {
  const device = options?.preferredDevice || 'wasm';
  const dtype = options?.dtype || (device === 'webgpu' ? 'fp32' : 'q8');
  const detectorModel = options?.detectorModel || 'Xenova/detr-resnet-50';
  const clipModel = options?.clipModel || 'Xenova/clip-vit-base-patch32';

  loadStatus = 'loading';
  loadError = null;
  detectorPipeline = null;
  classifierPipeline = null;
  activeDevice = device;
  activeDetectorModel = detectorModel;
  activeClipModel = clipModel;

  console.log(`[Worker] Initializing pipelines: device=${device}, dtype=${dtype}, detector=${detectorModel}, clip=${clipModel}`);

  try {
    // 1. Load Detector
    const isDetr = detectorModel.includes('detr');
    const detectorTask = isDetr ? 'object-detection' : 'zero-shot-object-detection';
    const detectorProgress = createProgressCallback(`Loading detector (${detectorModel.split('/')[1]})...`);

    const loadedDetector = await pipeline(detectorTask as any, detectorModel, {
      device: device as any,
      dtype: dtype as any,
      progress_callback: detectorProgress,
    });

    // 2. Load CLIP Classifier
    const clipProgress = createProgressCallback(`Loading classifier (${clipModel.split('/')[1]})...`);
    const loadedClassifier = await pipeline('zero-shot-image-classification', clipModel, {
      device: device as any,
      dtype: dtype as any,
      progress_callback: clipProgress,
    });

    // Store awaited instances ONLY after both succeed
    detectorPipeline = loadedDetector;
    classifierPipeline = loadedClassifier;
    loadStatus = 'ready';
    loadError = null;

    self.postMessage({
      type: 'STATUS',
      status: 'ready',
      device,
      modelName: detectorModel,
      clipName: clipModel,
    });
  } catch (err: any) {
    const errorMsg = err?.message || String(err);
    console.error(`[Worker] Pipeline loading failed for ${device}:`, errorMsg);

    // Hard fail state: never attempt inference
    detectorPipeline = null;
    classifierPipeline = null;
    loadStatus = 'failed';
    loadError = errorMsg;

    self.postMessage({
      type: 'LOAD_FAILED',
      error: errorMsg,
      device,
      detectorModel,
    });
  }
}

// ---------------------------------------------------------------------------
// 4. Isolated Smoke Tests for Diagnostics
// ---------------------------------------------------------------------------

async function getRawImageFromPayload(
  imageBuffer?: ArrayBuffer,
  imageBlob?: Blob,
  width?: number,
  height?: number,
  channels: 1 | 2 | 3 | 4 = 4
): Promise<RawImage> {
  if (imageBuffer && width && height) {
    return new RawImage(new Uint8ClampedArray(imageBuffer), width, height, channels);
  }
  if (imageBlob) {
    return await RawImage.fromBlob(imageBlob);
  }
  throw new Error('Image data missing from smoke test payload.');
}

async function smokeTestClip(imageBuffer?: ArrayBuffer, imageBlob?: Blob, width?: number, height?: number) {
  const startTime = performance.now();
  try {
    const rawImage = await getRawImageFromPayload(imageBuffer, imageBlob, width, height);
    const loadStart = performance.now();
    const clip = await pipeline('zero-shot-image-classification', 'Xenova/clip-vit-base-patch32', {
      device: 'wasm',
      dtype: 'q8' as any,
      progress_callback: createProgressCallback('Loading isolated CLIP...'),
    });
    const loadTimeMs = Math.round(performance.now() - loadStart);

    const inferStart = performance.now();
    const result = await clip(rawImage, CLIP_PROMPTS);
    const inferTimeMs = Math.round(performance.now() - inferStart);
    const totalTimeMs = Math.round(performance.now() - startTime);

    self.postMessage({
      type: 'SMOKE_RESULT',
      test: 'CLIP_ALONE',
      model: 'Xenova/clip-vit-base-patch32',
      device: 'wasm',
      dtype: 'q8',
      loadTimeMs,
      inferTimeMs,
      totalTimeMs,
      result,
    });
  } catch (err: any) {
    self.postMessage({
      type: 'SMOKE_ERROR',
      test: 'CLIP_ALONE',
      error: err?.message || String(err),
    });
  }
}

async function smokeTestDetector(
  modelName: 'Xenova/detr-resnet-50',
  dtype: 'fp32' | 'q8',
  device: 'wasm' | 'webgpu',
  imageBuffer?: ArrayBuffer,
  imageBlob?: Blob,
  width?: number,
  height?: number
) {
  const startTime = performance.now();
  try {
    const rawImage = await getRawImageFromPayload(imageBuffer, imageBlob, width, height);
    const isDetr = modelName.includes('detr');
    const task = isDetr ? 'object-detection' : 'zero-shot-object-detection';

    const loadStart = performance.now();
    const det = await pipeline(task as any, modelName, {
      device: device as any,
      dtype: dtype as any,
      progress_callback: createProgressCallback(`Loading ${modelName} (${dtype})...`),
    });
    const loadTimeMs = Math.round(performance.now() - loadStart);

    const inferStart = performance.now();
    let rawOutput: any;
    if (isDetr) {
      rawOutput = await det(rawImage, { threshold: 0.15 });
    } else {
      rawOutput = await det(rawImage, DETECTOR_QUERIES, { threshold: 0.12 });
    }
    const inferTimeMs = Math.round(performance.now() - inferStart);
    const totalTimeMs = Math.round(performance.now() - startTime);

    self.postMessage({
      type: 'SMOKE_RESULT',
      test: `${modelName}_${dtype}`,
      model: modelName,
      device,
      dtype,
      loadTimeMs,
      inferTimeMs,
      totalTimeMs,
      result: rawOutput,
    });
  } catch (err: any) {
    self.postMessage({
      type: 'SMOKE_ERROR',
      test: `${modelName}_${dtype}`,
      error: err?.message || String(err),
    });
  }
}

// ---------------------------------------------------------------------------
// 5. Full Real Inference Execution
// ---------------------------------------------------------------------------

async function analyze(
  imageBuffer: ArrayBuffer | undefined,
  imageBlob: Blob | undefined,
  imageWidth: number,
  imageHeight: number,
  scoreThreshold = 0.12,
  iouThreshold = 0.45,
  channels: 1 | 2 | 3 | 4 = 4
) {
  // STRICT HONESTY CHECK: If loading failed or is not ready, NEVER call inference
  if (loadStatus === 'failed') {
    self.postMessage({
      type: 'ERROR',
      error: `Inference blocked: Model loading previously failed. Reason: ${loadError || 'Unknown load error'}.`,
    });
    return;
  }

  if (loadStatus !== 'ready' || !detectorPipeline || !classifierPipeline) {
    self.postMessage({
      type: 'ERROR',
      error: 'Inference blocked: Pipelines are not ready or uninitialized.',
    });
    return;
  }

  const startTime = performance.now();

  let rawImage: RawImage;
  if (imageBuffer) {
    rawImage = new RawImage(new Uint8ClampedArray(imageBuffer), imageWidth, imageHeight, channels);
  } else if (imageBlob) {
    rawImage = await RawImage.fromBlob(imageBlob);
  } else {
    self.postMessage({
      type: 'ERROR',
      error: 'Image data must be transferred as ArrayBuffer or Blob to prevent CSP data: violation.',
    });
    return;
  }

  try {
    // 1. Stage 1: Object detection
    let rawDetections: any[] = [];
    const isDetr = activeDetectorModel.includes('detr');

    if (isDetr) {
      rawDetections = (await detectorPipeline(rawImage, { threshold: scoreThreshold })) || [];
    } else {
      rawDetections = (await detectorPipeline(rawImage, DETECTOR_QUERIES, { threshold: scoreThreshold })) || [];
    }

    const parsedProposals: RawDetectorResult[] = rawDetections.map((d: any) => ({
      label: d.label,
      score: d.score,
      box: {
        xmin: d.box.xmin,
        ymin: d.box.ymin,
        xmax: d.box.xmax,
        ymax: d.box.ymax,
      },
    }));

    const nmsFiltered = nonMaxSuppression(parsedProposals, iouThreshold, scoreThreshold);

    // 2. Stage 2: Crop each box and run CLIP zero-shot classification
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
          Math.max(0, Math.round(xmin)),
          Math.max(0, Math.round(ymin)),
          Math.min(imageWidth, Math.round(xmax)),
          Math.min(imageHeight, Math.round(ymax)),
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
      deviceUsed: activeDevice,
      modelName: activeDetectorModel,
    });
  } catch (inferErr: any) {
    self.postMessage({
      type: 'ERROR',
      error: `Model inference execution failed: ${inferErr?.message || inferErr}`,
    });
  }
}

// ---------------------------------------------------------------------------
// 6. Message Dispatcher
// ---------------------------------------------------------------------------

self.addEventListener('message', async (e: MessageEvent) => {
  const { type } = e.data || {};

  if (type === 'INIT') {
    await initPipelines({
      preferredDevice: e.data.preferredDevice,
      dtype: e.data.dtype,
      detectorModel: e.data.detectorModel,
      clipModel: e.data.clipModel,
    });
  } else if (type === 'SMOKE_CLIP') {
    await smokeTestClip(
      e.data.imageBuffer,
      e.data.imageBlob,
      e.data.imageWidth,
      e.data.imageHeight
    );
  } else if (type === 'SMOKE_DETECTOR') {
    await smokeTestDetector(
      e.data.modelName,
      e.data.dtype,
      e.data.device,
      e.data.imageBuffer,
      e.data.imageBlob,
      e.data.imageWidth,
      e.data.imageHeight
    );
  } else if (type === 'ANALYZE') {
    await analyze(
      e.data.imageBuffer,
      e.data.imageBlob,
      e.data.imageWidth,
      e.data.imageHeight,
      e.data.detectorScoreThreshold,
      e.data.detectorIouThreshold,
      e.data.channels
    );
  }
});
