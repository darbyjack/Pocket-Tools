import assert from "node:assert/strict";
import test from "node:test";

import { MiniAppRuntimeError, parseRuntimeResponse } from "./protocol.ts";

function response(primaryAction: Record<string, unknown>): string {
  return JSON.stringify({
    ok: true,
    value: {
      operations: [],
      page: {
        type: "page",
        title: "Rows",
        children: [
          {
            type: "list",
            items: [
              {
                type: "list-item",
                title: "Entry",
                primaryAction,
              },
            ],
          },
        ],
      },
    },
    logs: [],
    logsTruncated: false,
  });
}

test("parses a valid public SDK 1.2 list-row action", () => {
  const parsed = parseRuntimeResponse(
    response({
      label: "Open Entry",
      action: "openEntry",
      input: { id: "0123456789abcdef0123456789abcdef" },
      disabled: false,
    }),
  );

  const page = parsed.value.page;
  assert.ok(page !== undefined);
  const list = page.children[0];
  assert.equal(list?.type, "list");
  if (list?.type !== "list") return;
  assert.equal(list.items[0]?.primaryAction?.label, "Open Entry");
});

test("rejects destructive rows without confirmation", () => {
  assert.throws(
    () =>
      parseRuntimeResponse(
        response({
          label: "Remove Entry",
          action: "removeEntry",
          intent: "destructive",
        }),
      ),
    (error: unknown) =>
      error instanceof MiniAppRuntimeError &&
      error.code === "INVALID_UI_TREE" &&
      error.message.includes("require confirmation"),
  );
});
