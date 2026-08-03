#pragma once

namespace pocket_tools::quickjs::sources {

inline constexpr char kSdk[] = R"POCKET_JS(
const typed = (type, definition = {}) => ({ type, ...definition });

export const defineMiniApp = (definition) => definition;
export const collection = (fields) => ({ fields });

export const field = Object.freeze({
  text: (definition) => typed("text", definition),
  boolean: (definition) => typed("boolean", definition),
  number: (definition) => typed("number", definition),
  money: (definition) => typed("money", definition),
  datetime: (definition) => typed("datetime", definition),
});

export const setting = Object.freeze({
  text: (definition) => typed("text", definition),
  boolean: (definition) => typed("boolean", definition),
  number: (definition) => typed("number", definition),
  money: (definition) => typed("money", definition),
  select: (definition) => typed("select", definition),
});

export const ui = Object.freeze({
  page: (definition) => typed("page", definition),
  section: (definition) => typed("section", definition),
  row: (definition) => typed("row", definition),
  column: (definition) => typed("column", definition),
  heading: (definition) => typed("heading", definition),
  text: (definition) => typed("text", definition),
  metric: (definition) => typed("metric", definition),
  timer: (definition) => typed("timer", definition),
  textInput: (definition) => typed("text-input", definition),
  numberInput: (definition) => typed("number-input", definition),
  toggle: (definition) => typed("toggle", definition),
  select: (definition) => typed("select", definition),
  button: (definition) => typed("button", definition),
  navigation: (definition) => typed("navigation", definition),
  emptyState: (definition) => typed("empty-state", definition),
  listItem: (definition) => typed("list-item", definition),
  list: (definition) => typed("list", definition),
  summary: (definition) => typed("summary", definition),
});
)POCKET_JS";

