/**
 * Base analyzer interface that all framework-specific analyzers must implement
 */
export interface BaseAnalyzer {
  execute(): Promise<AppAnalysis>;
}

export interface FileAnalysisResult {
  framework?: "next" | "react" | "remix" | "other";
  path: string;
  details: Record<string, any>;
}

export interface AppAnalysis {
  framework: string;
  routerType: "app" | "pages" | "unknown";
  stats: {
    fileCount: number;
    routeCount: number;
    apiRouteCount: number;
    layoutCount: number;
  };
  layouts: LayoutInfo[];
  routes: RouteInfo[];
  apiRoutes: ApiRouteInfo[];
  allPaths: string[];
}

export interface RouteInfo {
  routePath: string;
  relativeFilePath: string;
  layoutChain: string[];
  components: string[];
  hasParams: boolean;
  hasForm: boolean;
  hooks: string[];
  eventHandlers: string[];
  featureFlags: string[];
}

export interface ApiRouteInfo {
  routePath: string;
  relativeFilePath: string;
  methods: string[];
  hasValidation: boolean;
  deps: string[];
}

export interface LayoutInfo {
  relativeFilePath: string;
  relativeDirPath: string;
  name: string;
  content: string;
  components: string[];
}
