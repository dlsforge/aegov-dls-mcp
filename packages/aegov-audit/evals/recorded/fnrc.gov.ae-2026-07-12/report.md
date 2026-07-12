# Mizan audit — https://fnrc.gov.ae

> @dlsforge/aegov-audit@0.0.1 · 2026-07-12T12:29:59.159Z · win32 x64, node v24.16.0
> Page: HTTP 200, 1395 nodes in 3036 ms — "مؤسسة الفجيرة للموارد الطبيعية" (lang=en dir=(unset))
> Final URL after redirects: https://fnrc.gov.ae/portal/home/index

**42 finding(s)** — 1 critical, 17 serious, 21 moderate, 3 minor · engines: axe 4.12.1, dls @aegov/design-system@3.0.7

## Lighthouse vs TDRA thresholds (local run conditions)

| Measure | Form factor | Value | TDRA threshold | Meets (local run)? |
|---|---|---|---|---|
| accessibility | mobile | 87 | >=90 | **no** |
| performance | mobile | 26 | >=90 | **no** |
| seo | mobile | 82 | >=90 | **no** |
| bestPractices | mobile | 65 | >=80 (preferably >=90) | **no** |
| largestContentfulPaint | mobile | 24402 | <=2.5s (2500 ms) | **no** |
| firstContentfulPaint | mobile | 5493 | <=1.8s (1800 ms) | **no** |
| accessibility | desktop | 77 | >=90 | **no** |
| performance | desktop | 23 | >=90 | **no** |
| seo | desktop | 82 | >=90 | **no** |
| bestPractices | desktop | 65 | >=80 (preferably >=90) | **no** |
| largestContentfulPaint | desktop | 6085 | <=2.5s (2500 ms) | **no** |
| firstContentfulPaint | desktop | 1913 | <=1.8s (1800 ms) | **no** |

- mobile: simulate (Lighthouse default for mobile); screen 412x823@1.75 mobile; chrome flags: --headless=new --no-first-run
- desktop: simulate (Lighthouse default for desktop); screen 1350x940@1; chrome flags: --headless=new --no-first-run

## TDRA assessment checklist (v2.0, published 2023-09-26)

Mizan machine-checks 14 of 125 checklist items (fully or partially). "No automated findings" covers the machine-checkable subset only — it is NOT a pass; the remaining items are process/design questions a human answers.

### SECTION 3: TECHNOLOGY

- **• 3.2** Have you built your frontend using TailwindCSS classes?
  - no automated findings (subset only — not a pass)
- **✗ 3.4** Is your frontend code structurally hierarchical using the accurate placement of <h1> to <h6> tags?
  - 2 finding(s)
  - [moderate|external] heading-order: Heading levels should only increase by one → fix: Fix any of the following:
  Heading order invalid
  - [moderate|external] page-has-heading-one: Page should contain a level-one heading → fix: Fix all of the following:
  Page must have a level-one heading
- **✗ 3.6** Are you using components and block code as mentioned in the design system?
  - 7 finding(s)
  - [minor|docs] dls-class-identity: Classes not seen in any official docs example (cannot verify — may be valid Tailwind/DLS token utilities): Hide, JobBackgroundImage, JobBackgroundImageAr, M-T, Mediaimg, MediaimgAr, Miningimg, Miningi
  - [moderate|heuristic] dls-button-type: <button> without explicit type (defaults to submit inside forms): <button class="btn btn-primary" id="continueBtn" style="
    background: #b5986b
  - [moderate|heuristic] dls-button-type: <button> without explicit type (defaults to submit inside forms): <button class="btn btn-danger" style="background-color: #c3b7b7;" id="cancelBtn"
  - [moderate|heuristic] dls-button-type: <button> without explicit type (defaults to submit inside forms): <button id="btnAccept" class="btn-learn-head mt-3" style="width: 100px; text-ali
  - [moderate|heuristic] dls-button-type: <button> without explicit type (defaults to submit inside forms): <button id="btnReject" class="btn-learn-head mt-3" style="width: 100px; text-ali
  - …and 2 more
- **• 3.10** Are you adding accurate aria attributes to form elements and labels?
  - no automated findings (subset only — not a pass)
