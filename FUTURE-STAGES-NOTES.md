# Future Stages — Reference Notes (Stages 2 & 3)

> **Why this file is notes, not a full handoff.** Stage 2's exact design depends on what Stage 1 produces — especially the shape of the parsed component catalogue, which the auditor will reuse. Writing a detailed Stage 2 spec now would mean inventing details we'd likely rewrite. Stage 3 is not an engineering task at all. So this file captures **intent, scope, key decisions, and dependencies** so the work can be picked up later without re-deriving the strategy. Turn the relevant section into a full handoff (like `STAGE1-HANDOFF.md`) when that stage is actually about to begin.

---

## Stage 2 — Compliance & Accessibility Auditor

> **Superseded:** this section has been expanded into the full build brief `STAGE2-HANDOFF.md` (currently DRAFT, awaiting Alam's go). Where the two disagree, the handoff wins; this section remains as the original strategy record.

### Intent
A tool that inspects a finished or in-progress government website and reports, in seconds, whether it meets the UAE's mandatory standards — turning a slow, expert-only manual review into an instant, repeatable check. It combines proven accessibility/performance engines with a custom layer of **design-system-specific** checks that generic tools cannot do.

### Why it is a separate stage
It depends on Stage 1. The auditor's "is this the correct component / token?" checks should reuse the **structured catalogue** built in Stage 1. Do not duplicate that catalogue — import or share it. This is the single most important cross-stage dependency.

### Likely tech stack (confirm at build time)
- **axe-core** — open-source accessibility engine; the foundation for WCAG checks.
- **Lighthouse** — Google's open-source auditor for performance, accessibility, and SEO scores (the same measures TDRA uses).
- **Playwright** — open-source browser automation to load pages and inspect their rendered Arabic / right-to-left state.
- **Custom DLS rules engine** — the differentiator; see checks below.
- **GitHub Actions** — free CI integration so audits run on every change.

### What the custom rules engine must check (the differentiating value)
- Correct use of design-system **tokens** (not arbitrary hard-coded values).
- Presence of the **mandatory UAE Pass** login where login exists.
- Valid **Emirates ID** handling (format `784-NNNN-NNNNNNN-N`, masking, validation).
- **Arabic / right-to-left parity** — both language versions present and structurally equivalent.
- Use of official **components/blocks/patterns** over hand-rolled equivalents.

### Compliance targets to report against
- **WCAG 2.2 Level AA** (report against 2.1 as well, since it is the legal baseline).
- The official **TDRA assessment criteria**, including the Lighthouse thresholds: **Accessibility, Performance, and SEO ≥ 90; Best Practices ≥ 80**, with the load-time targets, on both desktop and mobile. Re-verify the exact current numbers against the official TDRA assessment-criteria document before relying on them — these figures move.
- Shape the output **to mirror the official assessment checklist** so an entity can hand it straight to a reviewer.

### Definition of done (exit test)
> Run against a real government entity website, the auditor's report **matches what a manual expert review would find** and **maps cleanly onto the official TDRA assessment checklist.**

### Indicative effort
Roughly **80–140 effort-hours** — larger than Stage 1 because it integrates several finicky engines and adds the custom rules. About two to four weeks of active lead-developer-plus-owner collaboration; longer part-time.

### Cautions
- Lighthouse scores must be produced under the conditions TDRA specifies (e.g. run location matters); document the exact run conditions in the report.
- Keep the human in the loop on Arabic parity — automated checks flag, a person confirms.

---

## Stage 2B — Mizan Coverage Expansion + TDRA Excel Output (added 2026-07-20)

> Drafted as a full build brief in `STAGE2B-HANDOFF.md` (DRAFT, awaiting Alam's go); that file wins over this note. Intent: grow Mizan's machine-checked TDRA items from 14/125 to ≥50 with deterministic rules only (no LLM — judgment items stay in Studio's lane), and add `--format xlsx` output that fills a copy of TDRA's own assessment workbook with evidence. Exists to strengthen Stage 3's demo package.

---

## Stage 3 — Recognition & Adoption (not an engineering task)

### Intent
Take the two finished tools to the people who matter — government entities, the accredited agencies that build for them, and TDRA itself — and earn recognised credibility. Then decide, on evidence, whether to evolve the toolkit into a hosted service.

### Key actions
- Apply to the **UAE Design System Excellence Program** (the route to recognised expertise; recognition is tied to **90%+ adherence** to the standards, judged by an independent panel). Confirm the current track names and criteria on the official site before applying.
- Prepare a **demo package** and reach out to **TDRA** through their official channels (the design system's GitHub, and the official design-system contact address) seeking feedback or a community spotlight.
- Gather **evidence of real-world use** — ideally sustained interest from **two or more** entities or accredited partners.

### Decision point at the end of Stage 3
- **If adoption is strong:** evolve the toolkit into a hosted service. This is the first point where paid infrastructure (hosting, possibly LLM API costs for any optional generative features) becomes justified.
- **If adoption is soft:** keep refining the open-source tools and credibility; do not over-invest in infrastructure prematurely.

### Timeline
Measured in **months, not effort-hours** — it depends on external review cycles, relationships, and government procurement rhythms rather than coding. Patience and positioning matter more than speed.

### Cautions
- Production government deployment often runs through **accredited vendors** and may have sovereign-cloud / network requirements; partnering with an Excellence Program agency may be the realistic path to a live deployment.
- Re-check all official figures, programme names, and criteria against primary TDRA sources before any external presentation — treat anything written from memory as provisional.

---

## Cross-stage dependencies (quick reference)

| Dependency | From | To | Why it matters |
|---|---|---|---|
| Structured component/token catalogue | Stage 1 | Stage 2 | The auditor reuses it to judge "correct component/token." Share, don't duplicate. |
| The rules file (UAE Pass, Emirates ID, RTL, WCAG) | Stage 1 | Stage 2 | The auditor enforces the same rules the server promotes. Keep them consistent. |
| Working, credible open-source tools | Stages 1 & 2 | Stage 3 | Recognition and adoption need something real and trustworthy to point at. |
