import { mutateUserData, seedDemoWorkspace } from '@/server/data';
import { fail, ok, route } from '@/server/http';

export async function POST() {
  return route(async () => {
    let refused = false;

    const data = await mutateUserData((workspace) => {
      if (workspace.applications.length > 0 || workspace.resumes.length > 0) {
        refused = true;
        return;
      }
      seedDemoWorkspace(workspace);
    });

    if (refused) {
      return fail(
        'not-empty',
        'Sample data can only be loaded into an empty workspace. Delete your existing applications first.',
        409,
      );
    }

    return ok({ applications: data.applications.length }, 201);
  });
}
