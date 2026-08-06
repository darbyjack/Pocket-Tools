import { defineConfig } from "astro/config";
import starlight from "@astrojs/starlight";

import { sidebarItems, siteBase, siteUrl } from "./docs-map.mjs";

export default defineConfig({
  site: siteUrl,
  base: siteBase,
  trailingSlash: "always",
  integrations: [
    starlight({
      title: "Pocket Tools",
      description:
        "Professional documentation for the Pocket Tools Android host and its secure JavaScript mini-app SDK.",
      favicon: `${siteBase}/icon.png`,
      logo: {
        alt: "Pocket Tools",
        src: "./src/assets/icon.png",
      },
      social: [
        {
          icon: "github",
          label: "Pocket Tools on GitHub",
          href: "https://github.com/darbyjack/Pocket-Tools",
        },
      ],
      customCss: ["./src/styles/custom.css"],
      sidebar: sidebarItems(),
      pagefind: true,
      pagination: true,
      lastUpdated: false,
    }),
  ],
});
