#!/usr/bin/env node
/**
 * The front page of a published build (the GitHub Pages deploy, .github/workflows/deploy-pages.yml):
 * a player who opens the site lands in the game, not in the engine's launcher.
 *
 * Usage:
 *   node tools/pages-front.mjs [dist]
 *
 * In the build folder (default `dist`): the launcher (`index.html`) moves to `launcher.html`, and a
 * small `index.html` sends the visitor on to `game.html`, keeping the query and the hash (so
 * `…/?lang=en` opens the game in English). Run it after `npm run build`; a second run changes
 * nothing. Exit code 1 when the folder holds no build.
 */
import { existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const dir = process.argv[2] || 'dist';
const index = join(dir, 'index.html');
const launcher = join(dir, 'launcher.html');
const MARK = '<!-- pages-front -->';

if (!existsSync(join(dir, 'game.html'))) {
  console.error(`pages-front: ${dir}/game.html not found — run npm run build first`);
  process.exit(1);
}
if (existsSync(index) && readFileSync(index, 'utf8').includes(MARK)) {
  console.log(`pages-front: ${index} already opens the game`);
  process.exit(0);
}
if (existsSync(index)) renameSync(index, launcher);

writeFileSync(index, `<!doctype html>
${MARK}
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Culto ao Baiacu Rei</title>
  <meta http-equiv="refresh" content="0; url=game.html">
  <script>location.replace('game.html' + location.search + location.hash);</script>
  <style>body { margin: 0; background: #0b0f1c; color: #e8d9a8; font: 16px/1.5 system-ui, sans-serif; display: grid; place-items: center; min-height: 100vh; } a { color: #f2d27a; }</style>
</head>
<body>
  <p><a href="game.html">Jogar Culto ao Baiacu Rei</a></p>
</body>
</html>
`);
console.log(`pages-front: ${index} opens game.html${existsSync(launcher) ? `; the launcher is ${launcher}` : ''}`);
