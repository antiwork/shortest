import fs from "fs/promises";
import path from "path";
import { globby } from "globby";
import { z } from "zod";
import { getGitInfo } from "./get-git-info";
import { DOT_SHORTEST_DIR_PATH } from "@/cache";
import { getLogger } from "@/log";

const TREE_VERSION = 1;

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

export const getTreeStructure = async (
  framework: string,
  rootDir: string,
): Promise<TreeNode> => {
  const treeStructure = await buildTreeStructure(rootDir);

  const frameworkDir = path.join(DOT_SHORTEST_DIR_PATH, framework);
  await fs.mkdir(frameworkDir, { recursive: true });
  const treeJsonPath = path.join(frameworkDir, "tree.json");

  const treeOutput = {
    metadata: {
      timestamp: Date.now(),
      version: TREE_VERSION,
      git: await getGitInfo(),
    },
    data: treeStructure,
  };

  await fs.writeFile(treeJsonPath, JSON.stringify(treeOutput, null, 2));

  return treeStructure;
};

const buildTreeStructure = async (rootDir: string): Promise<TreeNode> => {
  const log = getLogger();
  log.trace("Building application structure tree...");

  const paths = await globby(["**/*"], {
    cwd: rootDir,
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
    ],
  });
  paths.sort();

  const rootNode: TreeNode = {
    path: "",
    name: path.basename(rootDir),
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
