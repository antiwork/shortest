"use client";

import { GitBranch, Settings, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import type { RepositoryConfig } from "@/lib/db/schema";

interface AutomationsListProps {
  configs: RepositoryConfig[];
}

export const AutomationsList = ({ configs }: AutomationsListProps) => {
  const router = useRouter();

  const handleDelete = async (id: number) => {
    try {
      const response = await fetch(`/api/github/setup/${id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to delete automation");
      }

      router.refresh();
    } catch (error) {
      console.error("Error deleting automation:", error);
    }
  };

  if (configs.length === 0) {
    return (
      <div className="w-full border-2 border-dashed border-gray-300 rounded-lg p-6">
        <div className="flex flex-col items-center justify-center text-center">
          <Settings className="h-16 w-16 text-gray-400 mb-4" />
          <h3 className="text-xl font-semibold mb-2">
            No automations configured
          </h3>
          <p className="text-gray-600 mb-4">
            Get started by setting up QA automation for your first repository.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="divide-y">
      {configs.map((config) => (
        <div
          key={config.id}
          className="flex items-center justify-between p-6 hover:bg-accent/50"
        >
          <div className="min-w-0 flex-1">
            <div className="flex items-center space-x-3">
              <h2 className="truncate text-sm font-semibold">
                {config.owner}/{config.repo}
              </h2>
              <span
                className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                  config.enabled
                    ? "bg-green-50 text-green-700 ring-1 ring-inset ring-green-600/20"
                    : "bg-red-50 text-red-700 ring-1 ring-inset ring-red-600/20"
                }`}
              >
                {config.enabled ? "Active" : "Disabled"}
              </span>
            </div>
            <div className="mt-1 flex items-center space-x-2 text-xs text-gray-500">
              <GitBranch className="h-4 w-4" />
              <span>
                Configured {new Date(config.createdAt).toLocaleDateString()}
              </span>
            </div>
          </div>
          <div className="ml-4 flex items-center space-x-4">
            <Button variant="outline" size="sm">
              <Settings className="h-4 w-4 mr-2" />
              Settings
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="icon">
                  <Trash2 className="h-4 w-4 text-gray-500 hover:text-red-500" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Remove QA Automation</AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure you want to remove the QA automation for{" "}
                    <span className="font-semibold">
                      {config.owner}/{config.repo}
                    </span>
                    ? This will not delete any files from your repository.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => handleDelete(config.id)}
                    className="bg-red-600 hover:bg-red-700"
                  >
                    Remove
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      ))}
    </div>
  );
};
