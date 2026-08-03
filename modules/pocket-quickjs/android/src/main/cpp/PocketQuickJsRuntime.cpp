#include "PocketQuickJsRuntime.h"
#include "PocketQuickJsSources.h"

#include <algorithm>
#include <chrono>
#include <cctype>
#include <cstddef>
#include <cstdint>
#include <cstring>
#include <exception>
#include <new>
#include <optional>
#include <string>
#include <string_view>
#include <unordered_map>
#include <utility>
#include <vector>

extern "C" {
#include <quickjs.h>
}

namespace pocket_tools::quickjs {
namespace {

constexpr const char* kSdkModuleName = "@pocket-tools/sdk";
constexpr std::size_t kMaximumFailureMessageBytes = 4 * 1024;
constexpr std::size_t kMaximumFailureStackBytes = 16 * 1024;

struct LogEntry {
  std::string level;
  std::string message;
};

struct RuntimeState {
  const SandboxLimits& limits;
  std::chrono::steady_clock::time_point deadline;
  bool interrupted = false;
  bool logsTruncated = false;
  std::size_t logBytes = 0;
  std::vector<LogEntry> logs;
  std::unordered_map<void*, std::string> unhandledRejections;
};

class RuntimeOwner {
 public:
  explicit RuntimeOwner(JSRuntime* runtime) : runtime_(runtime) {}
  ~RuntimeOwner() {
    if (runtime_ != nullptr) JS_FreeRuntime(runtime_);
  }
  RuntimeOwner(const RuntimeOwner&) = delete;
  RuntimeOwner& operator=(const RuntimeOwner&) = delete;
  [[nodiscard]] JSRuntime* get() const { return runtime_; }

 private:
  JSRuntime* runtime_;
};

class ContextOwner {
 public:
  explicit ContextOwner(JSContext* context) : context_(context) {}
  ~ContextOwner() {
    if (context_ != nullptr) JS_FreeContext(context_);
  }
  ContextOwner(const ContextOwner&) = delete;
  ContextOwner& operator=(const ContextOwner&) = delete;
  [[nodiscard]] JSContext* get() const { return context_; }

 private:
  JSContext* context_;
};

class ValueOwner {
 public:
  ValueOwner(JSContext* context, JSValue value) : context_(context), value_(value) {}
  ~ValueOwner() { JS_FreeValue(context_, value_); }
  ValueOwner(const ValueOwner&) = delete;
  ValueOwner& operator=(const ValueOwner&) = delete;
  ValueOwner(ValueOwner&& other) noexcept
      : context_(other.context_), value_(other.release()) {}
  [[nodiscard]] JSValue get() const { return value_; }
  [[nodiscard]] JSValue release() {
    JSValue value = value_;
    value_ = JS_UNDEFINED;
    return value;
  }

