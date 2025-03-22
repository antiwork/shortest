import fs from "fs/promises";
import { createRequire } from "module";
import path from "path";
import * as parser from "@babel/parser";
import * as t from "@babel/types";
import {
  FileAnalysisResult,
  BaseAnalyzer,
  FileNode,
  TestPlanningContext,
  AppAnalysis,
} from "./types";
import { DOT_SHORTEST_DIR_PATH } from "@/cache";
import { getTreeStructure } from "@/core/app-analyzer/utils/build-tree-structure";
import { getGitInfo } from "@/core/app-analyzer/utils/get-git-info";
import { getLogger } from "@/log";
import { assertDefined } from "@/utils/assert";
import { getErrorDetails } from "@/utils/errors";

const require = createRequire(import.meta.url);
const traverse = require("@babel/traverse").default;

interface ComponentInfo {
  name: string;
  props: string[];
  imports: string[];
  hooks: string[];
  eventHandlers: string[];
  filepath: string;
}

interface PageInfo {
  route: string;
  filepath: string;
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
  hasAuth: boolean;
  hasParams: boolean;
  hasSearchParams: boolean;
  hasFormSubmission: boolean;
}

interface ApiInfo {
  route: string;
  filepath: string;
  methods: ("GET" | "POST" | "PUT" | "DELETE" | "PATCH")[];
  inputValidation: boolean;
  dependencies: string[];
}

export class NextJsAnalyzer implements BaseAnalyzer {
  private routes: string[] = [];
  private apiRoutes: string[] = [];
  private results: FileAnalysisResult[] = [];
  private components: Record<string, ComponentInfo> = {};
  private pages: PageInfo[] = [];
  private apis: ApiInfo[] = [];
  private isAppRouter = false;
  private isPagesRouter = false;
  private treeStructure: any = null;
  private log = getLogger();

  private readonly NEXT_FRAMEWORK_NAME = "next";
  private readonly VERSION = 1;

  constructor(private rootDir: string) {}

  /**
   * Main method to execute the analysis
   */
  async execute(): Promise<AppAnalysis> {
    this.log.trace("Executing NextJs analyzer");

    try {
      this.routes = [];
      this.apiRoutes = [];
      this.results = [];
      this.components = {};
      this.pages = [];
      this.apis = [];
      this.isAppRouter = false;
      this.isPagesRouter = false;

      if (!this.treeStructure) {
        await this.setTreeStructure();
      }

      this.log.debug(
        `Tree structure loaded with ${this.treeStructure?.allFiles?.size || 0} files`,
      );

      this.detectRouterType();
      await this.parseFiles();
      await this.analyzeTreeStructure();
      const testPlanningContext = this.generateTestPlanningContext();

      this.log.debug(
        `Analysis generated: ${this.pages.length} pages, ${this.apis.length} API routes, ${Object.keys(this.components).length} components`,
      );

      const analysis: AppAnalysis = {
        framework: "next",
        filesScanned: this.treeStructure?.allFiles?.size || 0,
        summary: this.generateSummary(),
        routes: this.routes,
        apiRoutes: this.apiRoutes,
        results: this.results,
        testPlanningContext,
      };

      // Save analysis.json
      await this.saveAnalysisToFile(analysis);

      return analysis;
    } catch (error) {
      this.log.error(
        "Error executing NextJs analyzer:",
        getErrorDetails(error),
      );

      // Return a minimal analysis with error information
      return {
        framework: "next",
        filesScanned: this.treeStructure?.allFiles?.size || 0,
        summary: `Error analyzing Next.js application: ${error.message}`,
        routes: this.routes,
        apiRoutes: this.apiRoutes,
        results: this.results,
        testPlanningContext: this.generateTestPlanningContext(),
      };
    }
  }

  /**
   * Implementation of BaseAnalyzer.finalizeAnalysis
   */
  async finalizeAnalysis(): Promise<void> {
    // Analyze the app structure if it exists
    if (this.treeStructure) {
      await this.analyzeTreeStructure();
    }
  }

