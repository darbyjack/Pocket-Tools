import {
  validateGeneratedLinks,
  withGeneratedTemp,
} from "./docs-lib.mjs";

await withGeneratedTemp(async (destination) => {
  await validateGeneratedLinks(destination);
});

console.log("Documentation routes, links, anchors, and local paths are valid.");
