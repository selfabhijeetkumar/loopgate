/**
 * src/cv/nms.ts
 * Deterministic Non-Maximum Suppression (NMS) for bounding box deduplication.
 */

import type { RawBox, RawDetectorResult } from './types';

/**
 * Computes Intersection over Union (IoU) between two bounding boxes.
 */
export function calculateIoU(boxA: RawBox, boxB: RawBox): number {
  const xA = Math.max(boxA.xmin, boxB.xmin);
  const yA = Math.max(boxA.ymin, boxB.ymin);
  const xB = Math.min(boxA.xmax, boxB.xmax);
  const yB = Math.min(boxA.ymax, boxB.ymax);

  const intersectionArea = Math.max(0, xB - xA) * Math.max(0, yB - yA);
  if (intersectionArea <= 0) return 0;

  const boxAArea = Math.max(0, boxA.xmax - boxA.xmin) * Math.max(0, boxA.ymax - boxA.ymin);
  const boxBArea = Math.max(0, boxB.xmax - boxB.xmin) * Math.max(0, boxB.ymax - boxB.ymin);

  const unionArea = boxAArea + boxBArea - intersectionArea;
  if (unionArea <= 0) return 0;

  return intersectionArea / unionArea;
}

/**
 * Applies Non-Maximum Suppression to detector proposals.
 * Filters by score threshold, sorts descending by score, and eliminates
 * overlapping boxes that exceed the IoU threshold.
 */
export function nonMaxSuppression(
  proposals: RawDetectorResult[],
  iouThreshold = 0.45,
  scoreThreshold = 0.12
): RawDetectorResult[] {
  // 1. Filter out low score predictions
  const filtered = proposals.filter((p) => p.score >= scoreThreshold && p.box);

  // 2. Sort descending by score
  const sorted = [...filtered].sort((a, b) => b.score - a.score);

  const selected: RawDetectorResult[] = [];
  const suppressed = new Set<number>();

  for (let i = 0; i < sorted.length; i++) {
    if (suppressed.has(i)) continue;

    const current = sorted[i];
    selected.push(current);

    // Suppress remaining boxes that significantly overlap with current
    for (let j = i + 1; j < sorted.length; j++) {
      if (suppressed.has(j)) continue;

      const candidate = sorted[j];
      const iou = calculateIoU(current.box, candidate.box);

      if (iou >= iouThreshold) {
        suppressed.add(j);
      }
    }
  }

  return selected;
}
