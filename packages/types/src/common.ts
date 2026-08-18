import { z } from "zod";

export const IsoDate = z.string().min(1);
export type IsoDate = z.infer<typeof IsoDate>;

export const Id = z.string().min(1);
export type Id = z.infer<typeof Id>;

export const Confidence = z.enum(["high", "medium", "low"]);
export type Confidence = z.infer<typeof Confidence>;

export const ExtractionSource = z.enum([
  "structured-data",
  "semantic-html",
  "known-selector",
  "heuristic",
  "ai",
  "manual",
]);
export type ExtractionSource = z.infer<typeof ExtractionSource>;

export const Timestamped = z.object({
  createdAt: IsoDate,
  updatedAt: IsoDate,
});
export type Timestamped = z.infer<typeof Timestamped>;

export function nowIso(): IsoDate {
  return new Date().toISOString();
}
