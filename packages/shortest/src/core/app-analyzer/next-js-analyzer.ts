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
import { FrameworkInfo } from "@/core/app-analyzer";
import {
  getPaths,
  getTreeStructure,
} from "@/core/app-analyzer/utils/get-tree-structure";
import { getLogger } from "@/log";
import { assertDefined } from "@/utils/assert";
import { getErrorDetails, ShortestError } from "@/utils/errors";
import { getGitInfo } from "@/utils/get-git-info";

const require = createRequire(import.meta.url);
const traverse = require("@babel/traverse").default;

interface PageInfo {
  routePath: string;
  relativeFilePath: string;
  components: string[];
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
  private pages: PageInfo[] = [];
  private paths: string[] = [];
  private apis: ApiInfo[] = [];
  private isAppRouter = false;
  private isPagesRouter = false;
  private fileInfos: FileInfo[] = [];
  private log = getLogger();

  private readonly NEXT_ANALYSIS_VERSION = 2;
  private readonly frameworkInfo: FrameworkInfo;
  private readonly cacheFrameworkDir: string;

  constructor(frameworkInfo: FrameworkInfo) {
    this.frameworkInfo = frameworkInfo;
    this.cacheFrameworkDir = path.join(
      DOT_SHORTEST_DIR_PATH,
      this.frameworkInfo.id,
    );
  }

  async execute(): Promise<AppAnalysis> {
    this.log.trace("Executing NextJs analyzer");

    this.layouts = {};
    this.routes = [];
    this.apiRoutes = [];
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

    this.log.debug(
      `Analysis generated: ${this.pages.length} pages, ${this.apis.length} API routes, ${Object.keys(this.layouts).length} layouts`,
    );

    const analysis: AppAnalysis = this.generateAnalysis();
    await this.saveAnalysisToFile(analysis);
    return analysis;
  }

  private async setPaths(): Promise<void> {
    this.log.trace("Retrieving folder paths for NextJs analyzer");
    this.paths = await getPaths(this.frameworkInfo.dirPath);

    await fs.mkdir(this.cacheFrameworkDir, { recursive: true });
    const pathsOutput = {
      metadata: {
        timestamp: Date.now(),
        version: this.NEXT_ANALYSIS_VERSION,
        git: await getGitInfo(),
      },
      data: {
        framework: this.frameworkInfo,
        paths: this.paths,
      },
    };

    await fs.writeFile(
      path.join(this.cacheFrameworkDir, "paths.json"),
      JSON.stringify(pathsOutput, null, 2),
    );

    this.log.trace("Paths saved", {
      path: path.join(this.cacheFrameworkDir, "paths.json"),
    });
  }

