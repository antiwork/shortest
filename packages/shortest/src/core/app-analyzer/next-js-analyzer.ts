import fs from "fs/promises";
import { createRequire } from "module";
import path from "path";
import * as parser from "@babel/parser";
import * as t from "@babel/types";
import {
  FileAnalysisResult,
  BaseAnalyzer,
  AppAnalysis,
  LayoutInfo,
} from "./types";
import { DOT_SHORTEST_DIR_PATH } from "@/cache";
import { getGitInfo } from "@/core/app-analyzer/utils/get-git-info";
import {
  getPaths,
  getTreeStructure,
} from "@/core/app-analyzer/utils/get-tree-structure";
import { getLogger } from "@/log";
import { assertDefined } from "@/utils/assert";
import { getErrorDetails, ShortestError } from "@/utils/errors";

const require = createRequire(import.meta.url);
const traverse = require("@babel/traverse").default;

interface ComponentInfo {
  name: string;
  props: string[];
  imports: string[];
  hooks: string[];
  eventHandlers: string[];
  relativeFilePath: string;
}

interface PageInfo {
  routePath: string;
  relativeFilePath: string;
  components: string[];
  dataFetching: {
    method:
      | "getServerSideProps"
      | "getStaticProps"
      | "getStaticPaths"
      | "useQuery"
      | "fetch"
      | "axios"
      | "other"
      | null;
    dependencies?: string[];
  }[];
  hasParams: boolean;
  hasFormSubmission: boolean;
}

interface ApiInfo {
  routePath: string;
  relativeFilePath: string;
  methods: ("GET" | "POST" | "PUT" | "DELETE" | "PATCH")[];
  inputValidation: boolean;
  dependencies: string[];
}

interface FileInfo {
  relativeFilePath: string;
  relativeDirPath: string;
  absoluteFilePath: string;
  name: string;
  extension: string;
  content: null | string;
  ast: null | parser.ParseResult<t.File>;
}

export class NextJsAnalyzer implements BaseAnalyzer {
  private layouts: Record<string, LayoutInfo> = {};
  private routes: string[] = [];
  private apiRoutes: string[] = [];
  private results: FileAnalysisResult[] = [];
  private components: Record<string, ComponentInfo> = {};
  private pages: PageInfo[] = [];
  private paths: string[] = [];
  private apis: ApiInfo[] = [];
  private isAppRouter = false;
  private isPagesRouter = false;
  private fileInfos: FileInfo[] = [];
  private log = getLogger();

  private readonly NEXT_FRAMEWORK_NAME = "next";
  private readonly VERSION = 1;
  private readonly frameworkDir: string;

  constructor(private rootDir: string) {
    this.frameworkDir = path.join(
      DOT_SHORTEST_DIR_PATH,
      this.NEXT_FRAMEWORK_NAME,
    );
  }

  /**
   * Main method to execute the analysis
   */
  async execute(): Promise<AppAnalysis> {
    this.log.trace("Executing NextJs analyzer");

    this.layouts = {};
    this.routes = [];
    this.apiRoutes = [];
    this.results = [];
    this.components = {};
    this.pages = [];
    this.paths = [];
    this.apis = [];
    this.isAppRouter = false;
    this.isPagesRouter = false;

    await this.setPaths();
    await this.setTreeStructure();
    this.log.debug(`Processing ${this.fileInfos.length} files`);

    this.detectRouterType();

    await this.parseFiles();
    await this.processLayoutFiles();
    await this.processRouteFiles();
    await this.processComponentFiles();

    this.log.debug(
      `Analysis generated: ${this.pages.length} pages, ${this.apis.length} API routes, ${Object.keys(this.components).length} components`,
    );

    const analysis: AppAnalysis = this.generateAnalysis();

    // Save analysis.json
    await this.saveAnalysisToFile(analysis);

    return analysis;
  }

  private async setPaths(): Promise<void> {
    this.log.trace("Retrieving folder paths for NextJs analyzer");
    this.paths = await getPaths(this.rootDir);

    await fs.mkdir(this.frameworkDir, { recursive: true });
    const pathsOutput = {
      metadata: {
        timestamp: Date.now(),
        version: this.VERSION,
        git: await getGitInfo(),
      },
      data: this.paths,
    };

    await fs.writeFile(
      path.join(this.frameworkDir, "paths.json"),
      JSON.stringify(pathsOutput, null, 2),
    );

    this.log.trace("Paths saved", {
      path: path.join(this.frameworkDir, "paths.json"),
    });
  }

