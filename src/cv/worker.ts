/**
 * src/cv/worker.ts
 * Web Worker executing @huggingface/transformers pipelines off the main thread.
 * WebGPU preferred with automatic WASM fallback.
 */

import { pipeline, env, RawImage } from '@huggingface/transformers';
import type { RawBox, RawDetectorResult, NormalizedDetection } from './types';
import { nonMaxSuppression } from './nms';

// Configuration: Allow remote models from Hugging Face CDN, browser Cache API enabled
env.allowLocalModels = false;
env.useBrowserCache = true;

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

// Pipelines cache
let detectorPipeline: any = null;
let classifierPipeline: any = null;
let currentDevice = 'wasm';
let activeModelName = 'Xenova/owlvit-base-patch32';

async function initPipelines(preferredDevice: 'webgpu' | 'wasm' = 'webgpu') {
  // Test WebGPU availability
  let deviceToUse = preferredDevice;
  if (preferredDevice === 'webgpu') {
    if (typeof navigator === 'undefined' || !(navigator as any).gpu) {
      deviceToUse = 'wasm';
    }
  }

  const progressCallback = (p: any) => {
    self.postMessage({
      type: 'PROGRESS',
      payload: {
        status: p.status || 'progress',
        file: p.file,
        progress: p.progress !== undefined ? Math.round(p.progress) : undefined,
        loaded: p.loaded,
        total: p.total,
      },
    });
  };

  try {
    if (!detectorPipeline) {
      self.postMessage({
        type: 'PROGRESS',
        payload: { status: 'progress', task: 'Loading open-vocabulary detector (OWL-ViT)...' },
      });

      try {
        detectorPipeline = await pipeline('zero-shot-object-detection', 'Xenova/owlvit-base-patch32', {
          device: deviceToUse as any,
          progress_callback: progressCallback,
        });
        currentDevice = deviceToUse;
        activeModelName = 'Xenova/owlvit-base-patch32';
      } catch (gpuErr) {
        console.warn('WebGPU init failed for OWL-ViT, falling back to WASM:', gpuErr);
        detectorPipeline = await pipeline('zero-shot-object-detection', 'Xenova/owlvit-base-patch32', {
          device: 'wasm',
          progress_callback: progressCallback,
        });
        currentDevice = 'wasm';
        activeModelName = 'Xenova/owlvit-base-patch32';
      }
    }

    if (!classifierPipeline) {
      self.postMessage({
        type: 'PROGRESS',
        payload: { status: 'progress', task: 'Loading zero-shot classifier (CLIP)...' },
      });

      try {
        classifierPipeline = await pipeline('zero-shot-image-classification', 'Xenova/clip-vit-base-patch32', {
          device: currentDevice as any,
          progress_callback: progressCallback,
        });
      } catch (clipErr) {
        console.warn('Classifier fallback to wasm:', clipErr);
        classifierPipeline = await pipeline('zero-shot-image-classification', 'Xenova/clip-vit-base-patch32', {
          device: 'wasm',
          progress_callback: progressCallback,
        });
      }
    }

    self.postMessage({
      type: 'STATUS',
      status: 'ready',
      device: currentDevice,
    });
  } catch (err: any) {
    self.postMessage({
      type: 'STATUS',
      status: 'error',
      error: err?.message || String(err),
    });
  }
}

async function analyze(
  imageDataUrl: string,
  imageWidth: number,
  imageHeight: number,
  scoreThreshold = 0.12,
  iouThreshold = 0.45
) {
  const startTime = performance.now();

  if (!detectorPipeline || !classifierPipeline) {
    await initPipelines();
  }

  // Load raw image
  const rawImage = await RawImage.fromURL(imageDataUrl);

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

    // Normalized coordinates
    const normX = Math.max(0, Math.min(1, xmin / imageWidth));
    const normY = Math.max(0, Math.min(1, ymin / imageHeight));
    const normW = Math.max(0.01, Math.min(1 - normX, (xmax - xmin) / imageWidth));
    const normH = Math.max(0.01, Math.min(1 - normY, (ymax - ymin) / imageHeight));

    // Crop box from rawImage
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

      // Convert crop to data URL for belt tile texture in 3D twin
      cropDataUrl = cropped.toDataURL();

      // Zero-shot CLIP classification on cropped tile
      const clipOutput = await classifierPipeline(cropped, CLIP_PROMPTS);

      if (Array.isArray(clipOutput)) {
        // Find probabilities by prompt label
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
  } else if (type === 'ANALYZE') {
    try {
      await analyze(
        e.data.imageDataUrl,
        e.data.imageWidth,
        e.data.imageHeight,
        e.data.detectorScoreThreshold,
        e.data.detectorIouThreshold
      );
    } catch (err: any) {
      self.postMessage({
        type: 'ERROR',
        error: err?.message || String(err),
      });
    }
  }
});
