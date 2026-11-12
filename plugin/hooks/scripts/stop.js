// Stop: mark the end of a turn. The agent's last message is not stored.
import { run, findProject, append, ids } from './lib.js';

run((input) => {
  const found = findProject(input.cwd);
  if (!found) return;
  append(found.root, { type: 'stop', ...ids(input) }, found.dataDir);
});
