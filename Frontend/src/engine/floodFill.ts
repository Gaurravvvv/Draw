export function hexToRgba(hex: string): [number, number, number, number] {
  // Support #RRGGBB
  let r = 0, g = 0, b = 0, a = 255;
  if (hex.startsWith('#')) hex = hex.slice(1);
  if (hex.length === 6) {
    r = parseInt(hex.slice(0, 2), 16);
    g = parseInt(hex.slice(2, 4), 16);
    b = parseInt(hex.slice(4, 6), 16);
  } else if (hex.length === 8) {
    r = parseInt(hex.slice(0, 2), 16);
    g = parseInt(hex.slice(2, 4), 16);
    b = parseInt(hex.slice(4, 6), 16);
    a = parseInt(hex.slice(6, 8), 16);
  }
  return [r, g, b, a];
}

function colorDistance(r1: number, g1: number, b1: number, a1: number, r2: number, g2: number, b2: number, a2: number): number {
  return Math.abs(r1 - r2) + Math.abs(g1 - g2) + Math.abs(b1 - b2) + Math.abs(a1 - a2);
}

/**
 * High-performance Flood Fill using a Uint32Array stack-based linear scanline approach.
 * Modifies the imageData.data directly.
 * 
 * @param ctx The CanvasRenderingContext2D of the main canvas
 * @param x Start X coordinate
 * @param y Start Y coordinate
 * @param fillColorHex Hex color string (e.g. "#FF0000")
 * @param tolerance Color matching tolerance (0-255 * 4 approx)
 */
export function executeFloodFill(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  fillColorHex: string,
  tolerance: number = 30
) {
  const dpr = window.devicePixelRatio || 1;
  x = Math.round(x * dpr);
  y = Math.round(y * dpr);

  const canvasWidth = ctx.canvas.width;
  const canvasHeight = ctx.canvas.height;

  if (x < 0 || x >= canvasWidth || y < 0 || y >= canvasHeight) return;

  const imageData = ctx.getImageData(0, 0, canvasWidth, canvasHeight);
  const data = imageData.data;
  const buf32 = new Uint32Array(data.buffer);
  
  // Calculate Target Color
  const [fillR, fillG, fillB, fillA] = hexToRgba(fillColorHex);
  // Endianness check to form a 32-bit uint out of RGBA.
  // Little-endian system (most common) is ABGR. Big-endian is RGBA.
  const isLittleEndian = new Uint8Array(new Uint32Array([0x12345678]).buffer)[0] === 0x78;
  const fillUint32 = isLittleEndian 
    ? (fillA << 24) | (fillB << 16) | (fillG << 8) | fillR
    : (fillR << 24) | (fillG << 16) | (fillB << 8) | fillA;

  const startIndex = y * canvasWidth + x;
  const startR = data[startIndex * 4];
  const startG = data[startIndex * 4 + 1];
  const startB = data[startIndex * 4 + 2];
  const startA = data[startIndex * 4 + 3];

  // If the target pixel is already within tolerance of the fill color, do nothing.
  if (colorDistance(startR, startG, startB, startA, fillR, fillG, fillB, fillA) <= tolerance) {
    return;
  }

  function matchesStartColor(pixelIndex: number) {
    const idx = pixelIndex * 4;
    const r = data[idx];
    const g = data[idx + 1];
    const b = data[idx + 2];
    const a = data[idx + 3];
    return colorDistance(r, g, b, a, startR, startG, startB, startA) <= tolerance;
  }

  // Linear scanline flood fill stack
  // Stack stores [x, y]
  const stack: number[] = [x, y];

  while (stack.length > 0) {
    let currY = stack.pop()!;
    let currX = stack.pop()!;

    let currentIdx = currY * canvasWidth + currX;

    // Move left to find the edge of the fillable region
    while (currX >= 0 && matchesStartColor(currentIdx)) {
      currX--;
      currentIdx--;
    }
    
    // We went one pixel too far to the left
    currX++;
    currentIdx++;

    let spanAbove = false;
    let spanBelow = false;

    // Scan right until we hit a boundary
    while (currX < canvasWidth && matchesStartColor(currentIdx)) {
      // Fill current pixel using 32-bit assignment for performance
      buf32[currentIdx] = fillUint32;

      // Check pixel above
      if (currY > 0) {
        if (!spanAbove && matchesStartColor(currentIdx - canvasWidth)) {
          stack.push(currX, currY - 1);
          spanAbove = true;
        } else if (spanAbove && !matchesStartColor(currentIdx - canvasWidth)) {
          spanAbove = false;
        }
      }

      // Check pixel below
      if (currY < canvasHeight - 1) {
        if (!spanBelow && matchesStartColor(currentIdx + canvasWidth)) {
          stack.push(currX, currY + 1);
          spanBelow = true;
        } else if (spanBelow && !matchesStartColor(currentIdx + canvasWidth)) {
          spanBelow = false;
        }
      }

      currX++;
      currentIdx++;
    }
  }

  ctx.putImageData(imageData, 0, 0);
}
