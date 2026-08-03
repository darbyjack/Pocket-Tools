#include <jni.h>

#include <chrono>
#include <cstddef>
#include <cstring>
#include <string>
#include <string_view>

extern "C" {
#include <quickjs.h>
}

namespace {

constexpr std::size_t kMaximumSourceBytes = 512 * 1024;
constexpr std::size_t kMaximumRequestBytes = 2 * 1024 * 1024;
constexpr std::size_t kRuntimeMemoryBytes = 32 * 1024 * 1024;
constexpr std::size_t kRuntimeStackBytes = 512 * 1024;
constexpr auto kExecutionTimeout = std::chrono::milliseconds(250);

constexpr const char* kSdkModuleName = "@pocket-tools/sdk";

constexpr const char* kSdkSource = R"POCKET_JS(
const typed = (type, definition = {}) => ({ type, ...definition });

export const defineMiniApp = (definition) => definition;
export const collection = (fields) => ({ fields });

export const field = Object.freeze({
  number: (definition) => typed("number", definition),
  money: (definition) => typed("money", definition),
  datetime: (definition) => typed("datetime", definition),
});

export const setting = Object.freeze({
  number: (definition) => typed("number", definition),
  money: (definition) => typed("money", definition),
  select: (definition) => typed("select", definition),
});

export const ui = Object.freeze({
  page: (definition) => typed("page", definition),
  section: (definition) => typed("section", definition),
  metric: (definition) => typed("metric", definition),
  timer: (definition) => typed("timer", definition),
  button: (definition) => typed("button", definition),
  emptyState: (definition) => typed("empty-state", definition),
  listItem: (definition) => typed("list-item", definition),
  list: (definition) => typed("list", definition),
  summary: (definition) => typed("summary", definition),
});
)POCKET_JS";