  /**
   * Set the tree structure for analysis
   */
  private async setTreeStructure(): Promise<void> {
    this.log.setGroup("🌳");
    this.log.trace("Building tree structure for NextJs analyzer");
    try {
      const treeNode = await getTreeStructure(this.rootDir);

      this.setFileInfos(treeNode);
      console.log(this.fileInfos);

      await fs.mkdir(this.frameworkDir, { recursive: true });
      const treeJsonPath = path.join(this.frameworkDir, "tree.json");

      const treeOutput = {
        metadata: {
          timestamp: Date.now(),
          version: this.VERSION,
          git: await getGitInfo(),
        },
        data: treeNode,
      };

      await fs.writeFile(treeJsonPath, JSON.stringify(treeOutput, null, 2));
      this.log.trace("Tree structure saved", { path: treeJsonPath });
    } catch (error) {
      this.log.error("Failed to build tree structure", getErrorDetails(error));
      throw error;
    } finally {
      this.log.resetGroup();
    }
  }

  private setFileInfos(node: any): void {
    if (node.type === "directory" && node.children) {
      for (const child of node.children) {
        this.setFileInfos(child);
      }
    } else if (node.type === "file") {
      this.fileInfos.push({
        relativeFilePath: node.path,
        relativeDirPath: path.dirname(node.path),
        absoluteFilePath: path.resolve(this.rootDir, node.path),
        name: node.name,
        extension: node.extension,
        content: null,
        ast: null,
      });
    }
  }

  /**
   * Generate the new analysis format
   */
  private generateAnalysis(): AppAnalysis {
    // Convert pages to route info
    const routeInfoList = this.pages.map((page) => {
      const dataFetchingMethods = page.dataFetching.map(
        (df) => df.method || "unknown",
      );

      return {
        routePath: page.routePath,
        relativeFilePath: page.relativeFilePath,
        layoutChain: this.getLayoutChainForPage(page.relativeFilePath),
        components: page.components,
        hasParams: page.hasParams,
        hasForm: page.hasFormSubmission,
        dataFetching: dataFetchingMethods.filter(Boolean) as string[],
        hooks: this.getHooksForFile(page.relativeFilePath),
        eventHandlers: this.getEventHandlersForFile(page.relativeFilePath),
        featureFlags: [],
      };
    });

    // Convert API routes
    const apiRouteInfoList = this.apis.map((api) => ({
      routePath: api.routePath,
      relativeFilePath: api.relativeFilePath,
      methods: api.methods as string[],
      hasValidation: api.inputValidation,
      deps: api.dependencies,
    }));

    // Convert components
    const componentInfoList = Object.entries(this.components).map(
      ([name, comp]) => ({
        name: name,
        relativeFilePath: comp.relativeFilePath,
        props: comp.props,
        hasHandlers: comp.eventHandlers.length > 0,
      }),
    );

    // Convert layouts
    const layoutInfoList = Object.values(this.layouts);

    return {
      framework: this.NEXT_FRAMEWORK_NAME,
      routerType: this.isAppRouter
        ? "app"
        : this.isPagesRouter
          ? "pages"
          : "unknown",
      stats: {
        filesScanned: this.fileInfos.length,
        routes: this.pages.length,
        apiRoutes: this.apis.length,
        components: Object.keys(this.components).length,
      },
      routes: routeInfoList,
      apiRoutes: apiRouteInfoList,
      components: componentInfoList,
      layouts: layoutInfoList,
      allPaths: this.paths,
    };
  }

  /**
   * Get the layout chain for a page
   */
  private getLayoutChainForPage(filepath: string): string[] {
    const fileDirPath = path.dirname(filepath);

    return Object.entries(this.layouts)
      .map(([name, layout]) => ({
        name,
        relativeDirPath: layout.relativeDirPath,
        distance: this.getDirectoryDistance(
          fileDirPath,
          layout.relativeDirPath,
        ),
      }))
      .filter((layout) => layout.distance >= 0)
      .sort((a, b) => a.distance - b.distance)
      .map((layout) => layout.name);
  }

  private getDirectoryDistance(from: string, to: string): number {
    // If 'to' is not a parent directory of 'from', return -1
    if (!from.startsWith(to)) {
      return -1;
    }

    // Count directory levels between 'from' and 'to'
    const fromParts = from.split("/");
    const toParts = to.split("/");
    return fromParts.length - toParts.length;
  }

  /**
   * Get hooks used in a file
   */
  private getHooksForFile(filepath: string): string[] {
    const result = this.results.find((r) => r.path === filepath);
    return result?.details?.hooks || [];
  }

  /**
   * Get event handlers in a file
   */
  private getEventHandlersForFile(filepath: string): string[] {
    const result = this.results.find((r) => r.path === filepath);
    return result?.details?.eventHandlers || [];
  }

