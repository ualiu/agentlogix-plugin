# AgentLogix for Claude Code

See what your AI coding agent changed, and what it missed. AgentLogix keeps a live map of your app,
lights up every part your AI touches while it works, and checks each change against what the AI
says it did. More at https://agentlogix.si.

## Install

In Claude Code:

```
/plugin marketplace add ualiu/agentlogix-plugin
/plugin install agentlogix@agentlogix
```

Then open Claude Code in your project and type `/agentlogix`. The first time, it downloads the
AgentLogix app from npm (`agentlogix@0.3.3`), opens your dashboard and asks you to
sign in. Node.js 20.12 or newer is needed.

## What it installs

Three small hooks that note what you ask and which files your AI edits (they only write to a
`.agentlogix` folder in your project), a skill that teaches your AI to draw the map and report
on its changes, and the `/agentlogix` command. Your code isn't uploaded.

Version 0.3.3.
