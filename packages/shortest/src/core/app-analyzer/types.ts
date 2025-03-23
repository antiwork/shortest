/**
 * Base analyzer interface that all framework-specific analyzers must implement
 */
export interface BaseAnalyzer {
  execute(): Promise<AppAnalysis>;
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
  routerType: "app" | "pages" | "unknown";
  stats: {
    filesScanned: number;
    routes: number;
    apiRoutes: number;
    components: number;
  };
  routes: RouteInfo[];
  apiRoutes: ApiRouteInfo[];
  components: ComponentInfo[];
  layouts: LayoutInfo[];
}

export interface RouteInfo {
  path: string;
  file: string;
  layoutChain: string[];
  components: string[];
  hasParams: boolean;
  hasSearch: boolean;
  hasForm: boolean;
  auth: boolean;
  dataFetching: string[];
  hooks: string[];
  eventHandlers: string[];
  featureFlags: string[];
}

export interface ApiRouteInfo {
  path: string;
  file: string;
  methods: string[];
  hasValidation: boolean;
  deps: string[];
}

export interface ComponentInfo {
  name: string;
  file: string;
  props: string[];
  hasHandlers: boolean;
}

export interface LayoutInfo {
  name: string;
  file: string;
  children?: string[];
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
