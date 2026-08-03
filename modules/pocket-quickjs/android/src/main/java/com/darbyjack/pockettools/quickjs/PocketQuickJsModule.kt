package com.darbyjack.pockettools.quickjs

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class PocketQuickJsModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("PocketQuickJs")

    AsyncFunction("run") {
      source: String,
      requestJson: String,
      maximumSourceBytes: Int,
      maximumRequestBytes: Int,
      maximumResultBytes: Int,
      runtimeMemoryBytes: Int,
      runtimeStackBytes: Int,
      executionTimeoutMilliseconds: Int,
      maximumLogEntries: Int,
      maximumLogBytes: Int ->
      PocketQuickJsBridge.run(
        source,
        requestJson,
        SandboxLimits(
          maximumSourceBytes = maximumSourceBytes,
          maximumRequestBytes = maximumRequestBytes,
          maximumResultBytes = maximumResultBytes,
          runtimeMemoryBytes = runtimeMemoryBytes,
          runtimeStackBytes = runtimeStackBytes,
          executionTimeoutMilliseconds = executionTimeoutMilliseconds,
          maximumLogEntries = maximumLogEntries,
          maximumLogBytes = maximumLogBytes,
        ),
      )
    }
  }
}

internal data class SandboxLimits(
  val maximumSourceBytes: Int = 512 * 1024,
  val maximumRequestBytes: Int = 2 * 1024 * 1024,
  val maximumResultBytes: Int = 2 * 1024 * 1024,
  val runtimeMemoryBytes: Int = 32 * 1024 * 1024,
  val runtimeStackBytes: Int = 512 * 1024,
  val executionTimeoutMilliseconds: Int = 250,
  val maximumLogEntries: Int = 100,
  val maximumLogBytes: Int = 64 * 1024,
)

internal object PocketQuickJsBridge {
  init {
    System.loadLibrary("pocketquickjs")
  }

  fun run(
    source: String,
    requestJson: String,
    limits: SandboxLimits = SandboxLimits(),
  ): String {
    val result = runUtf8(
      source.toByteArray(Charsets.UTF_8),
      requestJson.toByteArray(Charsets.UTF_8),
      limits.maximumSourceBytes,
      limits.maximumRequestBytes,
      limits.maximumResultBytes,
      limits.runtimeMemoryBytes,
      limits.runtimeStackBytes,
      limits.executionTimeoutMilliseconds,
      limits.maximumLogEntries,
      limits.maximumLogBytes,
    )
    return result.toString(Charsets.UTF_8)
  }

  private external fun runUtf8(
    source: ByteArray,
    requestJson: ByteArray,
    maximumSourceBytes: Int,
    maximumRequestBytes: Int,
    maximumResultBytes: Int,
    runtimeMemoryBytes: Int,
    runtimeStackBytes: Int,
    executionTimeoutMilliseconds: Int,
    maximumLogEntries: Int,
    maximumLogBytes: Int,
  ): ByteArray
}
