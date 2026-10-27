# Factory Console

The control surface for an autonomous weekly app factory: see what it has built,
add your own ideas, and tell it what to do next — without opening a terminal.

**[Open the console →](https://factory-console.pages.dev/)**

---

## What it does

- **Overview** — apps shipped against the 52-week target, pace, mean score, what the
  factory is building right now and which phase it reached, and when it next runs.
- **Apps** — every app shipped, with its live link, repository, category and honest
  self-assessed score.
- **Ideas** — search the standing idea bank, add your own, and mark one **Build next**
  so the following run picks it.
- **Control** — write an instruction in plain English. The next run reads it before
  doing anything else, acts on it, and replies on the thread.

## How it talks to the factory

Reading a public factory repository needs no credentials, so the dashboard loads
straight away with nothing to set up. A token is needed only to **write** — adding
an idea or sending an instruction — and to read a private repository. When you
supply one it is kept in your browser's `localStorage` and sent only to
`api.github.com`; nothing from the repository is baked into this deployment.

Ideas and instructions become GitHub issues labelled `idea` and `request`. The
factory's scheduled runs read those labels, act, and close the issue with a reply —
so the console is a real control surface, not a read-only dashboard.

```
  console  ──creates issue──►  factory repo  ──read by──►  scheduled run
     ▲                                                          │
     └──────────── ledger, checkpoints, reports ◄───────────────┘
```

## Running it locally

```bash
npm install
npm run dev
```

| Command             | What it does                                                    |
| ------------------- | --------------------------------------------------------------- |
| `npm run dev`       | Development server                                              |
| `npm run build`     | Production build into `dist/`                                   |
| `npm test`          | Unit tests                                                      |
| `npm run test:e2e`  | End-to-end and accessibility tests, against a mocked GitHub API |
| `npm run typecheck` | Type checking                                                   |
| `npm run lint`      | Lint                                                            |
| `npm run budget`    | Bundle size budget                                              |

## Licence

MIT — see [LICENSE](./LICENSE).

---

Built by the [weekly app factory](https://github.com/oliverinhalo/Claude).