constexpr const char* kRunnerSource = R"POCKET_JS(
(() => {
  "use strict";

  const definition = globalThis.__pocketDefinition;
  const request = globalThis.__pocketRequest;
  const operations = [];

  const fail = (code, message) => {
    const error = new Error(message);
    error.code = code;
    throw error;
  };

  const isObject = (value) =>
    value !== null && typeof value === "object" && !Array.isArray(value);

  const identifierPattern = /^[a-z][A-Za-z0-9]*$/;
  const appIdPattern = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;

  if (!isObject(definition) || !isObject(definition.manifest)) {
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
    fail("UNSUPPORTED_SDK_VERSION", "This host supports sdkVersion 1 only.");
  }
  if (!isObject(definition.screens) || typeof definition.screens.home !== "function") {
    fail("INVALID_SCRIPT", "A home screen function is required.");
  }

  for (const groupName of ["settings", "collections", "screens", "actions"]) {
    const group = definition[groupName] ?? {};
    if (!isObject(group)) {
      fail("INVALID_SCRIPT", `${groupName} must be an object.`);
    }
    for (const name of Object.keys(group)) {
      if (!identifierPattern.test(name)) {
        fail("INVALID_SCRIPT", `${groupName}.${name} is not a lower camelCase identifier.`);
      }
    }
  }

  const collectionDefinitions = definition.collections ?? {};
  const recordsByCollection = request.records ?? {};
  const timersById = request.timers ?? {};
  const settings = request.settings ?? {};

  const queryRecords = (collectionName, query = {}) => {
    let records = [...(recordsByCollection[collectionName] ?? [])];

    for (const filter of query.where ?? []) {
      if (filter.operator !== "gte") {
        fail("INVALID_SCRIPT", `Unsupported query operator: ${String(filter.operator)}`);
      }
      records = records.filter((record) => record[filter.field] >= filter.value);
    }

    const orderBy = query.orderBy ?? [];
    if (orderBy.length > 0) {
      records.sort((left, right) => {
        for (const order of orderBy) {
          const leftValue = left[order.field];
          const rightValue = right[order.field];
          if (leftValue === rightValue) continue;
          const comparison = leftValue < rightValue ? -1 : 1;
          return order.direction === "desc" ? -comparison : comparison;
        }
        return 0;
      });
    }

    if (query.limit !== undefined) {
      records = records.slice(0, query.limit);
    }
    return records;
  };

  const collection = (name) => {
    if (!(name in collectionDefinitions)) {
      fail("UNKNOWN_COLLECTION", `Unknown collection: ${name}`);
    }
    return Object.freeze({
      insert(record) {
        if (!isObject(record)) {
          fail("INVALID_BRIDGE_VALUE", "Inserted records must be plain objects.");
        }
        operations.push({ type: "insert", collection: name, record });
        return {
          ...record,
          id: "pending",
          createdAt: request.now,
          updatedAt: request.now,
        };
      },
      query(query) {
        return queryRecords(name, query);
      },
      count(query) {
        return queryRecords(name, query).length;
      },
      sum(fieldName, query) {
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
        if (!(name in settings)) {
          fail("VALIDATION_FAILED", `Unknown setting: ${name}`);
        }
        return settings[name];
      },
    }),
    data: Object.freeze({ collection }),
    timers: Object.freeze({
      get(timerId) {
        return timersById[timerId] ?? null;
      },
      start(timerId) {
        if (timersById[timerId] !== undefined) {
          fail("VALIDATION_FAILED", `Timer is already active: ${timerId}`);
        }
        const timer = { id: timerId, startedAt: request.now, elapsedSeconds: 0 };
        operations.push({ type: "timer-start", timerId, startedAt: request.now });
        return timer;
      },
      stop(timerId) {
        const timer = timersById[timerId];
        if (timer === undefined) {
          fail("TIMER_NOT_FOUND", `Timer is not active: ${timerId}`);
        }
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
      "page",
      "section",
      "metric",
      "timer",
      "button",
      "empty-state",
      "list-item",
      "list",
      "summary",
    ]);
    let count = 0;

    const visit = (node, depth) => {
      if (!isObject(node) || !allowed.has(node.type)) {
        fail("INVALID_UI_TREE", "The script returned an unsupported UI node.");
      }
      count += 1;
      if (count > 512 || depth > 16) {
        fail("INVALID_UI_TREE", "The rendered UI tree exceeds host limits.");
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
    if (page.type !== "page") {
      fail("INVALID_UI_TREE", "A screen must return one page node.");
    }
  };

  if (request.mode === "inspect") {
    return JSON.stringify({
      ok: true,
      value: {
        inspection: {
          manifest: definition.manifest,
          settings: definition.settings ?? {},
          collections: definition.collections ?? {},
        },
        operations,
      },
    });
  }

  if (request.mode === "action") {
    const action = definition.actions?.[request.action];
    if (typeof action !== "function") {
      fail("UNKNOWN_ACTION", `Unknown action: ${String(request.action)}`);
    }
    action(context);
    return JSON.stringify({ ok: true, value: { operations } });
  }

  if (request.mode === "render") {
    const screen = definition.screens[request.screen ?? "home"];
    if (typeof screen !== "function") {
      fail("UNKNOWN_SCREEN", `Unknown screen: ${String(request.screen)}`);
    }
    const page = screen(context);
    validateUiTree(page);
    return JSON.stringify({ ok: true, value: { page, operations } });
  }

  fail("INVALID_SCRIPT", `Unknown runtime mode: ${String(request.mode)}`);
})()
)POCKET_JS";

struct ExecutionGuard {
  std::chrono::steady_clock::time_point deadline;
  bool interrupted = false;
};

int interruptHandler(JSRuntime*, void* opaque) {
  auto* guard = static_cast<ExecutionGuard*>(opaque);
  if (std::chrono::steady_clock::now() <= guard->deadline) {
    return 0;
  }
  guard->interrupted = true;
  return 1;
}

JSModuleDef* moduleLoader(
    JSContext* context,
    const char* moduleName,
    void*,
    JSValueConst) {
  if (std::strcmp(moduleName, kSdkModuleName) != 0) {
    JS_ThrowReferenceError(context, "Unsupported module: %s", moduleName);
    return nullptr;
  }

  JSValue compiled = JS_Eval(
      context,
      kSdkSource,
      std::strlen(kSdkSource),
      kSdkModuleName,
      JS_EVAL_TYPE_MODULE | JS_EVAL_FLAG_COMPILE_ONLY);
  if (JS_IsException(compiled)) {
    return nullptr;
  }

  auto* module = static_cast<JSModuleDef*>(JS_VALUE_GET_PTR(compiled));
  JS_FreeValue(context, compiled);
  return module;
}

std::string escapeJson(std::string_view value) {
  std::string escaped;
  escaped.reserve(value.size() + 16);
  for (const unsigned char character : value) {
    switch (character) {
      case '"': escaped += "\\\""; break;
      case '\\': escaped += "\\\\"; break;
      case '\b': escaped += "\\b"; break;
      case '\f': escaped += "\\f"; break;
      case '\n': escaped += "\\n"; break;
      case '\r': escaped += "\\r"; break;
      case '\t': escaped += "\\t"; break;
      default:
        if (character < 0x20) {
          constexpr char hex[] = "0123456789abcdef";
          escaped += "\\u00";
          escaped += hex[(character >> 4) & 0x0f];
          escaped += hex[character & 0x0f];
        } else {
          escaped += static_cast<char>(character);
        }
    }
  }
  return escaped;
}

std::string failureJson(
    std::string_view code,
    std::string_view message,
    std::string_view stack = {}) {
  std::string json = "{\"ok\":false,\"error\":{\"code\":\"";
  json += escapeJson(code);
  json += "\",\"message\":\"";
  json += escapeJson(message);
  json += "\"";
  if (!stack.empty()) {
    json += ",\"stack\":\"";
    json += escapeJson(stack);
    json += "\"";
  }
  json += "}}";
  return json;
}

std::string exceptionJson(JSContext* context, const ExecutionGuard& guard) {
  JSValue exception = JS_GetException(context);
  JSValue codeValue = JS_GetPropertyStr(context, exception, "code");
  JSValue stackValue = JS_GetPropertyStr(context, exception, "stack");

  const char* messageText = JS_ToCString(context, exception);
  const char* codeText = JS_IsUndefined(codeValue) ? nullptr : JS_ToCString(context, codeValue);
  const char* stackText = JS_IsUndefined(stackValue) ? nullptr : JS_ToCString(context, stackValue);

  const std::string code = guard.interrupted
      ? "RUNTIME_LIMIT_EXCEEDED"
      : (codeText == nullptr ? "RUNTIME_ERROR" : codeText);
  const std::string message = messageText == nullptr ? "QuickJS execution failed." : messageText;
  const std::string stack = stackText == nullptr ? "" : stackText;

  if (messageText != nullptr) JS_FreeCString(context, messageText);
  if (codeText != nullptr) JS_FreeCString(context, codeText);
  if (stackText != nullptr) JS_FreeCString(context, stackText);
  JS_FreeValue(context, codeValue);
  JS_FreeValue(context, stackValue);
  JS_FreeValue(context, exception);

  return failureJson(code, message, stack);
}

std::string runQuickJs(std::string_view source, std::string_view requestJson) {
  if (source.size() > kMaximumSourceBytes) {
    return failureJson("RUNTIME_LIMIT_EXCEEDED", "The mini-app source exceeds 512 KiB.");
  }
  if (requestJson.size() > kMaximumRequestBytes) {
    return failureJson("RUNTIME_LIMIT_EXCEEDED", "The runtime request exceeds 2 MiB.");
  }

  JSRuntime* runtime = JS_NewRuntime();
  if (runtime == nullptr) {
    return failureJson("RUNTIME_ERROR", "Unable to create the QuickJS runtime.");
  }

  JS_SetMemoryLimit(runtime, kRuntimeMemoryBytes);
  JS_SetMaxStackSize(runtime, kRuntimeStackBytes);
  JS_SetCanBlock(runtime, false);
  JS_SetModuleLoaderFunc2(runtime, nullptr, moduleLoader, nullptr, nullptr);

  ExecutionGuard guard{
      .deadline = std::chrono::steady_clock::now() + kExecutionTimeout,
  };
  JS_SetInterruptHandler(runtime, interruptHandler, &guard);

  JSContext* context = JS_NewContext(runtime);
  if (context == nullptr) {
    JS_FreeRuntime(runtime);
    return failureJson("RUNTIME_ERROR", "Unable to create the QuickJS context.");
  }

  std::string result;
  JSValue moduleValue = JS_Eval(
      context,
      source.data(),
      source.size(),
      "pocket-mini-app.mjs",
      JS_EVAL_TYPE_MODULE | JS_EVAL_FLAG_COMPILE_ONLY);
  if (JS_IsException(moduleValue)) {
    result = exceptionJson(context, guard);
    JS_FreeContext(context);
    JS_FreeRuntime(runtime);
    return result;
  }

  auto* module = static_cast<JSModuleDef*>(JS_VALUE_GET_PTR(moduleValue));
  if (JS_ResolveModule(context, moduleValue) < 0) {
    result = exceptionJson(context, guard);
    JS_FreeValue(context, moduleValue);
    JS_FreeContext(context);
    JS_FreeRuntime(runtime);
    return result;
  }

  JSValue evaluation = JS_EvalFunction(context, moduleValue);
  if (JS_IsException(evaluation)) {
    result = exceptionJson(context, guard);
    JS_FreeValue(context, evaluation);
    JS_FreeContext(context);
    JS_FreeRuntime(runtime);
    return result;
  }
  JS_FreeValue(context, evaluation);

  JSValue moduleNamespace = JS_GetModuleNamespace(context, module);
  JSValue definition = JS_GetPropertyStr(context, moduleNamespace, "default");
  JSValue request = JS_ParseJSON(
      context,
      requestJson.data(),
      requestJson.size(),
      "runtime-request.json");
  if (JS_IsException(definition) || JS_IsException(request)) {
    result = exceptionJson(context, guard);
    JS_FreeValue(context, definition);
    JS_FreeValue(context, request);
    JS_FreeValue(context, moduleNamespace);
    JS_FreeContext(context);
    JS_FreeRuntime(runtime);
    return result;
  }

  JSValue global = JS_GetGlobalObject(context);
  JS_SetPropertyStr(context, global, "__pocketDefinition", JS_DupValue(context, definition));
  JS_SetPropertyStr(context, global, "__pocketRequest", JS_DupValue(context, request));

  JSValue runnerResult = JS_Eval(
      context,
      kRunnerSource,
      std::strlen(kRunnerSource),
      "pocket-runner.js",
      JS_EVAL_TYPE_GLOBAL | JS_EVAL_FLAG_STRICT);
  if (JS_IsException(runnerResult)) {
    result = exceptionJson(context, guard);
  } else {
    const char* resultText = JS_ToCString(context, runnerResult);
    result = resultText == nullptr
        ? failureJson("RUNTIME_ERROR", "The QuickJS result was not a string.")
        : std::string(resultText);
    if (resultText != nullptr) JS_FreeCString(context, resultText);
  }

  JS_FreeValue(context, runnerResult);
  JS_FreeValue(context, global);
  JS_FreeValue(context, request);
  JS_FreeValue(context, definition);
  JS_FreeValue(context, moduleNamespace);
  JS_FreeContext(context);
  JS_FreeRuntime(runtime);
  return result;
}

std::string byteArrayToString(JNIEnv* environment, jbyteArray array) {
  const jsize length = environment->GetArrayLength(array);
  std::string value(static_cast<std::size_t>(length), '\0');
  environment->GetByteArrayRegion(
      array,
      0,
      length,
      reinterpret_cast<jbyte*>(value.data()));
  return value;
}

jbyteArray stringToByteArray(JNIEnv* environment, const std::string& value) {
  jbyteArray result = environment->NewByteArray(static_cast<jsize>(value.size()));
  if (result == nullptr) {
    return nullptr;
  }
  environment->SetByteArrayRegion(
      result,
      0,
      static_cast<jsize>(value.size()),
      reinterpret_cast<const jbyte*>(value.data()));
  return result;
}

}  // namespace

extern "C" JNIEXPORT jbyteArray JNICALL
Java_com_darbyjack_pockettools_quickjs_PocketQuickJsBridge_runUtf8(
    JNIEnv* environment,
    jobject,
    jbyteArray sourceBytes,
    jbyteArray requestBytes) {
  const std::string source = byteArrayToString(environment, sourceBytes);
  const std::string request = byteArrayToString(environment, requestBytes);
  return stringToByteArray(environment, runQuickJs(source, request));
}
