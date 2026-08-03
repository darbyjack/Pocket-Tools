// @ts-check

import { defineMiniApp, setting, ui } from "@pocket-tools/sdk";

/** @param {unknown} value */
function finiteNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

export default defineMiniApp({
  manifest: {
    id: "tip-splitter",
    name: "Tip Splitter",
    description: "Calculate a tip and split the total across a party.",
    icon: "calculator",
    sdkVersion: 1,
  },

  settings: {
    billAmount: setting.money({
      label: "Bill amount",
      default: 80,
      min: 0,
      max: 1_000_000,
    }),
    tipPercent: setting.number({
      label: "Tip percentage",
      default: 20,
      min: 0,
      max: 100,
    }),
    partySize: setting.number({
      label: "Party size",
      default: 2,
      min: 1,
      max: 100,
    }),
  },

  screens: {
    home(context) {
      const billAmount = Math.max(
        0,
        finiteNumber(context.settings.get("billAmount")),
      );
      const tipPercent = Math.max(
        0,
        finiteNumber(context.settings.get("tipPercent")),
      );
      const partySize = Math.max(
        1,
        Math.round(finiteNumber(context.settings.get("partySize"))),
      );
      const tipAmount = billAmount * (tipPercent / 100);
      const totalAmount = billAmount + tipAmount;
      const perPerson = totalAmount / partySize;

      return ui.page({
        title: "Tip Splitter",
        children: [
          ui.section({
            title: "Total",
            children: [
              ui.metric({
                label: "Bill plus tip",
                value: totalAmount,
                format: "money",
              }),
              ui.summary({
                title: "Breakdown",
                values: [
                  { label: "Bill", value: billAmount, format: "money" },
                  { label: "Tip", value: tipAmount, format: "money" },
                  {
                    label: "Tip rate",
                    value: `${tipPercent}%`,
                    format: "plain",
                  },
                ],
              }),
            ],
          }),
          ui.section({
            title: "Split",
            children: [
              ui.metric({
                label: "Per person",
                value: perPerson,
                format: "money",
              }),
              ui.summary({
                title: "Party",
                values: [
                  { label: "People", value: partySize, format: "number" },
                  {
                    label: "Total",
                    value: totalAmount,
                    format: "money",
                  },
                ],
              }),
            ],
          }),
        ],
      });
    },
  },
});
