import { defineConfig } from "astro/config";
import opticalCenter from "optical-center/astro";

export default defineConfig({
  integrations: [opticalCenter()],
});
