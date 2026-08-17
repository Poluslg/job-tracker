import { NextRequest, NextResponse } from "next/server";
import mammoth from "mammoth";

export const runtime = "nodejs";

const MAX_FILE_SIZE = 10 * 1024 * 1024;

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();

    const file = formData.get("file");
    const useAI = formData.get("useAI") !== "false";

    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "No file was uploaded." },
        { status: 400 },
      );
    }

    if (file.size === 0) {
      return NextResponse.json(
        { error: "The uploaded file is empty." },
        { status: 400 },
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "File is too large. Maximum size is 10 MB." },
        { status: 400 },
      );
    }

    const fileName = file.name;
    const extension = fileName.split(".").pop()?.toLowerCase();

    if (!extension || !["pdf", "docx", "txt"].includes(extension)) {
      return NextResponse.json(
        {
          error: "Unsupported file type. Please upload PDF, DOCX, or TXT.",
        },
        { status: 400 },
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    let extractedText = "";

    if (extension === "txt") {
      extractedText = buffer.toString("utf-8");
    }

    if (extension === "pdf") {
      const { PDFParse } = await import("pdf-parse");
      const parser = new PDFParse({ data: new Uint8Array(buffer) });
      const textResult = await parser.getText();
      extractedText = textResult.text;
    }

    if (extension === "docx") {
      const result = await mammoth.extractRawText({
        buffer,
      });

      extractedText = result.value;
    }

    extractedText = extractedText
      .replace(/\r\n/g, "\n")
      .replace(/\r/g, "\n")
      .replace(/[ \t]+/g, " ")
      .replace(/ +\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();

    if (extractedText.length < 50) {
      return NextResponse.json(
        {
          error:
            "Could not extract enough text from this file. The PDF may be scanned or image-based.",
          needsOCR: extension === "pdf",
        },
        { status: 422 },
      );
    }

    if (useAI) {
      const parsedResume = await parseResumeWithAI(extractedText);

      return NextResponse.json({
        resume: parsedResume,
        usedAI: true,
        extractedTextLength: extractedText.length,
      });
    }

    return NextResponse.json({
      text: extractedText,
      usedAI: false,
      extractedTextLength: extractedText.length,
    });
  } catch (error) {
    console.error("[Resume Parser]", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to parse resume.",
      },
      { status: 500 },
    );
  }
}

async function parseResumeWithAI(text: string) {
  const response = await fetch(
    "https://openrouter.ai/api/v1/chat/completions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.RESUME_AI_MODEL ?? "openai/gpt-4.1-mini",
        temperature: 0,
        messages: [
          {
            role: "system",
            content: "You extract structured resume data. Return JSON only.",
          },
          {
            role: "user",
            content: `
Extract structured information from this resume.

Rules:
- Do not invent information.
- Missing fields must be empty.
- Preserve the candidate's actual experience.
- Do not add skills that are not present.
- Return valid JSON only.

Resume:

${text}
`,
          },
        ],
        response_format: {
          type: "json_object",
        },
      }),
    },
  );

  if (!response.ok) {
    const errorText = await response.text();

    throw new Error(`AI parsing failed: ${response.status} ${errorText}`);
  }

  const data = await response.json();

  const content = data.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error("AI returned an empty response.");
  }

  return JSON.parse(content);
}
