import type { NumberInputNode as PublicNumberInputNode } from "@pocket-tools/sdk-contract";

export type NumberInputDecimalPlaces = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export interface DormantNumberInputNode extends PublicNumberInputNode {
  readonly step?: number;
  readonly decimalPlaces?: NumberInputDecimalPlaces;
}
