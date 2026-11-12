---
name: report
description: AgentLogix keeps a plain-English map of this app and checks every AI change against it. Use when a AgentLogix reminder asks for an end-of-turn report, or when the user asks what a part of the app affects. Setting up, opening the dashboard and building the map are done by the /agentlogix command.
---

# AgentLogix

AgentLogix shows the user what you changed, what that affected, and what you may have missed.
It compares your report with the files the hooks saw you change, so be complete and honest.
The user is often not an engineer: write plainly, name things the way the app's owner would,
and never use em dashes.

- Setting up AgentLogix: the user types `/agentlogix` in their project. It runs the setup script, which
  sets up the project, opens the dashboard and says whether to build the map. Nothing else to install.
- Building or rebuilding the map: `/agentlogix` (or `/agentlogix rebuild`) prints the map guide for you.
- Renaming parts or changing the map ("call Quote the Price check"): write the whole map again as MAP.md
  says, with the new names, keeping every existing id so the history lines up.
- End of a turn that changed files: write the report below.
- "What does X affect?": read `.agentlogix/map.json`, find the box, and answer from its edges and files.

## End-of-turn report

Write it as the last step of any turn that changed files. Skip it if nothing changed.
The report lives in `.agentlogix/`, AgentLogix's own folder, not in the project's code. Writing it never counts as
"touching other files", so write it even when the user asked you to change only certain files.

1. Read `.agentlogix/map.json` for the box ids, their files and the edges between them.
2. List every box you **edited** as `changed` (or `new` if you created it).
3. For every box **connected by an edge** to one you edited, open its files and check it. Don't skip any.
   - `affected`: it now **behaves differently** without being edited (it calls a rule you changed, it
     shows a label you renamed). The note says what changes for it.
   - `checked`: you looked and it needs no change. The note says what you checked ("Reads the cutoff
     from the same function, still correct").
4. For any rule, limit, price, time, label or field you changed, look for every place that
   enforces, shows or copies it (forms, pages, emails, validators, admin screens). If one wasn't
   updated, add a `risk` naming that box, saying what the customer would see, and giving a `fix`
   prompt the user can paste back to you.
5. Put every changed file that isn't covered by any box in `otherFiles` (styles, config, docs).
6. Things you couldn't test yourself ("Not checked in a browser", "Payment flow not run") go in
   `untested`, one short sentence each. **Never put testing reminders in `risks`. Use `untested`.**
   `risks` is only for real problems you found or suspect.
7. **Security.** Look at what you changed the way an attacker would. If this turn added or changed
   something that could let someone take money, data or accounts (a route that doesn't check who is
   signed in, one user reading another's records by changing an id, a price taken from the browser,
   a secret sent to the browser, a webhook that doesn't check its signature), add it to `security`
   with the box, a plain `title`, what someone could do in `text`, `severity` (`high` if money, data
   or accounts are at stake, else `medium`) and a `fix` prompt. Only real concerns about code you
   wrote or read; leave it empty otherwise. Never copy a secret value into the report.
8. If you fixed an open issue (the reminder lists them as `#id`), add its id to `resolves`.
9. If you added a whole new part of the app, update the map first (see MAP.md), then report.

Write the file with your Write tool to `.agentlogix/inbox/report.json`:

```json
{
  "summary": "One or two sentences: what changed, in the user's words.",
  "customerImpact": ["What a customer will notice, if anything."],
  "touched": {
    "rules": { "state": "changed", "note": "Pickups end at 2 pm. Long trips are mornings only." },
    "quote": { "state": "affected", "note": "Not edited, but it now refuses afternoon pickups for long trips." },
    "form":  { "state": "checked", "note": "Opened it: it still offers Afternoon for long trips. See risk." },
    "pricing": { "state": "checked", "note": "Reads prices only; no price changed." }
  },
  "otherFiles": ["client/src/styles/theme.css"],
  "outsideMap": ["New styles for the pickup picker"],
  "risks": [
    {
      "node": "form",
      "title": "Form and server disagree",
      "text": "The server now refuses afternoon pickups for long trips, but the form still offers Afternoon. Customers find out only after pressing Continue.",
      "fix": "Update the booking form so it greys out Afternoon for long trips, using the same rule function as the server."
    }
  ],
  "security": [],
  "resolves": [],
  "untested": ["Not checked in a browser: the pickup picker on a phone screen."]
}
```

Rules: `state` is `new`, `changed`, `affected` (behaves differently, not edited) or `checked`
(looked, no change needed). Keys in `touched` and `node` must be box ids from
the map. Keep notes to one sentence. Never claim something is safe: say what you checked.
