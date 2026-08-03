package com.darbyjack.pockettools.quickjs

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class PocketQuickJsModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("PocketQuickJs")

    AsyncFunction("run") { source: String, requestJson: String ->
      PocketQuickJsBridge.run(source, requestJson)
    }
  }
}

private object PocketQuickJsBridge {
  init {
    System.loadLibrary("pocketquickjs")
  }

  fun run(source: String, requestJson: String): String {
    val result = runUtf8(
      source.toByteArray(Charsets.UTF_8),
      requestJson.toByteArray(Charsets.UTF_8),
    )
    return result.toString(Charsets.UTF_8)
  }

  private external fun runUtf8(source: ByteArray, requestJson: ByteArray): ByteArray
}
