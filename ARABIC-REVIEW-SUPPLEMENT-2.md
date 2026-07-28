# Arabic Review — Supplement 2 (4 rows)

> For the reviewer already holding the main pack (`ARABIC-REVIEW-PACK.md`, prepared 2026-07-22). Community project — not affiliated with or endorsed by TDRA.
>
> **Please keep working on the main pack as you are.** This is a short add-on, not a replacement: the test pages gained a proper site header and footer on 2026-07-26, which introduced one new string and gave three existing ones a second home. Fill this in and send it back together with the main pack.

## How to respond

Same as before. For each row mark the **Verdict** column:

- ✅ — correct and natural for a UAE government website
- ✏️ — needs correction → **write the corrected Arabic in the Correction column**
- ⚠️ — understandable but unnatural/wrong register → note what would be better

Target register: **Modern Standard Arabic in the UAE government service style.** Notes in Arabic or English both fine.

---

## 1. New string

This is an **accessible name** — invisible on screen, but read aloud by screen readers to announce what the collapsed mobile menu is. It should sound natural spoken, not just correct on paper.

| # | Arabic | Intended meaning / role | Where | Verdict | Correction |
|---|---|---|---|---|---|
| C39 | القائمة الرئيسية للجوال | "Main menu (mobile)" — the accessible name of the site's navigation in its mobile/collapsed form | packages/aegov-audit/evals/fixtures/compliant/ar.html:57 |  |  |

**Worth knowing:** the English side says "Main (mobile)". If a UAE government site would more naturally say something else here — or would simply say القائمة الرئيسية without distinguishing mobile at all — please say so. "Mobile" may be an English habit that does not belong in the Arabic.

## 2. Existing rows that now appear in a second place

You may have already marked these in the main pack under Group D (generated demo pages). **You do not need to mark them twice** — if you have, that verdict stands and this section is only for your information. They are listed because a correction now has to be applied in two places rather than one, and I want to be sure nothing is missed.

| # | Arabic | Intended meaning / role | Now also appears in | Verdict (only if not already marked) | Correction |
|---|---|---|---|---|---|
| D15 | فتح القائمة الرئيسية | "Open main menu" — label on the button that opens the mobile menu | compliant/ar.html:53 |  |  |
| D60 | روابط التذييل | "Footer links" — the accessible name of the footer's navigation | compliant/ar.html:91 |  |  |
| D83 | جميع الحقوق محفوظة | "All rights reserved" — the closing phrase of the copyright line | compliant/ar.html:112 |  |  |

For **D83**, the main pack shows this phrase attached to a real entity's name. Here it follows a fictional ministry name, so please judge the **phrase itself** — is جميع الحقوق محفوظة the wording a UAE federal entity would use in its footer?

## 3. One thing to look at in context, if you have time

In the same page, these navigation labels now appear **three times each** — in the desktop navigation, in the mobile menu, and in the footer:

> الخدمات · عن الوزارة · اتصل بنا

They are already in the main pack (rows **C5, C6, C7**) and need only one verdict. The reason for mentioning them: seeing the same label repeated across a header, a mobile menu and a footer sometimes reveals that a wording which reads fine in one place is wrong in another — for example a footer heading that should be a noun phrase rather than an imperative. If anything jars when you picture the whole page, please note it on those rows.

---

*File to review:* `packages/aegov-audit/evals/fixtures/compliant/ar.html` — a fictional "Ministry of Example" service page, the Arabic half of a bilingual pair. Nothing in it is real government content.
