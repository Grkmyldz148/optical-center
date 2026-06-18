import { defineConfig } from "astro/config";
import sitemap from "@astrojs/sitemap";
import opticalCenter from "optical-center/astro";

// The canonical production origin. Drives canonical URLs, Open Graph/Twitter
// absolute image URLs (Base.astro), and the generated sitemap.
export default defineConfig({
  site: "https://opticalcenter.dev",
  integrations: [
    opticalCenter(),
    sitemap({
      // Freshness + crawl hints. lastmod is stamped at build time; the home
      // page outranks the docs in priority.
      changefreq: "weekly",
      priority: 0.7,
      lastmod: new Date(),
      serialize(item) {
        if (item.url === "https://opticalcenter.dev/") {
          item.priority = 1.0;
          item.changefreq = "weekly";
        }
        return item;
      },
    }),
  ],
});
