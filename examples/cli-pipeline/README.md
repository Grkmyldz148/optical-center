# CLI pipeline example

Shows the build-time CLI in a real folder of icons. Drop SVGs in
`icons/`, run the pipeline, get a mirrored `icons-centered/` folder
with rewritten viewBoxes plus a JSON report.

## Run it

```bash
# transform a folder, mirror to a sibling, with structured output
npx optical-center transform ./icons ./icons-centered --json > report.json

# inspect a single file
npx optical-center info ./icons/triangle.svg

# aggregate stats across the whole set
npx optical-center analyze ./icons

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
      "inputCount": 3,
      "transformed": 3,
      "failed": 0,
      "clipDetected": 0,
      "durationMs": 12
    },
    "files": [
      { "file": "play.svg", "status": "transformed", "viewBox": "-0.32 -0.62 24 24" }
    ]
  }
}
```

## Why structured output

The CLI is `--json`-friendly so a downstream agent (CI bot, build
script, design-system QA) can parse the report without screen-scraping.
Exit codes make it easy to gate:

- `0` everything fine
- `1` warnings only (clip detection)
- `2` failures (rasterize / write errors)
- `3` invalid args
