#!/usr/bin/env node
// /agentlogix runs this from the user's project folder. No dependencies, no npm, no npx.
//   1. Find a running AgentLogix dashboard, or start one in the background.
//      A port used by another AgentLogix server is reused; a port used by another program is
//      skipped (and we say which port we used instead).
//   2. Set up the project in the current folder (or the nearest parent already set up) and open it.
//   3. Open the dashboard in the default browser (or print the link).
//   4. Tell the agent what to do next: build the first map, or list what needs a look.
// Env for tests: AGENTLOGIX_HOME, AGENTLOGIX_PORT, AGENTLOGIX_NO_BROWSER=1.
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// Settings from before the rename keep working (same rule as server/config/legacyEnv.js).
for (const [key, value] of Object.entries(process.env)) {
  if (key.startsWith('PARABOLICA_') && process.env[`AGENTLOGIX_${key.slice(11)}`] === undefined) process.env[`AGENTLOGIX_${key.slice(11)}`] = value;
}

const PLUGIN_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// ~/.agentlogix, or the folder an older version left (the server moves it over when it starts).
const HOME = process.env.AGENTLOGIX_HOME || ['.agentlogix', '.parabolica', '.changemap'].map((d) => path.join(os.homedir(), d)).find((d) => fs.existsSync(d)) || path.join(os.homedir(), '.agentlogix');
const DEFAULT_PORT = Number(process.env.AGENTLOGIX_PORT) || 4400;
const PORT_TRIES = 20;
const DATA_DIRS = ['.agentlogix', '.parabolica', '.changemap'];
const MAP_GUIDE = path.join(PLUGIN_ROOT, 'skills', 'report', 'MAP.md');
const REBUILD = process.argv.includes('--rebuild');

// The map guide is printed in the output, so the agent never has to read files outside the project
// (Claude Code asks permission for that, or blocks it in non-interactive runs).
const mapGuide = () => {
  try {
    return fs.readFileSync(MAP_GUIDE, 'utf8').trim();
  } catch {
    return '(The map guide could not be read. Reinstall the AgentLogix plugin.)';
  }
};

const readJson = (file) => {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
};
const samePath = (a, b) => {
  const n = (p) => path.resolve(p);
  return process.platform === 'win32' ? n(a).toLowerCase() === n(b).toLowerCase() : n(a) === n(b);
};

// The project: the nearest folder (from here up) that is already set up, else the current folder.
export function projectRoot(start = process.cwd()) {
  let dir = path.resolve(start);
  for (;;) {
    if (DATA_DIRS.some((d) => fs.existsSync(path.join(dir, d, 'config.json')))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) return path.resolve(start);
    dir = parent;
  }
}

// The AgentLogix app (server + dashboard): next to the plugin folder when installed from the source
// repo, or where a previous server ran from. Otherwise (the plugin installed from the public plugin
// repo) it comes from npm: `npx agentlogix@<this plugin's version>`, so plugin and app always match.
const PLUGIN_VERSION = readJson(path.join(PLUGIN_ROOT, '.claude-plugin', 'plugin.json'))?.version || 'latest';
// AGENTLOGIX_APP_SPEC overrides what npx runs (tests use a packed tarball).
export const appSpec = () => process.env.AGENTLOGIX_APP_SPEC || `agentlogix@${PLUGIN_VERSION}`;

export function findApp() {
  const candidates = [
    path.join(PLUGIN_ROOT, '..'),
    path.join(PLUGIN_ROOT, 'app'),
    readJson(path.join(HOME, 'app.json'))?.appRoot,
    readJson(path.join(HOME, 'server.json'))?.appRoot,
  ].filter(Boolean);
  for (const root of candidates) {
    const cli = path.join(root, 'cli', 'bin', 'agentlogix.js');
    if (fs.existsSync(cli)) return { root, cli };
  }
  return null;
}

function request(port, method, urlPath, body, timeout = 2000) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const req = http.request(
      { host: '127.0.0.1', port, method, path: urlPath, timeout, headers: { host: `localhost:${port}`, ...(data ? { 'content-type': 'application/json', 'content-length': Buffer.byteLength(data) } : {}) } },
      (res) => {
        let text = '';
        res.on('data', (c) => (text += c));
        res.on('end', () => {
          let json = null;
          try { json = JSON.parse(text); } catch { /* not JSON */ }
          resolve({ status: res.statusCode, json });
        });
      },
    );
    req.on('timeout', () => req.destroy(Object.assign(new Error('timeout'), { code: 'ETIMEDOUT' })));
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

