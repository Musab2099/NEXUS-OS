#!/usr/bin/env node
// NEXUS build: turn the source folders into the deployable dist/ folder.
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DIST = path.join(ROOT, 'dist');

// Keep browser URLs stable while making the source layout easy to extend.
// Add a file to one of these source folders and it is included automatically.
const SOURCE_FOLDERS = [
  ['src/pages', '.'],
  ['src/scripts', 'scripts'],
  ['src/styles', 'styles'],
  ['src/data', 'data'],
  ['public', '.'],
];

const ROOT_FILES = [
  ['sw.js', 'sw.js'],
  ['src/data/manifest.json', 'manifest.json'],
];

function copyDirectory(source, destination) {
  if (!fs.existsSync(source)) return;
  fs.cpSync(source, destination, { recursive: true });
}

function copyFile(source, destination) {
  if (!fs.existsSync(source)) {
    throw new Error(`Required build file is missing: ${path.relative(ROOT, source)}`);
  }
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.copyFileSync(source, destination);
}

function cleanOutput() {
  fs.rmSync(DIST, { recursive: true, force: true });
  fs.mkdirSync(DIST, { recursive: true });
}

function main() {
  cleanOutput();

  for (const [from, to] of SOURCE_FOLDERS) {
    copyDirectory(path.join(ROOT, from), path.join(DIST, to));
  }

  for (const [from, to] of ROOT_FILES) {
    copyFile(path.join(ROOT, from), path.join(DIST, to));
  }

  console.log('NEXUS build complete -> dist/');
}

main();
