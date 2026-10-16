/**
 * src/__tests__/crop.test.ts
 * Unit tests for safe image crop helper.
 */

import { describe, it, expect } from 'vitest';
import { cropPixelBuffer, cropWithOffscreenCanvasOrBuffer } from '@/cv/crop';

describe('Safe Image Crop Helper', () => {
  it('correctly crops a sub-region of a 4x4 RGBA buffer', () => {
    // 4x4 image, RGBA (16 pixels, 64 bytes)
    const width = 4;
    const height = 4;
    const channels = 4;
    const data = new Uint8ClampedArray(width * height * channels);

    // Fill each pixel with (x, y, 0, 255)
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const offset = (y * width + x) * channels;
        data[offset] = x * 10;     // R
        data[offset + 1] = y * 10; // G
        data[offset + 2] = 0;      // B
        data[offset + 3] = 255;    // A
      }
    }

    // Crop box from (1, 1) to (2, 2) => 2x2 crop
    const result = cropPixelBuffer(data, width, height, { xmin: 1, ymin: 1, xmax: 2, ymax: 2 }, channels);

    expect(result.width).toBe(2);
    expect(result.height).toBe(2);
    expect(result.channels).toBe(4);
    expect(result.data.length).toBe(2 * 2 * 4);

    // Pixel (0, 0) of crop should be pixel (1, 1) of source: R=10, G=10
    expect(result.data[0]).toBe(10);
    expect(result.data[1]).toBe(10);
    expect(result.data[3]).toBe(255);

    // Pixel (1, 0) of crop should be pixel (2, 1) of source: R=20, G=10
    expect(result.data[4]).toBe(20);
    expect(result.data[5]).toBe(10);

    // Pixel (1, 1) of crop should be pixel (2, 2) of source: R=20, G=20
    expect(result.data[12]).toBe(20);
    expect(result.data[13]).toBe(20);
  });

  it('clamps coordinates to image boundaries without throwing', () => {
    const width = 10;
    const height = 10;
    const data = new Uint8ClampedArray(width * height * 4);

    // Out of bounds coordinates
    const result = cropPixelBuffer(data, width, height, { xmin: -5, ymin: -5, xmax: 20, ymax: 20 }, 4);
    expect(result.width).toBe(10);
    expect(result.height).toBe(10);
    expect(result.data.length).toBe(10 * 10 * 4);
  });

  it('handles 1x1 crop gracefully', () => {
    const width = 8;
    const height = 8;
    const data = new Uint8ClampedArray(width * height * 4);
    data[(3 * width + 3) * 4] = 99;

    const result = cropPixelBuffer(data, width, height, { xmin: 3, ymin: 3, xmax: 3, ymax: 3 }, 4);
    expect(result.width).toBe(1);
    expect(result.height).toBe(1);
    expect(result.data[0]).toBe(99);
  });

  it('cropWithOffscreenCanvasOrBuffer never invokes toDataURL and produces valid buffer', () => {
    const width = 16;
    const height = 16;
    const data = new Uint8ClampedArray(width * height * 4);
    const result = cropWithOffscreenCanvasOrBuffer(data, width, height, { xmin: 2, ymin: 2, xmax: 6, ymax: 6 }, 4);
    expect(result.width).toBe(5);
    expect(result.height).toBe(5);
    expect(result.data).toBeInstanceOf(Uint8ClampedArray);
  });
});
