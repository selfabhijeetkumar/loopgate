/**
 * src/cv/types.ts
 * Types for the in-browser computer vision pipeline.
 */

import type { BoundingBox, Item, Provenance } from '@/domain/types';

export interface RawBox {
  xmin: number;
  ymin: number;
  xmax: number;
  ymax: number;
}

export interface RawDetectorResult {
  score: number;
  label: string;
  box: RawBox;
}

export interface NormalizedDetection {
  id: string;
  label: string;
  score: number;
  box: BoundingBox; // x, y, width, height in [0, 1]
  clipProbabilities?: {
    recyclable: number;
    reusable: number;
    biodegradable: number;
    hazardous: number;
    batteryRisk: number;
  };
  cropDataUrl?: string;
  provenance: Provenance;
}

export interface WorkerProgressPayload {
  status: 'progress' | 'done' | 'ready' | 'cached' | 'error';
  task?: string;
  file?: string;
  progress?: number;
  loaded?: number;
  total?: number;
}

export type WorkerInMessage =
  | { type: 'INIT'; preferredDevice?: 'webgpu' | 'wasm' }
  | {
      type: 'ANALYZE';
      imageDataUrl: string;
      imageWidth: number;
      imageHeight: number;
      detectorScoreThreshold?: number;
      detectorIouThreshold?: number;
    };

export type WorkerOutMessage =
  | { type: 'STATUS'; status: 'ready' | 'loading' | 'error'; device?: string; error?: string }
  | { type: 'PROGRESS'; payload: WorkerProgressPayload }
  | {
      type: 'RESULT';
      detections: NormalizedDetection[];
      inferenceTimeMs: number;
      deviceUsed: string;
      modelName: string;
    }
  | { type: 'ERROR'; error: string };

export interface PipelineAnalysisResult {
  items: Item[];
  detections: NormalizedDetection[];
  inferenceTimeMs: number;
  deviceUsed: string;
  modelName: string;
  imageDimensions: { width: number; height: number };
}