// 'agentlogix' (ours, with its pid), 'free' (nothing listening) or 'other' (another program).
export async function probe(port) {
  try {
    const r = await request(port, 'GET', '/api/ping', null, 1500);
    if (r.json?.app === 'agentlogix') return { kind: 'agentlogix', pid: r.json.pid };
    return { kind: 'other' };
  } catch (err) {
    return err.code === 'ECONNREFUSED' ? { kind: 'free' } : { kind: 'other' };
  }
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// Starts the app: its CLI directly when it's on disk, else through npx. The first npx run downloads
// the package, so it gets a longer wait. (On Windows npx is a .cmd file, which needs a shell; the
// arguments are fixed words and a version, nothing from the user.)
async function startServer(app, port) {
  fs.mkdirSync(HOME, { recursive: true });
  const log = fs.openSync(path.join(HOME, 'server.log'), 'a');
  const opts = { detached: true, stdio: ['ignore', log, log], windowsHide: true, env: process.env };
  let child;
  if (app) {
    child = spawn(process.execPath, [app.cli, 'start', '--port', String(port)], { ...opts, cwd: app.root });
  } else {
    const spec = appSpec();
    if (!/^[\w@./:\\~-]+$/.test(spec)) throw new Error('AGENTLOGIX_APP_SPEC has unexpected characters.');
    // `--package <spec> agentlogix` names the command explicitly (works for a version or a tarball).
    const args = ['--yes', '--package', spec, 'agentlogix', 'start', '--port', String(port)];
    child = process.platform === 'win32'
      ? spawn(`npx.cmd ${args.join(' ')}`, { ...opts, cwd: HOME, shell: true }) // spec is checked above: no spaces or shell characters
      : spawn('npx', args, { ...opts, cwd: HOME });
    child.on('error', () => {}); // no npx: reported below as "didn't start"
  }
  child.unref();
  const tries = app ? 60 : 720; // 15 s, or 3 minutes for the first npx download
  for (let i = 0; i < tries; i++) {
    await wait(250);
    const p = await probe(port);
    if (p.kind === 'agentlogix') return p;
  }
  throw new Error(`The dashboard didn't start${app ? '' : ' (it downloads from npm the first time, so Node.js and npm must be installed)'}. Details are in ${path.join(HOME, 'server.log')}.`);
}

// Reuse a running AgentLogix, or start one on the first free port.
export async function ensureServer() {
  const notes = [];
  const recorded = readJson(path.join(HOME, 'server.json'));
  if (recorded?.port && (await probe(recorded.port)).kind === 'agentlogix') return { port: recorded.port, started: false, notes };
  for (let port = DEFAULT_PORT; port < DEFAULT_PORT + PORT_TRIES; port++) {
    const p = await probe(port);
    if (p.kind === 'agentlogix') return { port, started: false, notes };
    if (p.kind === 'other') continue;
    await startServer(findApp(), port); // null: from npm via npx
    if (port !== DEFAULT_PORT) notes.push(`Port ${DEFAULT_PORT} is used by another program, so the dashboard runs on port ${port}.`);
    return { port, started: true, notes };
  }
  throw new Error(`Ports ${DEFAULT_PORT} to ${DEFAULT_PORT + PORT_TRIES - 1} are all used by other programs. Set AGENTLOGIX_PORT to a free port.`);
}

function openBrowser(url) {
  if (process.env.AGENTLOGIX_NO_BROWSER) return Promise.resolve(false);
  return new Promise((resolve) => {
    let cmd;
    let args;
    if (process.platform === 'win32') { cmd = 'cmd'; args = ['/c', 'start', '', url]; }
    else if (process.platform === 'darwin') { cmd = 'open'; args = [url]; }
    else { cmd = 'xdg-open'; args = [url]; }
    try {
      const child = spawn(cmd, args, { detached: true, stdio: 'ignore', windowsHide: true });
      child.on('error', () => resolve(false));
      child.unref();
      setTimeout(() => resolve(true), 400);
    } catch {
      resolve(false);
    }
  });
}

async function main() {
  const root = projectRoot();
  const { port, started, notes } = await ensureServer();
  let home = (await request(port, 'GET', '/api/home')).json;
  const known = home.projects.find((p) => samePath(p.path, root));
  const wasSetUp = !!known?.initialized;
  if (!(known && home.activeId === known.id && wasSetUp)) {
    // Sets up .agentlogix/ (or moves an old .parabolica / .changemap) and makes it the open project.
    const res = await request(port, 'POST', '/api/home/projects', { path: root }, 10000);
    if (res.status >= 400) throw new Error(res.json?.error?.message || `Setting up ${root} failed.`);
    home = res.json;
  }
  const active = home.active;
  // The project's own address, so this tab stays on it even when another project is opened later.
  // No tab named: the dashboard opens Changes when there are sessions, How it works when there are none.
  const url = `http://localhost:${port}/p/${encodeURIComponent(active.id)}/`;
  const opened = await openBrowser(url);
  const dataDir = path.join(root, '.agentlogix');

  const out = [];
  out.push(wasSetUp ? `AgentLogix: ${active.name} is already set up.` : `AgentLogix is set up for ${active.name} (${root}).`);
  out.push(`Dashboard: ${url} ${opened ? '(opened in your browser)' : '(open this link in your browser)'}${started ? '' : ' [already running]'}`);
  for (const n of notes) out.push(n);
  out.push(`Data folder: ${dataDir}`);
  if (!active.mapReady || REBUILD) {
    out.push('NEXT_STEP: build-map');
    out.push(`${active.mapReady ? 'Rebuild the map (keep existing box ids).' : 'This project has no map yet.'} Build it now by following the map guide below, and write it with your Write tool to ${path.join(dataDir, 'inbox', 'map.json')}. The dashboard draws it as soon as the file is saved.`);
    out.push('--- MAP GUIDE ---');
    out.push(mapGuide());
    out.push('--- END OF MAP GUIDE ---');
  } else {
    const open = (await request(port, 'GET', `/api/p/${encodeURIComponent(active.id)}/issues?status=open`)).json?.open || [];
    out.push('NEXT_STEP: show-needs-a-look');
    if (!open.length) out.push('Nothing needs a look.');
    else {
      out.push(`Needs a look (${open.length}):`);
      for (const i of open) out.push(`- #${i.id} ${i.title}`);
    }
  }
  process.stdout.write(out.join('\n') + '\n');
}

// Run when executed directly (not when imported by tests).
if (process.argv[1] && samePath(process.argv[1], fileURLToPath(import.meta.url))) {
  main().catch((err) => {
    process.stdout.write(`AgentLogix setup failed: ${err.message}\n`);
    process.exit(1);
  });
}
