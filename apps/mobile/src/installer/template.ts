export const NEW_MINI_APP_TEMPLATE = `// @ts-check

import { defineMiniApp, setting, ui } from "@pocket-tools/sdk";

export default defineMiniApp({
  manifest: {
    id: "my-tool",
    name: "My Tool",
    description: "Describe what this utility does.",
    sdkVersion: 1,
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
        title: "My Tool",
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
`;
