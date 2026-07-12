# Mizan GitHub Action — audit on every change

Reusable composite action wrapping [`@dlsforge/aegov-audit`](../) (Mizan, ميزان): an entity's repo audits its own pages against the AEGOV Design Language System and the TDRA assessment criteria on every push or pull request. **Fails the build on findings at or above `fail-on` (default: critical); everything else surfaces as warning annotations.** The full report (machine `report.json` + reviewer-shaped `report.md` mirroring TDRA assessment checklist v2.0) lands in the job summary and as an artifact.

> Community project. **Not affiliated with or endorsed by TDRA.** A clean automated run is NOT compliance — automated checks cover a machine-checkable subset, and Arabic/RTL parity findings are flags for native-speaker review, never assertions.

## Usage

```yaml
jobs:
  mizan:
    runs-on: ubuntu-latest # Linux recommended (playwright --with-deps)
    steps:
      - uses: actions/checkout@v7
      # …build your site into dist/ here…
      - name: Mizan audit
        uses: dlsforge/aegov-dls-mcp/packages/aegov-audit/action@main # pin a tag/SHA in real pipelines
        with:
          url: dist/index.html # or a deployed/preview http(s) URL
          fail-on: critical # fail the build on critical, warn on the rest
          version: latest # pin the @dlsforge/aegov-audit version too
```

Audit a deployed page with Lighthouse (TDRA's four categories + LCP/FCP — needs http(s)) and the Arabic-variant parity flags:

```yaml
- uses: dlsforge/aegov-dls-mcp/packages/aegov-audit/action@main
  with:
    url: https://staging.example.gov.ae/en/service
    lighthouse: "true" # scores evaluated under the runner's LOCAL conditions,
    # recorded in the report — not comparable to TDRA's environment
    parity: auto # or the /ar URL explicitly
    fail-on: serious
```

## Inputs

| Input           | Default         | Meaning                                                                                             |
| --------------- | --------------- | --------------------------------------------------------------------------------------------------- |
| `url`           | (required)      | http(s) URL or workspace-relative path to a built HTML file                                          |
| `fail-on`       | `critical`      | Fail on findings at/above: `critical` \| `serious` \| `moderate` \| `minor` \| `none`                |
| `lighthouse`    | `false`         | Also run Lighthouse (http(s) only; slower)                                                           |
| `parity`        | `""`            | Arabic/RTL parity: `""` off, `auto` (hreflang discovery), or the variant URL                         |
| `out`           | `mizan-report`  | Output directory for `report.json` + `report.md`                                                     |
| `artifact-name` | `mizan-report`  | Report artifact name; `""` skips the upload                                                          |
| `summary`       | `true`          | Append `report.md` to the job summary                                                                |
| `version`       | `latest`        | `@dlsforge/aegov-audit` version to install — pin it                                                  |
| `install-spec`  | `""`            | Advanced: npm install spec(s) replacing the default (tarballs; used by this repo's self-test)        |
| `node-version`  | `22`            | Node for setup-node (Mizan needs ≥22.19)                                                             |

## Outputs

`exit-code`, `finding-count`, `critical`, `serious`, `moderate`, `minor`, `report-json`, `report-md`.

## Notes

- Until `@dlsforge/aegov-audit` is published to npm, the default install cannot resolve — use `install-spec` with packed tarballs (`@dlsforge/aegov-rules-core` first, then the audit tarball), exactly as [`.github/workflows/mizan-selftest.yml`](../../../.github/workflows/mizan-selftest.yml) does.
- Reports are private to the repo's own team (artifact + job summary). No public scoreboard — by design.
