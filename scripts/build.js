#!/usr/bin/env node
// =============================================================
// NEXUS build script
// Reads SUPABASE_URL and SUPABASE_KEY from .env and substitutes
// the __SUPABASE_URL__ / __SUPABASE_KEY__ placeholders in
// sync.js and topbar.js, then writes a deployable dist/ folder.
//
// Usage:
//   node scripts/build.js          # build to ./dist
//   npm run build                  # same thing, via package.json
//
// Placeholders must be literal strings __SUPABASE_URL__ and
// __SUPABASE_KEY__ (no quotes) inside the .js source.
// =============================================================
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const ENV_FILE = path.join(ROOT, '.env');

const PLACEHOLDER_FILES = ['sync.js', 'topbar.js'];
const PASSTHROUGH_FILES = [
  'index.html',
  'health.html',
  'gym.html',
  'grind-log.html',
  'progression-tab.html',
  'event-horizon.js',
  'event-horizon.css',
  'manifest.json',
  'sw.js',
  'favicon-32.png',
  'icon-192.png',
  'icon-512.png',
  'apple-touch-icon-180.png',
];

function loadEnv(filePath) {
  if (!fs.existsSync(filePath)) {
    console.error('✗ .env not found at', filePath);
    console.error('  Copy .env.example to .env and fill in your Supabase credentials.');
    process.exit(1);
  }
  const env = {};
  const text = fs.readFileSync(filePath, 'utf8');
  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();
    // strip surrounding quotes if present
    if ((val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    env[key] = val;
  }
  return env;
}

function ensureClean(dir) {
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
  fs.mkdirSync(dir, { recursive: true });
}

function copyPassthrough() {
  for (const rel of PASSTHROUGH_FILES) {
    const src = path.join(ROOT, rel);
    if (!fs.existsSync(src)) continue;
    fs.copyFileSync(src, path.join(DIST, rel));
  }
}

function renderFile(rel, env) {
  const src = path.join(ROOT, rel);
  let text = fs.readFileSync(src, 'utf8');
  let replaced = 0;
  for (const [token, value] of Object.entries(env)) {
    const placeholder = '__' + token + '__';
    const before = text;
    text = text.split(placeholder).join(value);
    if (text !== before) replaced++;
  }
  fs.writeFileSync(path.join(DIST, rel), text);
  return replaced;
}

function main() {
  const env = loadEnv(ENV_FILE);
  const required = ['SUPABASE_URL', 'SUPABASE_KEY'];
  for (const k of required) {
    if (!env[k] || env[k].startsWith('your-') || env[k].startsWith('https://your-')) {
      console.error('✗ .env is missing a real value for', k);
      process.exit(1);
    }
  }

  ensureClean(DIST);
  copyPassthrough();
  for (const rel of PLACEHOLDER_FILES) {
    const n = renderFile(rel, env);
    if (n === 0) {
      console.warn('  (warning) no placeholders replaced in', rel);
    } else {
      console.log('  ✓ injected', n, 'placeholder(s) in', rel);
    }
  }

  console.log('✓ build complete →', path.relative(ROOT, DIST) + '/');
}

main();
