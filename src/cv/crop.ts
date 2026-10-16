/**
 * src/cv/crop.ts
 * Safe image cropping helper for Web Workers and Node/Vitest environments.
 * Uses OffscreenCanvas when available and pixel buffer slicing as deterministic fallback.
 * Strictly avoids toDataURL or data: URLs to prevent worker runtime exceptions.
 */

export interface CropBox {
  xmin: number;
  ymin: number;
  xmax: number;
  ymax: number;
}

export interface PixelBuffer {
  data: Uint8ClampedArray;
  width: number;
  height: number;
  channels: number;
}

/**
 * Pure byte-level crop on an interleaved pixel buffer (e.g. RGBA).
 * 100% deterministic, zero DOM dependencies, works in Worker, Node, and browser.
 */
export function cropPixelBuffer(
  sourceData: Uint8ClampedArray | Uint8Array,
  sourceWidth: number,
  sourceHeight: number,
  box: CropBox,
  channels: number = 4
): PixelBuffer {
  const xmin = Math.max(0, Math.min(sourceWidth - 1, Math.round(box.xmin)));
  const ymin = Math.max(0, Math.min(sourceHeight - 1, Math.round(box.ymin)));
  const xmax = Math.max(xmin, Math.min(sourceWidth - 1, Math.round(box.xmax)));
  const ymax = Math.max(ymin, Math.min(sourceHeight - 1, Math.round(box.ymax)));

  const cropWidth = Math.max(1, xmax - xmin + 1);
  const cropHeight = Math.max(1, ymax - ymin + 1);

  const out = new Uint8ClampedArray(cropWidth * cropHeight * channels);

  for (let row = 0; row < cropHeight; row++) {
    const srcY = ymin + row;
    if (srcY >= sourceHeight) break;
    const srcOffset = (srcY * sourceWidth + xmin) * channels;
    const dstOffset = row * cropWidth * channels;
    const rowBytes = cropWidth * channels;
    out.set(sourceData.subarray(srcOffset, srcOffset + rowBytes), dstOffset);
  }

  return {
    data: out,
    width: cropWidth,
    height: cropHeight,
    channels,
  };
}

/**
 * Crops using OffscreenCanvas if available, falling back to pure pixel buffer slicing.
 * Never calls toDataURL.
 */
export function cropWithOffscreenCanvasOrBuffer(
  sourceData: Uint8ClampedArray | Uint8Array,
  sourceWidth: number,
  sourceHeight: number,
  box: CropBox,
  channels: number = 4
): PixelBuffer {
  if (typeof OffscreenCanvas !== 'undefined') {
    try {
      const xmin = Math.max(0, Math.min(sourceWidth - 1, Math.round(box.xmin)));
      const ymin = Math.max(0, Math.min(sourceHeight - 1, Math.round(box.ymin)));
      const xmax = Math.max(xmin, Math.min(sourceWidth - 1, Math.round(box.xmax)));
      const ymax = Math.max(ymin, Math.min(sourceHeight - 1, Math.round(box.ymax)));
      const cropWidth = Math.max(1, xmax - xmin + 1);
      const cropHeight = Math.max(1, ymax - ymin + 1);

      const srcCanvas = new OffscreenCanvas(sourceWidth, sourceHeight);
      const srcCtx = srcCanvas.getContext('2d');
      if (srcCtx) {
        const clamped =
          sourceData instanceof Uint8ClampedArray
            ? sourceData
            : new Uint8ClampedArray(sourceData.buffer);
        const imgData = new ImageData(clamped as any, sourceWidth, sourceHeight);
        srcCtx.putImageData(imgData, 0, 0);

        const dstCanvas = new OffscreenCanvas(cropWidth, cropHeight);
        const dstCtx = dstCanvas.getContext('2d');
        if (dstCtx) {
          dstCtx.drawImage(
            srcCanvas,
            xmin,
            ymin,
            cropWidth,
            cropHeight,
            0,
            0,
            cropWidth,
            cropHeight
          );
          const croppedData = dstCtx.getImageData(0, 0, cropWidth, cropHeight);
          return {
            data: croppedData.data,
            width: cropWidth,
            height: cropHeight,
            channels: 4,
          };
        }
      }
    } catch {
      // Fall through to deterministic buffer slice
    }
  }

  return cropPixelBuffer(sourceData, sourceWidth, sourceHeight, box, channels);
}
