// @ts-check

import { defineMiniApp, setting, ui } from "@pocket-tools/sdk";

export default defineMiniApp({
  manifest: {
    id: "replace-with-tool-id",
    name: "Replace With Tool Name",
    description: "Replace with one sentence describing the utility.",
    sdkVersion: "1.2",
  },

  settings: {
    message: setting.text({
      label: "Message",
      default: "Hello from Pocket Tools",
      maxLength: 200,
    }),
  },

  screens: {
    home(context) {
      return ui.page({
        title: "Replace With Tool Name",
        children: [
          ui.section({
            title: "Message",
            children: [
              ui.textInput({ setting: "message" }),
              ui.text({ text: String(context.settings.get("message")) }),
            ],
          }),
        ],
      });
    },
  },
});
