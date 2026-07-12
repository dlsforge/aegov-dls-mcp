# Mizan evals — the exit test

This folder is the measurable form of STAGE2-HANDOFF §3: against fixture sites with **known** defects, every check must catch what it should and stay quiet when it should — no critical miss, no fabricated failure. Run with `npm run evals` (in this package) or `npm run evals:audit` (repo root). CI runs it on every push.

## How it works

Each directory under `fixtures/` holds a small site plus an `expected.json`:

| Field | Meaning |
|---|---|
| `target` | HTML file the CLI audits |
| `parity` | optional other-language file, passed as `--parity` |
| `expected` | findings that MUST fire: `{ ruleId, severity?, minCount? }` |
| `forbidden` | ruleIds that must NOT fire — the stays-quiet proof |
| `maxFindings` | optional cap; `0` pins the compliant fixture to total silence |

`run-evals.mjs` drives the real CLI (`node dist/index.js <target> --json`) — the same surface users and CI run — and diffs `report.findings` against the expectation. When a fixture fails, fix the **rules engine**, never the report (§3).

## The fixtures

- **compliant** — bilingual EN/AR pair styled exclusively with DLS token values, official classes only, UAE Pass on the login, masked Emirates ID + exact pattern, full document meta, structural parity. Must produce **zero** findings including the parity pass.
- **seeded-a11y** — alt-less image, unlabeled field, low-contrast text (axe + the shared DLS img-alt rule).
- **seeded-dls** — the live docs-drift class, an unknown `aegov-*` class, a hard-coded inline design value (token fidelity, T4), a typeless button, a broken check-item (structure, T5).
- **seeded-eid** — unmasked Emirates ID on display, EID input without the exact `^784-\d{4}-\d{7}-\d$` pattern, a provably month-first date.
- **seeded-uaepass** — real login surface with no UAE Pass signal.
- **seeded-meta** — legacy doctype and missing charset/viewport/canonical/lang/dir/alternates (TDRA items 3.26–3.35).
- **seeded-langmix** — Arabic page served under `lang="en"` in an LTR context — modeled on a defect found live during the recorded real-site run.
- **seeded-parity** — degraded Arabic variant: no `dir="rtl"`, missing component, link-count drift. All parity findings are review flags, never assertions.

Arabic strings in fixtures are machine-generated and marked for **native-speaker review** — do not treat them as approved government copy.

## Recorded real-site run

`recorded/` holds at least one full run against a real UAE government site with its exact run conditions, kept as evidence for the exit test ("report matches what a manual expert review would find"). The recorded report was cross-checked against independent blind expert reviews; see `NOTES.md` beside the report for the comparison and the documented machine-check boundaries.
