# CLI pipeline

The build-time CLI run against a project's own `icons/` folder —
the way a design system would consume it. Mirrors the corrected SVGs
into `icons-centered/` with a JSON report.

## Run it

```bash
# from repo root
npm install

# transform every icon in ./icons → ./icons-centered
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
      "inputCount": 8,
      "transformed": 8,
      "failed": 0,
      "clipDetected": 3,
      "durationMs": 85
    },
    "files": [
      { "file": "play.svg",            "status": "transformed", "viewBox": "-1.293 -0.628 24 24" },
      { "file": "star-solid.svg",      "status": "transformed", "clipDetected": true },
      { "file": "play-solid.svg",      "status": "transformed", "clipDetected": true }
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
