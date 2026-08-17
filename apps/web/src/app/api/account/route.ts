import { requireSession, signOut } from '@/server/auth';
import { ok, route } from '@/server/http';
import { getRepository } from '@/server/repository';

export async function DELETE() {
  return route(async () => {
    const session = await requireSession();
    await getRepository().deleteUserData(session.userId);
    await signOut();
    return ok({ deleted: true });
  });
}
