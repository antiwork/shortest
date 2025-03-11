import { AutomationsList } from "./components/automations-list";
import { SetupDialog } from "./components/setup-dialog";
import { getUserProjects } from "@/lib/db/queries";

export default async function SetupPage() {
  const projects = await getUserProjects();

  return (
    <div className="space-y-6 h-full flex flex-col">
      <div className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Projects</h1>
            <p className="text-sm text-gray-500">
              Manage your end-to-end testing projects
            </p>
          </div>
          <SetupDialog projects={projects} />
        </div>
      </div>

      <div className="p-6 flex-grow">
        <div className="rounded-lg border">
          <AutomationsList projects={projects} />
        </div>
      </div>
    </div>
  );
}
