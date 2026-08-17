declare module 'mammoth/mammoth.browser.js' {
  export interface ExtractRawTextOptions {
    arrayBuffer: ArrayBuffer;
  }
  export interface ExtractRawTextResult {
    value: string;
    messages: Array<{ type: string; message: string }>;
  }
  export function extractRawText(options: ExtractRawTextOptions): Promise<ExtractRawTextResult>;
}
