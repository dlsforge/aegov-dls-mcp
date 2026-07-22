# Arabic Native-Speaker Review Pack — dlsforge (aegov-dls-mcp)

> Prepared 2026-07-22 from the repository at tag `aegov-audit-v0.1.0`. Community project — not affiliated with or endorsed by TDRA.

## Dear reviewer — what this is and how to respond

This open-source toolkit generates and audits **UAE government web pages** against the AEGOV Design System. All Arabic in it was **machine-generated and never reviewed by a native speaker**. You are that reviewer. The target register is **Modern Standard Arabic in the UAE government service style** (the TDRA content guideline specifies MSA).

For each row, please mark the **Verdict** column:

- ✅ — correct and natural for a UAE government website
- ✏️ — needs correction → **write the corrected Arabic in the Correction column**
- ⚠️ — understandable but unnatural/wrong register → note what would be better

Notes are welcome in Arabic or English. Please **don't skip Group B** — there the question is different (it's about what real websites say, not about our wording). Group E is quoted from official sources and needs no correction. When done, send this file back.

---

## Group A — strings that SHIP inside generated pages (highest priority)

These are emitted by the code generators (`scaffoldUaePass`, `scaffoldEmiratesId`) into real government prototypes. A mistake here is reproduced on every page anyone generates.

| # | Arabic | Intended meaning / role | Where | Verdict | Correction |
|---|---|---|---|---|---|
| A1 | تسجيل الدخول بالهوية الرقمية | Sign in with the UAE PASS digital identity | packages/aegov-audit/evals/fixtures/compliant/ar.html:46<br>packages/aegov-mcp/evals/outputs/09-uaepass-login.html:345 (+2) |  |  |
| A2 | رقم الهوية الإماراتية | Emirates ID number (form label) | packages/aegov-audit/evals/fixtures/compliant/ar.html:57<br>packages/aegov-mcp/evals/outputs/10-emirates-id-form-rtl.html:301 (+1) |  |  |
| A3 | الهوية الرقمية | the (national) digital identity — UAE PASS | packages/aegov-mcp/evals/outputs/09-uaepass-login.html:325<br>packages/aegov-mcp/evals/outputs/09-uaepass-login.html:358 (+1) |  |  |
| A4 | أدخل الأرقام الخمسة عشر لهويتك الإماراتية — تُضاف الشرطات تلقائيًا | Enter the 15 digits of your Emirates ID — dashes are added automatically (hint text) | packages/aegov-mcp/evals/outputs/10-emirates-id-form-rtl.html:317<br>packages/aegov-mcp/src/tools/scaffoldEmiratesId.ts:30 |  |  |
| A5 | أدخل رقم هوية إماراتية صحيحًا بالصيغة | Enter a valid Emirates ID number in the format … (error message; format sample follows) | packages/aegov-mcp/src/tools/scaffoldEmiratesId.ts:34 |  |  |
| A6 | إظهار رقم الهوية كاملًا | Show the full ID number (reveal-toggle label) | packages/aegov-mcp/src/tools/scaffoldEmiratesId.ts:36 |  |  |
| A7 | إخفاء رقم الهوية | Hide the ID number (mask-toggle label) | packages/aegov-mcp/src/tools/scaffoldEmiratesId.ts:37 |  |  |
| A8 | إنشاء حساب بالهوية الرقمية | Create an account with UAE PASS | packages/aegov-mcp/src/tools/scaffoldUaePass.ts:32 |  |  |
| A9 | المتابعة بالهوية الرقمية | Continue with UAE PASS | packages/aegov-mcp/src/tools/scaffoldUaePass.ts:34 |  |  |
| A10 | التوقيع بالهوية الرقمية | Sign (a document) with UAE PASS | packages/aegov-mcp/src/tools/scaffoldUaePass.ts:35 |  |  |

## Group B — recognition patterns (different question!)

Mizan (the auditor) uses these words/stems to **recognize things on real websites** — skip links, cookie banners, login buttons, rating blocks. The question is NOT "is this good Arabic" but: **is this what real UAE government sites actually write?** If sites commonly use different wording, tell us what to add.

