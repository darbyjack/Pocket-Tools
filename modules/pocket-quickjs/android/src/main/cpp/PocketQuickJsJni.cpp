#include <jni.h>

#include <cstddef>
#include <cstdint>
#include <new>
#include <string>

#include "PocketQuickJsRuntime.h"

namespace {

std::string byteArrayToString(JNIEnv* environment, jbyteArray array) {
  const jsize length = environment->GetArrayLength(array);
  std::string value(static_cast<std::size_t>(length), '\0');
  if (length > 0) {
    environment->GetByteArrayRegion(
        array,
        0,
        length,
        reinterpret_cast<jbyte*>(value.data()));
  }
  return value;
}

jbyteArray stringToByteArray(JNIEnv* environment, const std::string& value) {
  jbyteArray result = environment->NewByteArray(static_cast<jsize>(value.size()));
  if (result == nullptr) return nullptr;
  if (!value.empty()) {
    environment->SetByteArrayRegion(
        result,
        0,
        static_cast<jsize>(value.size()),
        reinterpret_cast<const jbyte*>(value.data()));
  }
  return result;
}

jbyteArray immediateFailure(JNIEnv* environment, const char* code, const char* message) {
  const std::string json = std::string("{\"ok\":false,\"error\":{\"code\":\"") +
      code + "\",\"message\":\"" + message +
      "\"},\"logs\":[],\"logsTruncated\":false}";
  return stringToByteArray(environment, json);
}

bool isPositive(jint value) {
  return value > 0;
}

}  // namespace

extern "C" JNIEXPORT jbyteArray JNICALL
Java_com_darbyjack_pockettools_quickjs_PocketQuickJsBridge_runUtf8(
    JNIEnv* environment,
    jobject,
    jbyteArray sourceBytes,
    jbyteArray requestBytes,
    jint maximumSourceBytes,
    jint maximumRequestBytes,
    jint maximumResultBytes,
    jint runtimeMemoryBytes,
    jint runtimeStackBytes,
    jint executionTimeoutMilliseconds,
    jint maximumLogEntries,
    jint maximumLogBytes) {
  if (sourceBytes == nullptr || requestBytes == nullptr) {
    return immediateFailure(
        environment,
        "INVALID_HOST_REQUEST",
        "The native sandbox requires source and request bytes.");
  }
  if (!isPositive(maximumSourceBytes) || !isPositive(maximumRequestBytes) ||
      !isPositive(maximumResultBytes) || !isPositive(runtimeMemoryBytes) ||
      !isPositive(runtimeStackBytes) || !isPositive(executionTimeoutMilliseconds) ||
      maximumLogEntries < 0 || maximumLogBytes < 0) {
    return immediateFailure(
        environment,
        "INVALID_HOST_CONFIGURATION",
        "The native sandbox limits must be non-negative integers.");
  }

  const jsize sourceLength = environment->GetArrayLength(sourceBytes);
  const jsize requestLength = environment->GetArrayLength(requestBytes);
  if (sourceLength > maximumSourceBytes) {
    return immediateFailure(
        environment,
        "SOURCE_LIMIT_EXCEEDED",
        "The mini-app source exceeds the host limit.");
  }
  if (requestLength > maximumRequestBytes) {
    return immediateFailure(
        environment,
        "REQUEST_LIMIT_EXCEEDED",
        "The runtime request exceeds the host limit.");
  }

  try {
    const std::string source = byteArrayToString(environment, sourceBytes);
    const std::string request = byteArrayToString(environment, requestBytes);
    const pocket_tools::quickjs::SandboxLimits limits{
        .maximumSourceBytes = static_cast<std::size_t>(maximumSourceBytes),
        .maximumRequestBytes = static_cast<std::size_t>(maximumRequestBytes),
        .maximumResultBytes = static_cast<std::size_t>(maximumResultBytes),
        .runtimeMemoryBytes = static_cast<std::size_t>(runtimeMemoryBytes),
        .runtimeStackBytes = static_cast<std::size_t>(runtimeStackBytes),
        .executionTimeoutMilliseconds =
            static_cast<std::uint32_t>(executionTimeoutMilliseconds),
        .maximumLogEntries = static_cast<std::uint32_t>(maximumLogEntries),
        .maximumLogBytes = static_cast<std::size_t>(maximumLogBytes),
    };
    return stringToByteArray(environment, pocket_tools::quickjs::run(source, request, limits));
  } catch (const std::bad_alloc&) {
    return immediateFailure(
        environment,
        "NATIVE_MEMORY_LIMIT",
        "The native sandbox allocation failed.");
  } catch (...) {
    return immediateFailure(
        environment,
        "NATIVE_RUNTIME_ERROR",
        "The native sandbox failed unexpectedly.");
  }
}
