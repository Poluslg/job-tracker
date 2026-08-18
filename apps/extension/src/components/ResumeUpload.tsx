import { useCallback, useRef, useState } from "react";
import {
  Alert,
  Badge,
  Button,
  Spinner,
  Textarea,
  useToast,
  Label,
} from "@job-ai/ui";
import { Plus, Upload } from "lucide-react";
import { ResumeFileError, extractResumeText } from "../lib/resumeFile.ts";
import { MessageError, send } from "../lib/messaging.ts";

type FileStatus = "idle" | "reading" | "uploading";

export function ResumeUpload({
  onUploaded,
}: {
  onUploaded: (label: string) => void;
}) {
  const [text, setText] = useState("");
  const [fileStatus, setFileStatus] = useState<FileStatus>("idle");
  const [dragOver, setDragOver] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [tab, setTab] = useState<"upload" | "paste">("upload");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleFile = useCallback(
    async (file: File) => {
      const ext = file.name.split(".").pop()?.toLowerCase();
      if (!["pdf", "docx", "txt"].includes(ext ?? "")) {
        toast("Unsupported file type. Please use PDF, DOCX, or TXT.", "error");
        return;
      }
      setSelectedFile(file);
      setFileStatus("reading");
      try {
        const { text: extractedText, type } = await extractResumeText(file);
        if (extractedText.trim().length < 50) {
          toast("The file appears to be empty or could not be read.", "error");
          setFileStatus("idle");
          return;
        }
        setFileStatus("uploading");
        const result = await send({
          type: "SAVE_RESUME",
          payload: {
            fileName: file.name,
            fileType: type,
            text: extractedText,
            useAI: true,
          },
        });

        const msg = result.usedAI
          ? "Resume parsed with AI — all fields auto-filled. Review them below."
          : "Resume uploaded. Please review and correct the parsed fields.";
        toast(msg, "success");
        onUploaded(result.resume.label);
      } catch (err) {
        if (err instanceof ResumeFileError) {
          toast(`${err.message} ${err.hint}`, "error");
        } else if (err instanceof MessageError) {
          toast(err.message, "error");
        } else {
          toast(
            "Could not read or upload that file. Try a PDF, DOCX or TXT file.",
            "error",
          );
        }
      } finally {
        setFileStatus("idle");
      }
    },
    [toast, onUploaded],
  );

  const uploadText = async () => {
    setFileStatus("uploading");
    try {
      const result = await send({
        type: "SAVE_RESUME",
        payload: {
          fileName: "pasted-resume.txt",
          fileType: "txt",
          text,
          useAI: true,
        },
      });
      setText("");
      const msg = result.usedAI
        ? "Resume parsed with AI — all fields auto-filled. Review them below."
        : "Resume saved. Review the parsed fields below.";
      toast(msg, "success");
      onUploaded(result.resume.label);
    } catch (err) {
      toast(
        err instanceof MessageError ? err.message : "Could not save that text.",
        "error",
      );
    } finally {
      setFileStatus("idle");
    }
  };

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) void handleFile(file);
    },
    [handleFile],
  );

  return (
    <div className="space-y-6">
      <div className="flex gap-2 border-b border-border pb-4">
        <button
          type="button"
          onClick={() => setTab("upload")}
          className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${tab === "upload" ? "bg-brand-subtle text-brand" : "text-fg-muted hover:bg-surface-muted hover:text-fg"}`}
        >
          Upload file
        </button>
        <button
          type="button"
          onClick={() => setTab("paste")}
          className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${tab === "paste" ? "bg-brand-subtle text-brand" : "text-fg-muted hover:bg-surface-muted hover:text-fg"}`}
        >
          Paste text
        </button>
      </div>

      {tab === "upload" ? (
        <div className="space-y-4">
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`relative flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-8 py-14 transition-colors ${dragOver ? "border-brand bg-brand-subtle/50" : "border-border-strong hover:border-brand hover:bg-brand-subtle/20"}`}
          >
            {fileStatus === "idle" && !selectedFile ? (
              <>
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-subtle">
                  <Upload className="h-6 w-6 text-brand" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium text-fg">
                    Drop your resume here
                  </p>
                  <p className="mt-1 text-xs text-fg-muted">
                    or click to browse — PDF, DOCX, or TXT
                  </p>
                </div>
                <div className="flex gap-2">
                  <Badge size="sm">PDF</Badge>
                  <Badge size="sm">DOCX</Badge>
                  <Badge size="sm">TXT</Badge>
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center gap-3">
                <Spinner className="h-8 w-8 text-brand" />
                <p className="text-sm text-fg-muted">
                  {fileStatus === "reading"
                    ? `Reading ${selectedFile?.name ?? "file"}…`
                    : "Parsing and saving…"}
                </p>
              </div>
            )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.docx,.txt"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleFile(file);
              e.target.value = "";
            }}
          />
        </div>
      ) : (
        <div className="space-y-3">
          <div>
            <Label htmlFor="resume-text">Resume text</Label>
            <Textarea
              id="resume-text"
              rows={16}
              value={text}
              onChange={(e) => setText(e.target.value)}
              className="text-xs font-mono"
              placeholder="Paste your full resume here…"
            />
          </div>
          <Button
            loading={fileStatus === "uploading"}
            disabled={text.trim().length < 100}
            onClick={() => void uploadText()}
          >
            <Plus className="h-4 w-4" /> Save resume
          </Button>
        </div>
      )}

      <p className="text-xs leading-relaxed text-fg-subtle">
        Your resume is read in this browser and stored on this device. The file
        is never uploaded to us. Text is only sent to an AI provider when you
        run a feature that needs one, using your own API key.
      </p>
    </div>
  );
}
