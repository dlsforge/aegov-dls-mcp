# Mizan audit — https://fnrc.gov.ae

> @dlsforge/aegov-audit@0.0.1 · 2026-07-21T19:05:51.937Z · win32 x64, node v24.16.0
> Page: HTTP 200, 1395 nodes in 271 ms — "مؤسسة الفجيرة للموارد الطبيعية" (lang=en dir=(unset))
> Final URL after redirects: https://fnrc.gov.ae/portal/home/index

**85 finding(s)** — 1 critical, 20 serious, 57 moderate, 7 minor · engines: axe 4.12.1, dls @aegov/design-system@3.0.7

## Lighthouse vs TDRA thresholds (local run conditions)

| Measure | Form factor | Value | TDRA threshold | Meets (local run)? |
|---|---|---|---|---|
| accessibility | mobile | 87 | >=90 | **no** |
| performance | mobile | 27 | >=90 | **no** |
| seo | mobile | 82 | >=90 | **no** |
| bestPractices | mobile | 65 | >=80 (preferably >=90) | **no** |
| largestContentfulPaint | mobile | 19086 | <=2.5s (2500 ms) | **no** |
| firstContentfulPaint | mobile | 5330 | <=1.8s (1800 ms) | **no** |
| accessibility | desktop | 77 | >=90 | **no** |
| performance | desktop | 21 | >=90 | **no** |
| seo | desktop | 82 | >=90 | **no** |
| bestPractices | desktop | 65 | >=80 (preferably >=90) | **no** |
| largestContentfulPaint | desktop | 5306 | <=2.5s (2500 ms) | **no** |
| firstContentfulPaint | desktop | 2145 | <=1.8s (1800 ms) | **no** |

- mobile: simulate (Lighthouse default for mobile); screen 412x823@1.75 mobile; chrome flags: --headless=new --no-first-run
- desktop: simulate (Lighthouse default for desktop); screen 1350x940@1; chrome flags: --headless=new --no-first-run

## TDRA assessment checklist (v2.0, published 2023-09-26)

Mizan machine-checks 53 of 125 checklist items (fully or partially). "No automated findings" covers the machine-checkable subset only — it is NOT a pass; the remaining items are process/design questions a human answers. Items marked "not checked" had no evidence engine in this run: they need --lighthouse, an http(s) target (origin probes and the bounded crawl), --entity-type ministry (item 2.12), or a keyboard walk that completed without aborting.

### SECTION 2 : DESIGN

- **✗ 2.2** Has your design process included the approved font mentioned in the design system?
  - 1 finding(s)
  - [moderate|heuristic] style-font-family: The dominant body-text font family is "droid arabic kufi regular" (100% of sampled text) — not one of the DLS font tokens (inter, roboto, noto kufi arabic, alexandria). → fix: Use the DLS font tokens (Inter/Roboto for Latin, Noto Kufi Arabic/Alexandria for Arabic).