 private:
  JSContext* context_;
  JSValue value_;
};

std::string truncateUtf8(std::string_view value, std::size_t maximumBytes) {
  if (value.size() <= maximumBytes) return std::string(value);
  std::size_t length = maximumBytes;
  while (length > 0 && (static_cast<unsigned char>(value[length]) & 0xc0U) == 0x80U) {
    length -= 1;
  }
  return std::string(value.substr(0, length));
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

std::string logsJson(const RuntimeState* state, std::size_t maximumBytes) {
  if (state == nullptr || state->logs.empty()) return "[]";
  std::string json = "[";
  for (const LogEntry& entry : state->logs) {
    std::string item = "{\"level\":\"" + escapeJson(entry.level) +
        "\",\"message\":\"" + escapeJson(entry.message) + "\"}";
    if (json.size() + item.size() + 1 > maximumBytes) break;
    if (json.size() > 1) json += ',';
    json += item;
  }
  json += ']';
  return json;
}

std::string minimalFailure(std::string_view code, std::string_view message) {
  return "{\"ok\":false,\"error\":{\"code\":\"" + escapeJson(code) +
      "\",\"message\":\"" + escapeJson(message) + "\"},\"logs\":[],"
      "\"logsTruncated\":true}";
}

std::string failureJson(
    const SandboxLimits& limits,
    std::string_view code,
    std::string_view message,
    std::string_view stack = {},
    const RuntimeState* state = nullptr) {
  const std::string safeMessage = truncateUtf8(message, kMaximumFailureMessageBytes);
  const std::string safeStack = truncateUtf8(stack, kMaximumFailureStackBytes);

  std::string json = "{\"ok\":false,\"error\":{\"code\":\"";
  json += escapeJson(code);
  json += "\",\"message\":\"";
  json += escapeJson(safeMessage);
  json += "\"";
  if (!safeStack.empty()) {
    json += ",\"stack\":\"";
    json += escapeJson(safeStack);
    json += "\"";
  }
  json += "},\"logs\":";

  const std::size_t reservedTail = 64;
  const std::size_t availableForLogs = limits.maximumResultBytes > json.size() + reservedTail
      ? limits.maximumResultBytes - json.size() - reservedTail
      : 2;
  json += logsJson(state, availableForLogs);
  json += ",\"logsTruncated\":";
  json += state != nullptr && state->logsTruncated ? "true" : "false";
  json += '}';

  if (json.size() <= limits.maximumResultBytes) return json;
  return minimalFailure(code, safeMessage);
}

std::string valueToString(JSContext* context, JSValueConst value) {
  ValueOwner stringValue(context, JS_ToString(context, value));
  if (JS_IsException(stringValue.get())) {
    ValueOwner ignored(context, JS_GetException(context));
    return "[unprintable]";
  }
  const char* text = JS_ToCString(context, stringValue.get());
  if (text == nullptr) return "[unprintable]";
  std::string result(text);
  JS_FreeCString(context, text);
  return result;
}

void appendLog(JSContext* context, const char* level, int argc, JSValueConst* argv) {
  auto* state = static_cast<RuntimeState*>(JS_GetContextOpaque(context));
  if (state == nullptr || state->logsTruncated) return;
  if (state->logs.size() >= state->limits.maximumLogEntries) {
    state->logsTruncated = true;
    return;
  }

  std::string message;
  for (int index = 0; index < argc; index += 1) {
    if (index > 0) message += ' ';
    message += valueToString(context, argv[index]);
  }

  const std::size_t entryBytes = std::strlen(level) + message.size();
  if (state->logBytes + entryBytes > state->limits.maximumLogBytes) {
    state->logsTruncated = true;
    return;
  }
  state->logBytes += entryBytes;
  state->logs.push_back({level, std::move(message)});
}

JSValue consoleLog(JSContext* context, JSValueConst, int argc, JSValueConst* argv) {
  appendLog(context, "log", argc, argv);
  return JS_UNDEFINED;
}
JSValue consoleInfo(JSContext* context, JSValueConst, int argc, JSValueConst* argv) {
  appendLog(context, "info", argc, argv);
  return JS_UNDEFINED;
}
JSValue consoleWarn(JSContext* context, JSValueConst, int argc, JSValueConst* argv) {
  appendLog(context, "warn", argc, argv);
  return JS_UNDEFINED;
}
JSValue consoleError(JSContext* context, JSValueConst, int argc, JSValueConst* argv) {
  appendLog(context, "error", argc, argv);
  return JS_UNDEFINED;
}

bool installConsole(JSContext* context) {
  ValueOwner global(context, JS_GetGlobalObject(context));
  ValueOwner console(context, JS_NewObject(context));
  if (JS_IsException(global.get()) || JS_IsException(console.get())) return false;

  if (JS_SetPropertyStr(context, console.get(), "log", JS_NewCFunction(context, consoleLog, "log", 1)) < 0 ||
      JS_SetPropertyStr(context, console.get(), "info", JS_NewCFunction(context, consoleInfo, "info", 1)) < 0 ||
      JS_SetPropertyStr(context, console.get(), "warn", JS_NewCFunction(context, consoleWarn, "warn", 1)) < 0 ||
      JS_SetPropertyStr(context, console.get(), "error", JS_NewCFunction(context, consoleError, "error", 1)) < 0) {
    return false;
  }
  return JS_SetPropertyStr(context, global.get(), "console", console.release()) >= 0;
}

int interruptHandler(JSRuntime*, void* opaque) {
  auto* state = static_cast<RuntimeState*>(opaque);
  if (std::chrono::steady_clock::now() <= state->deadline) return 0;
  state->interrupted = true;
  return 1;
}

void promiseRejectionTracker(
    JSContext* context,
    JSValueConst promise,
    JSValueConst reason,
    bool isHandled,
    void* opaque) {
  auto* state = static_cast<RuntimeState*>(opaque);
  void* key = JS_VALUE_GET_PTR(promise);
  if (isHandled) {
    state->unhandledRejections.erase(key);
  } else {
    state->unhandledRejections[key] = valueToString(context, reason);
  }
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

  ValueOwner compiled(
      context,
      JS_Eval(
          context,
          sources::kSdk,
          std::strlen(sources::kSdk),
          kSdkModuleName,
          JS_EVAL_TYPE_MODULE | JS_EVAL_FLAG_COMPILE_ONLY));
  if (JS_IsException(compiled.get())) return nullptr;
  return static_cast<JSModuleDef*>(JS_VALUE_GET_PTR(compiled.get()));
}

std::string lowerAscii(std::string value) {
  std::transform(value.begin(), value.end(), value.begin(), [](unsigned char character) {
    return static_cast<char>(std::tolower(character));
  });
  return value;
}

std::string exceptionFailure(
    JSContext* context,
    RuntimeState& state,
    std::optional<std::string_view> forcedCode = std::nullopt) {
  ValueOwner exception(context, JS_GetException(context));
  ValueOwner codeValue(context, JS_GetPropertyStr(context, exception.get(), "code"));
  ValueOwner stackValue(context, JS_GetPropertyStr(context, exception.get(), "stack"));

  const std::string message = valueToString(context, exception.get());
  const std::string stack = JS_IsUndefined(stackValue.get())
      ? ""
      : valueToString(context, stackValue.get());
  const std::string explicitCode = JS_IsUndefined(codeValue.get())
      ? ""
      : valueToString(context, codeValue.get());
  const std::string normalizedMessage = lowerAscii(message);

  std::string code;
  if (forcedCode.has_value()) {
    code = std::string(*forcedCode);
  } else if (state.interrupted) {
    code = "RUNTIME_TIMEOUT";
  } else if (normalizedMessage.find("out of memory") != std::string::npos) {
    code = "RUNTIME_MEMORY_LIMIT";
  } else if (normalizedMessage.find("stack overflow") != std::string::npos) {
    code = "RUNTIME_STACK_LIMIT";
  } else if (normalizedMessage.find("unsupported module:") != std::string::npos) {
    code = "UNSUPPORTED_MODULE";
  } else {
    code = explicitCode.empty() ? "RUNTIME_ERROR" : explicitCode;
  }

  return failureJson(state.limits, code, message, stack, &state);
}

bool drainPendingJobs(JSRuntime* runtime, RuntimeState& state, std::string& failure) {
  while (JS_IsJobPending(runtime)) {
    if (std::chrono::steady_clock::now() > state.deadline) {
      state.interrupted = true;
      failure = failureJson(
          state.limits,
          "RUNTIME_TIMEOUT",
          "QuickJS execution exceeded the host deadline.",
          {},
          &state);
      return false;
    }
    JSContext* jobContext = nullptr;
    if (JS_ExecutePendingJob(runtime, &jobContext) < 0) {
      failure = exceptionFailure(jobContext, state);
      return false;
    }
  }

  if (!state.unhandledRejections.empty()) {
    failure = failureJson(
        state.limits,
        "UNHANDLED_PROMISE_REJECTION",
        state.unhandledRejections.begin()->second,
        {},
        &state);
    return false;
  }
  return true;
}

bool addLogsToResponse(JSContext* context, JSValueConst response, const RuntimeState& state) {
  ValueOwner logs(context, JS_NewArray(context));
  if (JS_IsException(logs.get())) return false;

  std::uint32_t index = 0;
  for (const LogEntry& entry : state.logs) {
    ValueOwner item(context, JS_NewObject(context));
    if (JS_IsException(item.get()) ||
        JS_SetPropertyStr(context, item.get(), "level", JS_NewString(context, entry.level.c_str())) < 0 ||
        JS_SetPropertyStr(context, item.get(), "message", JS_NewString(context, entry.message.c_str())) < 0 ||
        JS_SetPropertyUint32(context, logs.get(), index++, item.release()) < 0) {
      return false;
    }
  }

  if (JS_SetPropertyStr(context, response, "logs", logs.release()) < 0) return false;
  return JS_SetPropertyStr(
             context,
             response,
             "logsTruncated",
             JS_NewBool(context, state.logsTruncated)) >= 0;
}

bool validLimits(const SandboxLimits& limits) {
  constexpr std::size_t mebibyte = 1024 * 1024;
  return limits.maximumSourceBytes > 0 && limits.maximumSourceBytes <= 8 * mebibyte &&
      limits.maximumRequestBytes > 0 && limits.maximumRequestBytes <= 32 * mebibyte &&
      limits.maximumResultBytes >= 256 && limits.maximumResultBytes <= 16 * mebibyte &&
      limits.runtimeMemoryBytes >= 4 * mebibyte && limits.runtimeMemoryBytes <= 512 * mebibyte &&
      limits.runtimeStackBytes >= 64 * 1024 && limits.runtimeStackBytes <= 8 * mebibyte &&
      limits.executionTimeoutMilliseconds >= 10 && limits.executionTimeoutMilliseconds <= 30'000 &&
      limits.maximumLogEntries <= 1'000 &&
      limits.maximumLogBytes <= mebibyte;
}

std::string runInternal(
    std::string_view source,
    std::string_view requestJson,
    const SandboxLimits& limits) {
  if (!validLimits(limits)) {
    return minimalFailure("INVALID_HOST_CONFIGURATION", "The QuickJS sandbox limits are invalid.");
  }
  if (source.size() > limits.maximumSourceBytes) {
    return failureJson(limits, "SOURCE_LIMIT_EXCEEDED", "The mini-app source exceeds the host limit.");
  }
  if (requestJson.size() > limits.maximumRequestBytes) {
    return failureJson(limits, "REQUEST_LIMIT_EXCEEDED", "The runtime request exceeds the host limit.");
  }

  RuntimeState state{
      .limits = limits,
      .deadline = std::chrono::steady_clock::now() +
          std::chrono::milliseconds(limits.executionTimeoutMilliseconds),
  };
  RuntimeOwner runtime(JS_NewRuntime());
  if (runtime.get() == nullptr) {
    return failureJson(limits, "RUNTIME_MEMORY_LIMIT", "Unable to create the QuickJS runtime.");
  }

  JS_SetMemoryLimit(runtime.get(), limits.runtimeMemoryBytes);
  JS_SetMaxStackSize(runtime.get(), limits.runtimeStackBytes);
  JS_SetCanBlock(runtime.get(), false);
  JS_SetModuleLoaderFunc2(runtime.get(), nullptr, moduleLoader, nullptr, nullptr);

  state.logs.reserve(std::min<std::uint32_t>(limits.maximumLogEntries, 64));
  JS_SetRuntimeOpaque(runtime.get(), &state);
  JS_SetInterruptHandler(runtime.get(), interruptHandler, &state);
  JS_SetHostPromiseRejectionTracker(runtime.get(), promiseRejectionTracker, &state);

  ContextOwner context(JS_NewContext(runtime.get()));
  if (context.get() == nullptr) {
    return failureJson(limits, "RUNTIME_MEMORY_LIMIT", "Unable to create the QuickJS context.");
  }
  JS_SetContextOpaque(context.get(), &state);
  if (!installConsole(context.get())) {
    return exceptionFailure(context.get(), state);
  }

  ValueOwner moduleValue(
      context.get(),
      JS_Eval(
          context.get(),
          source.data(),
          source.size(),
          "pocket-mini-app.mjs",
          JS_EVAL_TYPE_MODULE | JS_EVAL_FLAG_COMPILE_ONLY));
  if (JS_IsException(moduleValue.get())) return exceptionFailure(context.get(), state);

  auto* module = static_cast<JSModuleDef*>(JS_VALUE_GET_PTR(moduleValue.get()));
  if (JS_ResolveModule(context.get(), moduleValue.get()) < 0) {
    return exceptionFailure(context.get(), state);
  }

  ValueOwner evaluation(context.get(), JS_EvalFunction(context.get(), moduleValue.release()));
  if (JS_IsException(evaluation.get())) return exceptionFailure(context.get(), state);

  std::string jobFailure;
  if (!drainPendingJobs(runtime.get(), state, jobFailure)) return jobFailure;

  ValueOwner moduleNamespace(context.get(), JS_GetModuleNamespace(context.get(), module));
  ValueOwner definition(
      context.get(), JS_GetPropertyStr(context.get(), moduleNamespace.get(), "default"));
  ValueOwner request(
      context.get(),
      JS_ParseJSON(
          context.get(),
          requestJson.data(),
          requestJson.size(),
          "runtime-request.json"));
  if (JS_IsException(definition.get())) return exceptionFailure(context.get(), state);
  if (JS_IsException(request.get())) {
    return exceptionFailure(context.get(), state, "INVALID_RUNTIME_REQUEST");
  }

  ValueOwner runner(
      context.get(),
      JS_Eval(
          context.get(),
          sources::kRunner,
          std::strlen(sources::kRunner),
          "pocket-runner.js",
          JS_EVAL_TYPE_GLOBAL | JS_EVAL_FLAG_STRICT));
  if (JS_IsException(runner.get())) return exceptionFailure(context.get(), state);

  JSValue arguments[] = {definition.get(), request.get()};
  ValueOwner response(
      context.get(),
      JS_Call(context.get(), runner.get(), JS_UNDEFINED, 2, arguments));
  if (JS_IsException(response.get())) return exceptionFailure(context.get(), state);
  if (!drainPendingJobs(runtime.get(), state, jobFailure)) return jobFailure;
  if (!JS_IsObject(response.get())) {
    return failureJson(
        limits,
        "INVALID_BRIDGE_VALUE",
        "The runtime response must be a plain object.",
        {},
        &state);
  }
  if (!addLogsToResponse(context.get(), response.get(), state)) {
    return exceptionFailure(context.get(), state);
  }

  ValueOwner json(
      context.get(),
      JS_JSONStringify(context.get(), response.get(), JS_UNDEFINED, JS_UNDEFINED));
  if (JS_IsException(json.get())) {
    return exceptionFailure(context.get(), state, "INVALID_BRIDGE_VALUE");
  }
  const char* resultText = JS_ToCString(context.get(), json.get());
  if (resultText == nullptr) {
    return failureJson(
        limits,
        "RUNTIME_MEMORY_LIMIT",
        "Unable to encode the QuickJS result.",
        {},
        &state);
  }
  std::string result(resultText);
  JS_FreeCString(context.get(), resultText);

  if (result.size() > limits.maximumResultBytes) {
    return failureJson(
        limits,
        "RESULT_LIMIT_EXCEEDED",
        "The mini-app result exceeds the host limit.",
        {},
        &state);
  }
  return result;
}

}  // namespace

std::string run(
    std::string_view source,
    std::string_view requestJson,
    const SandboxLimits& limits) {
  try {
    return runInternal(source, requestJson, limits);
  } catch (const std::bad_alloc&) {
    return minimalFailure("NATIVE_MEMORY_LIMIT", "The native sandbox allocation failed.");
  } catch (const std::exception& error) {
    return minimalFailure("NATIVE_RUNTIME_ERROR", error.what());
  } catch (...) {
    return minimalFailure("NATIVE_RUNTIME_ERROR", "The native sandbox failed unexpectedly.");
  }
}

}  // namespace pocket_tools::quickjs
