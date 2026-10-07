# Factory Console — specification

## The sentence

Factory Console helps **the owner of an autonomous app factory** **see what it is
doing and steer it** in **under a minute a day**, without **opening a terminal or a
chat session**.

## The core loop

1. Open the console. See immediately whether a run is in progress and what it is on.
2. Scan progress: shipped against target, pace, mean score.
3. Open **Apps** to visit anything already shipped.
4. Open **Ideas** to search the bank, or add one of your own.
5. Mark an idea **Build next** to make it the next thing built.
6. Open **Control** to write an instruction in plain English.
7. Send it. The next run picks it up, acts, and replies on the thread.

## Out of scope

- Editing the idea bank file directly. Ideas arrive as issues; the factory merges them.
- Live chat with the agent. Instructions are asynchronous by design — the agent runs
  on a schedule, not on demand.
- Triggering a run on demand. Claude routines fire on their own schedule and cannot
  be dispatched from a webpage.
- Editing or deploying app code.
- Authentication, accounts, or multi-user support. One person, one browser, one token.
- Server-side anything. No backend, no database, no cookies.

## Acceptance criteria

1. With no stored token, the first screen explains what is needed and links straight
   to GitHub's token page with the exact permissions listed.
2. **Connect** stays disabled until the token is over 20 characters and the
   repository matches `owner/name`.
3. The token is rendered as a password field and never appears as readable text.
4. A token the API rejects returns the viewer to the setup screen with the reason,
   not to a dead end.
5. A missing ledger, idea bank, checkpoint directory or reports directory each
   degrade to an explanatory empty state rather than an error.
6. A token lacking Issues or Actions permission still renders a working dashboard,
   with a note naming what is hidden.
7. Searching the idea bank with no matches explains itself and suggests adding one.
8. Sending an idea or instruction keeps the current view mounted and shows the
   issue number it created.
9. No horizontal scroll at 320px.
10. Zero serious or critical axe violations on both the connect screen and the
    dashboard, in both colour schemes.

## Data model

Read-only from the factory repository via the GitHub API:

| Source                       | Used for                            |
| ---------------------------- | ----------------------------------- |
| `factory/state/ledger.json`  | apps, progress, scores              |
| `factory/ideas/idea-bank.md` | the idea bank, parsed from Markdown |
| `factory/state/run/*.json`   | the in-progress run and its phase   |
| `factory/state/reports/*.md` | links to past run reports           |
| issues labelled `idea`       | ideas you submitted                 |
| issues labelled `request`    | instructions you sent               |
| `actions/runs`               | recent workflow activity            |

Written: issues only. The console never pushes code.

Stored locally: the token and the repository name. Nothing else.

## The four states

| State   | Behaviour                                                                                                     |
| ------- | ------------------------------------------------------------------------------------------------------------- |
| Empty   | No apps yet → explains the first is built on the next run and needs nothing from you.                         |
| Error   | Token problems return to setup with the reason; other failures offer _Try again_ and _Use a different token_. |
| Slow    | Skeletons on first load only. A refresh keeps the current view and marks the button _Refreshing…_.            |
| Offline | The fetch fails and the error state explains it; the page itself still renders.                               |

## The one thing that must be excellent

The first screen. Everything else is only reachable through it, and a mis-scoped
token is the likeliest reason this page fails — so it must name the exact
permissions, not send the viewer to go and read documentation.