| # | Pattern | What it recognizes / our question | Where | Verdict | Additions/notes |
|---|---|---|---|---|---|
| B1 | تخط | Stem used to RECOGNIZE Arabic skip-links (matches تخطي / تخطى…). Is this stem what real UAE gov sites use in "skip to content" links? | packages/aegov-audit/src/engines/assets.ts:68 |  |  |
| B2 | ملفات تعريف الارتباط | Used to RECOGNIZE Arabic cookie banners. Is this the standard term for "cookies" on UAE gov sites, or do some use كوكيز or another wording we should also match? | packages/aegov-audit/src/engines/assets.ts:55 |  |  |
| B3 | تسجيل الدخول | Used to RECOGNIZE login controls (so Mizan can require UAE PASS on them). Are there other common Arabic login-button wordings we should also match (e.g. دخول alone)? | packages/aegov-audit/src/engines/uaepass.ts:22 |  |  |
| B4 | الهوية الإماراتية | Used to RECOGNIZE Emirates-ID input fields from their labels. Is this the label wording gov forms actually use? Any common alternates (بطاقة الهوية…)? | packages/aegov-rules-core/src/rules/engine.ts:53 |  |  |
| B5 | هل كانت هذه الصفحة مفيدة | Used to RECOGNIZE the "Page Rating" block. Is this the phrasing UAE gov sites actually use ("Was this page helpful?")? Other common variants? | packages/aegov-audit/src/engines/crawl.ts:86 |  |  |
| B6 | قيّم هذه الصفحة | Second recognizer for the rating block ("Rate this page"). Same question as above. | packages/aegov-audit/src/engines/crawl.ts:86 |  |  |
| B7 | خدم | Stem used to CLASSIFY service pages from URL/title/headings (matches خدمة / خدمات / خدماتنا…). Reasonable stem? Any false-match risk you can think of? | packages/aegov-audit/src/engines/crawl.ts:100 |  |  |

## Group C — hand-authored fixture pages (test/demo material)

Small fake government pages used for testing and demos (a fictional "Ministry of Example"). They are visible in the public repository, so they should read like real, well-written government pages.

| # | Arabic | Intended meaning / role | Where | Verdict | Correction |
|---|---|---|---|---|---|
| C1 | قدّم طلب شهادة الخدمة عبر الإنترنت | Apply for the service certificate online (og:description) | packages/aegov-audit/evals/fixtures/compliant/ar.html:17 |  |  |
| C2 | تخطي إلى المحتوى | Skip to content (skip link) | packages/aegov-audit/evals/fixtures/compliant/ar.html:37 |  |  |
| C3 | شعار وزارة المثال | Emblem of the Ministry of Example (image alt) | packages/aegov-audit/evals/fixtures/compliant/ar.html:39 |  |  |
| C4 | رئيسي | Main (navigation aria-label) | packages/aegov-audit/evals/fixtures/compliant/ar.html:40 |  |  |
| C5 | الخدمات | Services (nav link) | packages/aegov-audit/evals/fixtures/compliant/ar.html:41<br>packages/aegov-mcp/evals/outputs/10-emirates-id-form-rtl.html:71 (+3) |  |  |
| C6 | عن الوزارة | About the ministry (nav link) | packages/aegov-audit/evals/fixtures/compliant/ar.html:42 |  |  |
| C7 | اتصل بنا | Contact us (nav link) | packages/aegov-audit/evals/fixtures/compliant/ar.html:43<br>packages/aegov-audit/test/fixtures/parity-ar.html:12 (+1) |  |  |
| C8 | طلب شهادة خدمة | Apply for a service certificate (page h1) | packages/aegov-audit/evals/fixtures/compliant/ar.html:49 |  |  |
| C9 | قدّم طلبك عبر الإنترنت. تكتمل المعالجة خلال 3 أيام عمل | Submit your application online. Processing completes within 3 working days. | packages/aegov-audit/evals/fixtures/compliant/ar.html:50 |  |  |
| C10 | يُغلق باب التقديم في | Applications close on … (a DMY date follows) | packages/aegov-audit/evals/fixtures/compliant/ar.html:51 |  |  |
| C11 | بياناتك | Your details (section heading) | packages/aegov-audit/evals/fixtures/compliant/ar.html:53 |  |  |
| C12 | الهوية الإماراتية المسجلة | Emirates ID on file (label before a masked ID) | packages/aegov-audit/evals/fixtures/compliant/ar.html:54 |  |  |
| C13 | أؤكد أن المعلومات المقدمة صحيحة | I confirm the information provided is accurate (checkbox label) | packages/aegov-audit/evals/fixtures/compliant/ar.html:63 |  |  |
| C14 | إرسال الطلب | Submit application (button) | packages/aegov-audit/evals/fixtures/compliant/ar.html:65<br>packages/aegov-mcp/evals/outputs/10-emirates-id-form-rtl.html:355 |  |  |
| C15 | وزارة المثال | Ministry of Example (fictional entity name) | packages/aegov-audit/evals/fixtures/compliant/ar.html:70<br>packages/aegov-audit/evals/fixtures/seeded-langmix/index.html:25 (+1) |  |  |
| C16 | جهة حكومية اتحادية في دولة الإمارات العربية المتحدة | A federal government entity of the United Arab Emirates | packages/aegov-audit/evals/fixtures/compliant/ar.html:71 |  |  |
| C17 | إشعار ملفات تعريف الارتباط | Cookie notice (region aria-label) | packages/aegov-audit/evals/fixtures/compliant/ar.html:72 |  |  |
| C18 | نستخدم ملفات تعريف الارتباط لتحسين هذه الخدمة | We use cookies to improve this service | packages/aegov-audit/evals/fixtures/compliant/ar.html:73 |  |  |
| C19 | قبول ملفات تعريف الارتباط | Accept cookies (button) | packages/aegov-audit/evals/fixtures/compliant/ar.html:74 |  |  |
| C20 | وزارة المثال — الخدمات | Page title: "Ministry of Example — Services" | packages/aegov-audit/evals/fixtures/compliant/ar.html:9<br>packages/aegov-audit/evals/fixtures/compliant/ar.html:16 |  |  |
| C21 | العربية | Arabic (language-switch link on the English page) | packages/aegov-audit/evals/fixtures/compliant/index.html:45 |  |  |
| C22 | خدمات الشركات | Corporate services (h1) | packages/aegov-audit/evals/fixtures/seeded-langmix/index.html:16 |  |  |
| C23 | ستكتشف هنا مجموعة خدمات الشركات المقدمة من قبل المؤسسة لدعم قطاع الأعمال | Here you will discover the corporate services offered by the corporation to support the business sector | packages/aegov-audit/evals/fixtures/seeded-langmix/index.html:21 |  |  |
| C24 | انتقل إلى دليل خدماتنا واختر الخدمة التي تناسب احتياجاتك، ثم قدّم الطلب إلكترونياً | Go to our service directory, choose the service that fits your needs, then apply electronically | packages/aegov-audit/evals/fixtures/seeded-langmix/index.html:22 |  |  |
| C25 | تكتمل معالجة الطلبات خلال ثلاثة أيام عمل من تاريخ استيفاء المستندات | Applications are processed within three working days from the date documents are complete | packages/aegov-audit/evals/fixtures/seeded-langmix/index.html:23 |  |  |
| C26 | جميع الخدمات | All services | packages/aegov-audit/evals/fixtures/seeded-parity/ar.html:24 |  |  |
| C27 | تصفح | Browse | packages/aegov-audit/evals/fixtures/seeded-parity/ar.html:26 |  |  |
| C28 | شهادة ميلاد | Birth certificate | packages/aegov-audit/evals/fixtures/seeded-parity/ar.html:28 |  |  |
| C29 | شهادة زواج | Marriage certificate | packages/aegov-audit/evals/fixtures/seeded-parity/ar.html:29 |  |  |
| C30 | حجز اسم تجاري | Trade name reservation | packages/aegov-audit/evals/fixtures/seeded-parity/ar.html:30 |  |  |
| C31 | المزيد | More | packages/aegov-audit/evals/fixtures/seeded-parity/ar.html:32 |  |  |
| C32 | دليل الخدمات | Service directory | packages/aegov-audit/evals/fixtures/seeded-parity/ar.html:9<br>packages/aegov-audit/evals/fixtures/seeded-parity/ar.html:27 (+1) |  |  |
| C33 | إرسال | Send / Submit (button) | packages/aegov-audit/test/fixtures/parity-ar.html:10 |  |  |
| C34 | صفحة الخدمة | Service page (title) | packages/aegov-audit/test/fixtures/parity-ar.html:5 |  |  |
| C35 | واحد | One (placeholder heading) | packages/aegov-audit/test/fixtures/parity-ar.html:7 |  |  |
| C36 | تقديم طلب خدمة | Submit a service application | packages/aegov-audit/test/fixtures/parity-ar.html:9 |  |  |
| C37 | قدّم طلبك الآن | Submit your application now (CTA on a seeded-defect fixture) | packages/aegov-audit/test/fixtures/seeded-dls.html:29 |  |  |
| C38 | الصفحة غير موجودة | Page not found (bilingual designed-404 test page) | packages/aegov-audit/test/tier-b.test.mjs:90 |  |  |

