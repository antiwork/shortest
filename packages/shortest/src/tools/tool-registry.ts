import { Tool } from "ai";
import { z } from "zod";
import { BrowserTool } from "@/browser/core/browser-tool";
import { getLogger, Log } from "@/log";
import { AnthropicModel, OpenAIModel } from "@/types/config";
import { ShortestError } from "@/utils/errors";

const TOOL_ENTRY_CATEGORIES = ["provider", "custom"] as const;
const toolEntryCategorySchema = z.enum(TOOL_ENTRY_CATEGORIES);
const toolFactoryNoArgSchema = z.function().args().returns(z.custom<Tool>());

const toolFactoryWithArgSchema = z
  .function()
  .args(z.custom<BrowserTool>())
  .returns(z.custom<Tool>());
export const toolFactorySchema = z.union([
  toolFactoryWithArgSchema,
  toolFactoryNoArgSchema,
]);
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const toolEntrySchema = z.union([
  z.object({
    name: z.literal("bash"),
    category: z.literal("provider"),
    factory: toolFactoryNoArgSchema,
  }),
  z.object({
    name: z.string(),
    category: toolEntryCategorySchema,
    factory: toolFactoryWithArgSchema,
  }),
]);
export type ToolEntry = z.infer<typeof toolEntrySchema>;

export const anthropicToolTypeSchema = z.enum(["computer", "bash"]);
export type AnthropicToolType = z.infer<typeof anthropicToolTypeSchema>;

// eslint-disable-next-line zod/require-zod-schema-types
export type AnthropicModelFamily = "claude-3-5" | "claude-3-7";

/**
 * List of all Anthropic-defined tools for all models
 *
 * @see https://docs.anthropic.com/en/docs/agents-and-tools/computer-use#understand-anthropic-defined-tools
 */
// eslint-disable-next-line zod/require-zod-schema-types
export type AnthropicToolVersion = "20241022" | "20250124";

const ANTHROPIC_MODEL_TO_FAMILY: Record<AnthropicModel, AnthropicModelFamily> =
  {
    "claude-3-5-sonnet-latest": "claude-3-5",
    "claude-3-5-sonnet-20241022": "claude-3-5",
    "claude-3-7-sonnet-latest": "claude-3-7",
    "claude-3-7-sonnet-20250219": "claude-3-7",
  };

const ANTHROPIC_TOOL_VERSION_MAP: Record<
  AnthropicModelFamily,
  Record<AnthropicToolType, AnthropicToolVersion>
> = {
  "claude-3-5": {
    computer: "20241022",
    bash: "20241022",
  },
  "claude-3-7": {
    computer: "20250124",
    bash: "20250124",
  },
};

/**
 * Registry for managing and retrieving tools for AI models
 *
 * @private
 */
export class ToolRegistry {
  private tools: Map<string, ToolEntry> = new Map();
  private log: Log;

  constructor() {
    this.log = getLogger();
  }

  /**
   * Registers a new tool with the registry
   *
   * @param key - Unique identifier for the tool
   * @param entry - Tool entry configuration
   * @throws Error if a tool with the same key is already registered
   */
  public registerTool(key: string, entry: ToolEntry) {
    if (this.tools.has(key)) {
      throw new Error(`Tool with key '${key}' already registered`);
    }
    this.tools.set(key, entry);
  }

  /**
   * Retrieves all tools for a specific provider and model
   *
   * @param provider - The provider name
   * @param model - The Anthropic model to get tools for
   * @param browserTool - Browser tool instance
   * @returns Record of tool name to Tool instance
   *
   * @private
   */
  public getTools(
    provider: string,
    model: AnthropicModel | OpenAIModel,
    browserTool: BrowserTool,
  ): Record<string, Tool> {
    const selectedTools: Record<string, Tool> = {};
    const providerTools = this.getProviderTools(provider, model, browserTool);
    const customTools = this.getCustomTools(browserTool);
    Object.assign(selectedTools, providerTools, customTools);

    return selectedTools;
  }

  /**
   * Retrieves all custom tools
   *
   * @param browserTool - Browser tool instance
   * @returns Record of tool name to Tool instance
   *
   * @private
   */
  private getCustomTools(browserTool: BrowserTool): Record<string, Tool> {
    const tools: Record<string, Tool> = {};

    const customTools = Array.from(this.tools.values()).filter(
      (entry) => entry.category === "custom",
    );
    customTools.forEach((entry) => {
      tools[entry.name] = entry.factory(browserTool);
    });

    return tools;
  }

  /**
   * Retrieves all provider-specific tools
   *
   * @param provider - The provider name
   * @param model - The Anthropic model to get tools for
   * @param browserTool - Browser tool instance
   * @returns Record of tool name to Tool instance
   *
   * @private
   */
  private getProviderTools(
    provider: string,
    model: AnthropicModel | OpenAIModel,
    browserTool: BrowserTool,
  ): Record<string, Tool> {
    const tools: Record<string, Tool> = {};

    try {
      const computerToolEntry = this.getProviderToolEntry(
        provider,
        model,
        "computer",
      );
      tools[computerToolEntry.name] = computerToolEntry.factory(browserTool);
    } catch (error) {
      if (!(error instanceof ShortestError)) throw error;
      this.log.trace("Computer tool not found for model, skipping", { model });
    }

    try {
      const bashToolEntry = this.getProviderToolEntry(provider, model, "bash");
      // @ts-ignore
      // For some reason, it expects an argument, but it doesn't take any
      tools["bash"] = bashToolEntry.factory();
    } catch (error) {
      if (!(error instanceof ShortestError)) throw error;
      this.log.trace("Bash tool not found for model, skipping", { model });
    }

    return tools;
  }

  /**
   * Retrieves a specific provider tool entry
   *
   * @param provider - The provider name
   * @param model - The Anthropic model
   * @param toolType - Type of tool to retrieve
   * @returns Tool entry configuration
   * @throws ShortestError if tool not found
   *
   * @private
   */
  private getProviderToolEntry(
    provider: string,
    model: AnthropicModel | OpenAIModel,
    toolType: AnthropicToolType,
  ): ToolEntry {
    let toolEntryKey: string;
    switch (provider) {
      case "anthropic":
        toolEntryKey = this.getAnthropicToolEntryKey(
          provider,
          model as AnthropicModel,
          toolType,
        );
        break;
      case "openai":
        // toolEntryKey = this.getOpenAIToolEntryKey(provider, model as OpenAIModel, toolType);
        throw new ShortestError(`Unsupported yet!`);
        break;
      default:
        throw new ShortestError(`Unsupported provider: ${provider}`);
    }
    const toolEntry = this.tools.get(toolEntryKey);
    if (toolEntry) {
      return toolEntry;
    }
    throw new ShortestError(
      `${toolType} tool not found for key: ${toolEntryKey}`,
    );
  }

  /**
   * Generates the key used to look up tool entries
   * @param provider - The provider name
   * @param model - The Anthropic model
   * @param toolType - Type of tool
   * @returns Tool entry key string
   *
   * @private
   */
  private getAnthropicToolEntryKey(
    provider: string,
    model: AnthropicModel,
    toolType: AnthropicToolType,
  ): string {
    const family = ANTHROPIC_MODEL_TO_FAMILY[model];
    const version = ANTHROPIC_TOOL_VERSION_MAP[family][toolType];
    return `${provider}_${toolType}_${version}`;
  }
}
