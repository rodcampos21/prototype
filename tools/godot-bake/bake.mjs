#!/usr/bin/env node
/**
 * tools/godot-bake/bake.mjs — bake Luminati levels into data the Godot port (godot/) loads.
 *
 * The JavaScript engine stays the source of truth for everything it generates procedurally:
 * pixel textures, character sprite sheets, terrain geometry (cliffs, stairs, fringes, ambient
 * occlusion), props, trees and ground foliage. This tool boots the real game in a headless
 * browser for each level, lets it build the world, and writes what it built:
 *
 *   godot/levels/<level>/world.json   manifest: meshes, materials, gameplay data (tiles, colliders,
 *                                     interactables, lights, villagers, camera, lighting)
 *   godot/levels/<level>/world.bin.gz vertex / index / instance / tile data (gzip)
 *   godot/assets/baked/textures/*.png every texture, named by content hash (shared by levels)
 *   godot/assets/baked/sprites/*.png  character sprite sheets, by content hash
 *
 * Usage:
 *   node tools/godot-bake/bake.mjs                 # every level in public/levels/
 *   node tools/godot-bake/bake.mjs emberfall …     # just these
 *
 * Needs a Chromium-family browser: `CHROME_PATH=/path/to/chrome` (puppeteer-core, a dev
 * dependency of the project), or Playwright's Chromium if `playwright` is installed. three.js comes
 * from node_modules/three (`npm install`) or `THREE_DIR=/path/to/three.js` (an r186 checkout).
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import zlib from 'node:zlib';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { startServer } from './server.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const OUT = path.join(ROOT, 'godot');
const require = createRequire(import.meta.url);

const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const levels = args.length ? args : fs.readdirSync(path.join(ROOT, 'public/levels')).filter((f) => f.endsWith('.json')).map((f) => f.slice(0, -5)).sort();

// ---------------------------------------------------------------------------------------------
// Browser
// ---------------------------------------------------------------------------------------------
const GL_ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'];

async function launch() {
  const chromePath = [process.env.CHROME_PATH,
    'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser'].find((p) => p && fs.existsSync(p));
  if (chromePath) {
    try {
      const puppeteer = (await import('puppeteer-core')).default;
      const browser = await puppeteer.launch({ executablePath: chromePath, headless: true, args: GL_ARGS });
      return {
        async page() {
          const p = await browser.newPage();
          await p.setViewport({ width: 320, height: 180 });
          return { goto: (u) => p.goto(u, { timeout: 120000 }), evaluate: (fn, a) => p.evaluate(fn, a), waitFor: (fn) => p.waitForFunction(fn, { timeout: 180000 }), on: (e, f) => p.on(e, f), close: () => p.close() };
        },
        close: () => browser.close(),
      };
    } catch (e) {
      console.warn(`[bake] puppeteer-core unavailable (${e.message}); trying Playwright`);
    }
  }
  let pw;
  try { pw = require('playwright'); } catch {
    try { pw = require(require.resolve('playwright', { paths: [process.env.NODE_PATH ?? '', '/opt/npm-tools/node_modules'] })); } catch {
      throw new Error('No browser: set CHROME_PATH (and npm install), or install playwright');
    }
  }
  const browser = await pw.chromium.launch({ args: GL_ARGS });
  return {
    async page() {
      const p = await browser.newPage({ viewport: { width: 320, height: 180 } });
      return { goto: (u) => p.goto(u, { timeout: 120000 }), evaluate: (fn, a) => p.evaluate(fn, a), waitFor: (fn) => p.waitForFunction(fn, null, { timeout: 180000 }), on: (e, f) => p.on(e, f), close: () => p.close() };
    },
    close: () => browser.close(),
  };
}

// ---------------------------------------------------------------------------------------------
// Output helpers
// ---------------------------------------------------------------------------------------------
const decodeDataURL = (url) => Buffer.from(url.slice(url.indexOf(',') + 1), 'base64');
const hash = (buf) => crypto.createHash('sha1').update(buf).digest('hex').slice(0, 16);

function writeImage(dir, buf, prefix) {
  const name = `${prefix}${hash(buf)}.png`;
  const file = path.join(OUT, dir, name);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  if (!fs.existsSync(file)) fs.writeFileSync(file, buf);
  return `res://${dir}/${name}`;
}

function slugTex(name) {
  return (name || 'tex').replace(/^luminati:|^TileMap:/, '').replace(/[^a-z0-9_]+/gi, '_').slice(0, 40).replace(/_+$/, '') || 'tex';
}

// ---------------------------------------------------------------------------------------------
// Bake one level
// ---------------------------------------------------------------------------------------------
async function bakeLevel(browser, base, levelName) {
  const t0 = Date.now();
  const page = await browser.page();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`${base}/game.html?autostart=1&level=${encodeURIComponent(levelName)}`);
  await page.waitFor(() => !!window.__game && !!window.__game.world);
  const extractSrc = fs.readFileSync(path.join(ROOT, 'tools/godot-bake/extract.js'), 'utf8');
  const stats = await page.evaluate(async (src) => {
    // eslint-disable-next-line no-new-func
    return await (new Function(src))();
  }, extractSrc);
  const manifest = await page.evaluate(() => JSON.stringify(window.__lumBake.manifest));
  const levelJson = await page.evaluate(() => JSON.stringify(window.__game.level));
  const nBuffers = await page.evaluate(() => window.__lumBake.buffers.length);
  const chunks = [];
  for (let b = 0; b < nBuffers; b++) {
    const len = await page.evaluate((i) => window.__lumBake.buffers[i].length, b);
    const parts = [];
    for (let off = 0; off < len; off += 4 * 1024 * 1024) {
      const b64 = await page.evaluate(([i, o]) => {
        const a = window.__lumBake.buffers[i].subarray(o, o + 4 * 1024 * 1024);
        let s = '';
        for (let k = 0; k < a.length; k += 0x8000) s += String.fromCharCode.apply(null, a.subarray(k, k + 0x8000));
        return btoa(s);
      }, [b, off]);
      parts.push(Buffer.from(b64, 'base64'));
    }
    chunks.push(Buffer.concat(parts));
  }
  const imageKeys = await page.evaluate(() => Object.keys(window.__lumBake.images));
  const images = {};
  for (const k of imageKeys) images[k] = await page.evaluate((key) => window.__lumBake.images[key], k);
  await page.close();

  const m = JSON.parse(manifest);
  // buffers → one file; rewrite { buffer, offset } to absolute byte offsets
  const starts = [];
  let total = 0;
  for (const c of chunks) { starts.push(total); total += (c.length + 3) & ~3; }
  const bin = Buffer.alloc(total);
  chunks.forEach((c, i) => c.copy(bin, starts[i]));
  const fix = (o) => {
    if (!o || typeof o !== 'object') return;
    if (Array.isArray(o)) { o.forEach(fix); return; }
    if (typeof o.buffer === 'number' && typeof o.offset === 'number' && typeof o.type === 'string') {
      o.offset += starts[o.buffer];
      delete o.buffer;
    }
    for (const v of Object.values(o)) fix(v);
  };
  fix(m);

  // textures and sprite sheets → PNG files (deduplicated by content)
  for (const t of m.textures) {
    const url = images[`tex${t.id}`];
    t.path = url ? writeImage('assets/baked/textures', decodeDataURL(url), `${slugTex(t.name)}_`) : null;
  }
  for (const s of m.sheets) {
    const url = images[`sheet${s.id}`];
    s.path = url ? writeImage('assets/baked/sprites', decodeDataURL(url), `${slugTex(s.name)}_`) : null;
  }

  m.source = { level: levelName, bakedAt: new Date().toISOString(), engine: 'luminati (three.js r186)', pageErrors: errors };
  m.levelData = JSON.parse(levelJson);
  const dir = path.join(OUT, 'levels', levelName);
  fs.mkdirSync(dir, { recursive: true });
  // gzip: float vertex data packs ~3.5×; Godot inflates it with PackedByteArray.decompress
  m.binBytes = bin.length;
  fs.writeFileSync(path.join(dir, 'world.bin.gz'), zlib.gzipSync(bin, { level: 9 }));
  fs.rmSync(path.join(dir, 'world.bin'), { force: true });
  fs.writeFileSync(path.join(dir, 'world.json'), JSON.stringify(m));
  const mb = (bin.length / 1048576).toFixed(1);
  console.log(`[bake] ${levelName}: ${stats.meshes} meshes, ${stats.materials} materials, ${stats.textures} textures, ${mb} MB, ${((Date.now() - t0) / 1000).toFixed(1)} s${errors.length ? ` (${errors.length} page errors)` : ''}`);
  for (const e of errors) console.warn(`  page error: ${e}`);
}

const server = await startServer(0);
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await launch();
let failed = 0;
try {
  for (const name of levels) {
    try { await bakeLevel(browser, base, name); } catch (e) { failed++; console.error(`[bake] ${name} failed: ${e.stack ?? e}`); }
  }
} finally {
  await browser.close();
  server.close();
}
// the list of baked levels, for the Godot level picker
const baked = fs.existsSync(path.join(OUT, 'levels')) ? fs.readdirSync(path.join(OUT, 'levels')).filter((d) => fs.existsSync(path.join(OUT, 'levels', d, 'world.json'))).sort() : [];
const index = baked.map((d) => {
  const j = JSON.parse(fs.readFileSync(path.join(OUT, 'levels', d, 'world.json'), 'utf8'));
  return { id: d, name: j.level.name, subtitle: j.level.subtitle, width: j.level.width, depth: j.level.depth };
});
fs.writeFileSync(path.join(OUT, 'levels', 'index.json'), `${JSON.stringify(index, null, 2)}\n`);

// drop baked images no level uses any more (an older bake's textures), with their .import files
const used = new Set();
for (const d of baked) {
  const j = JSON.parse(fs.readFileSync(path.join(OUT, 'levels', d, 'world.json'), 'utf8'));
  for (const t of [...(j.textures ?? []), ...(j.sheets ?? [])]) if (t.path) used.add(t.path);
}
let removed = 0;
for (const dir of ['assets/baked/textures', 'assets/baked/sprites']) {
  const abs = path.join(OUT, dir);
  if (!fs.existsSync(abs)) continue;
  for (const f of fs.readdirSync(abs)) {
    if (!f.endsWith('.png')) continue;
    if (used.has(`res://${dir}/${f}`)) continue;
    fs.rmSync(path.join(abs, f));
    fs.rmSync(path.join(abs, `${f}.import`), { force: true });
    removed++;
  }
}
if (removed) console.log(`[bake] removed ${removed} images no level uses`);
process.exit(failed ? 1 : 0);
