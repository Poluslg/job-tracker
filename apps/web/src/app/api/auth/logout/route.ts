import { signOut } from "@/server/auth";
import { ok, route } from "@/server/http";

export async function POST() {
  return route(async () => {
    await signOut();
    return ok({ ok: true });
  });
}
