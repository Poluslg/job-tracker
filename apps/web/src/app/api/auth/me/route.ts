import { getAuthUser } from "@/server/auth";
import { ok, route } from "@/server/http";

export async function GET() {
  return route(async () => {
    const user = await getAuthUser();
    return ok({ user });
  });
}
