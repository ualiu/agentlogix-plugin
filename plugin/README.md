# AgentLogix plugin for Claude Code

Records what you asked, which files the agent changed, and when each turn ended, into
`.agentlogix/events.jsonl` in your project. Hooks only append one line to that file. They make
no network calls and never block the agent. Nothing happens in a folder without `.agentlogix/`.
Type `/agentlogix` in Claude Code in your project to set it up: it runs `scripts/setup.js`, which sets up
the current folder, starts or reuses the dashboard and opens it.

Load it while developing:

```
claude --plugin-dir /path/to/agentlogix/plugin
```

## Hook contract (checked against code.claude.com/docs/en/hooks, Claude Code 2.1.322, 2026-11-11)

All hooks run in exec form (`command: "node"`, `args: [script]`) so paths with spaces work on
Windows without shell quoting. Stdin is one JSON object.

Common fields: `session_id`, `prompt_id` (absent before the first prompt), `transcript_path`,
`cwd`, `permission_mode`, `hook_event_name`. Subagents add `agent_id`, `agent_type`.

| Event | Extra stdin fields we use | Output | Mode |
|---|---|---|---|
| `UserPromptSubmit` | `prompt` | `hookSpecificOutput.additionalContext` (the report reminder) | sync (timeout capped at 30 s; ours runs in milliseconds) |
| `PostToolUse` (matcher `Edit\|Write\|MultiEdit\|NotebookEdit`) | `tool_name`, `tool_input`, `tool_use_id`. File paths are absolute with native separators (backslashes on Windows) | none | `async: true` |
| `Stop` | `stop_hook_active`, `last_assistant_message` (not stored) | none | `async: true` |

`tool_input` shapes we handle (defensively, unknown shapes still record the path):
- Write: `{ file_path, content }`
- Edit: `{ file_path, old_string, new_string, replace_all? }`
- MultiEdit: `{ file_path, edits: [{ old_string, new_string }] }`
- NotebookEdit: `{ notebook_path, new_source, edit_mode? }`

`PostToolUse` does not fire when Bash or an outside process changes a file. The AgentLogix server
covers that by comparing `git status` and file hashes at the start and end of each turn.
(`FileChanged` hooks only watch files named up front, so they don't fit.)
