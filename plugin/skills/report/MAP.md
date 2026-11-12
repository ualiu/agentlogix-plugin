# Building the AgentLogix map

Read the repo (package.json files, the routes, pages, models, config and services) and write the
map with your Write tool to `.agentlogix/inbox/map.json`. AgentLogix validates it, lays the boxes
out itself and shows any error on the dashboard. Don't add positions.

The reader owns the app but may not know how it is built. Every title and description must make
sense to them: "Booking form", "Checkout", "Emails and tracking", not "BookController" or "utils".
No em dashes.

## What goes in it

**nodes**: the change map. 6 to 10 boxes (never more than 14), each a part of the app a customer
or the owner would recognise. Follow the main path a customer takes (form → quote → checkout →
payment → database → emails), then add the other important parts. Each has:
- `id`: short, lowercase, dashes (`booking-form`)
- `title`: 1 to 3 words
- `plain`: one or two sentences on what it does, for the owner (the card shows about three lines)
- `kind`: what sort of part it is, for its icon: `screen` (pages and forms people use), `server`
  (the backend that takes requests), `logic` (rules, prices, settings, shared code), `data`
  (the database and stored records), `service` (an outside service: Stripe, email, maps) or `jobs`
  (things that run on a timer or in the background)
- `files`: globs relative to the repo root, forward slashes (`client/src/components/booking/**`).
  Every source file should belong to one box where possible. Prefer folders and globs over long lists.

**edges**: how the boxes connect.
- `flow`: A hands the work to B, in the order a customer action travels (`form` → `quote`).
- `reads`: A uses rules, data or settings defined in B. Add one whenever a part **shows,
  enforces or copies** something defined elsewhere. A form that offers pickup times the server
  checks `reads` the rules. A pricing page that lists prices `reads` the rules. These edges are
  how AgentLogix spots a part that was left behind, so don't leave them out.

**blocks**: the layers every app has. Use the ones that exist, from: Frontend, Backend,
Authentication, Database, API endpoints, Outside services. Each has `plain`, up to 4 short
`facts` ("React 18 and Vite", "33 endpoints, 16 admin only") and `files` globs.

**features**: what customers and the owner actually use (Booking, Tracking, Customer accounts,
Admin queue, Discount codes...). Each has `plain`, `files`, `uses` (names from `services`) and,
if one box is the heart of it, `node`.

**flows**: the 2 or 3 most important journeys through the app, the way a customer or the owner
lives them ("Booking a delivery", "Refunding an order", "Signing up"). Each has `id`, `title`,
`plain` (one sentence) and `steps`: 2 to 10 steps in order, each `{ "node": <box id>, "text": ... }`
saying in one sentence what happens at that box on this journey. Follow the real code path (read
it, don't guess). A box can appear in more than one flow. AgentLogix shows which steps each AI
change touched, so pick journeys that matter to the business.

**security**: possible security problems you noticed while reading the code for the map, the
kind a fixed rule can't see: a route that changes or shows data without checking who is signed in,
one user able to see another user's records by changing an id, a price or amount taken from the
browser, an admin page anyone can open, a payment marked paid without asking Stripe, uploads with
no type or size check. Each is `{ "node": <box id>, "title": ..., "text": ..., "severity": "high" | "medium",
"fix": ... }`: `title` in a few plain words, `text` saying what someone could do and why it matters,
`fix` a prompt the user can paste back to you. `high` means someone could take money, data or
accounts; otherwise `medium`. Only real findings from code you read; leave the list empty if you
saw none. Never copy a secret value into the map. (AgentLogix scans for leaked keys, open database
rules and injection on its own, so you don't need to list those.)

**services**: outside things features depend on, by name: "Database", "Stripe", "Clerk",
"Google Maps", "Resend". Keep to the ones that matter.

**stats**: counts you can verify: `pages`, `endpoints` (API routes), `records` (kinds of
database records).

## Shape

```json
{
  "name": "sprynter",
  "summary": "A courier booking site with an admin queue. React frontend, Express backend, MongoDB database.",
  "stats": { "pages": 20, "endpoints": 33, "records": 6 },
  "services": ["Database", "Clerk", "Stripe", "Google Maps", "Resend"],
  "blocks": [
    { "id": "frontend", "title": "Frontend", "plain": "Everything the customer sees in the browser.", "facts": ["React 18 and Vite", "20 pages"], "files": ["client/src/**"] }
  ],
  "features": [
    { "id": "booking", "title": "Booking", "plain": "Customers enter addresses, pick a time and speed, see the price and pay.", "files": ["client/src/components/booking/**", "server/routes/deliveries.js"], "uses": ["Database", "Stripe", "Google Maps"], "node": "form" }
  ],
  "nodes": [
    { "id": "form", "title": "Booking form", "plain": "Where the customer enters addresses, the pickup time and the parcel.", "kind": "screen", "files": ["client/src/pages/Book.jsx", "client/src/components/booking/**"] },
    { "id": "quote", "title": "Quote", "plain": "Answers the form: can we do this trip, and what does it cost?", "kind": "server", "files": ["server/routes/quote.js"] },
    { "id": "rules", "title": "Rules and prices", "plain": "Pickup hours, cutoffs and every price, in one place.", "kind": "logic", "files": ["server/config/**"] }
  ],
  "edges": [
    { "from": "form", "to": "quote", "kind": "flow" },
    { "from": "quote", "to": "rules", "kind": "flow" },
    { "from": "form", "to": "rules", "kind": "reads" }
  ],
  "flows": [
    {
      "id": "book-delivery",
      "title": "Booking a delivery",
      "plain": "A customer goes from the form to a priced, bookable trip.",
      "steps": [
        { "node": "form", "text": "The customer enters both addresses and a pickup time, then presses Continue." },
        { "node": "quote", "text": "The server checks the trip can be done and works out the price." },
        { "node": "rules", "text": "Pickup hours, cutoffs and prices are looked up here." }
      ]
    }
  ],
  "security": [
    {
      "node": "quote",
      "title": "The price comes from the browser",
      "text": "Checkout charges the amount the booking form sends, so a customer could change it and pay less.",
      "severity": "high",
      "fix": "Make checkout work out the price on the server from the trip details, using the same rules as Quote, and ignore any amount sent by the browser."
    }
  ]
}
```

When you update the map later (a new part was added), write the whole map again, keeping existing
ids so history lines up. AgentLogix lays the boxes out left to right along the `flow` edges, so
getting those right is what makes the map read well.
