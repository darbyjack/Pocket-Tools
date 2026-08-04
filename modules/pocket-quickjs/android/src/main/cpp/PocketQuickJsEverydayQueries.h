#pragma once

#include "PocketQuickJsSources.h"

#include <string>

namespace pocket_tools::quickjs::sources {

inline const char* everydayQueryRunner() {
  static const std::string source =
      R"POCKET_JS(
((baseRunner) => {
  "use strict";

  const identifierPattern = /^[a-z][A-Za-z0-9]*$/;
  const queryKeys = ["where", "orderBy", "limit", "offset"];
  const metadataFields = Object.freeze({
    id: Object.freeze({ type: "text", optional: false }),
    createdAt: Object.freeze({ type: "datetime", optional: false }),
    updatedAt: Object.freeze({ type: "datetime", optional: false }),
  });

  const fail = (message) => {
    const error = new Error(message);
    error.code = "VALIDATION_FAILED";
    throw error;
  };

  const isPlainObject = (value) => {
    if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
  };

  const exactKeys = (value, allowed, path) => {
    for (const key of Object.keys(value)) {
      if (!allowed.includes(key)) fail(`${path}.${key} is not supported.`);
    }
  };

  const fieldDefinition = (definition, collectionName, fieldName) => {
    if (!identifierPattern.test(collectionName)) {
      fail("Collection names must be lower camelCase identifiers.");
    }
    if (metadataFields[fieldName] !== undefined) return metadataFields[fieldName];
    const collection = definition.collections?.[collectionName];
    const field = collection?.fields?.[fieldName];
    if (!isPlainObject(field)) fail(`Unknown field ${collectionName}.${String(fieldName)}.`);
    return field;
  };

  const allowedOperators = (field) => {
    if (field.type === "text") return ["eq", "neq", "contains", "startsWith"];
    if (field.type === "boolean") return ["eq", "neq"];
    if (
      field.type === "number" ||
      field.type === "money" ||
      field.type === "date" ||
      field.type === "datetime"
    ) {
      return ["eq", "neq", "gt", "gte", "lt", "lte"];
    }
    return [];
  };

  const validateQueryValue = (field, operator, value, path) => {
    if (value === null) {
      if (operator !== "eq" || field.optional !== true) {
        fail(`${path} may compare null only to an optional field with eq.`);
      }
      return;
    }

    if (field.type === "text" || field.type === "date" || field.type === "datetime") {
      if (typeof value !== "string") fail(`${path} must be text.`);
      return;
    }
    if (field.type === "boolean") {
      if (typeof value !== "boolean") fail(`${path} must be a boolean.`);
      return;
    }
    if (field.type === "number" || field.type === "money") {
      if (typeof value !== "number" || !Number.isFinite(value)) {
        fail(`${path} must be a finite number.`);
      }
      return;
    }
    fail(`${path} has an unsupported field type.`);
  };

  const validateQuery = (definition, collectionName, queryValue) => {
    const query = queryValue ?? {};
    if (!isPlainObject(query)) fail("Collection queries must be plain objects.");
    exactKeys(query, queryKeys, "query");

    const where = query.where ?? [];
    const orderBy = query.orderBy ?? [];
    if (!Array.isArray(where) || !Array.isArray(orderBy)) {
      fail("query.where and query.orderBy must be arrays.");
    }

    for (const [index, filter] of where.entries()) {
      const path = `query.where[${index}]`;
      if (!isPlainObject(filter)) fail(`${path} must be a plain object.`);
      exactKeys(filter, ["field", "operator", "value"], path);
      if (typeof filter.field !== "string") fail(`${path}.field must be text.`);
      const field = fieldDefinition(definition, collectionName, filter.field);
      const operators = allowedOperators(field);
      if (!operators.includes(filter.operator)) {
        fail(`${path}.operator is unsupported for ${field.type} fields.`);
      }
      validateQueryValue(field, filter.operator, filter.value, `${path}.value`);
    }

    for (const [index, order] of orderBy.entries()) {
      const path = `query.orderBy[${index}]`;
      if (!isPlainObject(order)) fail(`${path} must be a plain object.`);
      exactKeys(order, ["field", "direction"], path);
      if (typeof order.field !== "string") fail(`${path}.field must be text.`);
      fieldDefinition(definition, collectionName, order.field);
      if (order.direction !== "asc" && order.direction !== "desc") {
        fail(`${path}.direction must be asc or desc.`);
      }
    }

    for (const key of ["limit", "offset"]) {
      const value = query[key];
      if (value !== undefined && (!Number.isInteger(value) || value < 0 || value > 10_000)) {
        fail(`query.${key} must be an integer from 0 to 10000.`);
      }
    }

    return { where, orderBy, limit: query.limit, offset: query.offset };
  };

  const compareFilter = (value, filter, field) => {
    if (filter.operator === "eq") return value === filter.value;
    if (filter.operator === "neq") return value !== filter.value;
    if (filter.operator === "contains" || filter.operator === "startsWith") {
      if (typeof value !== "string") return false;
      const normalizedValue = value.toLowerCase();
      const normalizedFilter = filter.value.toLowerCase();
      return filter.operator === "contains"
        ? normalizedValue.includes(normalizedFilter)
        : normalizedValue.startsWith(normalizedFilter);
    }
    if (value === null || value === undefined) return false;
    if (filter.operator === "gt") return value > filter.value;
    if (filter.operator === "gte") return value >= filter.value;
    if (filter.operator === "lt") return value < filter.value;
    if (filter.operator === "lte") return value <= filter.value;
    fail(`Unsupported ${field.type} query operator.`);
  };

  const queryRecords = (baseCollection, definition, collectionName, queryValue) => {
    const query = validateQuery(definition, collectionName, queryValue);
    let records = [...baseCollection.query()];

    for (const filter of query.where) {
      const field = fieldDefinition(definition, collectionName, filter.field);
      records = records.filter((record) => compareFilter(record[filter.field], filter, field));
    }

    if (query.orderBy.length > 0) {
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

    records = records.slice(query.offset ?? 0);
    if (query.limit !== undefined) records = records.slice(0, query.limit);
    return records.map((record) => ({ ...record }));
  };

  const numericValues = (baseCollection, definition, collectionName, fieldName, query) => {
    const field = fieldDefinition(definition, collectionName, fieldName);
    if (field.type !== "number" && field.type !== "money") {
      fail(`Cannot aggregate non-numeric field ${collectionName}.${fieldName}.`);
    }

    const values = [];
    for (const record of queryRecords(baseCollection, definition, collectionName, query)) {
      const value = record[fieldName];
      if (value === null || value === undefined) continue;
      if (typeof value !== "number" || !Number.isFinite(value)) {
        fail(`Field ${collectionName}.${fieldName} contains a non-finite numeric value.`);
      }
      values.push(value);
    }
    return values;
  };

  const finiteResult = (value, operation) => {
    if (!Number.isFinite(value)) fail(`${operation} produced a non-finite result.`);
    return value;
  };

  const wrapCollection = (baseCollection, definition, collectionName) => Object.freeze({
    insert: (record) => baseCollection.insert(record),
    get: (id) => baseCollection.get(id),
    update: (id, changes) => baseCollection.update(id, changes),
    remove: (id) => baseCollection.remove(id),
    query: (query) => queryRecords(baseCollection, definition, collectionName, query),
    count: (query) => queryRecords(baseCollection, definition, collectionName, query).length,
    sum(fieldName, query) {
      let total = 0;
      for (const value of numericValues(baseCollection, definition, collectionName, fieldName, query)) {
        total = finiteResult(total + value, "sum");
      }
      return total;
    },
    min(fieldName, query) {
      const values = numericValues(baseCollection, definition, collectionName, fieldName, query);
      if (values.length === 0) return null;
      let result = values[0];
      for (let index = 1; index < values.length; index += 1) {
        if (values[index] < result) result = values[index];
      }
      return finiteResult(result, "min");
    },
    max(fieldName, query) {
      const values = numericValues(baseCollection, definition, collectionName, fieldName, query);
      if (values.length === 0) return null;
      let result = values[0];
      for (let index = 1; index < values.length; index += 1) {
        if (values[index] > result) result = values[index];
      }
      return finiteResult(result, "max");
    },
    average(fieldName, query) {
      const values = numericValues(baseCollection, definition, collectionName, fieldName, query);
      if (values.length === 0) return null;
      let total = 0;
      for (const value of values) total = finiteResult(total + value, "average");
      return finiteResult(total / values.length, "average");
    },
  });

  const enhanceContext = (context, definition) => {
    const collections = new Map();
    const data = Object.freeze({
      collection(name) {
        if (collections.has(name)) return collections.get(name);
        const wrapped = wrapCollection(context.data.collection(name), definition, name);
        collections.set(name, wrapped);
        return wrapped;
      },
    });
    return Object.freeze({
      ...context,
      data,
    });
  };

  const wrapFunctions = (functions, definition) => Object.fromEntries(
    Object.entries(functions ?? {}).map(([name, original]) => [
      name,
      (context, input) => original(enhanceContext(context, definition), input),
    ]),
  );

  const wrapDefinition = (definition) => {
    const sdkVersion = definition?.manifest?.sdkVersion === 1
      ? "1.0"
      : definition?.manifest?.sdkVersion;
    if (sdkVersion !== "1.2") return definition;
    const wrapped = { ...definition };
    wrapped.screens = wrapFunctions(definition.screens, wrapped);
    wrapped.actions = wrapFunctions(definition.actions, wrapped);
    return wrapped;
  };

  return (definition, request) => baseRunner(wrapDefinition(definition), request);
})(
)POCKET_JS" +
      std::string(kRunner) +
      R"POCKET_JS(
)
)POCKET_JS";
  return source.c_str();
}

}  // namespace pocket_tools::quickjs::sources
