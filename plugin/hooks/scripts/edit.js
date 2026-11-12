// PostToolUse (Edit|Write|MultiEdit|NotebookEdit): record which file changed and how.
// The raw edit stays on this machine; the server turns it into line counts.
import { run, findProject, append, ids, rel, cap, DATA_DIRS } from './lib.js';

function editOf(tool, ti) {
  switch (tool) {
    case 'Write':
      return { kind: 'write', content: cap(ti.content ?? '') };
    case 'Edit':
      return { kind: 'edit', old: cap(ti.old_string ?? ''), new: cap(ti.new_string ?? ''), all: !!ti.replace_all };
    case 'MultiEdit':
      return {
        kind: 'multi',
        edits: (ti.edits || []).map((e) => ({ old: cap(e.old_string ?? ''), new: cap(e.new_string ?? '') })),
      };
    case 'NotebookEdit':
      return { kind: 'notebook', new: cap(ti.new_source ?? ''), mode: ti.edit_mode || 'replace' };
    default:
      return { kind: 'unknown' };
  }
}

run((input) => {
  const ti = input.tool_input || {};
  const file = ti.file_path || ti.notebook_path;
  if (!file) return;
  const found = findProject(input.cwd);
  if (!found) return;
  const { root, dataDir } = found;
  const relPath = rel(root, file);
  if (relPath.startsWith('..')) return; // outside the project
  if (DATA_DIRS.some((d) => relPath === d || relPath.startsWith(`${d}/`))) return; // our own files (reports, map)

  append(root, {
    type: 'edit',
    ...ids(input),
    tool: input.tool_name,
    file: relPath,
    created: input.tool_response?.type === 'create' || undefined,
    edit: editOf(input.tool_name, ti),
  }, dataDir);
});
