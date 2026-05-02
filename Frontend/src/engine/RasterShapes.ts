/**
 * RasterShapes — Geometric shape drawing for raw HTML5 Canvas 2D
 *
 * All shapes are drawn using the native Canvas 2D API.
 * Shapes are rendered on the draft canvas during drag, then baked
 * to the main canvas on pointerup.
 */

// ─── Star Polygon Helpers ─────────────────────────────────────────────────────

function starPoints(cx: number, cy: number, outerR: number, innerR: number, spikes: number): Array<{ x: number; y: number }> {
  const pts: Array<{ x: number; y: number }> = [];
  const step = Math.PI / spikes;
  let angle = -Math.PI / 2; // Start from top

  for (let i = 0; i < spikes * 2; i++) {
    const r = i % 2 === 0 ? outerR : innerR;
    pts.push({ x: cx + Math.cos(angle) * r, y: cy + Math.sin(angle) * r });
    angle += step;
  }
  return pts;
}

function hexagonPoints(cx: number, cy: number, rx: number, ry: number): Array<{ x: number; y: number }> {
  const pts: Array<{ x: number; y: number }> = [];
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 3) * i - Math.PI / 2;
    pts.push({ x: cx + Math.cos(angle) * rx, y: cy + Math.sin(angle) * ry });
  }
  return pts;
}

// ─── Shape Kinds ──────────────────────────────────────────────────────────────

export type ShapeKind = 'rectangle' | 'ellipse' | 'triangle' | 'diamond' | 'star' | 'hexagon' | 'arrow';

// ─── Main Drawing Function ────────────────────────────────────────────────────

/**
 * Draw a shape outline onto a Canvas 2D context.
 * 
 * @param ctx   - The canvas context to draw on
 * @param kind  - Which shape to draw
 * @param x     - Left edge of bounding box
 * @param y     - Top edge of bounding box
 * @param w     - Width of bounding box
 * @param h     - Height of bounding box
 * @param color - Stroke color (CSS)
 * @param lineWidth - Stroke width in px
 */
export function drawShape(
  ctx: CanvasRenderingContext2D,
  kind: ShapeKind,
  x: number,
  y: number,
  w: number,
  h: number,
  color: string,
  lineWidth: number,
): void {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();

  const cx = x + w / 2;
  const cy = y + h / 2;

  switch (kind) {
    case 'rectangle':
      ctx.rect(x, y, w, h);
      break;

    case 'ellipse':
      ctx.ellipse(cx, cy, Math.abs(w / 2), Math.abs(h / 2), 0, 0, Math.PI * 2);
      break;

    case 'triangle':
      ctx.moveTo(cx, y);
      ctx.lineTo(x + w, y + h);
      ctx.lineTo(x, y + h);
      ctx.closePath();
      break;

    case 'diamond':
      ctx.moveTo(cx, y);
      ctx.lineTo(x + w, cy);
      ctx.lineTo(cx, y + h);
      ctx.lineTo(x, cy);
      ctx.closePath();
      break;

    case 'star': {
      const outerR = Math.min(Math.abs(w), Math.abs(h)) / 2;
      const innerR = outerR * 0.4;
      const pts = starPoints(cx, cy, outerR, innerR, 5);
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) {
        ctx.lineTo(pts[i].x, pts[i].y);
      }
      ctx.closePath();
      break;
    }

    case 'hexagon': {
      const rx = Math.abs(w) / 2;
      const ry = Math.abs(h) / 2;
      const pts = hexagonPoints(cx, cy, rx, ry);
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) {
        ctx.lineTo(pts[i].x, pts[i].y);
      }
      ctx.closePath();
      break;
    }

    case 'arrow': {
      // Arrow pointing right, scaled to bounding box
      const aw = Math.abs(w);
      const ah = Math.abs(h);
      // Arrow body is 60% width, head is 40% width
      const bodyW = aw * 0.6;
      const bodyH = ah * 0.3;
      const bodyTop = y + (h - bodyH) / 2;

      ctx.moveTo(x, bodyTop);
      ctx.lineTo(x + bodyW, bodyTop);
      ctx.lineTo(x + bodyW, y);
      ctx.lineTo(x + aw, cy);
      ctx.lineTo(x + bodyW, y + ah);
      ctx.lineTo(x + bodyW, bodyTop + bodyH);
      ctx.lineTo(x, bodyTop + bodyH);
      ctx.closePath();
      break;
    }
  }

  ctx.stroke();
  ctx.restore();
}
