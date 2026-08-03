package com.darbyjack.pockettools.quickjs

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.records.Field
import expo.modules.kotlin.records.Record

class PocketQuickJsModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("PocketQuickJs")

    AsyncFunction("run") { source: String, requestJson: String, limits: SandboxLimits ->
      PocketQuickJsBridge.run(source, requestJson, limits)
    }
  }
}

internal class SandboxLimits(
  @Field val maximumSourceBytes: Int = 512 * 1024,
  @Field val maximumRequestBytes: Int = 2 * 1024 * 1024,
  @Field val maximumResultBytes: Int = 2 * 1024 * 1024,
  @Field val runtimeMemoryBytes: Int = 32 * 1024 * 1024,
  @Field val runtimeStackBytes: Int = 512 * 1024,
  @Field val executionTimeoutMilliseconds: Int = 250,
  @Field val maximumLogEntries: Int = 100,
  @Field val maximumLogBytes: Int = 64 * 1024,
) : Record

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
