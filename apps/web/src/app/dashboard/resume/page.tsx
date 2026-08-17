import { loadUserData } from "@/server/data";
import { ResumeManager } from "./ResumeManager.tsx";

export const metadata = { title: "Resume" };
export const dynamic = "force-dynamic";

export default async function ResumePage() {
  const { data } = await loadUserData();
  return <ResumeManager initialResumes={data.resumes} />;
}
