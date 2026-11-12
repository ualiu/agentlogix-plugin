// UserPromptSubmit: record what the user asked, and remind the agent to write its report.
import path from 'node:path';
import { run, findProject, append, ids, cap, readJson } from './lib.js';

run((input) => {
  const found = findProject(input.cwd);
  if (!found) return;
  const { root, dataDir } = found;
  append(root, { type: 'prompt', ...ids(input), prompt: cap(input.prompt || '') }, dataDir);

  const config = readJson(path.join(root, dataDir, 'config.json'), {});
  if (config.report === false) return;

  const open = readJson(path.join(root, dataDir, 'issues.json'), [])
    .filter((i) => !i.resolvedIn && !i.dismissed)
    .slice(0, 5)
    .map((i) => `#${i.id} "${i.title}"`);

  let text =
    'AgentLogix is on. If this turn changes any files, finish by writing a short report to ' +
    `${dataDir}/inbox/report.json as described in the agentlogix:report skill. Skip it if nothing changed. ` +
    'In it, list every box connected to the ones you edited, as affected or checked. ' +
    "The report goes in AgentLogix's own folder, not the project's code, so write it even when you were asked " +
    'to change only certain files.';
  if (open.length) text += ` Open issues (list any you fix under "resolves"): ${open.join(', ')}.`;

  process.stdout.write(JSON.stringify({
    hookSpecificOutput: { hookEventName: 'UserPromptSubmit', additionalContext: text },
  }));
});