inline constexpr char kRunner[] = R"POCKET_JS(
((definition, request) => {
  "use strict";

  const operations = [];
  const fail = (code, message) => {
    const error = new Error(message);
    error.code = code;
    throw error;
  };
  const isPlainObject = (value) => {
    if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
  };
  const exactKeys = (value, allowed, path) => {
    for (const key of Object.keys(value)) {
      if (!allowed.includes(key)) fail("VALIDATION_FAILED", `${path}.${key} is not supported.`);
    }
  };
  const unsafeKeys = new Set(["__proto__", "constructor", "prototype"]);
  const identifierPattern = /^[a-z][A-Za-z0-9]*$/;
  const appIdPattern = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
  const recordIdPattern = /^[a-f0-9]{32}$/;
  const systemFields = new Set(["id", "createdAt", "updatedAt"]);

  const assertSerializable = (value, path) => {
    const seen = new Set();
    let visited = 0;
    const visit = (current, currentPath, depth) => {
      visited += 1;
      if (visited > 10_000 || depth > 32) {
        fail("INVALID_BRIDGE_VALUE", `${currentPath} exceeds bridge complexity limits.`);
      }
      if (
        current === null ||
        typeof current === "string" ||
        typeof current === "boolean"
      ) return;
      if (typeof current === "number") {
        if (!Number.isFinite(current)) {
          fail("INVALID_BRIDGE_VALUE", `${currentPath} contains a non-finite number.`);
        }
        return;
      }
      if (typeof current !== "object") {
        fail("INVALID_BRIDGE_VALUE", `${currentPath} is not serializable.`);
      }
      if (seen.has(current)) {
        fail("INVALID_BRIDGE_VALUE", `${currentPath} contains a circular reference.`);
      }
      seen.add(current);
      if (Array.isArray(current)) {
        for (let index = 0; index < current.length; index += 1) {
          visit(current[index], `${currentPath}[${index}]`, depth + 1);
        }
      } else {
        if (!isPlainObject(current)) {
          fail("INVALID_BRIDGE_VALUE", `${currentPath} must contain plain objects only.`);
        }
        for (const key of Object.keys(current)) {
          if (unsafeKeys.has(key)) {
            fail("INVALID_BRIDGE_VALUE", `${currentPath}.${key} is not an allowed key.`);
          }
          visit(current[key], `${currentPath}.${key}`, depth + 1);
        }
      }
      seen.delete(current);
    };
    visit(value, path, 0);
  };

  if (!isPlainObject(request)) {
    fail("INVALID_RUNTIME_REQUEST", "The host request must be a plain object.");
  }
  if (!isPlainObject(definition) || !isPlainObject(definition.manifest)) {
    fail("INVALID_MANIFEST", "The script must export one mini-app definition.");
  }
  if (!appIdPattern.test(definition.manifest.id ?? "")) {
    fail("INVALID_MANIFEST", "manifest.id must use lowercase kebab-case.");
  }
  if (
    typeof definition.manifest.name !== "string" ||
    definition.manifest.name.trim().length === 0 ||
    definition.manifest.name.length > 80
  ) {
    fail("INVALID_MANIFEST", "manifest.name must contain 1 to 80 characters.");
  }
  if (definition.manifest.sdkVersion !== 1) {
    fail("UNSUPPORTED_SDK_VERSION", "This host supports frozen sdkVersion 1 only.");
  }

  for (const groupName of ["settings", "collections", "screens", "actions"]) {
    const group = definition[groupName] ?? {};
    if (!isPlainObject(group)) fail("INVALID_SCRIPT", `${groupName} must be a plain object.`);
    for (const name of Object.keys(group)) {
      if (!identifierPattern.test(name)) {
        fail("INVALID_SCRIPT", `${groupName}.${name} is not a lower camelCase identifier.`);
      }
    }
  }

  const settingDefinitions = definition.settings ?? {};
  const collectionDefinitions = definition.collections ?? {};
  const screenDefinitions = definition.screens ?? {};
  const actionDefinitions = definition.actions ?? {};
  if (typeof screenDefinitions.home !== "function") {
    fail("INVALID_SCRIPT", "A home screen function is required.");
  }
  for (const [name, screen] of Object.entries(screenDefinitions)) {
    if (typeof screen !== "function") fail("INVALID_SCRIPT", `screens.${name} must be a function.`);
  }
  for (const [name, action] of Object.entries(actionDefinitions)) {
    if (typeof action !== "function") fail("INVALID_SCRIPT", `actions.${name} must be a function.`);
  }

  const recordsByCollection = request.records ?? {};
  const timersById = request.timers ?? {};
  const settings = request.settings ?? {};
  for (const [label, value] of [
    ["request.settings", settings],
    ["request.records", recordsByCollection],
    ["request.timers", timersById],
  ]) {
    if (!isPlainObject(value)) {
      fail("INVALID_RUNTIME_REQUEST", `${label} must be a plain object.`);
    }
  }

  const collectionDefinition = (name) => {
    const value = collectionDefinitions[name];
    if (!isPlainObject(value) || !isPlainObject(value.fields)) {
      fail("UNKNOWN_COLLECTION", `Unknown or invalid collection: ${name}`);
    }
    return value;
  };
  const fieldDefinition = (collectionName, fieldName) => {
    if (fieldName === "id") return { type: "text", optional: false, hostOwned: true };
    if (fieldName === "createdAt" || fieldName === "updatedAt") {
      return { type: "datetime", optional: false, hostOwned: true };
    }
    const field = collectionDefinition(collectionName).fields[fieldName];
    if (!isPlainObject(field)) {
      fail("VALIDATION_FAILED", `Unknown field ${collectionName}.${fieldName}.`);
    }
    return field;
  };
  const assertRecordId = (id, path) => {
    if (typeof id !== "string" || !recordIdPattern.test(id)) {
      fail("VALIDATION_FAILED", `${path} must be a host record ID.`);
    }
  };
  const assertFieldValue = (field, value, path) => {
    if (value === null) {
      if (field.optional !== true) fail("VALIDATION_FAILED", `${path} is required.`);
      return;
    }
    if (field.type === "text") {
      if (typeof value !== "string") fail("VALIDATION_FAILED", `${path} must be text.`);
      if (value.length < (field.minLength ?? 0) || value.length > (field.maxLength ?? 100000)) {
        fail("VALIDATION_FAILED", `${path} violates text length bounds.`);
      }
      return;
    }
    if (field.type === "boolean") {
      if (typeof value !== "boolean") fail("VALIDATION_FAILED", `${path} must be a boolean.`);
      return;
    }
    if (field.type === "number" || field.type === "money") {
      if (typeof value !== "number" || !Number.isFinite(value)) {
        fail("VALIDATION_FAILED", `${path} must be a finite number.`);
      }
      if (field.min !== undefined && value < field.min) {
        fail("VALIDATION_FAILED", `${path} is below its minimum.`);
      }
      if (field.max !== undefined && value > field.max) {
        fail("VALIDATION_FAILED", `${path} exceeds its maximum.`);
      }
      return;
    }
    if (field.type === "datetime") {
      if (typeof value !== "string" || !Number.isFinite(Date.parse(value))) {
        fail("VALIDATION_FAILED", `${path} must be a date-time string.`);
      }
      return;
    }
    fail("VALIDATION_FAILED", `${path} has an unsupported field type.`);
  };
  const assertRecord = (collectionName, record, path, partial = false) => {
    if (!isPlainObject(record)) fail("INVALID_BRIDGE_VALUE", `${path} must be a plain object.`);
    const fields = collectionDefinition(collectionName).fields;
    if (partial && Object.keys(record).length === 0) {
      fail("VALIDATION_FAILED", `${path} must update at least one field.`);
    }
    for (const [name, value] of Object.entries(record)) {
      if (systemFields.has(name)) fail("VALIDATION_FAILED", `${path}.${name} is host-owned.`);
      if (!(name in fields)) fail("VALIDATION_FAILED", `${path}.${name} is unknown.`);
      assertFieldValue(fields[name], value, `${path}.${name}`);
    }
    if (!partial) {
      for (const [name, field] of Object.entries(fields)) {
        if (field.optional !== true && !(name in record)) {
          fail("VALIDATION_FAILED", `${path}.${name} is required.`);
        }
      }
    }
    assertSerializable(record, path);
  };

  const mutableRecords = {};
  for (const name of Object.keys(collectionDefinitions)) {
    const records = recordsByCollection[name] ?? [];
    if (!Array.isArray(records)) {
      fail("INVALID_RUNTIME_REQUEST", `request.records.${name} must be an array.`);
    }
    mutableRecords[name] = records.map((record) => ({ ...record }));
  }

  const assertQueryValue = (field, value, operator, path) => {
    if (value === null) {
      if (operator !== "eq" || field.optional !== true) {
        fail("VALIDATION_FAILED", `${path} may compare null only to an optional field with eq.`);
      }
      return;
    }
    if (field.type === "text") {
      if (typeof value !== "string") fail("VALIDATION_FAILED", `${path} must be text.`);
      if (operator !== "eq") fail("VALIDATION_FAILED", `${path} supports eq only for text.`);
      return;
    }
    if (field.type === "boolean") {
      if (typeof value !== "boolean") fail("VALIDATION_FAILED", `${path} must be a boolean.`);
      if (operator !== "eq") fail("VALIDATION_FAILED", `${path} supports eq only for booleans.`);
      return;
    }
    if (field.type === "number" || field.type === "money") {
      if (typeof value !== "number" || !Number.isFinite(value)) {
        fail("VALIDATION_FAILED", `${path} must be a finite number.`);
      }
      return;
    }
    if (field.type === "datetime") {
      if (typeof value !== "string" || !Number.isFinite(Date.parse(value))) {
        fail("VALIDATION_FAILED", `${path} must be a date-time string.`);
      }
      return;
    }
    fail("VALIDATION_FAILED", `${path} has an unsupported query field type.`);
  };

  const validateQuery = (collectionName, query = {}) => {
    if (!isPlainObject(query)) fail("VALIDATION_FAILED", "Collection queries must be plain objects.");
    exactKeys(query, ["where", "orderBy", "limit", "offset"], "query");
    const where = query.where ?? [];
    const orderBy = query.orderBy ?? [];
    if (!Array.isArray(where) || !Array.isArray(orderBy)) {
      fail("VALIDATION_FAILED", "query.where and query.orderBy must be arrays.");
    }
    for (const [index, filter] of where.entries()) {
      const path = `query.where[${index}]`;
      if (!isPlainObject(filter)) fail("VALIDATION_FAILED", `${path} is invalid.`);
      exactKeys(filter, ["field", "operator", "value"], path);
      if (typeof filter.field !== "string") fail("VALIDATION_FAILED", `${path}.field must be text.`);
      if (filter.operator !== "eq" && filter.operator !== "gte" && filter.operator !== "lte") {
        fail("VALIDATION_FAILED", `${path}.operator is unsupported.`);
      }
      const field = fieldDefinition(collectionName, filter.field);
      assertQueryValue(field, filter.value, filter.operator, `${path}.value`);
    }
    for (const [index, order] of orderBy.entries()) {
      const path = `query.orderBy[${index}]`;
      if (!isPlainObject(order)) fail("VALIDATION_FAILED", `${path} is invalid.`);
      exactKeys(order, ["field", "direction"], path);
      if (typeof order.field !== "string") fail("VALIDATION_FAILED", `${path}.field must be text.`);
      fieldDefinition(collectionName, order.field);
      if (order.direction !== "asc" && order.direction !== "desc") {
        fail("VALIDATION_FAILED", `${path}.direction is unsupported.`);
      }
    }
    for (const key of ["limit", "offset"]) {
      const value = query[key];
      if (value !== undefined && (!Number.isInteger(value) || value < 0 || value > 10000)) {
        fail("VALIDATION_FAILED", `query.${key} must be an integer from 0 to 10000.`);
      }
    }
    return query;
  };

  const queryRecords = (collectionName, queryValue) => {
    const query = validateQuery(collectionName, queryValue);
    let records = [...mutableRecords[collectionName]];
    for (const filter of query.where ?? []) {
      records = records.filter((record) => {
        const value = record[filter.field];
        if (filter.operator === "eq") return value === filter.value;
        if (filter.operator === "gte") return value >= filter.value;
        return value <= filter.value;
      });
    }
    if ((query.orderBy ?? []).length > 0) {
      records.sort((left, right) => {
        for (const order of query.orderBy) {
          const leftValue = left[order.field];
          const rightValue = right[order.field];
          if (leftValue === rightValue) continue;
          const comparison = leftValue < rightValue ? -1 : 1;
          return order.direction === "desc" ? -comparison : comparison;
        }
        return 0;
      });
    }
    const offset = query.offset ?? 0;
    records = records.slice(offset);
    if (query.limit !== undefined) records = records.slice(0, query.limit);
    return records.map((record) => ({ ...record }));
  };

  const collection = (name) => {
    collectionDefinition(name);
    return Object.freeze({
      insert(record) {
        assertRecord(name, record, `operations.${name}.record`);
        const pending = {
          ...record,
          id: `pending-${operations.length}`,
          createdAt: request.now,
          updatedAt: request.now,
        };
        mutableRecords[name].push(pending);
        operations.push({ type: "insert", collection: name, record: { ...record } });
        return { ...pending };
      },
      get(id) {
        if (typeof id !== "string") fail("VALIDATION_FAILED", "Record IDs must be strings.");
        const record = mutableRecords[name].find((entry) => entry.id === id);
        return record === undefined ? null : { ...record };
      },
      update(id, changes) {
        assertRecordId(id, `operations.${name}.id`);
        assertRecord(name, changes, `operations.${name}.changes`, true);
        const index = mutableRecords[name].findIndex((entry) => entry.id === id);
        if (index < 0) fail("RECORD_NOT_FOUND", `Record not found: ${name}.${id}`);
        const updated = {
          ...mutableRecords[name][index],
          ...changes,
          updatedAt: request.now,
        };
        const recordData = Object.fromEntries(
          Object.entries(updated).filter(([key]) => !systemFields.has(key)),
        );
        assertRecord(name, recordData, `operations.${name}.record`);
        mutableRecords[name][index] = updated;
        operations.push({ type: "update", collection: name, id, changes: { ...changes } });
        return { ...updated };
      },
      remove(id) {
        assertRecordId(id, `operations.${name}.id`);
        const index = mutableRecords[name].findIndex((entry) => entry.id === id);
        if (index < 0) fail("RECORD_NOT_FOUND", `Record not found: ${name}.${id}`);
        mutableRecords[name].splice(index, 1);
        operations.push({ type: "remove", collection: name, id });
      },
      query(query) {
        return queryRecords(name, query);
      },
      count(query) {
        return queryRecords(name, query).length;
      },
      sum(fieldName, query) {
        const field = fieldDefinition(name, fieldName);
        if (field.type !== "number" && field.type !== "money") {
          fail("VALIDATION_FAILED", `Cannot sum non-numeric field ${name}.${fieldName}.`);
        }
        return queryRecords(name, query).reduce(
          (total, record) => total + Number(record[fieldName] ?? 0),
          0,
        );
      },
    });
  };

  const context = Object.freeze({
    settings: Object.freeze({
      get(name) {
        if (!(name in settingDefinitions) || !(name in settings)) {
          fail("VALIDATION_FAILED", `Unknown setting: ${name}`);
        }
        return settings[name];
      },
    }),
    data: Object.freeze({ collection }),
    timers: Object.freeze({
      get(timerId) {
        if (!identifierPattern.test(timerId)) {
          fail("VALIDATION_FAILED", "Timer IDs must be lower camelCase identifiers.");
        }
        return timersById[timerId] ?? null;
      },
      start(timerId) {
        if (!identifierPattern.test(timerId)) {
          fail("VALIDATION_FAILED", "Timer IDs must be lower camelCase identifiers.");
        }
        if (timersById[timerId] !== undefined) {
          fail("VALIDATION_FAILED", `Timer is already active: ${timerId}`);
        }
        const timer = { id: timerId, startedAt: request.now, elapsedSeconds: 0 };
        operations.push({ type: "timer-start", timerId, startedAt: request.now });
        return timer;
      },
      stop(timerId) {
        const timer = timersById[timerId];
        if (timer === undefined) fail("TIMER_NOT_FOUND", `Timer is not active: ${timerId}`);
        operations.push({ type: "timer-stop", timerId });
        return {
          id: timerId,
          startedAt: timer.startedAt,
          endedAt: request.now,
          durationSeconds: Math.max(0, Number(timer.elapsedSeconds)),
        };
      },
    }),
    now() {
      return request.now;
    },
  });

  const validateUiTree = (page) => {
    const allowed = new Set([
      "page", "section", "row", "column", "heading", "text", "metric", "timer",
      "text-input", "number-input", "toggle", "select", "button", "navigation",
      "empty-state", "list-item", "list", "summary",
    ]);
    let count = 0;
    const visit = (node, depth) => {
      if (!isPlainObject(node) || !allowed.has(node.type)) {
        fail("INVALID_UI_TREE", "The script returned an unsupported UI node.");
      }
      count += 1;
      if (count > 512 || depth > 16) {
        fail("INVALID_UI_TREE", "The rendered UI tree exceeds host limits.");
      }
      if (node.type === "button" && typeof actionDefinitions[node.action] !== "function") {
        fail("INVALID_UI_TREE", `Unknown action target: ${String(node.action)}`);
      }
      if (node.type === "navigation" && typeof screenDefinitions[node.screen] !== "function") {
        fail("INVALID_UI_TREE", `Unknown screen target: ${String(node.screen)}`);
      }
      if (["text-input", "number-input", "toggle", "select"].includes(node.type)) {
        const setting = settingDefinitions[node.setting];
        if (!isPlainObject(setting)) {
          fail("INVALID_UI_TREE", `Unknown setting binding: ${String(node.setting)}`);
        }
        const expected = {
          "text-input": ["text"],
          "number-input": ["number", "money"],
          toggle: ["boolean"],
          select: ["select"],
        }[node.type];
        if (!expected.includes(setting.type)) {
          fail("INVALID_UI_TREE", `Incompatible setting binding: ${String(node.setting)}`);
        }
      }
      if (Array.isArray(node.children)) {
        for (const child of node.children) visit(child, depth + 1);
      }
      if (Array.isArray(node.items)) {
        for (const item of node.items) visit(item, depth + 1);
      }
      if (node.emptyState !== undefined) visit(node.emptyState, depth + 1);
    };
    visit(page, 0);
    if (page.type !== "page") fail("INVALID_UI_TREE", "A screen must return one page node.");
    assertSerializable(page, "page");
  };

  const inspection = {
    manifest: definition.manifest,
    settings: settingDefinitions,
    collections: collectionDefinitions,
    screens: Object.keys(screenDefinitions),
    actions: Object.keys(actionDefinitions),
  };

  if (request.mode === "inspect") {
    assertSerializable(inspection, "inspection");
    return { ok: true, value: { inspection, operations } };
  }
  if (request.mode === "action") {
    const action = actionDefinitions[request.action];
    if (typeof action !== "function") {
      fail("UNKNOWN_ACTION", `Unknown action: ${String(request.action)}`);
    }
    if (request.actionInput !== undefined) {
      assertSerializable(request.actionInput, "actionInput");
    }
    const actionResult = action(context, request.actionInput);
    if (actionResult !== undefined && typeof actionResult?.then === "function") {
      fail("ASYNC_NOT_SUPPORTED", "Mini-app actions must complete synchronously.");
    }
    assertSerializable(operations, "operations");
    return { ok: true, value: { operations } };
  }
  if (request.mode === "render") {
    const screen = screenDefinitions[request.screen ?? "home"];
    if (typeof screen !== "function") {
      fail("UNKNOWN_SCREEN", `Unknown screen: ${String(request.screen)}`);
    }
    if (request.screenInput !== undefined) {
      assertSerializable(request.screenInput, "screenInput");
    }
    const page = screen(context, request.screenInput);
    if (page !== undefined && typeof page?.then === "function") {
      fail("ASYNC_NOT_SUPPORTED", "Mini-app screens must render synchronously.");
    }
    validateUiTree(page);
    assertSerializable(operations, "operations");
    return { ok: true, value: { page, operations } };
  }
  fail("INVALID_RUNTIME_REQUEST", `Unknown runtime mode: ${String(request.mode)}`);
})
)POCKET_JS";

}  // namespace pocket_tools::quickjs::sources
