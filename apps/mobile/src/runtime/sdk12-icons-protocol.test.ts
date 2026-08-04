import assert from "node:assert/strict";
import test from "node:test";

import { parseRuntimeResponse } from "./protocol.ts";

function response(): string {
  return JSON.stringify({
    ok: true,
    logs: [],
    logsTruncated: false,
    value: {
      page: {
        type: "page",
        title: "Icons",
        children: [
          { type: "button", label: "Add item", action: "addItem", icon: "add" },
          {
            type: "list",
            items: [
              {
                type: "list-item",
                title: "Appointment",
                leadingIcon: "calendar",
                primaryAction: { label: "Open appointment", action: "openItem", icon: "edit" },
                actions: [{ label: "Refresh", action: "refreshItem", icon: "refresh" }],
              },
            ],
          },
        ],
      },
      operations: [],
    },
  });
}

test("preserves public fixed action and list-item icons", () => {
  const parsed = parseRuntimeResponse(response());
  const children = parsed.value.page?.children as readonly Record<string, unknown>[] | undefined;
  assert.equal(children?.[0]?.icon, "add");
  const list = children?.[1] as { items?: readonly Record<string, unknown>[] } | undefined;
  const item = list?.items?.[0] as
    | {
        leadingIcon?: string;
        primaryAction?: { icon?: string };
        actions?: readonly { icon?: string }[];
      }
    | undefined;
  assert.equal(item?.leadingIcon, "calendar");
  assert.equal(item?.primaryAction?.icon, "edit");
  assert.equal(item?.actions?.[0]?.icon, "refresh");
});

test("rejects malformed icon output from the native boundary", () => {
  const malformed = JSON.parse(response()) as {
    value: { page: { children: [{ icon?: unknown }, { items: [{ leadingIcon?: unknown }] }] } };
  };
  malformed.value.page.children[0].icon = "download";
  assert.throws(
    () => parseRuntimeResponse(JSON.stringify(malformed)),
    /Expected add, edit, delete/,
  );

  const invalidLeading = JSON.parse(response()) as {
    value: { page: { children: [{}, { items: [{ leadingIcon?: unknown }] }] } };
  };
  invalidLeading.value.page.children[1].items[0].leadingIcon = { custom: true };
  assert.throws(
    () => parseRuntimeResponse(JSON.stringify(invalidLeading)),
    /Expected add, edit, delete/,
  );
});
