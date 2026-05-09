/**
 * imageToOutline — Converts an uploaded image into a coloring-book style outline
 *
 * Pipeline:
 *   1. Load image onto an offscreen canvas
 *   2. Convert to grayscale
 *   3. Apply Sobel edge detection (3×3 convolution kernels)
 *   4. Threshold & invert: edges → black, non-edges → transparent
 *   5. Return the result as a dataURL (PNG with transparency)
 *
 * The transparent background allows users to paint *behind* the outlines
 * using the Flood Fill tool perfectly.
 */

/**
 * Converts an image File or Blob into a black-outline-on-transparent dataURL.
 * 
 * @param file   - The user-uploaded image file
 * @param targetW - Target width to fit into (maintains aspect ratio)
 * @param targetH - Target height to fit into (maintains aspect ratio)
 * @param threshold - Edge sensitivity (0–255). Lower = more edges detected. Default 30.
 * @returns Promise resolving to a PNG dataURL string
 */
export function imageToOutline(
  file: File | Blob,
  targetW: number,
  targetH: number,
  threshold: number = 30
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);

      // ── 1. Fit image into target dimensions (preserve aspect ratio) ──
      const aspectRatio = img.width / img.height;
      let drawW = targetW;
      let drawH = targetH;

      if (aspectRatio > targetW / targetH) {
        // Image is wider
        drawH = Math.round(targetW / aspectRatio);
      } else {
        // Image is taller
        drawW = Math.round(targetH * aspectRatio);
      }

      // Center offset
      const offsetX = Math.round((targetW - drawW) / 2);
      const offsetY = Math.round((targetH - drawH) / 2);

      // ── 2. Draw image to offscreen canvas ──
      const canvas = document.createElement('canvas');
      canvas.width = targetW;
      canvas.height = targetH;
      const ctx = canvas.getContext('2d')!;

      // Fill with white first (so edge detection doesn't pick up image borders)
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, targetW, targetH);

      // Draw scaled image centered
      ctx.drawImage(img, offsetX, offsetY, drawW, drawH);

      // ── 3. Extract pixel data ──
      const imageData = ctx.getImageData(0, 0, targetW, targetH);
      const src = imageData.data;
      const w = targetW;
      const h = targetH;

      // ── 4. Convert to grayscale (in-place) ──
      const gray = new Float32Array(w * h);
      for (let i = 0; i < w * h; i++) {
        const idx = i * 4;
        // ITU-R BT.601 luma coefficients
        gray[i] = src[idx] * 0.299 + src[idx + 1] * 0.587 + src[idx + 2] * 0.114;
      }

      // ── 5. Sobel edge detection ──
      // Gx kernel:  [-1, 0, 1]    Gy kernel:  [-1, -2, -1]
      //             [-2, 0, 2]                 [ 0,  0,  0]
      //             [-1, 0, 1]                 [ 1,  2,  1]

      const edgeMagnitude = new Float32Array(w * h);

      for (let y = 1; y < h - 1; y++) {
        for (let x = 1; x < w - 1; x++) {
          const idx = y * w + x;

          // Top-left, top, top-right
          const tl = gray[(y - 1) * w + (x - 1)];
          const t  = gray[(y - 1) * w + x];
          const tr = gray[(y - 1) * w + (x + 1)];
          // Middle-left, middle-right
          const ml = gray[y * w + (x - 1)];
          const mr = gray[y * w + (x + 1)];
          // Bottom-left, bottom, bottom-right
          const bl = gray[(y + 1) * w + (x - 1)];
          const b  = gray[(y + 1) * w + x];
          const br = gray[(y + 1) * w + (x + 1)];

          // Horizontal gradient
          const gx = -tl + tr - 2 * ml + 2 * mr - bl + br;
          // Vertical gradient
          const gy = -tl - 2 * t - tr + bl + 2 * b + br;

          // Magnitude (approximation — avoids sqrt for performance)
          edgeMagnitude[idx] = Math.abs(gx) + Math.abs(gy);
        }
      }

      // ── 6. Threshold & write output ──
      // Edges → black with full opacity, non-edges → fully transparent
      const output = ctx.createImageData(w, h);
      const out = output.data;

      for (let i = 0; i < w * h; i++) {
        const idx = i * 4;
        if (edgeMagnitude[i] > threshold) {
          // Edge pixel → black
          out[idx] = 0;       // R
          out[idx + 1] = 0;   // G
          out[idx + 2] = 0;   // B
          out[idx + 3] = 255; // A (fully opaque)
        } else {
          // Non-edge → transparent
          out[idx] = 0;
          out[idx + 1] = 0;
          out[idx + 2] = 0;
          out[idx + 3] = 0;   // A (fully transparent)
        }
      }

      ctx.putImageData(output, 0, 0);

      // ── 7. Return as dataURL ──
      resolve(canvas.toDataURL('image/png'));
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image'));
    };

    img.src = url;
  });
}
