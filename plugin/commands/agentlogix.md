---
description: Set up AgentLogix for this project and open the dashboard, rebuild the map, or ask what a part affects
argument-hint: "[rebuild [what to change] | <part of the app>]"
allowed-tools: Bash(node:*)
---

Arguments: $ARGUMENTS

1. From the project folder, run this command with the Bash tool exactly as written (add ` --rebuild`
   at the end if the arguments start with `rebuild` or `map`). It sets up the project (no path needed),
   starts the dashboard if it isn't running, and opens it in the browser:

   `node "${CLAUDE_PLUGIN_ROOT}/scripts/setup.js"`

   You don't need to read any files from the plugin folder: everything you need is in its output.

2. Do what its `NEXT_STEP` line says:
   - `build-map`: read the project's code and build the map by following the map guide printed in the
     output, then write it with your Write tool to the `inbox/map.json` path given there. If the arguments
     say more after `rebuild` (names to use, for example "call Quote the Price check", or parts to add or
     merge), follow them, keeping the ids of boxes that stay. Then tell the user in two or three plain
     sentences what the map shows, and that it appears on the dashboard by itself.
   - `show-needs-a-look`: tell the user the dashboard is open, and list what needs a look in plain words
     (or say nothing needs a look).
   If the script failed, tell the user its message in plain words.

3. If the arguments name a part of the app, also answer "what does it affect?" from
   `.agentlogix/map.json` in the project: what it does, which parts it connects to and how, and its files.