  /**
   * Generate a summary of the analysis
   */
  private generateSummary(): string {
    return (
      `Next.js application using ${this.isAppRouter ? "App Router" : this.isPagesRouter ? "Pages Router" : "unknown router type"}. ` +
      `Found ${this.pages.length} pages, ${this.apis.length} API routes, and ${Object.keys(this.components).length} components.`
    );
  }

  /**
   * Save analysis results to file
   */
  private async saveAnalysisToFile(analysis: AppAnalysis): Promise<void> {
    try {
      await fs.mkdir(this.frameworkDir, { recursive: true });
      const analysisJsonPath = path.join(this.frameworkDir, "analysis.json");

      const output = {
        metadata: {
          timestamp: Date.now(),
          version: this.VERSION,
          git: await getGitInfo(),
        },
        data: analysis,
      };

      await fs.writeFile(analysisJsonPath, JSON.stringify(output, null, 2));
      this.log.trace(`Analysis saved to ${analysisJsonPath}`);
    } catch (error) {
      this.log.error("Failed to save analysis to file", getErrorDetails(error));
      throw error;
    }
  }

  private async parseFiles(): Promise<void> {
    const fileExtensions = [".js", ".jsx", ".ts", ".tsx"];

    this.log.trace("Parsing eligible files", {
      extensions: fileExtensions,
    });

    for (const ext of fileExtensions) {
      const files = this.fileInfos.filter((file) => file.extension === ext);
      this.log.trace(`Found ${files.length} files with extension: ${ext}`);

      for (const file of files) {
        try {
          if (!file.content) {
            try {
              this.log.trace("Reading file", { path: file.relativeFilePath });
              file.content = await fs.readFile(file.relativeFilePath, "utf-8");
            } catch (readError) {
              this.log.error(
                `Error reading file ${file.relativeFilePath}:`,
                getErrorDetails(readError),
              );
              continue;
            }
          }

          if (!file.ast && file.content) {
            try {
              const ast = parser.parse(file.content, {
                sourceType: "module",
                plugins: [
                  "jsx",
                  "typescript",
                  "classProperties",
                  "decorators-legacy",
                  "exportDefaultFrom",
                  "dynamicImport",
                  "optionalChaining",
                  "nullishCoalescingOperator",
                ],
              });

              file.ast = ast;
            } catch (parseError) {
              this.log.error(
                `Error parsing file ${file.relativeFilePath}:`,
                getErrorDetails(parseError),
              );
            }
          }
        } catch (error) {
          this.log.error(
            `Unexpected error processing file ${file.relativeFilePath}:`,
            getErrorDetails(error),
          );
        }
      }
    }

    this.log.trace("File parsing complete");
  }

  private async processLayoutFiles(): Promise<void> {
    const layoutFileInfos = this.fileInfos.filter((file) =>
      /^layout\.(jsx?|tsx)$/.test(file.name),
    );

    for (const layoutFileInfo of layoutFileInfos) {
      const ast = assertDefined(layoutFileInfo.ast);
      const content = assertDefined(layoutFileInfo.content);

      let layoutName = undefined;

      traverse(ast, {
        ExportDefaultDeclaration(path: any) {
          if (
            t.isFunctionDeclaration(path.node.declaration) &&
            path.node.declaration.id
          ) {
            layoutName = path.node.declaration.id.name;
          } else if (t.isIdentifier(path.node.declaration)) {
            layoutName = path.node.declaration.name;
          }
        },
      });

      if (!layoutName) {
        this.log.error("Could not determine layout name", {
          path: layoutFileInfo.relativeFilePath,
        });
        throw new ShortestError(
          `Could not determine layout name: ${layoutFileInfo.relativeFilePath}`,
        );
      }

      const layoutInfo: LayoutInfo = {
        name: layoutName,
        relativeFilePath: layoutFileInfo.relativeFilePath,
        relativeDirPath: layoutFileInfo.relativeDirPath,
        content: content,
        components: this.extractComponentsFromAST(ast),
      };
      this.layouts[layoutName] = layoutInfo;
    }
  }

  private detectRouterType(): void {
    this.isAppRouter = this.fileInfos.some(
      (file) => file.relativeDirPath === "app",
    );
    this.isPagesRouter = this.fileInfos.some(
      (file) => file.relativeDirPath === "pages",
    );

    if (this.isAppRouter && this.isPagesRouter) {
      this.log.debug(
        "Detected both App Router and Pages Router. Prioritizing App Router for analysis.",
      );
    } else if (this.isAppRouter) {
      this.log.debug("Detected Next.js App Router");
    } else if (this.isPagesRouter) {
      this.log.debug("Detected Next.js Pages Router");
    } else {
      this.log.debug("Could not determine Next.js router type");
    }
  }

