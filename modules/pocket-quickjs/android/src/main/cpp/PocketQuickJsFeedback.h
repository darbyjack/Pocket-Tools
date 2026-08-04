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

  const createFeedbackClient = (mode, state) => Object.freeze({
    show(message) {
      if (mode !== "action") fail("Feedback is available only during action execution.");
      if (typeof message !== "string") fail("Feedback messages must be text.");
      const length = Array.from(message).length;
      if (length < 1 || length > 160) {
        fail("Feedback messages must contain 1 to 160 characters.");
      }
      if (state.effect !== null) fail("An action may request feedback only once.");
      state.effect = Object.freeze({ type: "feedback", message });
    },
  });

  const enhanceContext = (context, mode, state) => Object.freeze({
    ...context,
    feedback: createFeedbackClient(mode, state),
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
    const state = { effect: null };
    const response = baseRunner(wrapDefinition(definition, state), request);
    if (
      response?.ok === true &&
      request?.mode === "action" &&
      state.effect !== null
    ) {
      return {
        ...response,
        value: {
          ...response.value,
          effects: [state.effect],
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