  /**
   * Set the app structure for analysis (implementation of BaseAnalyzer.setAppStructure)
   */
  async setAppStructure(appStructure: any): Promise<void> {
    this.log.trace("Setting app structure for NextJs analyzer");
    this.treeStructure = appStructure;
  }

  /**
   * Set the tree structure for analysis
   */
  async setTreeStructure(): Promise<void> {
    this.log.trace("Building tree structure for NextJs analyzer");
    try {
      const treeNode = await getTreeStructure(
        this.NEXT_FRAMEWORK_NAME,
        this.rootDir,
      );

      // Convert the tree structure to the format expected by the analyzer
      // This is a simplified conversion as we're adapting between different structures
      const appTreeStructure: any = {
        root: treeNode,
        allFiles: new Map(),
        filesByType: new Map(),
        filesByDirectory: new Map(),
      };

      // Process the tree to populate the maps
      this.populateTreeMaps(treeNode, appTreeStructure);

      this.treeStructure = appTreeStructure;

      // Save the tree structure to disk
      const frameworkDir = path.join(
        DOT_SHORTEST_DIR_PATH,
        this.NEXT_FRAMEWORK_NAME,
      );
      await fs.mkdir(frameworkDir, { recursive: true });
      const treeJsonPath = path.join(frameworkDir, "tree.json");

      const treeOutput = {
        metadata: {
          timestamp: Date.now(),
          version: this.VERSION,
          git: await getGitInfo(),
        },
        data: treeNode,
      };

      await fs.writeFile(treeJsonPath, JSON.stringify(treeOutput, null, 2));
      this.log.trace(`Tree structure saved to ${treeJsonPath}`);
    } catch (error) {
      this.log.error("Failed to build tree structure", getErrorDetails(error));
      throw error;
    }
  }