  private async processRouteFiles(): Promise<void> {
    this.log.trace("Processing route files", {
      isAppRouter: this.isAppRouter,
      isPagesRouter: this.isPagesRouter,
    });

    const ROUTING_FILE_PATTERNS = [
      "layout\\.(js|jsx|tsx)$",
      "page\\.(js|jsx|tsx)$",
      "loading\\.(js|jsx|tsx)$",
      "not-found\\.(js|jsx|tsx)$",
      "error\\.(js|jsx|tsx)$",
      "global-error\\.(js|jsx|tsx)$",
      "route\\.(js|ts)$",
      "template\\.(js|jsx|tsx)$",
      "default\\.(js|jsx|tsx)$",
    ];

    const appRouterFiles = this.fileInfos.filter((file) =>
      ROUTING_FILE_PATTERNS.some((pattern) =>
        new RegExp(pattern).test(file.name),
      ),
    );

    if (appRouterFiles.length > 0 || this.isAppRouter) {
      this.isAppRouter = true;
      this.log.debug(`Found ${appRouterFiles.length} App Router files`);

      for (const file of appRouterFiles) {
        await this.processAppRouterFile(file);
      }
    }

    const pagesFiles = this.fileInfos.filter((file) => {
      const isPagesFile =
        file.relativeDirPath.includes("/pages/") ||
        file.relativeDirPath.startsWith("pages/");

      const isSpecialFile = file.name.startsWith("_") || file.name === "api";

      return isPagesFile && !isSpecialFile;
    });

    if (pagesFiles.length > 0 || this.isPagesRouter) {
      this.isPagesRouter = true;
      this.log.debug(`Found ${pagesFiles.length} Pages Router files`);

      for (const file of pagesFiles) {
        await this.processPagesRouterFile(file);
      }
    }

    const apiFiles = this.fileInfos.filter((file) =>
      file.relativeFilePath.includes("/api/"),
    );

    this.log.debug(`Found ${apiFiles.length} API files`);
    for (const file of apiFiles) {
      if (file.relativeFilePath.startsWith("pages/api/")) {
        await this.processPagesRouterFile(file);
      } else {
        await this.processAppRouterFile(file);
      }
    }

    this.log.debug(
      `Processed ${this.routes.length} routes and ${this.apiRoutes.length} API routes`,
    );
  }

  /**
   * Process App Router route file
   */
  private async processAppRouterFile(file: FileInfo): Promise<void> {
    if (!file.content || !file.ast) return;

    const fileDetail: FileAnalysisResult = {
      framework: "next",
      path: file.relativeFilePath,
      details: {
        isRoute: false,
        isApiRoute: false,
        isLayout: false,
        components: [],
        imports: [],
        exports: [],
        hooks: [],
        eventHandlers: [],
      },
    };

    if (file.ast) {
      fileDetail.details.imports = this.extractImportsFromAST(file.ast);
      fileDetail.details.exports = this.extractExportsFromAST(file.ast);
      fileDetail.details.hooks = this.extractHooksFromAST(file.ast);
      fileDetail.details.eventHandlers = this.extractEventHandlersFromAST(
        file.ast,
      );
      fileDetail.details.components = this.extractComponentsFromAST(file.ast);
    }

    if (file.name === "page.js" || file.name === "page.tsx") {
      fileDetail.details.isRoute = true;
      const routePath = this.getRoutePathFromFileApp(file.relativeFilePath);
      this.routes.push(routePath);

      const pageInfo: PageInfo = {
        routePath: routePath,
        relativeFilePath: file.relativeFilePath,
        components: fileDetail.details.components || [],
        dataFetching: this.extractDataFetchingFromAST(file.ast),
        hasParams: this.hasRouteParams(routePath),
        hasFormSubmission:
          this.hasFormSubmissionInAST(file.ast) ||
          file.content.includes("onSubmit"),
      };

      this.pages.push(pageInfo);
      fileDetail.details.pageInfo = pageInfo;
    } else if (file.name === "layout.js" || file.name === "layout.tsx") {
      fileDetail.details.isLayout = true;

      // Extract layout name and add to layouts
      let layoutName: string | undefined;

      // Try to extract layout name from default export
      if (file.ast) {
        const exports = this.extractExportsFromAST(file.ast);
        const defaultExport = exports.find((e) => e.includes("default"));
        if (defaultExport) {
          layoutName = defaultExport.replace(" (default)", "");
        }
      }

      // Fallback to creating name from path
      if (!layoutName) {
        const parts = file.relativeFilePath.split("/");
        const dirName = parts[parts.length - 2] || "";
        layoutName =
          dirName.charAt(0).toUpperCase() + dirName.slice(1) + "Layout";
      }

      // Special case for root layout
      if (
        file.relativeFilePath === "app/layout.tsx" ||
        file.relativeFilePath === "app/layout.js"
      ) {
        layoutName = "RootLayout";
      }
    } else if (
      file.name === "route.js" ||
      file.name === "route.tsx" ||
      file.relativeFilePath.includes("/api/")
    ) {
      fileDetail.details.isApiRoute = true;
      const routePath = this.getRoutePathFromFileApp(file.relativeFilePath);
      this.apiRoutes.push(routePath);

      const apiInfo: ApiInfo = {
        routePath: routePath,
        relativeFilePath: file.relativeFilePath,
        methods: this.extractApiMethodsFromAST(file.ast),
        inputValidation: this.hasInputValidationInAST(file.ast),
        dependencies: fileDetail.details.imports || [],
      };

      this.apis.push(apiInfo);
      fileDetail.details.apiInfo = apiInfo;
    }

    this.results.push(fileDetail);
  }

