# React + Vite example

A minimal demo that places a play triangle inside a circular badge twice
— once geometrically, once with `opticalCenter` — so you can watch the
icon settle.

## Run it

```bash
npm install
npm run dev
```

Open the printed local URL. Inspect the second `<svg>` in DevTools — its
`viewBox` is rewritten and `data-optical-center` is set, but the JSX
source has nothing about it.
