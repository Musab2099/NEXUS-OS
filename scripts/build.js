#!/usr/bin/env node
// =============================================================
// NEXUS build script
// Reads SUPABASE_URL and SUPABASE_KEY and substitutes the
// __SUPABASE_URL__ / __SUPABASE_KEY__ placeholders in sync.js
// (and auth.js if present), then writes a deployable dist/ folder.
// =============================================================
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const ENV_FILE = path.join(ROOT, '.env');

// Files that contain placeholder tokens to substitute
const PLACEHOLDER_FILES = [
  'src/scripts/sync.js',
  'src/scripts/auth.js',
];

// Explicit root/standalone files to copy to dist
const ROOT_PASSTHROUGH = [
  'sw.js',
  'manifest.json',
];

// Directories whose entire contents are copied to dist
const PASSTHROUGH_DIRS = [
  'src',
  'public',
];

function loadEnvFile(filePath) {
  const env = {};
  try {
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
  } catch (err) {
    console.warn(`[build] Warning: Could not read ${filePath}: ${err.message}`);
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
  try {
    if (fs.existsSync(dir)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
    fs.mkdirSync(dir, { recursive: true });
  } catch (err) {
    console.error(`[build] Error cleaning directory ${dir}:`, err);
    throw err;
  }
}

function copyFileSafe(src, dest) {
  try {
    const destDir = path.dirname(dest);
    fs.mkdirSync(destDir, { recursive: true });
    fs.copyFileSync(src, dest);
  } catch (err) {
    console.error(`[build] Error copying ${src} -> ${dest}:`, err);
    throw err;
  }
}

function copyDirRecursive(srcDir, destDir, ignoreRelPaths = new Set()) {
  if (!fs.existsSync(srcDir)) return;
  
  const entries = fs.readdirSync(srcDir, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(srcDir, entry.name);
    const destPath = path.join(destDir, entry.name);
    const relFromRoot = path.relative(ROOT, srcPath).replace(/\\/g, '/');

    if (ignoreRelPaths.has(relFromRoot)) {
      continue;
    }

    if (entry.isDirectory()) {
      copyDirRecursive(srcPath, destPath, ignoreRelPaths);
    } else if (entry.isFile()) {
      copyFileSafe(srcPath, destPath);
    }
  }
}

function copyAllAssets(placeholderFiles) {
  const placeholderSet = new Set(placeholderFiles);

  // 1. Copy root passthrough files if present
  for (const rel of ROOT_PASSTHROUGH) {
    const src = path.join(ROOT, rel);
    if (fs.existsSync(src)) {
      const dest = path.join(DIST, rel);
      copyFileSafe(src, dest);
    }
  }

  // 2. Copy directories recursively, skipping placeholder files
  for (const dir of PASSTHROUGH_DIRS) {
    const srcDir = path.join(ROOT, dir);
    const destDir = path.join(DIST, dir);
    copyDirRecursive(srcDir, destDir, placeholderSet);
  }
}

function renderFile(rel, env) {
  const src = path.join(ROOT, rel);
  if (!fs.existsSync(src)) {
    return null;
  }

  try {
    let text = fs.readFileSync(src, 'utf8');
    let replaced = 0;
    for (const [token, value] of Object.entries(env)) {
      if (!value) continue;
      const placeholder = '__' + token + '__';
      const before = text;
      text = text.split(placeholder).join(value);
      if (text !== before) replaced++;
    }
    const dest = path.join(DIST, rel);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, text, 'utf8');
    return replaced;
  } catch (err) {
    console.error(`[build] Error rendering placeholder file ${rel}:`, err);
    throw err;
  }
}

function createRootRedirect() {
  try {
    const redirectHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="refresh" content="0; url=src/pages/index.html">
  <title>NEXUS</title>
  <script>window.location.replace("src/pages/index.html");</script>
</head>
<body style="background:#07051A;color:#EDE9FE;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;">
  <p>Loading NEXUS...</p>
</body>
</html>`;
    fs.mkdirSync(DIST, { recursive: true });
    fs.writeFileSync(path.join(DIST, 'index.html'), redirectHtml, 'utf8');
  } catch (err) {
    console.error('[build] Error creating root redirect index.html:', err);
    throw err;
  }
}

function main() {
  try {
    const env = loadCredentials();
    const hasUrl = env.SUPABASE_URL && !env.SUPABASE_URL.startsWith('your-') && !env.SUPABASE_URL.startsWith('https://your-');
    const hasKey = env.SUPABASE_KEY && !env.SUPABASE_KEY.startsWith('your-');

    if (hasUrl && hasKey) {
      console.log('✓ Supabase credentials loaded.');
    } else {
      console.warn('⚠️ Supabase credentials not found or set to placeholder values.');
      console.warn('  NEXUS will build in offline / local-first fallback mode.');
    }

    // Prepare clean output directory
    ensureClean(DIST);

    // Copy all static assets into dist/
    copyAllAssets(PLACEHOLDER_FILES);

    // Render placeholder files with env values (or copy as-is if no values)
    for (const rel of PLACEHOLDER_FILES) {
      const src = path.join(ROOT, rel);
      if (!fs.existsSync(src)) {
        continue; // Optional placeholder file not in repo
      }
      const n = renderFile(rel, (hasUrl && hasKey) ? env : {});
      if (n === null) continue;
      if (n === 0) {
        console.log(`  ℹ ${rel} copied (no placeholders replaced)`);
      } else {
        console.log(`  ✓ injected ${n} placeholder(s) in ${rel}`);
      }
    }

    // Create root entry point redirect
    createRootRedirect();

    console.log('✓ build complete → dist/');
  } catch (err) {
    console.error('✗ Build failed with error:', err.message || err);
    process.exit(1);
  }
}

main();
