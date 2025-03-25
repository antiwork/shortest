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
    filesScanned: number;
    routes: number;
    apiRoutes: number;
    components: number;
  };
  routes: RouteInfo[];
  apiRoutes: ApiRouteInfo[];
  components: ComponentInfo[];
  layouts: LayoutInfo[];
  allPaths: string[];
}

export interface RouteInfo {
  routePath: string;
  relativeFilePath: string;
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
  routePath: string;
  relativeFilePath: string;
  methods: string[];
  hasValidation: boolean;
  deps: string[];
}

export interface ComponentInfo {
  name: string;
  relativeFilePath: string;
  props: string[];
  hasHandlers: boolean;
}

export interface LayoutInfo {
  relativeFilePath: string;
  relativeDirPath: string;
  name: string;
  content: string;
  components: string[];
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
