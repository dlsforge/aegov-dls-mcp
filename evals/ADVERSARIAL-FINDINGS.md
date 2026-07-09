# Adversarial findings — `@dlsforge/aegov-mcp`

> Response to `evals/ADVERSARIAL-BRIEF.md`. An independent pass that tried to break the
> central claim. Verified against a live build (`npm run build`) on `@aegov/design-system@3.0.7`.
> Every reproducer below was run through the **real** `validate_snippet` MCP tool over stdio.
> Baseline at time of testing: `npm run evals` 10/10, `npm run smoke` 19/19, `npm run validate` OK.

## Answer to the brief's single most important question

**Is 10/10 a real measure of standard-compliance, or has the standard leaked into the tests/tools?**

Partly leaked. The **package tier is genuinely sound** — the catalogue's 41 `aegov-*` classes match the compiled `dist/plugin.js` selectors exactly, the drift list is complete, and `validate_snippet` rejects every non-shipping `aegov-*` class. But the **UAE-specific heuristics in `validate_snippet` are unsound in both directions**, and the 10/10 pass survives them only because each eval spec hard-codes the exact expected pattern string (e.g. screen 10's `requiredPatterns` literally contains `pattern="^784-\d{4}-\d{7}-\d$"`). That check lives in the *spec*, not the *tool*. A real assistant building a screen that isn't one of the 10 — e.g. an EID field named `national_id`, or a profile page showing a stored ID — gets `valid: true` on non-compliant markup.

So: the exit-test number is real for the 10 canned screens, but the load-bearing tool that a connected assistant actually relies on ("call this on every snippet… fix errors and re-validate") will certify non-compliant Emirates ID handling as valid. Findings F1–F2 are where the claim is weakest.

---

## F1 — HIGH — ✅ FIXED — `validate_snippet` misses Emirates ID fields whose identity is on the `<label>`, not the `<input>` tag

The `looksEid` heuristic (`src/tools/validateSnippet.ts:156-166`) inspects **only the `<input>` tag string**. The code comment claims a field's identity is "its name/id/placeholder/**label**" — but the associated `<label>` element is never read. Any Emirates ID field labelled through a separate `<label for=…>` with a generic `name`/`id` and no `784` in the tag dodges all three signals, so the mandatory-pattern check never runs.

