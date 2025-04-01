"use client";

import { AlertCircle, GitPullRequest, Loader2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { PullRequestItem } from "./pull-request";
import { PullRequestFilter } from "./pull-request-filter";
import type { PullRequest } from "./types";
import { getAssignedPullRequests } from "@/lib/github";

export default function DashboardPage() {
  const [pullRequests, setPullRequests] = useState<PullRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter-related state and logic
  const [selectedRepoFilters, setSelectedRepoFilters] = useState<string[]>([]);
  const [buildStatusFilter, setBuildStatusFilter] = useState<string[]>([]);

  const uniqueRepositories = useMemo(
    () =>
      Array.from(new Set(pullRequests.map((pr) => pr.repository.full_name))),
    [pullRequests],
  );

  const filteredPullRequests = useMemo(
    () =>
      pullRequests.filter((pr) => {
        const repoMatch =
          selectedRepoFilters.length === 0 ||
          selectedRepoFilters.includes(pr.repository.full_name);
        const statusMatch =
          buildStatusFilter.length === 0 ||
          buildStatusFilter.includes(pr.buildStatus.toLowerCase());
        return repoMatch && statusMatch;
      }),
    [pullRequests, selectedRepoFilters, buildStatusFilter],
  );

  const handleRepoFilterChange = (value: string) => {
    setSelectedRepoFilters((prev) =>
      prev.includes(value)
        ? prev.filter((filter) => filter !== value)
        : [...prev, value],
    );
  };

  const handleBuildStatusFilterChange = (value: string) => {
    setBuildStatusFilter((prev) =>
      prev.includes(value)
        ? prev.filter((filter) => filter !== value)
        : [...prev, value],
    );
  };

  useEffect(() => {
    const fetchAndSetPullRequests = async () => {
      try {
        const data = await getAssignedPullRequests();
        if ("error" in data) {
          setError(data.error as string);

          setPullRequests([]);
        } else {
          setPullRequests(
            data.map((pr) => ({
              ...pr,
              repository: {
                id: parseInt(pr.repoId, 10),
                name: pr.repo,
                full_name: `${pr.owner}/${pr.repo}`,
                owner: {
                  login: pr.owner,
                },
              },
            })),
          );

          setError(null);
        }
        setLoading(false);
      } catch (error) {
        console.error("Error fetching pull requests:", error);

        setLoading(false);

        setError(
          "Failed to fetch pull requests. Please reconnect your GitHub account.",
        );

        setPullRequests([]);
      }
    };

    fetchAndSetPullRequests();
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-full">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full">
        <AlertCircle className="h-12 w-12 text-red-500 mb-4" />
        <p className="text-lg mb-4">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 h-full flex flex-col">
      {/* Filter UI */}
      <div className="p-6">
        <PullRequestFilter
          uniqueRepositories={uniqueRepositories}
          selectedRepoFilters={selectedRepoFilters}
          buildStatusFilter={buildStatusFilter}
          onRepoFilterChange={handleRepoFilterChange}
          onBuildStatusFilterChange={handleBuildStatusFilterChange}
        />
      </div>

      {/* Pull Requests List */}
      <div className="p-6 flex-grow">
        {filteredPullRequests.length > 0 ? (
          <ul className="space-y-8 w-full">
            {filteredPullRequests.map((pr) => (
              <li key={pr.id}>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold text-lg">
                    {pr.repository.full_name}
                  </h3>
                </div>
                <PullRequestItem pullRequest={pr} />
              </li>
            ))}
          </ul>
        ) : (
          <div className="w-full border-2 border-dashed border-gray-300 rounded-lg p-6">
            <div className="flex flex-col items-center justify-center text-center">
              <GitPullRequest className="h-16 w-16 text-gray-400 mb-4" />
              <h3 className="text-xl font-semibold mb-2">
                No pull requests found
              </h3>
              <p className="text-gray-600 mb-4">
                {selectedRepoFilters.length > 0 || buildStatusFilter.length > 0
                  ? "No pull requests match the selected filters."
                  : "We couldn't find any pull requests assigned to you."}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