  /**
   * Populate tree maps for easier access to files
   */
  private populateTreeMaps(
    node: any,
    treeStructure: any,
    basePath: string = "",
    isRoot: boolean = true,
  ): void {
    if (node.type === "directory" && node.children) {
      const dirPath = isRoot
        ? ""
        : basePath
          ? `${basePath}/${node.name}`
          : node.name;

      if (!isRoot) {
        if (!treeStructure.filesByDirectory.has(dirPath)) {
          treeStructure.filesByDirectory.set(dirPath, []);
        }
      }

      for (const child of node.children) {
        this.populateTreeMaps(child, treeStructure, dirPath, false);
      }
    } else if (node.type === "file") {
      const filePath = basePath ? `${basePath}/${node.name}` : node.name;
      // Extract extension safely, falling back to empty string if undefined
      const extensionMatch = node.name.match(/\.([^.]+)$/);
      const extension = extensionMatch ? extensionMatch[1] : "";

      const absolutePath =
        node.path && typeof node.path === "string"
          ? path.resolve(node.path)
          : path.resolve(this.rootDir, filePath);

      const fileNode: any = {
        path: absolutePath,
        relativePath: filePath,
        name: node.name,
        type: "file",
        extension: extension,
        isDirectory: false,
        size: 0, // We don't have this info from the tree structure
        lastModified: new Date(),
      };

      // Add to allFiles map
      treeStructure.allFiles.set(filePath, fileNode);

      // Add to filesByType map
      if (!treeStructure.filesByType.has(extension)) {
        treeStructure.filesByType.set(extension, []);
      }
      treeStructure.filesByType.get(extension).push(fileNode);

      // Add to filesByDirectory map
      if (!treeStructure.filesByDirectory.has(basePath)) {
        treeStructure.filesByDirectory.set(basePath, []);
      }
      treeStructure.filesByDirectory.get(basePath).push(fileNode);
    }
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
      const frameworkDir = path.join(
        DOT_SHORTEST_DIR_PATH,
        this.NEXT_FRAMEWORK_NAME,
      );
      await fs.mkdir(frameworkDir, { recursive: true });
      const analysisJsonPath = path.join(frameworkDir, "analysis.json");

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

  /**
   * Main method to analyze the Next.js app structure
   */
  private async analyzeTreeStructure(): Promise<void> {
    assertDefined(
      this.treeStructure,
      "App structure must be set before analysis",
    );

    // Process route files
    await this.processRouteFiles();

    // Process component files
    await this.processComponentFiles();

    // Build relationships between components and pages
    this.buildComponentRelationships();
  }

  private async parseFiles(): Promise<void> {
    if (!this.treeStructure) {
      throw new Error("App structure must be set before parsing files");
    }

    // Only parse JavaScript/TypeScript files
    const fileExtensions = ["js", "jsx", "ts", "tsx"];

    this.log.trace(
      `Starting to parse files with extensions: ${fileExtensions.join(", ")}`,
    );

    // Parse each file and generate its AST
    for (const ext of fileExtensions) {
      const files = this.treeStructure.filesByType.get(ext) || [];
      this.log.trace(`Found ${files.length} files with extension: ${ext}`);

      for (const file of files) {
        try {
          if (!file.content) {
            try {
              this.log.trace("Reading file", { path: file.path });
              file.content = await fs.readFile(file.path, "utf-8");
            } catch (readError) {
              this.log.error(
                `Error reading file ${file.path}:`,
                getErrorDetails(readError),
              );
              continue;
            }
          }

          if (!file.ast && file.content) {
            try {
              // Parse the file content using Babel
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

              // Store the AST in the file node
              file.ast = ast;
            } catch (parseError) {
              this.log.error(
                `Error parsing file ${file.path}:`,
                getErrorDetails(parseError),
              );
              // Continue processing other files even if this one fails
            }
          }
        } catch (error) {
          this.log.error(
            `Unexpected error processing file ${file.path}:`,
            getErrorDetails(error),
          );
        }
      }
    }

    this.log.trace("File parsing complete");
  }

  /**
   * Detect if the project uses App Router or Pages Router
   */
  private detectRouterType(): void {
    if (!this.treeStructure) return;

    const hasAppDir =
      this.treeStructure.filesByDirectory.has("app") ||
      Array.from(this.treeStructure.filesByDirectory.keys()).some((dir) =>
        (dir as string).startsWith("app/"),
      );

    const hasPagesDir =
      this.treeStructure.filesByDirectory.has("pages") ||
      Array.from(this.treeStructure.filesByDirectory.keys()).some((dir) =>
        dir.startsWith("pages/"),
      );

    this.isAppRouter = hasAppDir;
    this.isPagesRouter = hasPagesDir;

    if (this.isAppRouter && this.isPagesRouter) {
      console.log(
        "Detected both App Router and Pages Router. Prioritizing App Router for analysis.",
      );
    } else if (this.isAppRouter) {
      console.log("Detected Next.js App Router");
    } else if (this.isPagesRouter) {
      console.log("Detected Next.js Pages Router");
    } else {
      console.log("Could not confidently determine Next.js router type");
    }
  }

  /**
   * Process Next.js route files (pages and API routes)
   */
  private async processRouteFiles(): Promise<void> {
    assertDefined(
      this.treeStructure,
      "App structure must be set before processing route files",
    );

    this.log.debug("Processing route files");
    this.log.debug(
      `Router type: ${this.isAppRouter ? "App Router" : ""} ${this.isPagesRouter ? "Pages Router" : ""}`,
    );

    // Look for app router files regardless of app/ directory
    // Find all page.js/tsx, route.js/tsx, and layout.js/tsx files
    const appFiles = Array.from(this.treeStructure.allFiles.values()).filter(
      (file) => {
        // Look for app router-specific file naming patterns
        const isAppRouterFile =
          file.name === "page.js" ||
          file.name === "page.tsx" ||
          file.name === "route.js" ||
          file.name === "route.tsx" ||
          file.name === "layout.js" ||
          file.name === "layout.tsx";

        return isAppRouterFile;
      }
    );

    // Process App Router route files if we have them or if app router was detected
    if (appFiles.length > 0 || this.isAppRouter) {
      this.isAppRouter = true; // Ensure this is set if we found app router files
      this.log.debug(`Found ${appFiles.length} App Router files`);

      for (const file of appFiles) {
        await this.processAppRouterFile(file);
      }
    }

    // Look for pages files with more flexibility
    const pagesFiles = Array.from(this.treeStructure.allFiles.values()).filter(
      (file) => {
        // Check if it's in a pages directory
        const isPagesFile =
          (file as FileNode).relativePath.includes("/pages/") ||
          (file as FileNode).relativePath.startsWith("pages/");

        // Skip special files like _app.js
        const isSpecialFile =
          (file as FileNode).name.startsWith("_") ||
          (file as FileNode).name === "api"; // Skip the api folder itself

        return isPagesFile && !isSpecialFile;
      }
    );

    // Process Pages Router files if we have them or if pages router was detected
    if (pagesFiles.length > 0 || this.isPagesRouter) {
      this.isPagesRouter = true; // Ensure this is set if we found pages router files
      this.log.debug(`Found ${pagesFiles.length} Pages Router files`);

      for (const file of pagesFiles) {
        await this.processPagesRouterFile(file);
      }
    }

    // Process API routes specifically since they're important
    const apiFiles = Array.from(this.treeStructure.allFiles.values()).filter(
      (file) => file.relativePath.includes("/api/")
    );

    this.log.debug(`Found ${apiFiles.length} API files`);
    for (const file of apiFiles) {
      if (file.relativePath.startsWith("pages/api/")) {
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
  private async processAppRouterFile(file: FileNode): Promise<void> {
    if (!file.content || !file.ast) return;

    const fileDetail: FileAnalysisResult = {
      framework: "next",
      path: file.relativePath,
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
      const routePath = this.getRoutePathFromFileApp(file.relativePath);
      this.routes.push(routePath);

      const pageInfo: PageInfo = {
        route: routePath,
        filepath: file.relativePath,
        components: fileDetail.details.components || [],
        dataFetching: this.extractDataFetchingFromAST(file.ast),
        hasAuth:
          this.hasAuthCheckInAST(file.ast) ||
          file.content.includes("useAuth") ||
          file.content.includes("withAuth"),
        hasParams: this.hasRouteParams(routePath),
        hasSearchParams: file.content.includes("searchParams"),
        hasFormSubmission:
          this.hasFormSubmissionInAST(file.ast) ||
          file.content.includes("onSubmit"),
      };

      this.pages.push(pageInfo);
      fileDetail.details.pageInfo = pageInfo;
    } else if (file.name === "layout.js" || file.name === "layout.tsx") {
      fileDetail.details.isLayout = true;
    } else if (
      file.name === "route.js" ||
      file.name === "route.tsx" ||
      file.relativePath.includes("/api/")
    ) {
      fileDetail.details.isApiRoute = true;
      const routePath = this.getRoutePathFromFileApp(file.relativePath);
      this.apiRoutes.push(routePath);

      const apiInfo: ApiInfo = {
        route: routePath,
        filepath: file.relativePath,
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
  private async processPagesRouterFile(file: FileNode): Promise<void> {
    if (!file.content || !file.ast) return;

    const fileDetail: FileAnalysisResult = {
      framework: "next",
      path: file.relativePath,
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

      // Extract component usage
      fileDetail.details.components = this.extractComponentsFromAST(file.ast);
    }

    // Determine route type
    if (file.relativePath.startsWith("pages/api/")) {
      fileDetail.details.isApiRoute = true;
      const routePath = this.getRoutePathFromFilePages(file.relativePath);
      this.apiRoutes.push(routePath);

      const apiInfo: ApiInfo = {
        route: routePath,
        filepath: file.relativePath,
        methods: this.extractApiMethodsFromAST(file.ast),
        inputValidation: this.hasInputValidationInAST(file.ast),
        dependencies: fileDetail.details.imports || [],
      };

      this.apis.push(apiInfo);
      fileDetail.details.apiInfo = apiInfo;
    } else {
      fileDetail.details.isRoute = true;
      const routePath = this.getRoutePathFromFilePages(file.relativePath);
      this.routes.push(routePath);

      const pageInfo: PageInfo = {
        route: routePath,
        filepath: file.relativePath,
        components: fileDetail.details.components || [],
        dataFetching: this.extractDataFetchingFromAST(file.ast),
        hasAuth:
          this.hasAuthCheckInAST(file.ast) ||
          file.content.includes("useAuth") ||
          file.content.includes("withAuth"),
        hasParams: this.hasRouteParams(routePath),
        hasSearchParams:
          file.content.includes("query") || file.content.includes("useRouter"),
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
    if (!this.treeStructure) return;

    this.log.debug("Processing component files");

    // Find all potential component files
    // We look for multiple component organization patterns
    const componentFiles = Array.from(
      this.treeStructure.allFiles.values(),
    ).filter((file) => {
      // Common component file locations
      const isInComponentsDir =
        file.relativePath.includes("/components/") ||
        file.relativePath.startsWith("components/") ||
        file.relativePath.includes("/src/components/");

      // Common UI component locations
      const isInUIDir =
        file.relativePath.includes("/ui/") ||
        file.relativePath.startsWith("ui/");

      // Components in feature directories
      const isInFeatureDir =
        file.relativePath.includes("/features/") ||
        file.relativePath.startsWith("features/");

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
          (file.relativePath.includes("/components/") ||
          file.relativePath.includes("/ui/")));

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
  private async processComponentFile(file: FileNode): Promise<void> {
    if (!file.content || !file.ast) return;

    const fileDetail: FileAnalysisResult = {
      framework: "next",
      path: file.relativePath,
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
      file.relativePath,
      `.${file.extension}`,
    );

    const componentInfo: ComponentInfo = {
      name: componentName,
      props: this.extractPropsFromAST(file.ast),
      imports: fileDetail.details.imports || [],
      hooks: fileDetail.details.hooks || [],
      eventHandlers: fileDetail.details.eventHandlers || [],
      filepath: file.relativePath,
    };

    this.components[componentName] = componentInfo;
    fileDetail.details.componentInfo = componentInfo;

    this.results.push(fileDetail);
  }

  /**
   * Build relationships between components and pages
   */
  private buildComponentRelationships(): void {
    // This would build a graph of component dependencies
    // For now, we already have basic relationships in page.components
  }

  // ---- AST Analysis Methods ----

  /**
   * Extract imports from AST
   */
  private extractImportsFromAST(ast: any): string[] {
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
  private extractExportsFromAST(ast: any): string[] {
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
  private extractHooksFromAST(ast: any): string[] {
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
  private extractComponentsFromAST(ast: any): string[] {
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
  private extractPropsFromAST(ast: any): string[] {
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
  private extractDataFetchingFromAST(ast: any): {
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
   * Check if the AST contains authentication logic
   */
  private hasAuthCheckInAST(ast: any): boolean {
    let hasAuth = false;

    traverse(ast, {
      CallExpression(path: any) {
        if (t.isIdentifier(path.node.callee)) {
          if (
            ["useAuth", "getSession", "useSession"].includes(
              path.node.callee.name,
            )
          ) {
            hasAuth = true;
          }
        }
      },
      Identifier(path: any) {
        if (
          ["isAuthenticated", "isLoggedIn", "withAuth"].includes(path.node.name)
        ) {
          hasAuth = true;
        }
      },
    });

    return hasAuth;
  }

  /**
   * Check if the AST contains form submission logic
   */
  private hasFormSubmissionInAST(ast: any): boolean {
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
    ast: any,
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
  private hasInputValidationInAST(ast: any): boolean {
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

  /**
   * Generate suggested test flows based on the structure
   */
  private generateSuggestedTestFlows(userFlows: any[]): any[] {
    const testFlows: any[] = [];

    // Add basic smoke test for important pages
    if (this.pages.length > 0) {
      testFlows.push({
        name: "Smoke Tests",
        description: "Verify key pages load successfully",
        scenarios: this.pages
          .filter((p) => !p.route.includes(":")) // Filter out dynamic routes
          .slice(0, 5) // Take the first 5 pages
          .map((page) => ({
            description: `Verify ${page.route} page loads`,
            steps: [
              `Navigate to ${page.route}`,
              "Verify the page title is correct",
              "Verify main content is visible",
            ],
          })),
      });
    }

    // Add tests based on user flows
    for (const flow of userFlows) {
      testFlows.push({
        name: `${flow.name} Test`,
        description: `Verify ${flow.description.toLowerCase()}`,
        scenarios: [
          {
            description: flow.description,
            steps: flow.steps
              .map((step: any) => {
                if (step.type === "page") return `Navigate to ${step.route}`;
                if (step.type === "action") return step.name;
                return "";
              })
              .filter(Boolean),
          },
        ],
      });
    }

    // Add form validation tests if relevant
    const formPages = this.pages.filter((p) => p.hasFormSubmission);
    if (formPages.length > 0) {
      testFlows.push({
        name: "Form Validation Tests",
        description: "Verify form validation works correctly",
        scenarios: formPages.map((page) => ({
          description: `Verify form validation on ${page.route}`,
          steps: [
            `Navigate to ${page.route}`,
            "Attempt to submit form with invalid data",
            "Verify validation error messages appear",
            "Fill the form with valid data",
            "Submit the form",
            "Verify successful submission",
          ],
        })),
      });
    }

    return testFlows;
  }

  /**
   * Generate a high-level summary of the application structure
   * for AI test planning
   */
  private generateTestPlanningContext(): TestPlanningContext {
    // Create a user flow summary based on pages and their relationships
    const userFlows = this.inferUserFlows();

    return {
      routerType: this.isAppRouter
        ? "app"
        : this.isPagesRouter
          ? "pages"
          : "unknown",
      mainPages: this.pages.map((page) => ({
        route: page.route,
        hasAuth: page.hasAuth,
        hasParams: page.hasParams,
        hasSearchParams: page.hasSearchParams,
        hasFormSubmission: page.hasFormSubmission,
        components: page.components,
        dataFetching: page.dataFetching.map((df) => df.method || "unknown"),
      })),
      apiEndpoints: this.apis.map((api) => ({
        route: api.route,
        methods: api.methods,
        hasValidation: api.inputValidation,
      })),
      coreComponents: Object.entries(this.components)
        .filter(([_, comp]) => comp.props.length > 0) // Only include components with props
        .map(([name, comp]) => ({
          name,
          props: comp.props,
          hasEventHandlers: comp.eventHandlers.length > 0,
        })),
      userFlows: userFlows,
      suggestedTestFlows: this.generateSuggestedTestFlows(userFlows),
    };
  }

  /**
   * Infer possible user flows through the application
   */
  private inferUserFlows(): any[] {
    const flows: any[] = [];

    // Map auth protected pages (potential user journeys)
    const authPages = this.pages.filter((p) => p.hasAuth);
    if (authPages.length > 0) {
      // Assume we need a login -> protected page flow
      flows.push({
        name: "Authentication Flow",
        description: "User logs in and accesses protected content",
        steps: [
          { type: "page", route: "/login" }, // Assumed login page
          { type: "action", name: "Submit login form" },
          { type: "page", route: authPages[0].route },
        ],
      });
    }

    // Map form submission flows
    const formPages = this.pages.filter((p) => p.hasFormSubmission);
    for (const page of formPages) {
      flows.push({
        name: `Form Flow: ${page.route}`,
        description: `User completes and submits a form on ${page.route}`,
        steps: [
          { type: "page", route: page.route },
          { type: "action", name: "Fill form fields" },
          { type: "action", name: "Submit form" },
          // Next step would depend on the app, could be confirmation page
        ],
      });
    }

    // Map API flows
    if (this.apis.length > 0) {
      const crudApis = this.apis.filter(
        (api) =>
          api.methods.includes("GET") &&
          (api.methods.includes("POST") || api.methods.includes("PUT")),
      );

      if (crudApis.length > 0) {
        flows.push({
          name: "Data CRUD Flow",
          description: "User creates and reads data",
          steps: [
            { type: "action", name: "Create new data via API/form" },
            { type: "action", name: "View created data" },
            { type: "action", name: "Update data" },
            { type: "action", name: "Delete data" },
          ],
          relatedApis: crudApis.map((api) => api.route),
        });
      }
    }

    return flows;
  }
}
