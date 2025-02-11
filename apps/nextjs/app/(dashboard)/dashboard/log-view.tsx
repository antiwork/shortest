"use client";

import { Loader2, ChevronRight, ChevronDown } from "lucide-react";
import { useRef, useState } from "react";
import { LogGroup } from "./types";

interface LogViewProps {
  parsedLogs: LogGroup[] | undefined;
  error: Error | undefined;
  isLoading: boolean;
}

export function LogView({ parsedLogs, error, isLoading }: LogViewProps) {
  const logContainerRef = useRef<HTMLDivElement>(null);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>(
    {},
  );

  const toggleGroup = (groupId: string) => {
    setExpandedGroups((prev) => ({
      ...prev,
      [groupId]: !prev[groupId],
    }));
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-6 h-6 animate-spin mr-2" />
        <span>Loading logs...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-red-500">Error loading logs: {error.message}</div>
    );
  }

  if (parsedLogs?.length === 0) {
    return <div>No logs available</div>;
  }

  return (
    <div className="bg-gray-900 text-gray-100 rounded-lg overflow-hidden">
      <div className="flex items-center justify-between p-2 bg-gray-800">
        <h3 className="text-sm font-semibold">Logs</h3>
      </div>
      <div
        ref={logContainerRef}
        className="h-96 overflow-y-auto p-4 font-mono text-sm"
      >
        {parsedLogs?.map((group) => (
          <div key={group.id} className="mb-4">
            <button
              onClick={() => toggleGroup(group.id)}
              className="flex items-center text-left w-full py-2 px-4 bg-gray-800 hover:bg-gray-700 rounded"
            >
              {expandedGroups[group.id] ? (
                <ChevronDown className="w-4 h-4 mr-2" />
              ) : (
                <ChevronRight className="w-4 h-4 mr-2" />
              )}
              <span className="font-semibold">{group.name}</span>
            </button>
            {expandedGroups[group.id] && (
              <pre className="whitespace-pre-wrap mt-2 pl-6 border-l-2 border-gray-700">
                {group.logs.join("\n")}
              </pre>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