  /**
   * Process Pages Router route file
   */
  private async processPagesRouterFile(file: FileInfo): Promise<void> {
    if (!file.content || !file.ast) return;

    const fileDetail: FileAnalysisResult = {
      framework: "next",
      path: file.relativeFilePath,
      details: {
        isRoute: false,
        isApiRoute: false,
        components: [],
        imports: [],
        exports: [],
        hooks: [],
        eventHandlers: [],
      },
    };

    fileDetail.details.imports = this.extractImportsFromAST(file.ast);
    fileDetail.details.exports = this.extractExportsFromAST(file.ast);
    fileDetail.details.hooks = this.extractHooksFromAST(file.ast);
    fileDetail.details.eventHandlers = this.extractEventHandlersFromAST(
      file.ast,
    );
    fileDetail.details.components = this.extractComponentsFromAST(file.ast);

    // Check for _app.js/_app.tsx which could be considered a layout
    if (file.name === "_app.js" || file.name === "_app.tsx") {
      this.layouts["PagesAppLayout"] = {
        name: "PagesAppLayout",
        relativeFilePath: file.relativeFilePath,
        relativeDirPath: file.relativeDirPath,
        content: file.content || "",
        components: this.extractComponentsFromAST(
          file.ast || parser.parse("", { sourceType: "module" }),
        ),
      };
    }

    // Determine route type
    if (file.relativeFilePath.startsWith("pages/api/")) {
      fileDetail.details.isApiRoute = true;
      const routePath = this.getRoutePathFromFilePages(file.relativeFilePath);
      this.apiRoutes.push(routePath);

      const apiInfo: ApiInfo = {
        routePath: routePath,
        relativeFilePath: file.relativeFilePath,
        methods: this.extractApiMethodsFromAST(file.ast),
        inputValidation: this.hasInputValidationInAST(file.ast),
        dependencies: fileDetail.details.imports || [],
      };

      this.apis.push(apiInfo);
      fileDetail.details.apiInfo = apiInfo;
    } else {
      fileDetail.details.isRoute = true;
      const routePath = this.getRoutePathFromFilePages(file.relativeFilePath);
      this.routes.push(routePath);

      const pageInfo: PageInfo = {
        routePath: routePath,
        relativeFilePath: file.relativeFilePath,
        components: fileDetail.details.components || [],
        dataFetching: this.extractDataFetchingFromAST(file.ast),
        hasParams: this.hasRouteParams(routePath),
        hasFormSubmission:
          this.hasFormSubmissionInAST(file.ast) ||
          file.content.includes("onSubmit"),
      };

      this.pages.push(pageInfo);
      fileDetail.details.pageInfo = pageInfo;
    }

    this.results.push(fileDetail);
  }

