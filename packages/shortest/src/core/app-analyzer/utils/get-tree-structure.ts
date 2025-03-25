import path from "path";
import { globby } from "globby";
import { z } from "zod";
import { getLogger } from "@/log";

const FileNodeSchema = z.object({
  path: z.string(),
  name: z.string(),
  type: z.literal("file"),
  extension: z.string(),
});

const DirectoryNodeSchema: z.ZodType<any> = z.object({
  path: z.string(),
  name: z.string(),
  type: z.literal("directory"),
  children: z.lazy(() => z.array(TreeNodeSchema)),
});

const TreeNodeSchema = z.union([DirectoryNodeSchema, FileNodeSchema]);

type TreeNode = z.infer<typeof TreeNodeSchema>;

export const getPaths = async (sourceDir: string) => {
  const paths = await globby(["**/*"], {
    cwd: sourceDir,
    gitignore: true,
    ignore: [
      "**/*.test.ts",
      "**/*.test.tsx",
      "**/*.test.js",
      "**/*.test.jsx",
      "**/*.spec.ts",
      "**/*.spec.tsx",
      "**/*.spec.js",
      "**/*.spec.jsx",
      "packages/**",
      "test/**",
      "tests/**",
    ],
  });
  paths.sort();

  return paths;
};

export const getTreeStructure = async (
  sourceDir: string,
): Promise<TreeNode> => {
  const log = getLogger();
  log.trace("Building application structure tree...");
  const paths = await getPaths(sourceDir);

  const rootNode: TreeNode = {
    path: "",
    name: path.basename(sourceDir),
    type: "directory",
    children: [],
  };

  const dirMap = new Map<string, TreeNode>();
  dirMap.set("", rootNode);

  /**
   * Helper function to ensure a directory path exists in the tree
   * and returns the node for that directory
   */
  const ensureDirectoryPath = (dirPath: string): TreeNode => {
    // If we already have this directory in our map, return it
    if (dirMap.has(dirPath)) {
      return dirMap.get(dirPath)!;
    }

    const parentPath = path.dirname(dirPath);
    const parentNode =
      parentPath === "." ? rootNode : ensureDirectoryPath(parentPath);
    const dirName = path.basename(dirPath);

    const dirNode: TreeNode = {
      path: dirPath,
      name: dirName,
      type: "directory",
      children: [],
    };

    parentNode.children.push(dirNode);
    dirMap.set(dirPath, dirNode);

    return dirNode;
  };

  for (const filePath of paths) {
    if (!filePath) continue;

    const isDirectory = !path.extname(filePath);

    if (isDirectory) {
      ensureDirectoryPath(filePath);
    } else {
      const dirPath = path.dirname(filePath);
      const parentNode =
        dirPath === "." ? rootNode : ensureDirectoryPath(dirPath);
      const fileName = path.basename(filePath);

      const fileNode: TreeNode = {
        path: filePath,
        name: fileName,
        type: "file",
        extension: path.extname(filePath),
      };

      parentNode.children.push(fileNode);
    }
  }

  return rootNode;
};