## Group D — AI-generated demo pages (eval outputs)

Full bilingual pages produced by an AI assistant connected to our tools, committed as evidence that the tools work (`packages/aegov-mcp/evals/outputs/`, especially `09-uaepass-login.html` and `10-emirates-id-form-rtl.html`). **These files are never hand-edited** (that is an evaluation rule) — your corrections here will instead improve the generators and their instructions. Mark anything wrong or unnatural; short notes are enough.

| # | Arabic | Page | Verdict | Notes |
|---|---|---|---|---|
| D1 | عربي | 01-homepage-ministry.html |  |  |
| D2 | دفع مخالفة مرورية | 02-service-details.html |  |  |
| D3 | تسجيل الدخول إلى حسابك | 09-uaepass-login.html |  |  |
| D4 | تستخدم هذه الخدمة | 09-uaepass-login.html |  |  |
| D5 | الهوية الرقمية الوطنية لدولة الإمارات — كوسيلة وحيدة لتسجيل الدخول. سيتم توجيهك إلى منصة الهوية الرقمية للتحقق من هويتك بشكل آمن، ثم إعادتك إلى هذه الصفحة للمتابعة | 09-uaepass-login.html |  |  |
| D6 | هي أول هوية رقمية وطنية للمواطنين والمقيمين والزوار في دولة الإمارات. تتيح لك تسجيل الدخول إلى آلاف الخدمات الحكومية وخدمات القطاع الخاص بحساب واحد، وتوقيع المستندات رقمياً | 09-uaepass-login.html |  |  |
| D7 | لا تملك حساباً في الهوية الرقمية؟ حمّل تطبيق | 09-uaepass-login.html |  |  |
| D8 | لإنشاء حسابك وتوثيقه | 09-uaepass-login.html |  |  |
| D9 | هل وجدت هذا المحتوى مفيداً؟ يمكنك مساعدتنا على التحسين من خلال مشاركة ملاحظاتك حول تجربتك | 09-uaepass-login.html |  |  |
| D10 | البيانات المفتوحة | 10-emirates-id-form-rtl.html |  |  |
| D11 | المشاركة الرقمية | 10-emirates-id-form-rtl.html |  |  |
| D12 | عن الهيئة | 10-emirates-id-form-rtl.html |  |  |
| D13 | إمكانية الوصول | 10-emirates-id-form-rtl.html |  |  |
| D14 | تبديل اللغة | 10-emirates-id-form-rtl.html |  |  |
| D15 | فتح القائمة الرئيسية | 10-emirates-id-form-rtl.html |  |  |
| D16 | تخطّي إلى المحتوى الرئيسي | 10-emirates-id-form-rtl.html |  |  |
| D17 | إغلاق القائمة الرئيسية | 10-emirates-id-form-rtl.html |  |  |
| D18 | إغلاق النافذة | 10-emirates-id-form-rtl.html |  |  |
| D19 | لغات أخرى | 10-emirates-id-form-rtl.html |  |  |
| D20 | تستخدم قائمة "لغات أخرى" أعلاه خدمة ترجمة | 10-emirates-id-form-rtl.html |  |  |
| D21 | لإنشاء ترجمة آلية للمحتوى لغرض العرض. دقة الترجمة الآلية غير مضمونة | 10-emirates-id-form-rtl.html |  |  |
| D22 | التصنيف بالنجوم الذهبية | 10-emirates-id-form-rtl.html |  |  |
| D23 | حصلت الهيئة الاتحادية للهوية والجنسية والجمارك وأمن المنافذ على | 10-emirates-id-form-rtl.html |  |  |
| D24 | تصنيف خمس نجوم | 10-emirates-id-form-rtl.html |  |  |
| D25 | من النظام العالمي للتصنيف بالنجوم للخدمات بتاريخ | 10-emirates-id-form-rtl.html |  |  |
| D26 | اعرف المزيد | 10-emirates-id-form-rtl.html |  |  |
| D27 | مسار التنقل | 10-emirates-id-form-rtl.html |  |  |
| D28 | استخدم النموذج التالي لتقديم طلب تجديد تصريح الإقامة. يُرجى إدخال بياناتك كما هي مسجلة في الهوية الإماراتية. الحقول المميّزة بعلامة النجمة | 10-emirates-id-form-rtl.html |  |  |
| D29 | إلزامية | 10-emirates-id-form-rtl.html |  |  |
| D30 | شعار الهيئة الاتحادية للهوية والجنسية | 10-emirates-id-form-rtl.html |  |  |
| D31 | الشعار | 10-emirates-id-form-rtl.html |  |  |
| D32 | بيانات مقدّم الطلب | 10-emirates-id-form-rtl.html |  |  |
| D33 | الاسم الكامل | 10-emirates-id-form-rtl.html |  |  |
| D34 | أدخل اسمك الكامل كما في جواز السفر | 10-emirates-id-form-rtl.html |  |  |
| D35 | شعار التصنيف بالنجوم الذهبية | 10-emirates-id-form-rtl.html |  |  |
| D36 | شعار النجمة الذهبية | 10-emirates-id-form-rtl.html |  |  |
| D37 | رقم الهوية المسجّل لدينا | 10-emirates-id-form-rtl.html |  |  |
| D38 | البريد الإلكتروني | 10-emirates-id-form-rtl.html |  |  |
| D39 | سنستخدم بريدك الإلكتروني لإرسال تحديثات حالة الطلب. لن نشاركه مع أي جهة أخرى | 10-emirates-id-form-rtl.html |  |  |
| D40 | رقم الهاتف المتحرك | 10-emirates-id-form-rtl.html |  |  |
| D41 | رمز الدولة | 10-emirates-id-form-rtl.html |  |  |
| D42 | أدخل رقمك دون رمز الدولة، مثال | 10-emirates-id-form-rtl.html |  |  |
| D43 | معلومات الخدمة | 10-emirates-id-form-rtl.html |  |  |
| D44 | معلومات عن الخدمة | 10-emirates-id-form-rtl.html |  |  |
| D45 | رسوم الخدمة | 10-emirates-id-form-rtl.html |  |  |
| D46 | تبدأ رسوم تجديد تصريح الإقامة من 100 درهم إماراتي، وتختلف حسب مدة التصريح ونوعه | 10-emirates-id-form-rtl.html |  |  |
| D47 | مدة الإنجاز | 10-emirates-id-form-rtl.html |  |  |
| D48 | يُنجز الطلب عادةً خلال يومي عمل من تاريخ اكتمال البيانات والمستندات | 10-emirates-id-form-rtl.html |  |  |
| D49 | هل تحتاج مساعدة؟ | 10-emirates-id-form-rtl.html |  |  |
| D50 | اتصل بمركز الاتصال على الرقم المجاني | 10-emirates-id-form-rtl.html |  |  |
| D51 | على مدار الساعة | 10-emirates-id-form-rtl.html |  |  |
| D52 | ابحث في الموقع | 10-emirates-id-form-rtl.html |  |  |
| D53 | ابحث عن شيء ما | 10-emirates-id-form-rtl.html |  |  |
| D54 | هل وجدت هذا المحتوى مفيداً؟ | 10-emirates-id-form-rtl.html |  |  |
| D55 | يمكنك مساعدتنا على التحسين من خلال مشاركة ملاحظاتك حول تجربتك | 10-emirates-id-form-rtl.html |  |  |
| D56 | نعم، كان المحتوى مفيدًا | 10-emirates-id-form-rtl.html |  |  |
| D57 | نعم | 10-emirates-id-form-rtl.html |  |  |
| D58 | لا، لم يكن المحتوى مفيدًا | 10-emirates-id-form-rtl.html |  |  |
| D59 | لا | 10-emirates-id-form-rtl.html |  |  |
| D60 | روابط التذييل | 10-emirates-id-form-rtl.html |  |  |
| D61 | عنوان | 10-emirates-id-form-rtl.html |  |  |
| D62 | نبذة عن الهيئة | 10-emirates-id-form-rtl.html |  |  |
| D63 | الرؤية والرسالة | 10-emirates-id-form-rtl.html |  |  |
| D64 | الهيكل التنظيمي | 10-emirates-id-form-rtl.html |  |  |
| D65 | الجوائز | 10-emirates-id-form-rtl.html |  |  |
| D66 | التوظيف | 10-emirates-id-form-rtl.html |  |  |
| D67 | استخدام الموقع | 10-emirates-id-form-rtl.html |  |  |
| D68 | بحث | 10-emirates-id-form-rtl.html |  |  |
| D69 | خريطة الموقع | 10-emirates-id-form-rtl.html |  |  |
| D70 | إخلاء المسؤولية | 10-emirates-id-form-rtl.html |  |  |
| D71 | سياسة الخصوصية | 10-emirates-id-form-rtl.html |  |  |
| D72 | الشروط والأحكام | 10-emirates-id-form-rtl.html |  |  |
| D73 | معلومات ودعم | 10-emirates-id-form-rtl.html |  |  |
| D74 | المركز الإعلامي | 10-emirates-id-form-rtl.html |  |  |
| D75 | الأسئلة الشائعة | 10-emirates-id-form-rtl.html |  |  |
| D76 | الملاحظات والشكاوى | 10-emirates-id-form-rtl.html |  |  |
| D77 | مراجع | 10-emirates-id-form-rtl.html |  |  |
| D78 | القوانين واللوائح | 10-emirates-id-form-rtl.html |  |  |
| D79 | الحقيبة الإعلامية | 10-emirates-id-form-rtl.html |  |  |
| D80 | المصطلحات والاختصارات | 10-emirates-id-form-rtl.html |  |  |
| D81 | تواصل | 10-emirates-id-form-rtl.html |  |  |
| D82 | الرقم المجاني | 10-emirates-id-form-rtl.html |  |  |
| D83 | الهيئة الاتحادية للهوية والجنسية والجمارك وأمن المنافذ. جميع الحقوق محفوظة | 10-emirates-id-form-rtl.html |  |  |
| D84 | آخر تحديث في 07/07/2026 الساعة | 10-emirates-id-form-rtl.html |  |  |
| D85 | تابعنا على | 10-emirates-id-form-rtl.html |  |  |
| D86 | فيسبوك | 10-emirates-id-form-rtl.html |  |  |
| D87 | إنستغرام | 10-emirates-id-form-rtl.html |  |  |
| D88 | لينكدإن | 10-emirates-id-form-rtl.html |  |  |
| D89 | إكس (تويتر | 10-emirates-id-form-rtl.html |  |  |
| D90 | يوتيوب | 10-emirates-id-form-rtl.html |  |  |
| D91 | التنقل الرئيسي | 10-emirates-id-form-rtl.html |  |  |
| D92 | الرئيسية | 10-emirates-id-form-rtl.html |  |  |
| D93 | تجديد تصريح الإقامة | 10-emirates-id-form-rtl.html |  |  |
| D94 | الهيئة الاتحادية للهوية والجنسية والجمارك وأمن المنافذ - الإمارات العربية المتحدة | 10-emirates-id-form-rtl.html |  |  |
| D95 | إظهار القائمة الفرعية لـ "الخدمات | 10-emirates-id-form-rtl.html |  |  |
| D96 | قدّم طلب تجديد تصريح الإقامة إلكترونيًا: أدخل اسمك الكامل ورقم الهوية الإماراتية وبيانات الاتصال | 10-emirates-id-form-rtl.html |  |  |
| D97 | خدمات الإقامة | 10-emirates-id-form-rtl.html |  |  |
| D98 | إصدار تصريح إقامة | 10-emirates-id-form-rtl.html |  |  |
| D99 | إلغاء تصريح الإقامة | 10-emirates-id-form-rtl.html |  |  |
| D100 | الاستعلام عن حالة الإقامة | 10-emirates-id-form-rtl.html |  |  |
| D101 | خدمات الهوية | 10-emirates-id-form-rtl.html |  |  |
| D102 | تجديد الهوية الإماراتية | 10-emirates-id-form-rtl.html |  |  |
| D103 | بدل فاقد للهوية | 10-emirates-id-form-rtl.html |  |  |
| D104 | تحديث البيانات الشخصية | 10-emirates-id-form-rtl.html |  |  |
| D105 | هل وجدت | 10-emirates-id-form-rtl.json |  |  |

## Group E — text quoted from official sources (no correction needed)

These strings are **extracted verbatim** from the official design-system documentation and the official UAE PASS integration documentation (they appear in our machine-readable catalogue with full provenance). We never edit official text. Listed only for completeness — **skim them and flag a row only if something looks like OUR extraction mangled it** (truncated mid-word, mixed-up fragments).

| # | Arabic (excerpt) | Where | Flag? |
|---|---|---|---|
| E1 | إصدار شهادة براءة ذمة من خلال هذه الخدمة يمكن للأفراد والشركات والمؤسسات التجارية طلب إصدار شهادة براءة ذمة من المخالفات المرورية ابدأ الخدم… | packages/aegov-rules-core/catalog/catalog.json:1111<br>packages/aegov-rules-core/inventory/docs.json:2158 |  |
| E2 | أفضّل الخيار 1 أفضّل الخيار 2 أفضّل الخيار | packages/aegov-rules-core/catalog/catalog.json:1259<br>packages/aegov-rules-core/inventory/docs.json:2344 |  |
| E3 | الخيار 1 الخيار | packages/aegov-rules-core/catalog/catalog.json:1303<br>packages/aegov-rules-core/inventory/docs.json:3940 |  |
| E4 | افتح القائمة حسابي إعدادات تسجيل خروج | packages/aegov-rules-core/catalog/catalog.json:1504<br>packages/aegov-rules-core/inventory/docs.json:2567 |  |
| E5 | يبدو أن هناك خطأ مصادفة تمت مصادفة خطأ نظام غير متوقع تسبب في عدم تحميل الصفحة المقصود. لقد سجلنا هذا الخطأ وسنبحث في إصلاحه في أقرب وقت ممك… | packages/aegov-rules-core/catalog/catalog.json:167<br>packages/aegov-rules-core/catalog/catalog.json:482 (+2) |  |
| E6 | تحميل ملف | packages/aegov-rules-core/catalog/catalog.json:1694<br>packages/aegov-rules-core/inventory/docs.json:2745 |  |
| E7 | الاسم الأول | packages/aegov-rules-core/catalog/catalog.json:1856<br>packages/aegov-rules-core/inventory/docs.json:3123 |  |
| E8 | نطاق | packages/aegov-rules-core/catalog/catalog.json:1900<br>packages/aegov-rules-core/inventory/docs.json:4054 |  |
| E9 | حدد اختيارا الإمارات العربية المتحدة الهند الولايات المتحدة الأمريكية | packages/aegov-rules-core/catalog/catalog.json:1944<br>packages/aegov-rules-core/inventory/docs.json:4238 |  |
| E10 | وصف | packages/aegov-rules-core/catalog/catalog.json:1988<br>packages/aegov-rules-core/inventory/docs.json:4817 |  |
| E11 | تواصل مع قيادات الهيئة المشورات المدونات استبيان | packages/aegov-rules-core/catalog/catalog.json:2359<br>packages/aegov-rules-core/inventory/docs.json:2916 |  |
| E12 | السابق 1 2 3 4 5 ... 17 التالي | packages/aegov-rules-core/catalog/catalog.json:2574<br>packages/aegov-rules-core/inventory/docs.json:3611 |  |
| E13 | ولا بد أن تشكل ثقة القيادة الكريمة للدولة دافعاً للمزيد من العمل المتواصل المخلص لخدمة وطننا الغالي، وهي حافز متجدد لمزيد من العطاء والعمل، … | packages/aegov-rules-core/catalog/catalog.json:2778<br>packages/aegov-rules-core/inventory/docs.json:1519 |  |
| E14 | برج خليفة نخلة جميرا مول دبي سفاري الصحراء | packages/aegov-rules-core/catalog/catalog.json:3027<br>packages/aegov-rules-core/inventory/docs.json:4645 |  |
| E15 | جون دو مرحبًا جون، شكرًا لمشاركتك ملاحظاتك بخصوص | packages/aegov-rules-core/catalog/catalog.json:3173<br>packages/aegov-rules-core/inventory/docs.json:4931 |  |
| E16 | الرد | packages/aegov-rules-core/catalog/catalog.json:3173<br>packages/aegov-rules-core/inventory/docs.json:4931 |  |
| E17 | تمكين | packages/aegov-rules-core/catalog/catalog.json:3286<br>packages/aegov-rules-core/inventory/docs.json:5121 |  |
| E18 | ماذا تعني | packages/aegov-rules-core/catalog/catalog.json:43<br>packages/aegov-rules-core/inventory/docs.json:619 |  |
| E19 | الاتصالات ونظم المعلومات | packages/aegov-rules-core/catalog/catalog.json:43<br>packages/aegov-rules-core/inventory/docs.json:619 |  |
| E20 | ؟ الاتصالات ونظم المعلومات تغطي جميع خدمات وأدوات الاتصالات وتقنية المعلومات والإنترنت والفضاء الإلكتروني والراديو والتلفزيون والطيف الترددي… | packages/aegov-rules-core/catalog/catalog.json:43<br>packages/aegov-rules-core/inventory/docs.json:619 |  |
| E21 | لقد أصبحت ترقية حسابك لاستخدامه مع | packages/aegov-rules-core/catalog/catalog.json:683<br>packages/aegov-rules-core/inventory/docs.json:1377 |  |
| E22 | نشطة الآن. قم بربط حسابك بـ | packages/aegov-rules-core/catalog/catalog.json:683<br>packages/aegov-rules-core/inventory/docs.json:1377 |  |
| E23 | الصفحة الرئيسية خدماتنا من نحن تسجيل الدخول تسجيل الدخول الإمكانية الإمكانية تغيير اللغة تغيير اللغة | packages/aegov-rules-core/catalog/catalog.json:7285<br>packages/aegov-rules-core/inventory/docs.json:3478 |  |
| E24 | تبديل القائمة الرئيسية إغلاق القائمة الرئيسية الصفحة الرئيسية خدماتنا من نحن تسجيل الدخول الإمكانية تغيير اللغة | packages/aegov-rules-core/catalog/catalog.json:7285<br>packages/aegov-rules-core/inventory/docs.json:3478 |  |
| E25 | الصفحة الرئيسة المركز الإعلامي التوعية و الإرشاد عزيزي العامل | packages/aegov-rules-core/catalog/catalog.json:829<br>packages/aegov-rules-core/inventory/docs.json:1698 |  |
| E26 | اعرف حقوقك | packages/aegov-rules-core/catalog/catalog.json:829<br>packages/aegov-rules-core/inventory/docs.json:1698 |  |
| E27 | تسجيل الدخول تسجيل الدخول تسجيل الدخول تسجيل الدخول | packages/aegov-rules-core/catalog/catalog.json:942<br>packages/aegov-rules-core/inventory/docs.json:1915 |  |
| E28 | أنت غير مؤهل للوصول إلى هذه الخدمة. إما أن حسابك لم تتم ترقيته أو أن لديك حساب زائر. يُرجى التواصل مع | packages/aegov-rules-core/inventory/uaepass.json:1479 |  |
| E29 | اسم الجهة | packages/aegov-rules-core/inventory/uaepass.json:1479<br>packages/aegov-rules-core/inventory/uaepass.json:1479 (+2) |  |
| E30 | لتمكين من الوصول إلى الخدمة | packages/aegov-rules-core/inventory/uaepass.json:1479 |  |
| E31 | توقيعك الرقمي في الهوية الرقمية الحالي لا يسمح باستخدام هذه الخدمة, يرجى ترقية حسابك حسب التعليمات على تطبيق الهوية الرقمية | packages/aegov-rules-core/inventory/uaepass.json:1479 |  |
| E32 | رابط التطبيق | packages/aegov-rules-core/inventory/uaepass.json:1479 |  |
| E33 | هذه الخدمة مخصصة للمستخدمين المسجلين فقط، يرجى التواصل مع | packages/aegov-rules-core/inventory/uaepass.json:1479 |  |
| E34 | للوصول إلى الخدمات | packages/aegov-rules-core/inventory/uaepass.json:1479 |  |
| E35 | قام المستخدم بالغاء تسجيل الدخول | packages/aegov-rules-core/inventory/uaepass.json:1479 |  |
| E36 | قام المستخدم بالغاء عملية التوقيع | packages/aegov-rules-core/inventory/uaepass.json:1479 |  |
| E37 | لقد خرجت من طلب الاشعار, يرجى اعادة المحاولة مرى أخرى | packages/aegov-rules-core/inventory/uaepass.json:1479 |  |
| E38 | حصل خطأ أثناء جمع مستنداتك من الهوية الرقمية. يرجى اعادة المحاولة | packages/aegov-rules-core/inventory/uaepass.json:1479 |  |
| E39 | هذه الخدمة متاحة فقط لمواطني دولة الإمارات العربية المتحدة | packages/aegov-rules-core/inventory/uaepass.json:1479<br>packages/aegov-rules-core/inventory/uaepass.json:1504 |  |
| E40 | حدث خطأ ما أثناء تسجيل الدخول، يُرجى المحاولة مرة أخرى لاحقًا! | packages/aegov-rules-core/inventory/uaepass.json:1479 |  |
| E41 | لقد قمت برفض طلب مشاركة البيانات عن طريقة الهوية الرقمية, يرجى إعادة المحاولة | packages/aegov-rules-core/inventory/uaepass.json:1479 |  |
| E42 | لقد قمتَ بإلغاء طلب تأكيد بصمة الوجه | packages/aegov-rules-core/inventory/uaepass.json:1479 |  |
| E43 | لقد تعذّر التحقق من بصمة الوجه. حاول مرة أخرى | packages/aegov-rules-core/inventory/uaepass.json:1479 |  |
| E44 | المستفيد غير مؤهل لاستخدام هذه الخدمة. حساب المستفيد إما غير محدث أو لديه حساب زائر. يرجى الاتصال بـ | packages/aegov-rules-core/inventory/uaepass.json:1479 |  |
| E45 | اسم مزود الخدمة | packages/aegov-rules-core/inventory/uaepass.json:1479 |  |
| E46 | لاستخدام الخدمات | packages/aegov-rules-core/inventory/uaepass.json:1479 |  |
| E47 | قام المستخدم بإلغاء تسجيل الدخول | packages/aegov-rules-core/inventory/uaepass.json:1486<br>packages/aegov-rules-core/inventory/uaepass.json:1504 (+1) |  |
| E48 | قام المستخدم بإلغاء عملية التوقيع | packages/aegov-rules-core/inventory/uaepass.json:1486<br>packages/aegov-rules-core/inventory/uaepass.json:1504 (+1) |  |
| E49 | أنت غير مؤهل للوصول إلى هذه الخدمة. إما أن حسابك لم تتم ترقيته أو لديك حساب زائر. يرجى الاتصال بـ | packages/aegov-rules-core/inventory/uaepass.json:1504 |  |
| E50 | لتتمكن من الوصول إلى الخدمة | packages/aegov-rules-core/inventory/uaepass.json:1504 |  |
| E51 | هذه الخدمة مخصصة فقط للمستخدمين المسجلين، يرجى التواصل مع | packages/aegov-rules-core/inventory/uaepass.json:1504 |  |
| E52 | لتتمكن من الوصول إلى الخدمات | packages/aegov-rules-core/inventory/uaepass.json:1504 |  |
| E53 | حدث خطأ ما أثناء تسجيل الدخول، يرجى المحاولة مرة أخرى لاحقًا! | packages/aegov-rules-core/inventory/uaepass.json:1504 |  |
| E54 | يرجى ترقية حسابك باتباع الإرشادات الموجودة في تطبيق الهوية الرقمية | packages/aegov-rules-core/inventory/uaepass.json:1504 |  |
| E55 | ساوميا,,,,شارما | packages/aegov-rules-core/inventory/uaepass.json:298 |  |
| E56 | شارما | packages/aegov-rules-core/inventory/uaepass.json:298<br>packages/aegov-rules-core/inventory/uaepass.json:310 |  |
| E57 | هندى | packages/aegov-rules-core/inventory/uaepass.json:298<br>packages/aegov-rules-core/inventory/uaepass.json:310 |  |
| E58 | ساوميا | packages/aegov-rules-core/inventory/uaepass.json:298 |  |
| E59 | عمر,بدوى,حسنين,,عبدالله | packages/aegov-rules-core/inventory/uaepass.json:310 |  |
| E60 | عمر | packages/aegov-rules-core/inventory/uaepass.json:310 |  |
| E61 | سميث جون | packages/aegov-rules-core/inventory/uaepass.json:329 |  |
| E62 | الهند | packages/aegov-rules-core/inventory/uaepass.json:329 |  |
| E63 | جون | packages/aegov-rules-core/inventory/uaepass.json:329 |  |
| E64 | سميث | packages/aegov-rules-core/inventory/uaepass.json:329 |  |
| E65 | د | packages/aegov-rules-core/inventory/uaepass.json:329 |  |

## Group F — incidental strings in tests and docs (lowest priority)

Single words in unit tests and the tool name. Ten-second glance is enough.

| # | Arabic | Role | Where | Verdict |
|---|---|---|---|---|
| F1 | ميزان | The auditor's name — README glosses it as "ميزان — scale/balance". Is the gloss right and the name sensible? | packages/aegov-audit/README.md:1<br>packages/aegov-audit/README.md:9 (+2) |  |
| F2 | مرحبا | Test string ("hello") used to assert Arabic handling | packages/aegov-audit/test/xlsx.test.mjs:49<br>packages/aegov-mcp/test/edge-cases.test.mjs:308 (+3) |  |
| F3 | رقم الهوية | Adversarial-findings doc example (ID number) | packages/aegov-mcp/evals/ADVERSARIAL-FINDINGS.md:37 |  |
| F4 | اضغط هنا | Test string ("click here") | packages/aegov-mcp/test/edge-cases.test.mjs:299 |  |
| F5 | تقديم | Test string ("submit") | packages/aegov-rules-core/test/rules-engine.test.mjs:147 |  |

---

_Generated from the repository source; regenerate rather than hand-maintain. Thank you!_
