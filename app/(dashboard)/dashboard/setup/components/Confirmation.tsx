"use client";

import { Check, Loader2 } from "lucide-react";
import { useState } from "react";
import type { WizardData } from "./ShortestWizard";
import { Button } from "@/components/ui/button";

interface ConfirmationProps {
  wizardData: WizardData;
  prevStep: () => void;
  onComplete: () => void;
}

const Confirmation = ({
  wizardData,
  prevStep,
  onComplete,
}: ConfirmationProps) => {
  const [status, setStatus] = useState<{
    type: "idle" | "loading" | "error" | "success";
    message?: string;
  }>({ type: "idle" });

  const handleConfirm = async () => {
    if (!wizardData.selectedRepo) return;

    setStatus({ type: "loading", message: "Setting up Shortest..." });

    try {
      const response = await fetch("/api/github/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          repoFullName: wizardData.selectedRepo.full_name,
          testPattern: wizardData.testPattern,
          triggers: wizardData.triggers,
          defaultBranch: wizardData.selectedRepo.default_branch,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to set up Shortest");
      }

      setStatus({
        type: "success",
        message: "Setup complete! Add tests to your repository to get started.",
      });
    } catch (err) {
      setStatus({
        type: "error",
        message:
          err instanceof Error ? err.message : "Failed to set up Shortest",
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-6 p-6 border rounded-lg bg-gray-50">
        <div className="space-y-4">
          <div>
            <div className="text-sm font-medium text-gray-700">Repository</div>
            <div className="text-sm text-gray-500">
              {wizardData.selectedRepo?.full_name}
            </div>
          </div>
          <div>
            <div className="text-sm font-medium text-gray-700">Triggers</div>
            <ul className="text-sm text-gray-500 list-disc list-inside">
              {wizardData.triggers.onPush && (
                <li>Push to {wizardData.selectedRepo?.default_branch}</li>
              )}
              {wizardData.triggers.onPullRequest && <li>Pull requests</li>}
            </ul>
          </div>
        </div>
        <div>
          <div>
            <div className="text-sm font-medium text-gray-700">
              Test Pattern
            </div>
            <div className="text-sm text-gray-500">
              {wizardData.testPattern}
            </div>
          </div>
        </div>
      </div>

      {status.message && (
        <div
          className={`p-4 rounded-md ${
            status.type === "error"
              ? "bg-red-50 text-red-500"
              : status.type === "success"
                ? "bg-green-50 text-green-500"
                : "bg-gray-50 text-gray-500"
          }`}
        >
          <p className="text-sm">{status.message}</p>
        </div>
      )}

      <div className="flex justify-between">
        <Button
          onClick={prevStep}
          variant="outline"
          disabled={status.type === "loading" || status.type === "success"}
        >
          Back
        </Button>
        {status.type === "success" ? (
          <Button onClick={onComplete} variant="outline">
            <Check className="mr-2 h-4 w-4" />
            Done
          </Button>
        ) : (
          <Button onClick={handleConfirm} disabled={status.type === "loading"}>
            {status.type === "loading" ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Setting up...
              </>
            ) : (
              "Set Up"
            )}
          </Button>
        )}
      </div>
    </div>
  );
};

export { Confirmation };
