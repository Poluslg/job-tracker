export async function extractTextFromFile(file: File): Promise<string> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("useAI", "false");

  const res = await fetch("/api/extract", {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Failed to extract text from file.");
  }

  const data = await res.json();
  return data.text;
}
