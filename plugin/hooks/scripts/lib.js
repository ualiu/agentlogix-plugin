// Shared helpers for the AgentLogix hooks. No dependencies, no network, no git.
// Every hook: read stdin JSON, find .agentlogix/, append one line, exit 0. Never throw.
import fs from 'node:fs';
import path from 'node:path';

export const EVENT_VERSION = 1;
const MAX_TEXT = 200_000; // cap stored strings so one huge Write can't bloat events.jsonl

export function readStdin() {
  try {
    const raw = fs.readFileSync(0, 'utf8');
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

// The data folder: the new name first, then the old names (Parabolica, Change Map) until the server moves it.
export const DATA_DIRS = ['.agentlogix', '.parabolica', '.changemap'];

// Walk up from `start` until a project set up for AgentLogix is found (<data dir>/config.json).
// Checking for config.json matters: ~/.agentlogix holds the project list, not a project, and
// must never collect events from every folder under the home directory.
export function findProject(start) {
  let dir = path.resolve(start || process.cwd());
  for (;;) {
    for (const name of DATA_DIRS) {
      try {
        if (fs.statSync(path.join(dir, name, 'config.json')).isFile()) return { root: dir, dataDir: name };
      } catch { /* not here */ }
    }
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

export const findRoot = (start) => findProject(start)?.root ?? null;

export function rel(root, file) {
  return path.relative(root, file).split(path.sep).join('/');
}

export function cap(text) {
  if (typeof text !== 'string') return text;
  return text.length > MAX_TEXT ? text.slice(0, MAX_TEXT) : text;
}

export function append(root, event, dataDir = DATA_DIRS[0]) {
  const line = JSON.stringify({ v: EVENT_VERSION, at: new Date().toISOString(), ...event }) + '\n';
  fs.appendFileSync(path.join(root, dataDir, 'events.jsonl'), line);
}

export function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
}

// Common identity for every event. `turn` is Claude Code's prompt_id (one per user prompt).
export function ids(input) {
  return {
    claudeSession: input.session_id || null,
    turn: input.prompt_id || null,
    ...(input.agent_id ? { agentId: input.agent_id } : {}),
  };
}

export function run(fn) {
  // AgentLogix's own "Ask about this change" runs Claude Code read-only with AGENTLOGIX_ASK=1.
  // Those questions are not AI work on the project: record nothing, remind nothing.
  if (process.env.AGENTLOGIX_ASK || process.env.PARABOLICA_ASK) process.exit(0);
  try {
    fn(readStdin());
  } catch {
    // A hook must never break the agent. Swallow everything.
  }
  process.exit(0);
}
