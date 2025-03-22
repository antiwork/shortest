/**
 * Base analyzer interface that all framework-specific analyzers must implement
 */
export interface BaseAnalyzer {
  execute(): Promise<AppAnalysis>;
  finalizeAnalysis(): Promise<void>;
}

/**
 * Minimal data describing a single file's analysis.
 */
export interface FileAnalysisResult {
  framework?: "next" | "react" | "remix" | "other";
  path: string;
  details: Record<string, any>;
}

/**
 * The final shape we store to analysis.json
 */
export interface AppAnalysis {
  framework: string;
  filesScanned: number;
  summary: string;
  routes?: string[];
  apiRoutes?: string[];
  results: FileAnalysisResult[];
  testPlanningContext?: TestPlanningContext;
}

// File information with content and parsed AST
export interface FileInfo {
  path: string;
  relativePath: string;
  content: string;
  ast?: any; // Will be populated with Babel AST
  isDirectory: boolean;
  size: number;
  lastModified: Date;
}

// Directory node in the app structure tree
export interface DirectoryNode {
  path: string;
  relativePath: string;
  name: string;
  type: "directory";
  children: (DirectoryNode | FileNode)[];
  isDirectory: true;
  size?: number;
  lastModified?: Date;
}

// File node in the app structure tree
export interface FileNode {
  path: string;
  relativePath: string;
  name: string;
  type: "file";
  extension: string;
  isDirectory: false;
  size: number;
  lastModified: Date;
  content?: string;
  ast?: any;
}

export interface TreeNode {
  path: string;
  name: string;
  type: "directory" | "file";
  children?: TreeNode[];
  extension?: string;
}

export interface AppTreeStructure {
  root: DirectoryNode;
  allFiles: Map<string, FileNode>;
  filesByType: Map<string, FileNode[]>;
  filesByDirectory: Map<string, FileNode[]>;
}

export interface TestPlanningContext {
  routerType: "app" | "pages" | "unknown";
  mainPages: {
    route: string;
    hasAuth: boolean;
    hasParams: boolean;
    hasSearchParams: boolean;
    hasFormSubmission: boolean;
    components: string[];
    dataFetching: string[];
  }[];
  apiEndpoints: {
    route: string;
    methods: string[];
    hasValidation: boolean;
  }[];
  coreComponents: {
    name: string;
    props: string[];
    hasEventHandlers: boolean;
  }[];
  userFlows: any[];
  suggestedTestFlows: any[];
}
