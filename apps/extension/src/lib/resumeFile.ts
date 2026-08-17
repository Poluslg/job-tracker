import type { ResumeFileType } from "@job-ai/types";
import { reflowDocument, toPdfItem, type PdfItem } from "@job-ai/core";

export const MAX_RESUME_BYTES = 10 * 1024 * 1024;

export class ResumeFileError extends Error {
  readonly hint: string;

  constructor(message: string, hint = "") {
    super(message);
    this.name = "ResumeFileError";
    this.hint = hint;
  }
}

export function fileTypeOf(file: File): ResumeFileType | null {
  const ext = file.name.toLowerCase().split(".").pop() ?? "";
  if (ext === "pdf") return "pdf";
  if (ext === "docx") return "docx";
  if (ext === "txt" || ext === "md") return "txt";
  return null;
}

export async function extractResumeText(
  file: File,
): Promise<{ text: string; type: ResumeFileType }> {
  const type = fileTypeOf(file);
  if (!type) {
    throw new ResumeFileError(
      "Unsupported file type.",
      "Upload a PDF, DOCX or TXT file.",
    );
  }
  if (file.size > MAX_RESUME_BYTES) {
    throw new ResumeFileError(
      "That file is larger than 10 MB.",
      "Resumes are usually well under 1 MB — check whether the file contains large images.",
    );
  }

  const text = await extract(file, type);
  const cleaned = text
    .replace(/\r\n/g, "\n")
    .replace(/\n{4,}/g, "\n\n\n")
    .trim();

  if (cleaned.length < 100) {
    throw new ResumeFileError(
      "We could not read enough text from that file.",
      type === "pdf"
        ? "This looks like a scanned or image-based PDF. Export a text-based PDF from your editor, or paste the text instead."
        : "Try saving the file as PDF or plain text and uploading again.",
    );
  }

  return { text: cleaned, type };
}

async function extract(file: File, type: ResumeFileType): Promise<string> {
  switch (type) {
    case "txt":
      return file.text();

    case "docx": {
      const mammoth = await import("mammoth/mammoth.browser.js");
      const buffer = await file.arrayBuffer();
      const result = await mammoth.extractRawText({ arrayBuffer: buffer });
      return result.value;
    }

    case "pdf": {
      const pdfjs = await import("pdfjs-dist");

      const workerUrl = new URL(
        "pdfjs-dist/build/pdf.worker.min.mjs",
        import.meta.url,
      );
      pdfjs.GlobalWorkerOptions.workerSrc = workerUrl.toString();

      const data = new Uint8Array(await file.arrayBuffer());
      const task = pdfjs.getDocument({ data });
      const doc = await task.promise;

      const pages: PdfItem[][] = [];
      try {
        for (let i = 1; i <= doc.numPages; i++) {
          const page = await doc.getPage(i);
          const content = await page.getTextContent();

          pages.push(
            content.items
              .map(toPdfItem)
              .filter((i): i is PdfItem => i !== null),
          );
        }
      } finally {
        await task.destroy();
      }
      return reflowDocument(pages);
    }
  }
}