  /**
   * Process component files
   */
  private async processComponentFiles(): Promise<void> {
    this.log.debug("Processing component files");

    // Find all potential component files
    // We look for multiple component organization patterns
    const componentFiles = this.fileInfos.filter((file) => {
      // Common component file locations
      const isInComponentsDir =
        file.relativeDirPath.includes("/components/") ||
        file.relativeDirPath.startsWith("components/") ||
        file.relativeDirPath.includes("/src/components/");

      // Common UI component locations
      const isInUIDir =
        file.relativeDirPath.includes("/ui/") ||
        file.relativeDirPath.startsWith("ui/");

      // Components in feature directories
      const isInFeatureDir =
        file.relativeDirPath.includes("/features/") ||
        file.relativeDirPath.startsWith("features/");

      // Must be a JS/TS file with appropriate extension
      const hasJsExtension =
        file.extension === "js" ||
        file.extension === "jsx" ||
        file.extension === "ts" ||
        file.extension === "tsx";

      // Look for potential React component patterns
      const isProbablyComponent =
        // TitleCase naming is a strong signal for a component
        /^[A-Z][a-zA-Z0-9]*\.(jsx?|tsx?)$/.test(file.name) ||
        // Files explicitly named Component
        file.name.includes("Component") ||
        // Index files in component directories
        (file.name.match(/^index\.(jsx?|tsx?)$/) &&
          (file.relativeFilePath.includes("/components/") ||
            file.relativeFilePath.includes("/ui/")));

      return (
        hasJsExtension &&
        (isInComponentsDir ||
          isInUIDir ||
          isInFeatureDir ||
          isProbablyComponent)
      );
    });

    this.log.debug(`Found ${componentFiles.length} potential component files`);

    for (const file of componentFiles) {
      await this.processComponentFile(file);
    }

    this.log.debug(
      `Processed ${Object.keys(this.components).length} components`,
    );
  }

  /**
   * Process component file
   */
  private async processComponentFile(file: FileInfo): Promise<void> {
    if (!file.content || !file.ast) return;

    const fileDetail: FileAnalysisResult = {
      framework: "next",
      path: file.relativeFilePath,
      details: {
        isComponent: true,
        imports: [],
        exports: [],
        hooks: [],
        eventHandlers: [],
      },
    };

    // Extract information using AST
    if (file.ast) {
      // Extract imports
      fileDetail.details.imports = this.extractImportsFromAST(file.ast);

      // Extract exports
      fileDetail.details.exports = this.extractExportsFromAST(file.ast);

      // Extract React hooks
      fileDetail.details.hooks = this.extractHooksFromAST(file.ast);

      // Extract event handlers
      fileDetail.details.eventHandlers = this.extractEventHandlersFromAST(
        file.ast,
      );
    }

    // Create component info
    const componentName = path.basename(
      file.relativeFilePath,
      `.${file.extension}`,
    );

    const componentInfo: ComponentInfo = {
      name: componentName,
      props: this.extractPropsFromAST(file.ast),
      imports: fileDetail.details.imports || [],
      hooks: fileDetail.details.hooks || [],
      eventHandlers: fileDetail.details.eventHandlers || [],
      relativeFilePath: file.relativeFilePath,
    };

    this.components[componentName] = componentInfo;
    fileDetail.details.componentInfo = componentInfo;

    this.results.push(fileDetail);
  }

  /**
   * Extract imports from AST
   */
  private extractImportsFromAST(ast: parser.ParseResult<t.File>): string[] {
    const imports: string[] = [];

    traverse(ast, {
      ImportDeclaration(path: any) {
        // Get named imports
        path.node.specifiers.forEach((specifier: any) => {
          if (
            t.isImportSpecifier(specifier) &&
            t.isIdentifier(specifier.imported)
          ) {
            imports.push(specifier.imported.name);
          } else if (t.isImportDefaultSpecifier(specifier)) {
            imports.push(specifier.local.name);
          }
        });
      },
    });

    return imports;
  }

  /**
   * Extract exports from AST
   */
  private extractExportsFromAST(ast: parser.ParseResult<t.File>): string[] {
    const exports: string[] = [];

    traverse(ast, {
      ExportNamedDeclaration(path: any) {
        if (path.node.declaration) {
          if (t.isVariableDeclaration(path.node.declaration)) {
            path.node.declaration.declarations.forEach((declaration: any) => {
              if (t.isIdentifier(declaration.id)) {
                exports.push(declaration.id.name);
              }
            });
          } else if (
            t.isFunctionDeclaration(path.node.declaration) &&
            path.node.declaration.id
          ) {
            exports.push(path.node.declaration.id.name);
          }
        }
      },
      ExportDefaultDeclaration(path: any) {
        if (
          t.isFunctionDeclaration(path.node.declaration) &&
          path.node.declaration.id
        ) {
          exports.push(`${path.node.declaration.id.name} (default)`);
        } else if (t.isIdentifier(path.node.declaration)) {
          exports.push(`${path.node.declaration.name} (default)`);
        } else {
          exports.push("(anonymous default export)");
        }
      },
    });

    return exports;
  }

  /**
   * Extract hooks from AST
   */
  private extractHooksFromAST(ast: parser.ParseResult<t.File>): string[] {
    const hooks: string[] = [];

    traverse(ast, {
      CallExpression(path: any) {
        if (t.isIdentifier(path.node.callee)) {
          const name = path.node.callee.name;
          // Check for standard React hooks
          if (name.startsWith("use") && /^use[A-Z]/.test(name)) {
            if (!hooks.includes(name)) {
              hooks.push(name);
            }
          }
        }
      },
    });

    return hooks;
  }

