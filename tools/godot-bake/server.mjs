/**
 * tools/godot-bake/server.mjs — a tiny static server that lets the Luminati game boot in a browser
 * WITHOUT Vite, for the Godot bake (tools/godot-bake/bake.mjs).
 *
 * What it does on top of plain static files:
 *  - injects an import map into game.html, so the bare specifiers resolve:
 *      three                  → node_modules/three/build/three.module.js
 *      three/addons/…         → node_modules/three/examples/jsm/…
 *      lil-gui, @fontsource/… → small stubs (the bake needs neither the debug panel nor web fonts)
 *  - serves a `.css` file asked for by a module `import` as a JS module that injects the style;
 *  - serves `/levels/…`, `/campaigns/…`, `/i18n/…` from `public/` (Vite's public dir);
 *  - `THREE_DIR` (env) may point at a three.js r186 checkout instead of node_modules/three.
 *
 * Usage: `node tools/godot-bake/server.mjs [port]` (the bake starts it itself).
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const THREE_DIR = process.env.THREE_DIR ? path.resolve(process.env.THREE_DIR) : path.join(ROOT, 'node_modules/three');

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.story': 'text/plain; charset=utf-8',
  '.po': 'text/plain; charset=utf-8',
};

const IMPORT_MAP = `<script type="importmap">${JSON.stringify({
  imports: {
    three: '/__three/build/three.module.js',
    'three/addons/': '/__three/examples/jsm/',
    'three/examples/jsm/': '/__three/examples/jsm/',
    'lil-gui': '/__stub/lil-gui.js',
    '@fontsource/': '/__stub/fontsource/',
  },
})}</script>`;

/** lil-gui stand-in: a chainable no-op object (the debug panel is never opened by the bake). */
const LIL_GUI_STUB = `
const chain = () => new Proxy(function () {}, { get: (t, k) => (k === 'then' ? undefined : chain()), apply: () => chain() });
export default class GUI { constructor() { return chain(); } }
`;

function resolveFile(urlPath) {
  if (urlPath.startsWith('/__three/')) return path.join(THREE_DIR, urlPath.slice('/__three/'.length));
  const direct = path.join(ROOT, urlPath);
  if (fs.existsSync(direct) && fs.statSync(direct).isFile()) return direct;
  const pub = path.join(ROOT, 'public', urlPath);
  if (fs.existsSync(pub) && fs.statSync(pub).isFile()) return pub;
  return direct;
}

export function startServer(port = 0) {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://x');
    let p = decodeURIComponent(url.pathname);
    if (p.endsWith('/')) p += 'index.html';
    const send = (code, type, body) => {
      res.writeHead(code, { 'content-type': type, 'cache-control': 'no-store' });
      res.end(body);
    };
    if (p === '/__stub/lil-gui.js') return send(200, TYPES['.js'], LIL_GUI_STUB);
    if (p.startsWith('/__stub/')) return send(200, TYPES['.js'], 'export default {};');
    const file = resolveFile(p);
    if (!file.startsWith(ROOT) && !file.startsWith(THREE_DIR)) return send(403, 'text/plain', 'forbidden');
    if (!fs.existsSync(file) || !fs.statSync(file).isFile()) return send(404, 'text/plain', `not found: ${p}`);
    const ext = path.extname(file).toLowerCase();
    const isModuleRequest = req.headers['sec-fetch-dest'] === 'script';
    if (ext === '.css' && isModuleRequest) {
      const css = fs.readFileSync(file, 'utf8');
      return send(200, TYPES['.js'],
        `const s = document.createElement('style'); s.textContent = ${JSON.stringify(css)}; document.head.appendChild(s); export default {};`);
    }
    if (ext === '.html') {
      let html = fs.readFileSync(file, 'utf8');
      html = html.replace(/<head>/i, `<head>${IMPORT_MAP}`);
      return send(200, TYPES['.html'], html);
    }
    return send(200, TYPES[ext] ?? 'application/octet-stream', fs.readFileSync(file));
  });
  return new Promise((resolve) => server.listen(port, '127.0.0.1', () => resolve(server)));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const server = await startServer(Number(process.argv[2] ?? 5180));
  const addr = /** @type {import('node:net').AddressInfo} */ (server.address());
  console.log(`Luminati bake server on http://127.0.0.1:${addr.port}/ (three: ${THREE_DIR})`);
}
