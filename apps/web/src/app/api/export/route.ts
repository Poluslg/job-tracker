import { exportTracker } from "@job-ai/core";
import { loadUserData } from "@/server/data";
import { fail, route } from "@/server/http";

export async function GET(request: Request) {
  return route(async () => {
    const format =
      new URL(request.url).searchParams.get("format") === "csv"
        ? "csv"
        : "xlsx";
    const { data } = await loadUserData();

    if (data.applications.length === 0) {
      return fail(
        "empty",
        "Your tracker is empty — there is nothing to export yet.",
        400,
      );
    }

    const file = exportTracker(data.applications, format);

    const body = new Uint8Array(file.bytes.byteLength);
    body.set(file.bytes);

    return new Response(body, {
      headers: {
        "content-type": file.mimeType,
        "content-disposition": `attachment; filename="${file.fileName}"`,
        "cache-control": "no-store",
      },
    });
  });
}