  /**
   * Extract event handlers from AST
   */
  private extractEventHandlersFromAST(ast: any): string[] {
    const handlers: string[] = [];

    traverse(ast, {
      VariableDeclarator(path: any) {
        if (t.isIdentifier(path.node.id)) {
          const name = path.node.id.name;
          // Check for event handler naming patterns
          if (
            /^handle[A-Z]|on[A-Z]|[A-Za-z]+(Click|Change|Submit|Focus|Blur)$/.test(
              name,
            )
          ) {
            if (!handlers.includes(name)) {
              handlers.push(name);
            }
          }
        }
      },
      FunctionDeclaration(path: any) {
        if (path.node.id) {
          const name = path.node.id.name;
          // Check for event handler naming patterns
          if (
            /^handle[A-Z]|on[A-Z]|[A-Za-z]+(Click|Change|Submit|Focus|Blur)$/.test(
              name,
            )
          ) {
            if (!handlers.includes(name)) {
              handlers.push(name);
            }
          }
        }
      },
    });

    return handlers;
  }

  /**
   * Extract components from AST
   */
  private extractComponentsFromAST(ast: parser.ParseResult<t.File>): string[] {
    const components: string[] = [];

    traverse(ast, {
      JSXOpeningElement(path: any) {
        const name = path.node.name;
        if (t.isJSXIdentifier(name)) {
          // Check if it starts with uppercase (component convention)
          if (
            t.isJSXIdentifier(name) &&
            /^[A-Z]/.test(name.name) &&
            !components.includes(name.name)
          ) {
            components.push(name.name);
          }
        }
      },
    });

    return components;
  }

  /**
   * Extract props from AST
   */
  private extractPropsFromAST(ast: parser.ParseResult<t.File>): string[] {
    const props: string[] = [];

    traverse(ast, {
      // Find props in function parameters with destructuring
      FunctionDeclaration(path: any) {
        if (path.node.params.length > 0) {
          const param = path.node.params[0];
          if (t.isObjectPattern(param)) {
            param.properties.forEach((prop: any) => {
              if (t.isObjectProperty(prop) && t.isIdentifier(prop.key)) {
                props.push(prop.key.name);
              } else if (
                t.isRestElement(prop) &&
                t.isIdentifier(prop.argument)
              ) {
                props.push(`...${prop.argument.name}`);
              }
            });
          }
        }
      },
      // Find props in arrow functions with destructuring
      ArrowFunctionExpression(path: any) {
        if (path.node.params.length > 0) {
          const param = path.node.params[0];
          if (t.isObjectPattern(param)) {
            param.properties.forEach((prop: any) => {
              if (t.isObjectProperty(prop) && t.isIdentifier(prop.key)) {
                props.push(prop.key.name);
              } else if (
                t.isRestElement(prop) &&
                t.isIdentifier(prop.argument)
              ) {
                props.push(`...${prop.argument.name}`);
              }
            });
          }
        }
      },
    });

    return props;
  }

  /**
   * Extract data fetching methods from AST
   */
  private extractDataFetchingFromAST(ast: parser.ParseResult<t.File>): {
    method:
      | "getServerSideProps"
      | "getStaticProps"
      | "getStaticPaths"
      | "useQuery"
      | "fetch"
      | "axios"
      | "other"
      | null;
    dependencies?: string[];
  }[] {
    const dataFetching: {
      method:
        | "getServerSideProps"
        | "getStaticProps"
        | "getStaticPaths"
        | "useQuery"
        | "fetch"
        | "axios"
        | "other"
        | null;
      dependencies?: string[];
    }[] = [];

    // Check for Next.js data fetching methods
    let hasGetServerSideProps = false;
    let hasGetStaticProps = false;
    let hasGetStaticPaths = false;
    let hasUseQuery = false;
    let hasFetch = false;
    let hasAxios = false;

    traverse(ast, {
      ExportNamedDeclaration(path: any) {
        if (
          path.node.declaration &&
          t.isFunctionDeclaration(path.node.declaration)
        ) {
          const funcName = path.node.declaration.id?.name;
          if (funcName === "getServerSideProps") {
            hasGetServerSideProps = true;
          } else if (funcName === "getStaticProps") {
            hasGetStaticProps = true;
          } else if (funcName === "getStaticPaths") {
            hasGetStaticPaths = true;
          }
        }
      },
      CallExpression(path: any) {
        if (t.isIdentifier(path.node.callee)) {
          if (path.node.callee.name === "useQuery") {
            hasUseQuery = true;
          } else if (path.node.callee.name === "fetch") {
            hasFetch = true;
          }
        } else if (
          t.isMemberExpression(path.node.callee) &&
          t.isIdentifier(path.node.callee.object) &&
          path.node.callee.object.name === "axios"
        ) {
          hasAxios = true;
        }
      },
    });

    if (hasGetServerSideProps) {
      dataFetching.push({ method: "getServerSideProps" });
    }

    if (hasGetStaticProps) {
      dataFetching.push({ method: "getStaticProps" });
    }

    if (hasGetStaticPaths) {
      dataFetching.push({ method: "getStaticPaths" });
    }

    if (hasUseQuery) {
      dataFetching.push({ method: "useQuery" });
    }

    if (hasFetch) {
      dataFetching.push({ method: "fetch" });
    }

    if (hasAxios) {
      dataFetching.push({ method: "axios" });
    }

    return dataFetching;
  }

