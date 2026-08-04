#pragma once

#include "PocketQuickJsEverydayQueries.h"

#include <string>

namespace pocket_tools::quickjs::sources {

inline const char* feedbackRunner() {
  static const std::string source =
      R"POCKET_JS(
((baseRunner) => {
  "use strict";

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

  const exactKeys = (value, required, optional, path) => {
    const allowed = new Set([...required, ...optional]);
    for (const key of required) {
      if (!Object.prototype.hasOwnProperty.call(value, key)) {
        fail(`${path}.${key} is required.`);
      }
    }
    for (const key of Object.keys(value)) {
      if (!allowed.has(key)) fail(`${path}.${key} is not supported.`);
    }
  };

  const text = (value, path, minimum, maximum) => {
    if (typeof value !== "string") fail(`${path} must be text.`);
    const length = Array.from(value).length;
    if (length < minimum || length > maximum) {
      fail(`${path} must contain ${minimum} to ${maximum} characters.`);
    }
    return value;
  };

  const requireAction = (mode, capability) => {
    if (mode !== "action") fail(`${capability} is available only during action execution.`);
  };

  const createFeedbackClient = (mode, state) => Object.freeze({
    show(message) {
      requireAction(mode, "Feedback");
      const normalized = text(message, "Feedback messages", 1, 160);
      if (state.feedbackRequested) fail("An action may request feedback only once.");
      state.feedbackRequested = true;
      state.effects.push(Object.freeze({ type: "feedback", message: normalized }));
    },
  });

  const recordOutput = (state, effect) => {
    if (state.outputRequested) fail("An action may request output only once.");
    state.outputRequested = true;
    state.effects.push(Object.freeze(effect));
  };

  const createOutputClient = (mode, state) => Object.freeze({
    copy(value) {
      requireAction(mode, "Output");
      recordOutput(
        state,
        Object.freeze({
          type: "copy",
          text: text(value, "output.copy.text", 1, 10_000),
        }),
      );
    },
    share(value) {
      requireAction(mode, "Output");
      if (!isPlainObject(value)) fail("output.share must be a plain object.");
      exactKeys(value, ["text"], ["title"], "output.share");
      const title =
        value.title === undefined
          ? undefined
          : text(value.title, "output.share.title", 1, 120);
      recordOutput(
        state,
        Object.freeze({
          type: "share",
          ...(title === undefined ? {} : { title }),
          text: text(value.text, "output.share.text", 1, 10_000),
        }),
      );
    },
  });

  const enhanceContext = (context, mode, state) => Object.freeze({
    ...context,
    feedback: createFeedbackClient(mode, state),
    output: createOutputClient(mode, state),
  });

  const wrapFunctions = (functions, mode, state) => {
    if (!isPlainObject(functions)) return functions;
    return Object.fromEntries(
      Object.entries(functions).map(([name, original]) => [
        name,
        typeof original === "function"
          ? (context, input) => original(enhanceContext(context, mode, state), input)
          : original,
      ]),
    );
  };

  const wrapDefinition = (definition, state) => {
    if (!isPlainObject(definition) || !isPlainObject(definition.manifest)) return definition;
    const sdkVersion = definition.manifest.sdkVersion === 1
      ? "1.0"
      : definition.manifest.sdkVersion;
    if (sdkVersion !== "1.2") return definition;

    const wrapped = { ...definition };
    wrapped.screens = wrapFunctions(definition.screens, "render", state);
    wrapped.actions = wrapFunctions(definition.actions, "action", state);
    return wrapped;
  };

  return (definition, request) => {
    const state = {
      effects: [],
      feedbackRequested: false,
      outputRequested: false,
    };
    const response = baseRunner(wrapDefinition(definition, state), request);
    if (
      response?.ok === true &&
      request?.mode === "action" &&
      state.effects.length > 0
    ) {
      return {
        ...response,
        value: {
          ...response.value,
          effects: state.effects,
        },
      };
    }
    return response;
  };
})(
)POCKET_JS" +
      std::string(everydayQueryRunner()) +
      R"POCKET_JS(
)
)POCKET_JS";
  return source.c_str();
}

}  // namespace pocket_tools::quickjs::sources
