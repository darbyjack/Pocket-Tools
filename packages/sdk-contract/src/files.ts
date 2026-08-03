export interface TextFileExport {
  readonly name: string;
  readonly mimeType: string;
  readonly content: string;
}

export interface ImportedTextFile {
  readonly name: string;
  readonly mimeType: string;
  readonly content: string;
}

export interface FileClient {
  exportText(file: TextFileExport): Promise<void>;
  importText(options?: {
    readonly acceptedMimeTypes?: readonly string[];
    readonly maximumBytes?: number;
  }): Promise<ImportedTextFile | null>;
}
