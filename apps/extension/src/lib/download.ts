export async function downloadDataUrl(
  dataUrl: string,
  fileName: string,
): Promise<void> {
  if (chrome.downloads?.download) {
    await chrome.downloads.download({
      url: dataUrl,
      filename: fileName,
      saveAs: true,
    });
    return;
  }
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = fileName;
  a.click();
}

export async function downloadBytes(
  bytes: Uint8Array,
  fileName: string,
  mimeType: string,
): Promise<void> {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  const url = URL.createObjectURL(new Blob([copy.buffer], { type: mimeType }));
  try {
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    a.click();
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  }
}

export function downloadText(
  text: string,
  fileName: string,
  mimeType = "text/plain",
): void {
  void downloadBytes(new TextEncoder().encode(text), fileName, mimeType);
}
