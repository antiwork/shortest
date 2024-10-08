"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  GitPullRequestDraft,
  GitPullRequest,
  CheckCircle,
  XCircle,
  Edit,
  PlusCircle,
  Loader2,
  AlertCircle,
} from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Checkbox } from "@/components/ui/checkbox";
import dynamic from "next/dynamic";
import { PullRequest, TestFile } from "./types";
import { generateTestsResponseSchema } from "@/app/api/generate-tests/schema";
import { useToast } from "@/hooks/use-toast";
import { commitChangesToPullRequest, getPullRequestInfo, getFailingTests } from "@/lib/github";

const ReactDiffViewer = dynamic(() => import("react-diff-viewer"), {
  ssr: false,
});

interface PullRequestItemProps {
  pullRequest: PullRequest;
}

export function PullRequestItem({ pullRequest }: PullRequestItemProps) {
  const [testFiles, setTestFiles] = useState<TestFile[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<Record<string, boolean>>({});
  const [expandedFiles, setExpandedFiles] = useState<Record<string, boolean>>({});
  const [analyzing, setAnalyzing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const savedTestFiles = localStorage.getItem(`testFiles_${pullRequest.id}`);
    const savedSelectedFiles = searchParams.get(`selectedFiles_${pullRequest.id}`);
    const savedExpandedFiles = searchParams.get(`expandedFiles_${pullRequest.id}`);

    if (savedTestFiles) {
      setTestFiles(JSON.parse(savedTestFiles));
    }
    if (savedSelectedFiles) {
      setSelectedFiles(JSON.parse(decodeURIComponent(savedSelectedFiles)));
    }
    if (savedExpandedFiles) {
      setExpandedFiles(JSON.parse(decodeURIComponent(savedExpandedFiles)));
    }
  }, [searchParams, pullRequest.id]);

  const updateState = (
    newTestFiles: TestFile[],
    newSelectedFiles: Record<string, boolean>,
    newExpandedFiles: Record<string, boolean>
  ) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set(`selectedFiles_${pullRequest.id}`, encodeURIComponent(JSON.stringify(newSelectedFiles)));
    params.set(`expandedFiles_${pullRequest.id}`, encodeURIComponent(JSON.stringify(newExpandedFiles)));
    router.push(`?${params.toString()}`, { scroll: false });

    localStorage.setItem(`testFiles_${pullRequest.id}`, JSON.stringify(newTestFiles));

    setTestFiles(newTestFiles);
    setSelectedFiles(newSelectedFiles);
    setExpandedFiles(newExpandedFiles);
  };

  const handleTests = async (pr: PullRequest, mode: "write" | "update") => {
    setAnalyzing(true);
    setLoading(true);
    setError(null);

    try {
      const { diff, testFiles: oldTestFiles } = await getPullRequestInfo(
        pr.repository.owner.login,
        pr.repository.name,
        pr.number
      );

      let testFilesToUpdate = oldTestFiles;

      if (mode === "update") {
        const failingTests = await getFailingTests(
          pr.repository.owner.login,
          pr.repository.name,
          pr.number
        );
        testFilesToUpdate = oldTestFiles.filter(file => 
          failingTests.some(failingFile => failingFile.name === file.name)
        );
      }

      const response = await fetch("/api/generate-tests", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          mode,
          pr_id: pr.id,
          pr_diff: diff,
          test_files: testFilesToUpdate,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to generate test files");
      }

      const data = await response.json();
      const parsedData = generateTestsResponseSchema.parse(data);
      handleTestFilesUpdate(oldTestFiles, parsedData);
    } catch (error) {
      console.error("Error generating test files:", error);
      setError("Failed to generate test files.");
    } finally {
      setAnalyzing(false);
      setLoading(false);
    }
  };

  const handleTestFilesUpdate = (
    oldTestFiles: TestFile[],
    newTestFiles: TestFile[]
  ) => {
    if (newTestFiles.length > 0) {
      const filteredTestFiles = newTestFiles
        .filter((file): file is TestFile => file !== undefined)
        .map((file) => {
          const oldFile = oldTestFiles.find(
            (oldFile) => oldFile.name === file.name
          );
          return {
            ...file,
            oldContent: oldFile ? oldFile.content : "",
          };
        });
      const newSelectedFiles: Record<string, boolean> = {};
      const newExpandedFiles: Record<string, boolean> = {};
      filteredTestFiles.forEach((file) => {
        const fileName = file?.name ?? `file_${Math.random()}`;
        newExpandedFiles[fileName] = true;
        newSelectedFiles[fileName] = true;
      });
      updateState(filteredTestFiles, newSelectedFiles, newExpandedFiles);
    }
  };

  const commitChanges = async () => {
    setLoading(true);
    setError(null);
    try {
      const filesToCommit = testFiles
        .filter((file) => selectedFiles[file.name])
        .map((file) => ({
          name: file.name,
          content: file.content,
        }));

      const newCommitUrl = await commitChangesToPullRequest(
        pullRequest.repository.owner.login,
        pullRequest.repository.name,
        pullRequest.number,
        filesToCommit
      );

      toast({
        title: "Changes committed successfully",
        description: (
          <>
            The test files have been added to the pull request.{" "}
            <Link href={newCommitUrl} className="underline">
              View commit
            </Link>
          </>
        ),
      });

      updateState([], {}, {});
    } catch (error) {
      console.error("Error committing changes:", error);
      setError("Failed to commit changes. Please try again.");
      toast({
        title: "Error",
        description: "Failed to commit changes. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCancelChanges = () => {
    updateState([], {}, {});
    setError(null);
  };

  const handleFileToggle = (fileName: string) => {
    const newSelectedFiles = {
      ...selectedFiles,
      [fileName]: !selectedFiles[fileName],
    };
    const newExpandedFiles = {
      ...expandedFiles,
      [fileName]: !expandedFiles[fileName],
    };
    updateState(testFiles, newSelectedFiles, newExpandedFiles);
  };

  return (
    <div className="bg-white p-4 rounded-lg shadow-md">
      <div className="flex items-center justify-between mb-2">
        <span className="flex items-center">
          {pullRequest.isDraft ? (
            <GitPullRequestDraft className="mr-2 h-4 w-4 text-gray-400" />
          ) : (
            <GitPullRequest className="mr-2 h-4 w-4" />
          )}
          <span className="font-medium">{pullRequest.title}</span>
        </span>
        <Link
          href={`https://github.com/${pullRequest.repository.full_name}/pull/${pullRequest.number}`}
          className="text-sm text-gray-600 underline"
        >
          #{pullRequest.number}
        </Link>
      </div>
      <div className="flex items-center justify-between">
        <span className="flex items-center">
          {pullRequest.buildStatus === "success" ? (
            <CheckCircle className="mr-2 h-4 w-4 text-green-500" />
          ) : pullRequest.buildStatus === "pending" ? (
            <AlertCircle className="mr-2 h-4 w-4 text-yellow-500" />
          ) : (
            <XCircle className="mr-2 h-4 w-4 text-red-500" />
          )}
          <Link
            href={`https://github.com/${pullRequest.repository.full_name}/pull/${pullRequest.number}/checks`}
            className="text-sm underline text-gray-600"
          >
            Build: {pullRequest.buildStatus}
          </Link>
        </span>
        {testFiles.length > 0 ? (
          <Button
            size="sm"
            className="bg-white hover:bg-gray-100 text-black border border-gray-200"
            onClick={handleCancelChanges}
            disabled={loading}
          >
            Cancel
          </Button>
        ) : pullRequest.buildStatus === "success" ? (
          <Button
            size="sm"
            className="bg-green-500 hover:bg-green-600 text-white"
            onClick={() => handleTests(pullRequest, "write")}
            disabled={loading}
          >
            {loading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <PlusCircle className="mr-2 h-4 w-4" />
            )}
            {loading ? "Loading..." : "Write new tests"}
          </Button>
        ) : (
          <Button
            size="sm"
            className="bg-yellow-500 hover:bg-yellow-600 text-white"
            onClick={() => handleTests(pullRequest, "update")}
            disabled={loading}
          >
            {loading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Edit className="mr-2 h-4 w-4" />
            )}
            {loading ? "Loading..." : "Update tests to fix"}
          </Button>
        )}
      </div>
      {error && (
        <div className="mt-4 p-2 bg-red-100 border border-red-400 text-red-700 rounded">
          {error}
        </div>
      )}
      {(loading || analyzing || testFiles.length > 0) && (
        <div className="mt-4">
          <h4 className="font-semibold mb-2">Test files</h4>
          {analyzing ? (
            <div className="flex items-center justify-center h-20">
              <Loader2 className="h-6 w-6 animate-spin" />
              <span className="ml-2">Analyzing PR diff...</span>
            </div>
          ) : (
            <div className="space-y-4">
              {testFiles.map((file) => (
                <div key={file.name} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <Checkbox
                        id={file.name}
                        checked={selectedFiles[file.name]}
                        onCheckedChange={() => handleFileToggle(file.name)}
                      />
                      <label
                        htmlFor={file.name}
                        className="ml-2 font-medium cursor-pointer"
                      >
                        {file.name}
                      </label>
                    </div>
                  </div>
                  {expandedFiles[file.name] && (
                    <div className="mt-2">
                      <div className="bg-gray-100 p-4 rounded-lg overflow-x-auto">
                        <ReactDiffViewer
                          oldValue={file.oldContent || ""}
                          newValue={file.content || ""}
                          splitView={true}
                        />
                      </div>
                    </div>
                  )}
                </div>
              ))}
              <Button
                className="w-full mt-4 bg-blue-500 hover:bg-blue-600 text-white"
                onClick={commitChanges}
                disabled={
                  Object.values(selectedFiles).every((value) => !value) ||
                  loading
                }
              >
                {loading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle className="mr-2 h-4 w-4" />
                )}
                {loading ? "Committing changes..." : "Commit changes"}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
