/**
 * Stage 2B step-5 gate: the TDRA-workbook writer.
 *
 * Unit tests exercise the splice/zip primitives on synthetic XML. The
 * integration test round-trips the REAL cached workbook (.tdra-cache is
 * gitignored — the test skips with a note when it is absent, e.g. on CI)
 * and enforces the honesty contract: Reason column filled, Validate column
 * untouched, no pass-adjacent wording anywhere Mizan wrote, styles
 * byte-identical.
 *
 * Run: npm run build && node --test test/xlsx.test.mjs
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import {
  readZip,
  writeZip,
  spliceCells,
  itemRowMap,
  reasonText,
  fillWorkbook,
} from "../dist/report/xlsx.js";
import { buildReport } from "../dist/report/report.js";

const WORKBOOK = resolve(".tdra-cache/tdra_dls-assessmentcriteria-2023_version2_0.xlsx");
const PAGE = { status: 200, loadMs: 10, nodes: 10, title: "t", lang: "en", dir: "ltr" };

const uaePassFinding = {
  engine: "dls", ruleId: "dls-uaepass-missing", severity: "serious", confidence: "heuristic",
  message: "login surface without UAE Pass", fix: "Integrate UAE Pass", helpUrl: null,
  tags: [], targets: [], nodeCount: 1,
};

function makeReport(findings = [uaePassFinding]) {
  return buildReport({
    target: "https://example.gov.ae",
    page: PAGE,
    engines: { axe: "4.12.1" },
    findings,
    lighthouse: null, // lighthouse-only items become "not-checked"
  });
}

describe("zip round-trip primitives", () => {
  test("writeZip output re-reads byte-identically", () => {
    const entries = [
      { name: "a.xml", data: Buffer.from("<a>مرحبا</a>", "utf8") },
      { name: "dir/b.bin", data: Buffer.from([0, 1, 2, 250, 251, 252]) },
    ];
    const back = readZip(writeZip(entries));
    assert.equal(back.length, 2);
    assert.deepEqual(back[0].data, entries[0].data);
    assert.deepEqual(back[1].data, entries[1].data);
    assert.equal(back[1].name, "dir/b.bin");
  });
});

describe("spliceCells", () => {
  const sheet =
    '<worksheet><sheetData>' +
    '<row r="1"><c r="A1" t="s"><v>0</v></c></row>' +
    '<row r="10"><c r="A10" t="s"><v>1</v></c><c r="D10" t="s"><v>2</v></c><c r="G10"><v>9</v></c></row>' +
    "</sheetData></worksheet>";

  test("inserts a new F cell in column order (between D and G)", () => {
    const out = spliceCells(sheet, new Map([["F10", "evidence & more"]]));
    const row = out.match(/<row r="10">([\s\S]*?)<\/row>/)[1];
    const order = [...row.matchAll(/<c r="([A-Z]+10)"/g)].map((m) => m[1]);
    assert.deepEqual(order, ["A10", "D10", "F10", "G10"]);
    assert.match(row, /<c r="F10" t="inlineStr"><is><t xml:space="preserve">evidence &amp; more<\/t><\/is><\/c>/);
  });

  test("replaces an existing cell instead of duplicating it", () => {
    const once = spliceCells(sheet, new Map([["F10", "first"]]));
    const twice = spliceCells(once, new Map([["F10", "second"]]));
    const hits = [...twice.matchAll(/<c r="F10"/g)];
    assert.equal(hits.length, 1);
    assert.match(twice, />second</);
  });

  test("untouched rows and cells stay byte-identical", () => {
    const out = spliceCells(sheet, new Map([["F10", "x"]]));
    assert.ok(out.includes('<row r="1"><c r="A1" t="s"><v>0</v></c></row>'));
    assert.ok(out.includes('<c r="G10"><v>9</v></c>'));
  });
});

describe("reasonText honesty contract", () => {
  const report = makeReport();

  test("machine item with findings lists them", () => {
    const t = reasonText(report, "3.24");
    assert.match(t, /1 automated finding\(s\)/);
    assert.match(t, /dls-uaepass-missing/);
  });
  test("clean machine item is explicitly NOT a pass", () => {
    const t = reasonText(report, "3.26");
    assert.match(t, /no automated findings/);
    assert.match(t, /NOT a pass/);
  });
  test("lighthouse-only item without a run reads not-checked", () => {
    assert.match(reasonText(report, "3.53"), /not checked in this run/);
  });
  test("process items ask for the human", () => {
    assert.match(reasonText(report, "1.2"), /requires human answer/);
  });
  test("no reason text ever contains pass-adjacent wording", () => {
    for (const id of ["1.2", "3.24", "3.26", "3.53"]) {
      assert.doesNotMatch(reasonText(report, id), /completed/i, id);
    }
  });
});

describe("real-workbook integration (skips when .tdra-cache is absent)", { skip: !existsSync(WORKBOOK) }, () => {
  const template = existsSync(WORKBOOK) ? readFileSync(WORKBOOK) : null;

  test("fills all 125 Reason cells, banner in H1, Validate column untouched, styles byte-identical", () => {
    const report = makeReport();
    const out = fillWorkbook(template, report);
    const entries = Object.fromEntries(readZip(out).map((e) => [e.name, e.data]));
    const sheet = entries["xl/worksheets/sheet1.xml"].toString("utf8");
    const tplSheet = readZip(template)
      .find((e) => e.name === "xl/worksheets/sheet1.xml")
      .data.toString("utf8");

    // every checklist item row got an F cell
    const strings = readZip(template).find((e) => e.name === "xl/sharedStrings.xml").data.toString("utf8");
    const rows = itemRowMap(
      tplSheet,
      [...strings.matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) =>
        [...m[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((t) => t[1]).join(""),
      ),
    );
    assert.equal(rows.size, 125);
    for (const rowNum of rows.values()) {
      assert.match(sheet, new RegExp(`<c r="F${rowNum}" t="inlineStr">`), `row ${rowNum}`);
    }

    // banner present, and it names the tool + disclaims TDRA affiliation
    assert.match(sheet, /<c r="H1" t="inlineStr">/);
    assert.match(sheet, /NOT affiliated with or endorsed by TDRA/);

    // Validate column (E): exactly as many E cells as the template had — none added
    const eCells = (s) => [...s.matchAll(/<c r="E\d+"/g)].length;
    assert.equal(eCells(sheet), eCells(tplSheet));

    // nothing Mizan wrote says "completed" (the entity's word, never ours)
    for (const m of sheet.matchAll(/<is><t[^>]*>([\s\S]*?)<\/t><\/is>/g)) {
      assert.doesNotMatch(m[1], /completed/i);
    }

    // untouched workbook parts are carried over byte-identical
    const tplEntries = Object.fromEntries(readZip(template).map((e) => [e.name, e.data]));
    for (const name of ["xl/styles.xml", "xl/sharedStrings.xml", "xl/workbook.xml", "[Content_Types].xml"]) {
      assert.deepEqual(entries[name], tplEntries[name], name);
    }

    // structure still parses: the filled sheet keeps all 125 item rows
    assert.equal(
      itemRowMap(
        sheet,
        [...strings.matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) =>
          [...m[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((t) => t[1]).join(""),
        ),
      ).size,
      125,
    );
  });

  test("a mismatched workbook (missing items) is refused as version drift", () => {
    // strip sheet1 down to its first 40 rows so most item ids disappear
    const entries = readZip(template);
    const idx = entries.findIndex((e) => e.name === "xl/worksheets/sheet1.xml");
    const truncated = entries[idx].data
      .toString("utf8")
      .replace(/<row r="(\d+)"[^>]*>[\s\S]*?<\/row>/g, (m, r) => (Number(r) > 40 ? "" : m));
    const mutated = entries.map((e, i) => (i === idx ? { name: e.name, data: Buffer.from(truncated) } : e));
    assert.throws(() => fillWorkbook(writeZip(mutated), makeReport()), /drift/);
  });
});