- **✗ 3.12** Have you tested your frontend code to be AA Level compliant with WCAG 2.1
  - 4 finding(s)
  - [serious|external] color-contrast: Elements must meet minimum color contrast ratio thresholds → fix: Fix any of the following:
  Element has insufficient color contrast of 2.88 (foreground color: #9e978f, background color: #ffffff, font size: 12.0pt (
  - [critical|external] image-alt: Images must have alternative text → fix: Fix any of the following:
  Element does not have an alt attribute
  aria-label attribute does not exist or is empty
  aria-labelledby attribute does 
  - [serious|external] link-name: Links must have discernible text → fix: Fix all of the following:
  Element is in tab order and does not have accessible text

Fix any of the following:
  Element does not have text that is 
  - [serious|external] scrollable-region-focusable: Scrollable region must have keyboard access → fix: Fix any of the following:
  Element should have focusable content
  Element should be focusable
- **• 3.24** Have you used the login block as described with UAE Pass as the primary login method?
  - no automated findings (subset only — not a pass)
- **• 3.26** Is the Doctype HTML5 on the top of all pages?
  - no automated findings (subset only — not a pass)
- **• 3.27** Is the charset declared as UTF-8?
  - no automated findings (subset only — not a pass)
- **• 3.28** Is the viewport declared accurately?
  - no automated findings (subset only — not a pass)
- **✗ 3.32** Are you using "rel=canonical" to avoid duplicate content page indexing?
  - 1 finding(s)
  - [minor|heuristic] meta-canonical: No rel=canonical link — review whether duplicate-content indexing is possible on this page. → fix: Add <link rel="canonical" href="…"> when the same content is reachable under several URLs.
- **✗ 3.33** Have you ensured adding the "direction" attribute to your body tag according to your language?
  - 11 finding(s)
  - [moderate|heuristic] dls-arabic-rtl: Arabic text renders in an LTR context (<h3.heading> "خدمات الشركات") with no dir="rtl" in scope and no explicit lang="ar" inline tagging — RTL is first-class in the standard; review the direction hand → fix: Establish dir="rtl" on the Arabic content (or tag a short inline island with lang="ar").
  - [moderate|heuristic] dls-arabic-rtl: Arabic text renders in an LTR context (<p> "ستكشف مجموعة خدمات الشركة المقدمة من قبل منظمتنا.") with no dir="rtl" in scope and no explicit lang="ar" inline tagging — RTL is first-class in the standard → fix: Establish dir="rtl" on the Arabic content (or tag a short inline island with lang="ar").
  - [moderate|heuristic] dls-arabic-rtl: Arabic text renders in an LTR context (<a.btn-learn-head.mt-3> "اعرف المزيد") with no dir="rtl" in scope and no explicit lang="ar" inline tagging — RTL is first-class in the standard; review the direc → fix: Establish dir="rtl" on the Arabic content (or tag a short inline island with lang="ar").
  - [moderate|heuristic] dls-arabic-rtl: Arabic text renders in an LTR context (<h3.heading> "خدمات النقليات") with no dir="rtl" in scope and no explicit lang="ar" inline tagging — RTL is first-class in the standard; review the direction han → fix: Establish dir="rtl" on the Arabic content (or tag a short inline island with lang="ar").
  - [moderate|heuristic] dls-arabic-rtl: Arabic text renders in an LTR context (<p> "اختر الخيار المخصص لاستكشاف خدمات النقل الشاملة لدينا.") with no dir="rtl" in scope and no explicit lang="ar" inline tagging — RTL is first-class in the sta → fix: Establish dir="rtl" on the Arabic content (or tag a short inline island with lang="ar").
  - …and 6 more
- **✗ 3.34** Have you ensured added the "lang" attribute to your HTML tag based on your language?
  - 1 finding(s)
  - [serious|heuristic] meta-lang-mismatch: The document declares lang="en" but the visible text is predominantly Arabic (82% Arabic script) — the declared language must match the content. → fix: Serve the Arabic variant with <html lang="ar" dir="rtl"> (and the English variant with lang="en").
- **✗ 3.35** Have you ensured all pages list the alternate language tag?
  - 1 finding(s)
  - [minor|heuristic] meta-alternate: No alternate-language link tags (<link rel="alternate" hreflang=…>) — pages should list their other-language version. → fix: Add hreflang alternate links on every page of both language versions.
- **✗ 3.48** Are all images dynamically adding an alt tag that is meaningful to the image?
  - 14 finding(s)
  - [critical|external] image-alt: Images must have alternative text → fix: Fix any of the following:
  Element does not have an alt attribute
  aria-label attribute does not exist or is empty
  aria-labelledby attribute does 
  - [serious|heuristic] dls-img-alt: <img> without alt attribute (WCAG 2.2 AA 1.1.1): <img class="ar-logo-1" src="/portal/Content/images/fnrc/assets/fnrcimages/logo f
  - [serious|heuristic] dls-img-alt: <img> without alt attribute (WCAG 2.2 AA 1.1.1): <img src="/portal/Content/images/fnrc/assets/fnrcimages/logo-right.png" style="w
  - [serious|heuristic] dls-img-alt: <img> without alt attribute (WCAG 2.2 AA 1.1.1): <img class="plub-icon" src="/portal/Content/images/fnrc/assets/FNRC ASSETS 2/Gro (×2 occurrences)
  - [serious|heuristic] dls-img-alt: <img> without alt attribute (WCAG 2.2 AA 1.1.1): <img src="/portal/Content/images/fnrc/assets/fnrcimages/A-.png">
  - …and 9 more

_111 of 125 checklist items need human review (process/design questions outside automated scope)._

## Further findings (no single checklist item, still on-standard requirements)

- [moderate|external] axe/landmark-unique: Landmarks should have a unique role or role/label/title (i.e. accessible name) combination
- [moderate|external] axe/region: All page content should be contained by landmarks

## Disclaimers

- Community tool. Not affiliated with or endorsed by TDRA.
- Automated checks cover only a machine-checkable subset of the standard — a clean automated run is NOT compliance and NOT WCAG 2.1/2.2 AA conformance.
- Arabic/RTL parity findings are flags for native-speaker review; Mizan never asserts parity as settled.
- Lighthouse numbers were produced under the run conditions recorded in this report (local machine, simulated throttling) — they are comparable across local runs, not to TDRA's environment.
- This is a private report for the site's own team.
