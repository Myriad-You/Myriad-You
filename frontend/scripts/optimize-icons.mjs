/**
 * Icon optimizer — regenerates the optimized WebP icons under `public/` from the
 * pristine source images kept in `raw/`.
 *
 * Contract:
 *   - `raw/` holds the full-resolution originals (source of truth, committed).
 *   - `public/` holds the shipped WebP that the app references by path.
 *   - This script is idempotent: re-run it any time to rebuild `public/` from `raw/`.
 *
 * Adding a new painted icon later:
 *   1. Drop the full-res PNG into `raw/icons/<category>/<name>.png`
 *      (add <category> to PAINTED_DIRS below if it's a new folder).
 *   2. Run `pnpm optimize:icons`.
 *   3. Reference it in code as `/icons/<category>/<name>.webp`.
 *
 * Sizing/quality rationale:
 *   - cap 192px = 64px display floor × 3 (Retina DPR3). Largest actual icon
 *     display is ~48px, so 192 is generous headroom; a single WebP serves every
 *     size (the browser downscales). No srcset needed for icons this small.
 *   - saturation 1.05 = a deliberate, subtle vividness bump for the painted UI
 *     icons (the re-encode itself does not wash colour out at q90).
 *   - Brand assets (game logos, the app logo) use saturation 1.0 to keep colours
 *     exact. The HSR wordmark is a CSS mask-image, so it is encoded lossless to
 *     preserve alpha edges (its RGB is irrelevant when used as a mask).
 *
 * Intentionally NOT processed: `public/icons/oauth/*` (already-tiny 64px brand
 * logos), `public/favicon.webp`, and the `*.svg` wordmarks (vector — optimal as-is).
 */
import { existsSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const FE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const RAW = path.join(FE, 'raw')
const PUB = path.join(FE, 'public')

// Painted UI icon folders under raw/icons/ → cap 192, saturation 1.05, q90.
const PAINTED_DIRS = [
  'config', 'notifications', 'control-panel', 'dynamic', 'greeting',
  'status', 'weather', 'tapp', 'widgets', 'brew',
]

const kb = (b) => `${(b / 1024).toFixed(1)}KB`

async function encode(src, out, { cap, saturation, quality, lossless }) {
  let pipe = sharp(src).resize({ width: cap, height: cap, fit: 'inside', withoutEnlargement: true })
  if (saturation !== 1) pipe = pipe.modulate({ saturation })
  pipe = lossless ? pipe.webp({ lossless: true, effort: 6 }) : pipe.webp({ quality, effort: 6 })
  await pipe.toFile(out)
  return statSync(out).size
}

let count = 0
let rawBytes = 0
let webpBytes = 0

async function run(label, src, out, opts) {
  const o = statSync(src).size
  const n = await encode(src, out, opts)
  rawBytes += o
  webpBytes += n
  count++
  console.log(`  ${label.padEnd(40)} ${kb(o).padStart(9)} → ${kb(n).padStart(8)}  ${((1 - n / o) * 100).toFixed(0)}%`)
}

// 1) Painted UI icons
for (const dir of PAINTED_DIRS) {
  const rawDir = path.join(RAW, 'icons', dir)
  if (!existsSync(rawDir)) {
    console.warn(`  ! missing raw/icons/${dir} — skipped`)
    continue
  }
  for (const f of readdirSync(rawDir).filter((x) => x.endsWith('.png'))) {
    await run(`icons/${dir}/${f}`,
      path.join(rawDir, f),
      path.join(PUB, 'icons', dir, f.replace(/\.png$/, '.webp')),
      { cap: 192, saturation: 1.05, quality: 90 })
  }
}

// 2) Game logos — brand assets (saturation 1.0). starrail.png is a CSS
//    mask-image → lossless WebP at a larger cap to keep its alpha silhouette crisp.
const gameRaw = path.join(RAW, 'game-logos')
if (existsSync(gameRaw)) {
  for (const f of readdirSync(gameRaw).filter((x) => x.endsWith('.png'))) {
    const isMask = f === 'starrail.png'
    await run(`game-logos/${f}${isMask ? ' [mask]' : ''}`,
      path.join(gameRaw, f),
      path.join(PUB, 'game-logos', f.replace(/\.png$/, '.webp')),
      isMask ? { cap: 400, saturation: 1.0, lossless: true } : { cap: 192, saturation: 1.0, quality: 90 })
  }
}

// 3) App logo — brand mark, no saturation, downscaled for its ≤120px display.
const logoRaw = path.join(RAW, 'logo.webp')
if (existsSync(logoRaw)) {
  await run('logo.webp', logoRaw, path.join(PUB, 'logo.webp'), { cap: 360, saturation: 1.0, quality: 90 })
}

console.log(`\n${count} images: ${kb(rawBytes)} → ${kb(webpBytes)}  (${((1 - webpBytes / rawBytes) * 100).toFixed(1)}% smaller)`)
