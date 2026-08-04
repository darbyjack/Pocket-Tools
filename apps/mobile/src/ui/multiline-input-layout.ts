export const DEFAULT_MULTILINE_LINES = 4;

const MULTILINE_LINE_HEIGHT = 24;
const MULTILINE_VERTICAL_PADDING_AND_BORDER = 26;

export type MultilineLineCount = 2 | 3 | 4 | 5 | 6 | 7 | 8;

export function multilineInputHeight(lines: MultilineLineCount = DEFAULT_MULTILINE_LINES): number {
  return lines * MULTILINE_LINE_HEIGHT + MULTILINE_VERTICAL_PADDING_AND_BORDER;
}
