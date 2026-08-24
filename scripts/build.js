#!/usr/bin/env node
// =============================================================
// NEXUS build script
// Copies the static application into dist/.
// =============================================================
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DIST = path.join(ROOT, 'dist');

const PASSTHROUGH_FILES = [
  'sw.js',
  'src/pages/index.html',
  'src/pages/health.html',
  'src/pages/gym.html',
  'src/pages/live-workout.html',
  'src/pages/grind-log.html',
  'src/pages/progression-tab.html',
  'src/pages/facescan.html',
  'src/pages/offline.html',
  'src/scripts/topbar.js',
  'src/scripts/github-health.js',
  'src/scripts/workout-persistence.js',
  'src/scripts/theme.js',
  'src/scripts/event-horizon.js',
  'src/styles/liquid-amethyst.css',
  'src/styles/event-horizon.css',
  'src/styles/themes.css',
  'src/styles/style.css',
  'src/styles/animations.css',
  'src/scripts/animations.js',
  'src/data/manifest.json',
];

// Files that need to be placed at the ROOT of dist/ so they
// are reachable via absolute web paths like /icon-192.png.
// Keys = source path relative to ROOT, Values = filename in dist/.
const ROOT_ASSETS = {
  'public/favicon-32.png':           'favicon-32.png',
  'public/icon-192.png':             'icon-192.png',
  'public/icon-512.png':             'icon-512.png',
  'public/apple-touch-icon-180.png': 'apple-touch-icon-180.png',
  'src/data/manifest.json':          'manifest.json',
};

function ensureClean(dir) {
  if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
}

function outputPath(rel) {
  if (rel.startsWith('src/pages/')) return path.join(DIST, path.basename(rel));
  if (rel.startsWith('src/scripts/')) return path.join(DIST, 'scripts', path.basename(rel));
  if (rel.startsWith('src/styles/')) return path.join(DIST, 'styles', path.basename(rel));
  if (rel.startsWith('src/data/')) return path.join(DIST, 'data', path.basename(rel));
  return path.join(DIST, rel);
}

function copyPassthrough() {
  for (const rel of PASSTHROUGH_FILES) {
    const src = path.join(ROOT, rel);
    if (!fs.existsSync(src)) continue;
    const dest = outputPath(rel);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(src, dest);
  }
}

function copyRootAssets() {
  for (const [rel, filename] of Object.entries(ROOT_ASSETS)) {
    const src = path.join(ROOT, rel);
    if (!fs.existsSync(src)) {
      console.warn('  ⚠ root asset not found:', rel);
      continue;
    }
    const dest = path.join(DIST, filename);
    fs.copyFileSync(src, dest);
    console.log('  ✓ copied', rel, '→ dist/' + filename);
  }
}

function main() {
  ensureClean(DIST);
  copyPassthrough();
  copyRootAssets();
  console.log('✓ build complete →', path.relative(ROOT, DIST) + '/');
}

main();
