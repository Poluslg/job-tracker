import { redirect } from "next/navigation";
import { getSession } from "@/server/auth";
import { Sidebar } from "./Sidebar.tsx";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  return (
    <div className="flex min-h-screen">
      <Sidebar email={session.email} name={session.name} />
      {}
      <main className="min-w-0 flex-1 px-5 py-6 lg:px-8 lg:py-8">
        {children}
      </main>
    </div>
  );
}
