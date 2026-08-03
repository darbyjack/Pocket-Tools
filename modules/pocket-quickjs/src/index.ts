import { requireNativeModule } from "expo-modules-core";

interface PocketQuickJsNativeModule {
  readonly run: (source: string, requestJson: string) => Promise<string>;
}

const nativeModule = requireNativeModule<PocketQuickJsNativeModule>("PocketQuickJs");

export function runInQuickJs(source: string, requestJson: string): Promise<string> {
  return nativeModule.run(source, requestJson);
}
