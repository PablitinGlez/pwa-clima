# Clima escolar PWA

Angular PWA that searches Open-Meteo city forecasts, caches previously requested results for offline use, and uses the push server hosted on Render.

## Build

```sh
npm ci
npx ng build pwa-clima
```

Render Static Site settings:
- Build command: `npm ci && npx ng build pwa-clima`
- Publish directory: `dist/pwa-clima/browser`
