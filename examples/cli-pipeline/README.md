# CLI pipeline

The build-time CLI run against the shared `fixtures/icons/` pool —
30 real icons from Lucide, Heroicons, Feather, FontAwesome, Phosphor,
Tabler, plus a stress set of edge cases. Mirrors them into
`icons-centered/` with rewritten viewBoxes plus a JSON report.

## Run it

```bash
# from repo root
npm install

# transform every icon in the pool, mirror to ./icons-centered
npm --workspace optical-center-example-cli-pipeline run transform

# get a structured JSON report
npm --workspace optical-center-example-cli-pipeline run report > report.json

# inspect one icon
npm --workspace optical-center-example-cli-pipeline run info

# aggregate stats across the whole pool
npm --workspace optical-center-example-cli-pipeline run analyze

# clear the on-disk cache when you change algorithm versions
npx optical-center clear-cache
```

## What the report looks like

```json
{
  "kind": "transform",
  "schemaVersion": 1,
  "data": {
    "summary": {
      "inputCount": 30,
      "transformed": 30,
      "failed": 0,
      "clipDetected": 1,
      "durationMs": 412
    },
    "files": [
      { "file": "lucide/play.svg",   "status": "transformed", "viewBox": "-0.32 -0.62 24 24" },
      { "file": "fontawesome/star-solid.svg", "status": "transformed", "viewBox": "..." },
      { "file": "edge-cases/edge-clipped.svg", "status": "transformed", "clipDetected": true }
    ]
  }
}
```

## Why structured output

The CLI is `--json`-friendly so a downstream agent (CI bot, build
script, design-system QA) can parse the report without
screen-scraping. Exit codes make gating easy:

- `0` everything fine
- `1` warnings only (clip detection)
- `2` failures (rasterize / write errors)
- `3` invalid args

## Shared fixture pool

This example doesn't ship its own icons. It points at the repo-root
`fixtures/icons/` folder — the same pool the tests, the React example,
the asset-import example, and the vanilla-HTML example all use.
Adding an icon to `fixtures/icons/<family>/` automatically exercises
every example.
