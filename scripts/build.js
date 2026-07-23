#!/usr/bin/env node
// =============================================================
// NEXUS build script
// Reads SUPABASE_URL and SUPABASE_KEY and substitutes the
// __SUPABASE_URL__ / __SUPABASE_KEY__ placeholders in sync.js,
// then writes a deployable dist/ folder.
// =============================================================
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const ENV_FILE = path.join(ROOT, '.env');

const PLACEHOLDER_FILES = ['src/scripts/sync.js'];
const PASSTHROUGH_FILES = [
  'sw.js',
  'src/pages/index.html',
  'src/pages/health.html',
  'src/pages/gym.html',
  'src/pages/grind-log.html',
  'src/pages/progression-tab.html',
  'src/scripts/topbar.js',
  'src/scripts/event-horizon.js',
  'src/styles/liquid-amethyst.css',
  'src/styles/event-horizon.css',
  'src/data/manifest.json',
  'public/favicon-32.png',
  'public/icon-192.png',
  'public/icon-512.png',
  'public/apple-touch-icon-180.png',
];

function loadEnvFile(filePath) {
  const env = {};
  if (!fs.existsSync(filePath)) return env;
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

function loadCredentials() {
  // 1. process.env wins (Vercel / CI / shells that already export the values).
  // 2. .env fills the gaps for local dev.
  const fileEnv = loadEnvFile(ENV_FILE);
  const fromProcess = {};
  for (const k of ['SUPABASE_URL', 'SUPABASE_KEY']) {
    if (process.env[k]) fromProcess[k] = process.env[k];
  }
  return { ...fileEnv, ...fromProcess };
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
  const env = loadCredentials();
  const fromEnvFile = fs.existsSync(ENV_FILE);
  const required = ['SUPABASE_URL', 'SUPABASE_KEY'];
  for (const k of required) {
    if (!env[k] || env[k].startsWith('your-') || env[k].startsWith('https://your-')) {
      console.error('✗ missing real value for', k);
      if (!fromEnvFile && !process.env[k]) {
        console.error('  Set it as an environment variable, or copy .env.example to .env');
        console.error('  and fill it in for local dev.');
      } else {
        console.error('  Check that', fromEnvFile ? '.env' : 'process.env', 'contains a real value.');
      }
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
