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

  const openIssues = readJson(path.join(root, dataDir, 'issues.json'), [])
    .filter((i) => !i.resolvedIn && !i.resolvedAt && !i.dismissed);
  const open = openIssues.slice(0, 5).map((i) => `#${i.id} "${i.title}"`);
  // About to commit, push or ship: name the high security risks still open, so they come up first.
  const shipping = /\b(commit|push|deploy|ship|release|publish|merge)\b/i.test(input.prompt || '');
  const highRisks = openIssues.filter((i) => i.kind === 'security' && i.severity === 'high').slice(0, 5);

  let text =
    'AgentLogix is on. If this turn changes any files, finish by writing a short report to ' +
    `${dataDir}/inbox/report.json as described in the agentlogix:report skill. Skip it if nothing changed. ` +
    'In it, list every box connected to the ones you edited, as affected or checked. ' +
    "The report goes in AgentLogix's own folder, not the project's code, so write it even when you were asked " +
    'to change only certain files.';
  if (open.length) text += ` Open issues (list any you fix under "resolves"): ${open.join(', ')}.`;
  if (shipping && highRisks.length) {
    text += ` Before you commit, push or deploy: AgentLogix has ${highRisks.length} high security risk${highRisks.length === 1 ? '' : 's'} open ` +
      `(${highRisks.map((i) => `#${i.id} "${i.title}"${i.files?.[0] ? ` in ${i.files[0]}` : ''}`).join(', ')}). ` +
      'Tell the user about them first and ask whether to fix them before going ahead.';
  }

  process.stdout.write(JSON.stringify({
    hookSpecificOutput: { hookEventName: 'UserPromptSubmit', additionalContext: text },
  }));
});