  private async setTreeStructure(): Promise<void> {
    this.log.setGroup("🌳");
    this.log.trace("Building tree structure for NextJs analyzer");
    try {
      const treeNode = await getTreeStructure(this.frameworkInfo.dirPath);

      this.setFileInfos(treeNode);

      await fs.mkdir(this.cacheFrameworkDir, { recursive: true });
      const treeJsonPath = path.join(this.cacheFrameworkDir, "tree.json");

      const treeOutput = {
        metadata: {
          timestamp: Date.now(),
          version: this.NEXT_ANALYSIS_VERSION,
          git: await getGitInfo(),
        },
        data: {
          framework: this.frameworkInfo,
          node: treeNode,
        },
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
        absoluteFilePath: path.resolve(this.frameworkInfo.dirPath, node.path),
        name: node.name,
        extension: node.extension,
        content: null,
        ast: null,
      });
    }
  }

  private generateAnalysis(): AppAnalysis {
    const routeInfoList = this.pages.map((page) => ({
      routePath: page.routePath,
      relativeFilePath: page.relativeFilePath,
      layoutChain: this.getLayoutChainForPage(page.relativeFilePath),
      components: page.components,
      hasParams: page.hasParams,
      hasForm: page.hasFormSubmission,
      hooks: this.getHooksForFile(page.relativeFilePath),
      eventHandlers: this.getEventHandlersForFile(page.relativeFilePath),
      featureFlags: [],
    }));

    const apiRouteInfoList = this.apis.map((api) => ({
      routePath: api.routePath,
      relativeFilePath: api.relativeFilePath,
      methods: api.methods as string[],
      hasValidation: api.inputValidation,
      deps: api.dependencies,
    }));

    const layoutInfoList = Object.values(this.layouts);

    return {
      framework: this.frameworkInfo,
      routerType: this.isAppRouter
        ? "app"
        : this.isPagesRouter
          ? "pages"
          : "unknown",
      stats: {
        fileCount: this.fileInfos.length,
        routeCount: this.pages.length,
        apiRouteCount: this.apis.length,
        layoutCount: Object.keys(this.layouts).length,
      },
      layouts: layoutInfoList,
      routes: routeInfoList,
      apiRoutes: apiRouteInfoList,
      allPaths: this.paths,
    };
  }

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

  private getHooksForFile(filepath: string): string[] {
    const result = this.results.find((r) => r.path === filepath);
    return result?.details?.hooks || [];
  }

  private getEventHandlersForFile(filepath: string): string[] {
    const result = this.results.find((r) => r.path === filepath);
    return result?.details?.eventHandlers || [];
  }

  private async saveAnalysisToFile(analysis: AppAnalysis): Promise<void> {
    try {
      await fs.mkdir(this.cacheFrameworkDir, { recursive: true });
      const analysisJsonPath = path.join(
        this.cacheFrameworkDir,
        "analysis.json",
      );

      const output = {
        metadata: {
          timestamp: Date.now(),
          version: this.NEXT_ANALYSIS_VERSION,
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
              file.content = await fs.readFile(
                path.join(this.frameworkInfo.dirPath, file.relativeFilePath),
                "utf-8",
              );
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

  private processLayoutFiles(): void {
    const layoutFileInfos = this.fileInfos.filter((file) =>
      /^layout\.(jsx?|tsx)$/.test(file.name),
    );

    for (const layoutFileInfo of layoutFileInfos) {
      const ast = assertDefined(layoutFileInfo.ast);
      const content = assertDefined(layoutFileInfo.content);

      const componentFunctions = new Map();
      let layoutName = null;

      traverse(ast, {
        // Collect all function declarations
        FunctionDeclaration(path: any) {
          if (path.node.id) {
            componentFunctions.set(path.node.id.name, path.node);
          }
        },

        // Try to find which one is exported
        ExportDefaultDeclaration(path: any) {
          if (
            t.isFunctionDeclaration(path.node.declaration) &&
            path.node.declaration.id
          ) {
            layoutName = path.node.declaration.id.name;
          } else if (t.isIdentifier(path.node.declaration)) {
            layoutName = path.node.declaration.name;
          } else if (t.isCallExpression(path.node.declaration)) {
            // Try to extract from HOCs
            const arg = path.node.declaration.arguments[0];
            if (t.isIdentifier(arg)) {
              layoutName = arg.name;
            }
          }
        },
      });

      // Fallback if export detection fails
      if (!layoutName && componentFunctions.size > 0) {
        layoutName = [...componentFunctions.keys()][0];
      }

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
        content,
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

  // TODO: Untested, AI-generated, check if this logic actually works
  private processAppRouterFile(file: FileInfo): void {
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

    fileDetail.details.imports = this.extractImportsFromAST(file.ast);
    fileDetail.details.exports = this.extractExportsFromAST(file.ast);
    fileDetail.details.hooks = this.extractHooksFromAST(file.ast);
    fileDetail.details.eventHandlers = this.extractEventHandlersFromAST(
      file.ast,
    );
    fileDetail.details.components = this.extractComponentsFromAST(file.ast);

    if (file.name === "page.js" || file.name === "page.tsx") {
      fileDetail.details.isRoute = true;
      const routePath = this.getRoutePathFromFileApp(file.relativeFilePath);
      this.routes.push(routePath);

      const pageInfo: PageInfo = {
        routePath,
        relativeFilePath: file.relativeFilePath,
        components: fileDetail.details.components || [],
        hasParams: this.hasRouteParams(routePath),
        hasFormSubmission:
          this.hasFormSubmissionInAST(file.ast) ||
          file.content.includes("onSubmit"),
      };

      this.pages.push(pageInfo);
      fileDetail.details.pageInfo = pageInfo;
    } else if (file.name === "layout.js" || file.name === "layout.tsx") {
      fileDetail.details.isLayout = true;

      let layoutName: string | undefined;

      if (file.ast) {
        const exports = this.extractExportsFromAST(file.ast);
        const defaultExport = exports.find((e) => e.includes("default"));
        if (defaultExport) {
          layoutName = defaultExport.replace(" (default)", "");
        }
      }

      if (!layoutName) {
        const parts = file.relativeFilePath.split("/");
        const dirName = parts[parts.length - 2] || "";
        layoutName =
          dirName.charAt(0).toUpperCase() + dirName.slice(1) + "Layout";
      }

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
        routePath,
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

  private processPagesRouterFile(file: FileInfo): void {
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

    if (file.relativeFilePath.startsWith("pages/api/")) {
      fileDetail.details.isApiRoute = true;
      const routePath = this.getRoutePathFromFilePages(file.relativeFilePath);
      this.apiRoutes.push(routePath);

      const apiInfo: ApiInfo = {
        routePath,
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
        routePath,
        relativeFilePath: file.relativeFilePath,
        components: fileDetail.details.components || [],
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
