import { AutomationsList } from "./components/AutomationsList";
import { SetupDialog } from "./components/SetupDialog";
import { getUserRepositoryConfigs } from "@/lib/db/queries";

export default async function SetupPage() {
  const configs = await getUserRepositoryConfigs();

  return (
    <div className="space-y-6 h-full flex flex-col">
      <div className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              QA Automations
            </h1>
            <p className="text-sm text-gray-500">
              Manage your end-to-end testing automations
            </p>
          </div>
          <SetupDialog configs={configs} />
        </div>
      </div>

      <div className="p-6 flex-grow">
        <div className="rounded-lg border bg-card">
          <AutomationsList configs={configs} />
        </div>
      </div>
    </div>
  );
}
