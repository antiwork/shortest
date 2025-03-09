"use client";

import { AlertCircle, Github, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import type { Repository, WizardData } from "./ShortestWizard";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { RepositoryConfig } from "@/lib/db/schema";

interface RepositorySelectorProps {
  wizardData: WizardData;
  setWizardData: (data: WizardData) => void;
  nextStep: () => void;
  repositories: Repository[];
  setRepositories: (repos: Repository[]) => void;
  existingConfigs: RepositoryConfig[];
}

const RepositorySelector = ({
  wizardData,
  setWizardData,
  nextStep,
  repositories,
  setRepositories,
  existingConfigs,
}: RepositorySelectorProps) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchRepos = async () => {
      if (repositories.length > 0) return;

      setLoading(true);
      try {
        const response = await fetch("/api/github/repos");
        if (!response.ok) {
          throw new Error("Failed to fetch repositories");
        }
        const data = await response.json();
        setRepositories(data);
        setError(null);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to fetch repositories",
        );
      } finally {
        setLoading(false);
      }
    };

    fetchRepos();
  }, [repositories.length, setRepositories]);

  const handleSelect = (value: string) => {
    const selected = repositories.find((repo) => repo.full_name === value);
    const [owner, repo] = value.split("/");
    const existingConfig = existingConfigs.find(
      (config) => config.owner === owner && config.repo === repo,
    );

    if (existingConfig) {
      setError("This repository already has QA automation configured");
      setWizardData({ ...wizardData, selectedRepo: null });
      return;
    }

    setError(null);
    setWizardData({ ...wizardData, selectedRepo: selected || null });
  };

  if (loading) {
    return (
      <div className="flex justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Select
        value={wizardData.selectedRepo?.full_name}
        onValueChange={handleSelect}
      >
        <SelectTrigger className="w-[350px]">
          <div className="flex items-center gap-2">
            <Github className="h-4 w-4 opacity-50" />
            <SelectValue placeholder="Select a repository" />
          </div>
        </SelectTrigger>
        <SelectContent>
          {repositories.map((repo) => {
            const [owner, repoName] = repo.full_name.split("/");
            const hasExistingConfig = existingConfigs.some(
              (config) => config.owner === owner && config.repo === repoName,
            );

            return (
              <SelectItem
                key={repo.full_name}
                value={repo.full_name}
                disabled={hasExistingConfig}
                className="pr-12"
              >
                <div className="flex items-center justify-between w-full gap-4">
                  <span>{repo.full_name}</span>
                  {hasExistingConfig && (
                    <span className="inline-flex items-center rounded-full bg-yellow-50 px-2 py-0.5 text-xs font-medium text-yellow-800 ring-1 ring-inset ring-yellow-600/20 absolute right-2">
                      Already configured
                    </span>
                  )}
                </div>
              </SelectItem>
            );
          })}
        </SelectContent>
      </Select>

      {error && (
        <div className="flex items-center gap-2 text-sm text-red-500">
          <AlertCircle className="h-4 w-4" />
          <p>{error}</p>
        </div>
      )}

      <div className="flex justify-end">
        <Button onClick={nextStep} disabled={!wizardData.selectedRepo}>
          Next
        </Button>
      </div>
    </div>
  );
};

export { RepositorySelector };