- **✗ 2.3** Has the design process added the the approved fonts for headings in the mentioned font weight?
  - 1 finding(s)
  - [minor|heuristic] style-heading-typography: Headings deviate from the DLS typography tokens: h2 (3/3 rendered at weight 400, family "droid arabic kufi regular"; token says weight 800); h3 (25/25 rendered at weight 800, family "droid arabic kufi → fix: Style headings with the DLS heading utilities so family and weight come from the tokens.
- **• 2.6** Has the design team adhered to the neutral colour palette for background colour?
  - no automated findings (subset only — not a pass)
- **✗ 2.7** Has the design team adhered to the primary text colour of AEBLACK-800?
  - 1 finding(s)
  - [moderate|heuristic] style-text-primary: The dominant body-text colour computes to rgb(158, 151, 143) (no DLS token match) across 63% of sampled text — the checklist asks for AEBLACK-800 as the primary text colour. → fix: Set primary body text to the aeblack-800 token.
- **✗ 2.8** Has the design team adhered to the use of the primary colour of AEGOLD-600 for actions?
  - 1 finding(s)
  - [moderate|heuristic] style-action-gold: None of the 48 action element(s) on the page use AEGOLD-600 (or any aegold-scale token) for background, border or text — the checklist asks for AEGOLD-600 as the primary action colour. Observed action → fix: Style primary actions (buttons, CTAs) with the aegold-600 token.
- **✗ 2.9** Have you tested sections of your website's background and foreground colour usage to be 3:1?
  - 10 finding(s)
  - [moderate|heuristic] style-section-contrast: Text in <footer.text-center.text-lg-start.text-white> has a 2.61:1 contrast ratio against the section background (rgb(158, 151, 143) on rgb(247, 243, 237), e.g. <a.hov>) — below the checklist's 3:1 re → fix: Raise the contrast between the section background and its foreground content to at least 3:1.
  - [moderate|heuristic] style-section-contrast: Text in <footer.text-center.text-lg-start.text-white> has a 2.61:1 contrast ratio against the section background (rgb(158, 151, 143) on rgb(247, 243, 237), e.g. <span.ft-span>) — below the checklist's → fix: Raise the contrast between the section background and its foreground content to at least 3:1.
  - [moderate|heuristic] style-section-contrast: Text in <footer.text-center.text-lg-start.text-white> has a 2.61:1 contrast ratio against the section background (rgb(158, 151, 143) on rgb(247, 243, 237), e.g. <a.hov>) — below the checklist's 3:1 re → fix: Raise the contrast between the section background and its foreground content to at least 3:1.
  - [moderate|heuristic] style-section-contrast: Text in <footer.text-center.text-lg-start.text-white> has a 2.61:1 contrast ratio against the section background (rgb(158, 151, 143) on rgb(247, 243, 237), e.g. <a.hov>) — below the checklist's 3:1 re → fix: Raise the contrast between the section background and its foreground content to at least 3:1.
  - [moderate|heuristic] style-section-contrast: Text in <footer.text-center.text-lg-start.text-white> has a 2.61:1 contrast ratio against the section background (rgb(158, 151, 143) on rgb(247, 243, 237), e.g. <span.ft-span>) — below the checklist's → fix: Raise the contrast between the section background and its foreground content to at least 3:1.
  - …and 5 more
- **✗ 2.10** Have you tested contrast ratio of action elements background and foreground to be 4.5:1?
  - 10 finding(s)
  - [moderate|heuristic] style-action-contrast: Action element <a.txt-cnter.myBtn2> has a 2.89:1 text/background contrast ratio (rgb(158, 151, 143) on rgb(255, 255, 255)) — below the checklist's 4.5:1 requirement for action elements. → fix: Adjust the action element's colours to reach 4.5:1 (the DLS token pairs meet this).
  - [moderate|heuristic] style-action-contrast: Action element <a.txt-cnter.myBtn2> has a 2.89:1 text/background contrast ratio (rgb(158, 151, 143) on rgb(255, 255, 255)) — below the checklist's 4.5:1 requirement for action elements. → fix: Adjust the action element's colours to reach 4.5:1 (the DLS token pairs meet this).
  - [moderate|heuristic] style-action-contrast: Action element <a.txt-cnter.myBtn2> has a 2.89:1 text/background contrast ratio (rgb(158, 151, 143) on rgb(255, 255, 255)) — below the checklist's 4.5:1 requirement for action elements. → fix: Adjust the action element's colours to reach 4.5:1 (the DLS token pairs meet this).
  - [moderate|heuristic] style-action-contrast: Action element <a.txt-cnter.myBtn2> has a 2.89:1 text/background contrast ratio (rgb(158, 151, 143) on rgb(255, 255, 255)) — below the checklist's 4.5:1 requirement for action elements. → fix: Adjust the action element's colours to reach 4.5:1 (the DLS token pairs meet this).
  - [moderate|heuristic] style-action-contrast: Action element <button.slide-btn> has a 1:1 text/background contrast ratio (rgb(255, 255, 255) on rgb(255, 255, 255)) — below the checklist's 4.5:1 requirement for action elements. → fix: Adjust the action element's colours to reach 4.5:1 (the DLS token pairs meet this).
  - …and 5 more
- **○ 2.12** FOR MINISTRIES ONLY: Are you following the primary colour palette only using AEGOLD and AEBLACK as your primary colours?
  - not checked in this run — its evidence engine did not run (see the checklist note)
- **• 2.23** Has the design process ensured that all icons are a minimum of 24px in width and height?
  - no automated findings (subset only — not a pass)
- **✗ 2.35** Has the design team created hidden design elements such as "Skip to content"
  - 1 finding(s)
  - [moderate|heuristic] dom-skip-link: No "skip to content" link detected among in-page anchors (heuristic — checked link text/class/target in English and Arabic). → fix: Add a (visually hidden, focus-visible) <a href="#main">Skip to content</a> as the first focusable element.
- **• 2.38** Has the design team tested the layout when zoomed in to a browser at 175%?
  - no automated findings (subset only — not a pass)
- **✗ 2.42** Have you created user-friendly error pages for 404, 403, 500
  - 1 finding(s)
  - [moderate|heuristic] http-error-page: The 404 response for an unknown URL looks like a bare server default (1245 bytes) — not the user-friendly designed error page the checklist asks for (404/403/500). → fix: Serve the designed 404 page (site navigation, bilingual message, link home); do the same for 403/500.
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
- **✗ 3.8** Have you added the "aria-hidden="true" attribute to icons that must not be read by screen readers?
  - 1 finding(s)
  - [moderate|heuristic] dom-icon-aria-hidden: 10 icon element(s) are neither aria-hidden="true" nor given an accessible name — screen readers may announce them meaninglessly. → fix: Add aria-hidden="true" to decorative icons; give meaningful icons an accessible name.
- **✗ 3.9** Have you ensured all icons have a supporting text - either visible or wrapped in the "sr-only" class?
  - 1 finding(s)
  - [moderate|heuristic] dom-icon-no-text: 10 icon-only link(s)/button(s) carry no supporting text — neither visible, sr-only, nor aria-label. → fix: Add visible text, a .sr-only span, or an aria-label to every icon-only control.
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
- **• 3.13** Can you navigate your entire website using only a keyboard - without the use of a trackpad or a mouse?
  - no automated findings (subset only — not a pass)
- **✗ 3.14** Have you added a focus state to every action element? Have you tested your website for focus states?
  - 1 finding(s)
  - [serious|heuristic] kbd-focus-indicator: 10 of 75 keyboard-focused element(s) show no visible focus indication (no outline and no focused-vs-blurred style change, including ::before/::after): <a.navbar-brand> in header/nav, <a.navbar-brand>  → fix: Never remove outlines without a replacement — style :focus-visible on all interactive elements.
- **• 3.23** Is your hero block using <picture> with srcset to add a different image for mobile and desktop?
  - no automated findings (subset only — not a pass)
- **• 3.24** Have you used the login block as described with UAE Pass as the primary login method?
  - no automated findings (subset only — not a pass)
- **• 3.25** Have you added the Page Rating block to all service card pages?
  - no automated findings (subset only — not a pass)
- **• 3.26** Is the Doctype HTML5 on the top of all pages?
  - no automated findings (subset only — not a pass)
- **• 3.27** Is the charset declared as UTF-8?
  - no automated findings (subset only — not a pass)
- **• 3.28** Is the viewport declared accurately?
  - no automated findings (subset only — not a pass)
- **✗ 3.29** Are all meta title and description tags unique? Have you ensured unique dynamic content when required?
  - 1 finding(s)
  - [moderate|heuristic] crawl-title-duplicate: 2 pages share the identical <title> "نبذة عن المؤسسة" across 7 crawled page(s) (home + 6, cap 6) — the checklist asks for unique meta titles per page. → fix: Give every page a unique, descriptive title (CMS templates should interpolate the page name).
- **• 3.30** Has a favicon been included with variations for bookmarking sizes?
  - no automated findings (subset only — not a pass)
- **✗ 3.31** Are you using the Apple-meta tags to control the colour of your website's pre header?
  - 1 finding(s)
  - [minor|heuristic] dom-theme-color: No theme-color / Apple status-bar meta tag — the browser pre-header colour is not controlled. → fix: Add <meta name="theme-color" content="…"> (and the Apple status-bar variant).
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
  - 2 finding(s)
  - [minor|heuristic] meta-alternate: No alternate-language link tags (<link rel="alternate" hreflang=…>) — pages should list their other-language version. → fix: Add hreflang alternate links on every page of both language versions.
  - [minor|heuristic] crawl-alternate-missing: 6 of 6 crawled subpage(s) list no <link rel="alternate" hreflang="…"> — every page should point to its other-language version. → fix: Emit alternate hreflang links on every page of both language versions.
- **✗ 3.36** Have you ensured you have the facility to generate open meta tags for social media?
  - 1 finding(s)
  - [moderate|heuristic] dom-og-tags: No Open Graph meta tags (og:*) on the page — social-media shares will not carry controlled title/image. → fix: Emit og:title, og:description and og:image per page (the CMS should generate them).
- **• 3.37** Have you structured your HTML using HTML5 semantic tags (such as <header>, <footer>, <section>, <main>)
  - no automated findings (subset only — not a pass)
- **✗ 3.38** Have you created the Error pages - 404, 403, 500
  - 1 finding(s)
  - [moderate|heuristic] http-error-page: The 404 response for an unknown URL looks like a bare server default (1245 bytes) — not the user-friendly designed error page the checklist asks for (404/403/500). → fix: Serve the designed 404 page (site navigation, bilingual message, link home); do the same for 403/500.
- **✗ 3.39** Have you ensured you are following the design system guideline on use of hyperlinks to add "rel=noopener" where required?
  - 1 finding(s)
  - [minor|heuristic] dom-noopener: 17 link(s) with target="_blank" lack rel="noopener" — modern browsers imply it, but the design-system guideline asks for it explicitly. → fix: Add rel="noopener" (or "noopener noreferrer") to links opening new tabs.
- **• 3.41** Have you ensured the use of Google Fonts and not loading fonts from your server?
  - no automated findings (subset only — not a pass)
- **• 3.43** Have you ensured that CSS is NON-Blocking?
  - no automated findings (subset only — not a pass)
- **✗ 3.46** Are you minifying your rendered CSS and JavaScript for a production environment?
  - 2 finding(s)
  - [moderate|external] lh-unminified-css: Unminified CSS shipped to production (Lighthouse unminified-css; mobile: Est savings of 27 KiB; desktop: Est savings of 27 KiB). → fix: Minify rendered CSS in the production build pipeline.
  - [moderate|external] lh-unminified-javascript: Unminified JavaScript shipped to production (Lighthouse unminified-javascript; mobile: Est savings of 54 KiB; desktop: Est savings of 54 KiB). → fix: Minify rendered JavaScript in the production build pipeline.
- **• 3.47** Are you implementing a cache system for faster page load?
  - no automated findings (subset only — not a pass)
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
- **✗ 3.49** Are you using Picture/Srcset for images as described in the design system?
  - 1 finding(s)
  - [moderate|heuristic] dom-no-srcset: None of the 120 images use srcset or <picture> — no responsive image delivery as the design system describes. → fix: Serve size-appropriate variants via srcset/sizes or <picture>.
- **✗ 3.50** Have you enabled lazy loading for images?
  - 1 finding(s)
  - [moderate|heuristic] dom-no-lazy-loading: None of the 120 images use loading="lazy" — below-the-fold images all load eagerly. → fix: Add loading="lazy" to images below the fold (keep the LCP/hero image eager).
- **✗ 3.51** Are you using WebP as your image format primarily?
  - 1 finding(s)
  - [moderate|heuristic] dom-no-webp: 78 images resolve to JPEG/PNG/GIF by URL and none to WebP/AVIF (extension-based check — a CDN content-negotiating formats would not show here; verify the actual response types). → fix: Serve WebP (with fallbacks via <picture>) as the primary image format.
- **• 3.52** Are you videos being loaded based on user's device and internet speed? This would happen by default if you are hosting public videos on Youtube or Vimeo
  - no automated findings (subset only — not a pass)
- **✗ 3.53** Eliminating all images on the page, is your page weight below 500KB while loading?
  - 1 finding(s)
  - [serious|external] lh-page-weight-no-images: Page weight excluding images exceeds the TDRA budget of 500 KB (checklist 3.53): mobile 1.02 MB, desktop 1.40 MB. Transfer size of this local load, images subtracted. → fix: Trim non-image payload: split/defer JavaScript, remove unused CSS, subset fonts, enable text compression.
- **✗ 3.54** With all images on your page, is your page weight below 4MB while loading?
  - 1 finding(s)
  - [serious|external] lh-page-weight-total: Total page weight exceeds the TDRA budget of 4 MB (checklist 3.54, read as 4.00 MB): desktop 5.55 MB. Transfer size of this local load. → fix: Reduce transferred bytes: compress/resize images, remove unused scripts and styles, enable text compression.
- **✗ 3.57** Have you ensured JavaScript is placed at the end of your website?
  - 1 finding(s)
  - [moderate|heuristic] dom-blocking-script-head: 3 script(s) load synchronously in <head> (no defer/async/module): https://cdn.datatables.net/1.11.5/js/jquery.dataTables.min.js, https://www.google.com/recaptcha/enterprise.js?render=6LeMlEAoAAAAAPWFz → fix: Move scripts before </body> or mark them defer/async.
- **• 3.58** Have you taken into account third party scripts and software that will affect your load time in a production environment?
  - no automated findings (subset only — not a pass)
- **• 3.59** Have you added a cookie banner?
  - no automated findings (subset only — not a pass)
- **✗ 3.64** Does your content management system generate a Sitemap.xml file?
  - 1 finding(s)
  - [moderate|heuristic] http-sitemap: No sitemap found: https://fnrc.gov.ae/sitemap.xml answers HTTP 404 and robots.txt declares no Sitemap → fix: Generate sitemap.xml from the CMS and declare it in robots.txt.

_72 of 125 checklist items need human review (process/design questions outside automated scope)._

## Further findings (no single checklist item, still on-standard requirements)

- [moderate|external] axe/landmark-unique: Landmarks should have a unique role or role/label/title (i.e. accessible name) combination
- [moderate|external] axe/region: All page content should be contained by landmarks

## Disclaimers

- Community tool. Not affiliated with or endorsed by TDRA.
- Automated checks cover only a machine-checkable subset of the standard — a clean automated run is NOT compliance and NOT WCAG 2.1/2.2 AA conformance.
- Arabic/RTL parity findings are flags for native-speaker review; Mizan never asserts parity as settled.
- Lighthouse numbers were produced under the run conditions recorded in this report (local machine, simulated throttling) — they are comparable across local runs, not to TDRA's environment.
- This is a private report for the site's own team.
