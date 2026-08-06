import { pages } from "../apps/docs/docs-map.mjs";
import { renderSdkReference } from "./docs-lib.mjs";

const page = pages.find((candidate) => candidate.generator === "sdk-reference");
if (!page) {
  throw new Error("The SDK declaration reference is missing from docs-map.mjs.");
}

const rendered = await renderSdkReference(page);

if (process.argv.includes("--json")) {
  console.log(
    JSON.stringify(
      {
        page: page.slug,
        sources: rendered.sources,
      },
      null,
      2,
    ),
  );
} else {
  console.log(rendered.content);
}
