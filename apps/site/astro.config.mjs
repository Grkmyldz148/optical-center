import { defineConfig } from "astro/config";
import sitemap from "@astrojs/sitemap";
import opticalCenter from "optical-center/astro";

// The canonical production origin. Drives canonical URLs, Open Graph/Twitter
// absolute image URLs (Base.astro), and the generated sitemap.
export default defineConfig({
  site: "https://opticalcenter.dev",
  integrations: [opticalCenter(), sitemap()],
});
