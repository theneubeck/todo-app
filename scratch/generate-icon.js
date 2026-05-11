// scratch/generate-icon.js
//
// One-off generator for assets/icon.png. Produces a 1024x1024 RGBA PNG
// with a centered black rounded square and a white checkmark, per
// DESIGN.md color tokens (primary #000000, on-primary #ffffff).
//
// Pure JS, no native deps. Uses Node's zlib for the PNG IDAT deflate.
// Run with: node scratch/generate-icon.js
//
// This is throwaway tooling — the committed artifact is assets/icon.png.

const fs = require('fs')
const path = require('path')
const zlib = require('zlib')

const SIZE = 1024

// Layout per plan.md "Visual treatment":
//   ~824x824 centered square (~100px margin), corner radius ~180px.
//   White checkmark stroke ~80px, occupies ~50% of square.
const MARGIN = 100
const SQUARE = SIZE - 2 * MARGIN // 824
const RADIUS = 180
const SQ_X0 = MARGIN
const SQ_Y0 = MARGIN
const SQ_X1 = MARGIN + SQUARE
const SQ_Y1 = MARGIN + SQUARE

// Checkmark: 3-point polyline (left-bottom, mid-bottom, right-top), centered.
// The square's center is at (SIZE/2, SIZE/2) = (512, 512).
// We choose check vertices so the glyph occupies ~50% of the square.
const CHECK_STROKE = 80
const CX = SIZE / 2
const CY = SIZE / 2
const CHECK_HALF_W = SQUARE * 0.28 // ~230px → total width ~460px (~56% of square)
const CHECK_PIVOT_X = CX - SQUARE * 0.04 // pivot slightly left of center
const CHECK_PIVOT_Y = CY + SQUARE * 0.12 // pivot below center (bottom of V)
const P1 = { x: CHECK_PIVOT_X - CHECK_HALF_W * 0.7, y: CHECK_PIVOT_Y - CHECK_HALF_W * 0.45 }
const P2 = { x: CHECK_PIVOT_X, y: CHECK_PIVOT_Y }
const P3 = { x: CHECK_PIVOT_X + CHECK_HALF_W, y: CHECK_PIVOT_Y - CHECK_HALF_W }

function inRoundedSquare(x, y) {
  if (x < SQ_X0 || x >= SQ_X1 || y < SQ_Y0 || y >= SQ_Y1) return false
  // Check the four rounded corners.
  const corners = [
    { cx: SQ_X0 + RADIUS, cy: SQ_Y0 + RADIUS, qx0: SQ_X0, qy0: SQ_Y0 },
    { cx: SQ_X1 - RADIUS, cy: SQ_Y0 + RADIUS, qx0: SQ_X1 - RADIUS, qy0: SQ_Y0, flipX: true },
    { cx: SQ_X0 + RADIUS, cy: SQ_Y1 - RADIUS, qx0: SQ_X0, qy0: SQ_Y1 - RADIUS, flipY: true },
    { cx: SQ_X1 - RADIUS, cy: SQ_Y1 - RADIUS, qx0: SQ_X1 - RADIUS, qy0: SQ_Y1 - RADIUS, flipX: true, flipY: true },
  ]
  for (const c of corners) {
    const inXRange = c.flipX ? x >= c.cx : x < c.cx
    const inYRange = c.flipY ? y >= c.cy : y < c.cy
    if (inXRange && inYRange) {
      const dx = x - c.cx
      const dy = y - c.cy
      return dx * dx + dy * dy <= RADIUS * RADIUS
    }
  }
  return true
}

function distToSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax
  const dy = by - ay
  const len2 = dx * dx + dy * dy
  if (len2 === 0) {
    const ex = px - ax
    const ey = py - ay
    return Math.sqrt(ex * ex + ey * ey)
  }
  let t = ((px - ax) * dx + (py - ay) * dy) / len2
  if (t < 0) t = 0
  if (t > 1) t = 1
  const cx = ax + t * dx
  const cy = ay + t * dy
  return Math.hypot(px - cx, py - cy)
}

function onCheckmark(x, y) {
  const half = CHECK_STROKE / 2
  const d1 = distToSegment(x, y, P1.x, P1.y, P2.x, P2.y)
  if (d1 <= half) return true
  const d2 = distToSegment(x, y, P2.x, P2.y, P3.x, P3.y)
  if (d2 <= half) return true
  return false
}

function buildRgba() {
  const rgba = Buffer.alloc(SIZE * SIZE * 4)
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const idx = (y * SIZE + x) * 4
      // Default: transparent.
      let r = 0
      let g = 0
      let b = 0
      let a = 0
      if (inRoundedSquare(x + 0.5, y + 0.5)) {
        if (onCheckmark(x + 0.5, y + 0.5)) {
          r = 255
          g = 255
          b = 255
          a = 255
        } else {
          r = 0
          g = 0
          b = 0
          a = 255
        }
      }
      rgba[idx] = r
      rgba[idx + 1] = g
      rgba[idx + 2] = b
      rgba[idx + 3] = a
    }
  }
  return rgba
}

// ---- Minimal PNG encoder ----
// Reference: https://www.w3.org/TR/PNG/

function crc32(buf) {
  let c
  if (!crc32.table) {
    crc32.table = new Uint32Array(256)
    for (let n = 0; n < 256; n++) {
      c = n
      for (let k = 0; k < 8; k++) {
        c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
      }
      crc32.table[n] = c >>> 0
    }
  }
  c = 0xffffffff
  for (let i = 0; i < buf.length; i++) {
    c = crc32.table[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  }
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length, 0)
  const typeBuf = Buffer.from(type, 'ascii')
  const crcInput = Buffer.concat([typeBuf, data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(crcInput), 0)
  return Buffer.concat([len, typeBuf, data, crc])
}

function encodePng(rgba, width, height) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])

  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // color type: RGBA
  ihdr[10] = 0 // compression
  ihdr[11] = 0 // filter
  ihdr[12] = 0 // interlace

  // Build scanlines with filter byte 0 (None) per row.
  const stride = width * 4
  const raw = Buffer.alloc((stride + 1) * height)
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride)
  }
  const idatData = zlib.deflateSync(raw, { level: 9 })

  return Buffer.concat([
    signature,
    chunk('IHDR', ihdr),
    chunk('IDAT', idatData),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

function main() {
  console.log(`Rendering ${SIZE}x${SIZE} icon...`)
  const rgba = buildRgba()
  const png = encodePng(rgba, SIZE, SIZE)
  const outDir = path.resolve(__dirname, '..', 'assets')
  fs.mkdirSync(outDir, { recursive: true })
  const outPath = path.join(outDir, 'icon.png')
  fs.writeFileSync(outPath, png)
  console.log(`Wrote ${outPath} (${png.length} bytes)`)
}

main()
