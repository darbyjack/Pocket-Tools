import * as Clipboard from "expo-clipboard";
import { Share } from "react-native";

import type { OutputEffect } from "../model.ts";

export async function performHostOutput(effect: OutputEffect): Promise<void> {
  if (effect.type === "copy") {
    await Clipboard.setStringAsync(effect.text);
    return;
  }

  if (effect.type === "share") {
    await Share.share({
      message: effect.text,
      ...(effect.title === undefined ? {} : { title: effect.title }),
    });
    return;
  }

  assertNeverOutput(effect);
}

function assertNeverOutput(effect: never): never {
  void effect;
  throw new Error("The runtime returned an unsupported output effect.");
}
