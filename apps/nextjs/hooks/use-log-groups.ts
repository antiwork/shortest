import { useMemo } from "react";
import { LogGroup } from "../app/(dashboard)/dashboard/types";

export function useLogGroups(logs: string | undefined) {
  const parsedLogs = useMemo(() => {
    if (!logs) return [];

    const groups: LogGroup[] = [];
    let currentGroup: LogGroup | null = null;
    const lines = logs.split("\n");

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].replace(
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d+Z\s*/,
        "",
      );
      if (line.startsWith("File:")) {
        if (currentGroup) {
          groups.push(currentGroup);
        }
        currentGroup = {
          id: `group-${groups.length}`,
          name: line.trim(),
          logs: [],
        };
      } else if (currentGroup) {
        currentGroup.logs.push(line);
      } else {
        if (!groups.length || groups[groups.length - 1].name !== "Other") {
          groups.push({
            id: `group-${groups.length}`,
            name: "Other",
            logs: [],
          });
        }
        groups[groups.length - 1].logs.push(line);
      }
    }

    if (currentGroup) {
      groups.push(currentGroup);
    }

    // Add line numbers and trim group names
    return groups.map((group) => ({
      ...group,
      name: group.name
        .replace(/^File:\s*/, "")
        .replace(/^.*?_/, "")
        .replace(/\.txt$/, "")
        .split("/")[0],
      logs: group.logs.map(
        (log, index) => `${(index + 1).toString().padStart(4, " ")} | ${log}`,
      ),
    }));
  }, [logs]);

  return parsedLogs;
}