  /**
   * Check if the AST contains form submission logic
   */
  private hasFormSubmissionInAST(ast: parser.ParseResult<t.File>): boolean {
    let hasFormSubmission = false;

    traverse(ast, {
      JSXOpeningElement(path: any) {
        if (
          t.isJSXIdentifier(path.node.name) &&
          path.node.name.name === "form"
        ) {
          hasFormSubmission = true;
        }
      },
      JSXAttribute(path: any) {
        if (
          t.isJSXIdentifier(path.node.name) &&
          path.node.name.name === "onSubmit"
        ) {
          hasFormSubmission = true;
        }
      },
      Identifier(path: any) {
        if (path.node.name === "handleSubmit") {
          hasFormSubmission = true;
        }
      },
    });

    return hasFormSubmission;
  }

  /**
   * Extract API methods from AST
   */
  private extractApiMethodsFromAST(
    ast: parser.ParseResult<t.File>,
  ): ("GET" | "POST" | "PUT" | "DELETE" | "PATCH")[] {
    const methods: ("GET" | "POST" | "PUT" | "DELETE" | "PATCH")[] = [];

    traverse(ast, {
      MemberExpression(path: any) {
        if (t.isIdentifier(path.node.property)) {
          const propName = path.node.property.name;
          if (
            ["get", "post", "put", "delete", "patch"].includes(
              propName.toLowerCase(),
            )
          ) {
            const method = propName.toUpperCase() as
              | "GET"
              | "POST"
              | "PUT"
              | "DELETE"
              | "PATCH";
            if (!methods.includes(method)) {
              methods.push(method);
            }
          }
        }
      },
      BinaryExpression(path: any) {
        if (path.node.operator === "===" || path.node.operator === "==") {
          // Look for req.method === 'METHOD'
          if (
            t.isMemberExpression(path.node.left) &&
            t.isIdentifier(path.node.left.property) &&
            path.node.left.property.name === "method" &&
            t.isStringLiteral(path.node.right)
          ) {
            const method = path.node.right.value.toUpperCase() as
              | "GET"
              | "POST"
              | "PUT"
              | "DELETE"
              | "PATCH";
            if (
              ["GET", "POST", "PUT", "DELETE", "PATCH"].includes(method) &&
              !methods.includes(method)
            ) {
              methods.push(method);
            }
          }
        }
      },
    });

    return methods;
  }

  /**
   * Check if the AST contains input validation
   */
  private hasInputValidationInAST(ast: parser.ParseResult<t.File>): boolean {
    let hasValidation = false;

    traverse(ast, {
      Identifier(path: any) {
        const name = path.node.name;
        if (["validate", "schema", "yup", "zod", "joi"].includes(name)) {
          hasValidation = true;
        }
      },
    });

    return hasValidation;
  }

  /**
   * Check if a route has parameters
   */
  private hasRouteParams(route: string): boolean {
    return route.includes(":");
  }

  private getRoutePathFromFileApp(filePath: string): string {
    // Transform app/dashboard/settings/page.tsx -> /dashboard/settings
    let routePath = filePath
      .replace(/^app/, "")
      .replace(/\/(page|route|layout)\.(js|jsx|ts|tsx)$/, "");

    // Handle dynamic route params
    routePath = routePath.replace(/\/\[([^\]]+)\]/g, "/:$1");

    return routePath || "/";
  }

  private getRoutePathFromFilePages(filePath: string): string {
    // Transform pages/dashboard/settings.tsx -> /dashboard/settings
    let routePath = filePath
      .replace(/^pages/, "")
      .replace(/\.(js|jsx|ts|tsx)$/, "");

    // Handle dynamic route params
    routePath = routePath.replace(/\/\[([^\]]+)\]/g, "/:$1");

    // Handle index routes
    routePath = routePath.replace(/\/index$/, "");

    return routePath || "/";
  }
}