**Reproducer (missing pattern — should be an error, isn't):**
```html
<div class="aegov-form-control">
  <label for="idn">Emirates ID number</label>
  <div class="form-control-input">
    <input type="text" id="idn" name="national_id" placeholder="Enter your ID number" required />
  </div>
</div>
```
`validate_snippet` → **`valid: true`, 0 errors, 0 warnings.**

**Control (identical, `name="emirates-id"`):** → `valid: false`, error "Emirates ID input without pattern validation". So the only thing standing between compliant and non-compliant is the string in the input's own `name`/`id`/`placeholder` — a label of "Emirates ID number" is invisible to the check. `name="national_id"`, `name="idn"`, `name="id_number"` all slip through, and a field with a **wrong** pattern under a generic name slips through the same way.

**Why it matters:** "Emirates ID … pattern validation" is a CLAUDE.md non-negotiable and brief angle #4. This is the exact "dodge all three" gap the brief predicted. The evals don't catch it because screen 10's spec hard-codes the expected `pattern=` string; nothing generalises to real forms.

**Upstream fix:** resolve `<label for=X>` → text and feed it into `looksEid`; and/or treat any `<input>` inside an `aegov-form-control` whose visible label matches `/emirates[-\s]?id|رقم الهوية/i` as an EID field. At minimum, delete the misleading "…/label" clause from the comment so it stops describing behaviour that doesn't exist.

**Fixed (`validateSnippet.ts`):** `validate_snippet` now builds a `<label for=X>` → text map and matches an `EID_SIGNAL_RE` (English + Arabic `الهوية الإماراتية`) against both the input's own attributes and its associated label; a search-input guard (`looksSearch`) prevents the label signal from re-introducing the old "Emirates ID renewal" false positive. Verified: the F1 reproducer (and its Arabic-labelled variant) now returns `valid:false`; the search-box control stays `valid:true`.

## F2 — MEDIUM/HIGH — ✅ FIXED — an unmasked full-format Emirates ID displayed on-page was a *warning*, so `valid: true`

`src/tools/validateSnippet.ts:147-155` emits the unmasked-EID finding at `level: "warning"`. The tool's own instructions tell the assistant to "fix **errors** and re-validate" — a warning leaves `valid: true`, so the self-correction loop never removes it.

**Reproducer:**
```html
<section class="aegov-card">
  <h3>Applicant record</h3>
  <p>Emirates ID on file: 784-1985-1234567-1</p>
</section>
```
`validate_snippet` → **`valid: true`, 0 errors, 1 warning.** A fully unmasked, real-shaped Emirates ID ships.

**Why it matters:** masking is a CLAUDE.md non-negotiable and brief angle #4 ("a full unmasked Emirates ID on-page… find one it doesn't [catch]"). Only screen 10's eval catches this, via an explicit `forbiddenPattern` — again, the standard lives in the spec, not the tool. Live corroboration of the same warning-not-error class: screen 03 **passes** `npm run evals` while carrying a `validate_snippet` warning ("Arabic text but no dir=rtl"); RTL is only hard-enforced on screen 10 because its spec sets `rtl:true`.

**Upstream fix (a judgement call, but pick one):** escalate the visible-text/`value` unmasked-EID case to `error`; **or** if masking is deliberately human-judgement-only, say so and stop listing it as a non-negotiable the tool enforces. Today the docs and the code disagree.

**Fixed (`validateSnippet.ts`, decision by Alam 2026-07-09):** the unmasked-EID finding is now `level: "error"`, so `valid: false` and the assistant self-correction loop removes it. The pattern-attribute strip that precedes the check also accepts single-quoted `pattern='…'` (consistency with F3). Verified: the F2 reproducer returns `valid: false`; masked displays (`784-1945-XXXXXXX-X`) remain valid because `FULL_EID_RE` requires all digits.

## F3 — MEDIUM — ✅ FIXED — a correctly-patterned EID field is falsely flagged when the `pattern` uses single quotes

The pattern extractor at `src/tools/validateSnippet.ts:167` is `/\bpattern\s*=\s*"([^"]*)"/` — **double-quote only**. HTML permits single-quoted attribute values, so a valid field is reported as missing its pattern. This is the same false-positive class as the prior `value`-attribute bug the brief mentions (§10.9), just on a different attribute.

**Reproducer:**
```html
<div class="aegov-form-control">
  <label for="eid">Emirates ID</label>
  <input type="text" id="eid" name="emirates-id" pattern='^784-\d{4}-\d{7}-\d$' required />
</div>
```
`validate_snippet` → **`valid: false`**, error "Emirates ID input without pattern validation" — even though the pattern is present and exactly correct.

**Upstream fix:** `/\bpattern\s*=\s*(?:"([^"]*)"|'([^']*)')/` (mirror the class-attr handling), then compare `m[1] ?? m[2]`.

**Fixed (`validateSnippet.ts`):** the extractor now accepts single- or double-quoted `pattern`. Verified: the F3 reproducer returns `valid:true`.

## F4 — LOW/MEDIUM — ✅ FIXED — unquoted `class` attributes bypass class-identity validation entirely

`CLASS_ATTR_RE` (`src/tools/validateSnippet.ts:21`, and the identical copy in `scripts/run-evals.mjs:56`) only matches quoted values. HTML5-valid unquoted class values are never tokenised, so an unshipped `aegov-*` class in unquoted form escapes the "certain" package-tier check.

**Reproducer:**
```html
<a class=aegov-totally-fake-nonexistent-class href="#">Click</a>
<span class="aegov-also-fake">x</span>
```
`validate_snippet` → flags only `aegov-also-fake` (quoted); **`aegov-totally-fake-nonexistent-class` (unquoted) passes silently.**

**Why it's lower:** LLM-generated markup almost always quotes attributes, so real-world exposure is small — but it's a hole in the tier the project calls "certain," and the eval judge shares the blind spot. **Upstream fix:** add the unquoted alternative `class\s*=\s*([^\s"'=<>`]+)` to both regexes.

**Fixed:** the unquoted alternative was added to `CLASS_ATTR_RE` in both `src/tools/validateSnippet.ts` and `scripts/run-evals.mjs` (with the third capture group threaded through `classTokens`). Verified: the unquoted fake class in the F4 reproducer is now flagged.

---

## What held up (calibration — these attacks failed)

- **Package-class fidelity:** catalogue's 41 `aegov-*` classes ⇔ compiled `dist/plugin.js` selectors, exact set match, zero drift either direction.
- **Drift-class completeness:** the 5 non-shipping docs classes used in examples (`aegov-newslette`, `aegov-pagination-larger/-smaller`, `aegov-slider-next/-prev`) are exactly the 5 in `knownDocsOnlyClasses`; no unacknowledged drift class exists, and `validate_snippet` errors on every non-shipping `aegov-*` class regardless of the list.
- **The prior `value`-attribute EID false positive is genuinely fixed** — a search box valued "Emirates ID renewal" is no longer flagged.
- **`scaffoldEmiratesId` / `scaffoldUaePass` emit compliant output:** correct double-quoted pattern, masked placeholders (no real EID literal), explicit `type="button"` reveal control, Arabic strings flagged for native review, provenance + source URLs present, appearances/min-size enum-constrained.

## Resolution status

| # | Severity | Status | Note |
|---|----------|--------|------|
| F1 | HIGH | ✅ fixed | label→input association + Arabic signal + search guard |
| F2 | MED/HIGH | ✅ fixed | escalated to `error` (Alam's decision, 2026-07-09) |
| F3 | MED | ✅ fixed | `pattern` extractor accepts single quotes |
| F4 | LOW/MED | ✅ fixed | unquoted `class` handled in tool + judge |

All four findings fixed in `src/tools/validateSnippet.ts` (F4 also `scripts/run-evals.mjs`); no catalogue regeneration. Post-fix baseline re-run: **`npm run evals` 10/10, `npm run smoke` 19/19, `npm run validate` OK** — the exit test held, confirming these were tool-soundness bugs the canned specs already papered over.

**F2 resolved (2026-07-09):** Alam decided masking is tool-enforced — the unmasked-EID finding is now an `error`, so the code and CLAUDE.md's non-negotiable agree.
