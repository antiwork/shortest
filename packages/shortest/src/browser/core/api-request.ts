import {
  APIRequest as APIRequestType,
  APIRequestConfig,
  APIFetchConfig,
} from "@/types/request";

const generatePrompt = (
  request: APIRequestType,
  config: Partial<APIRequestConfig>,
) => `
        You are about to process an API request. Your goal is to dynamically populate variables (like <Bearer API KEY>) with actual values, either inferred or retrieved. Follow these steps:
        - Analyze the REQUEST OBJECT: extract all necessary values (e.g., HTTP method, headers, authorization tokens).
        - Use the CONFIG OBJECT for the base URL, timeout, headers, storageState (used for cookies) or other reusable settings.
        - Assemble the final bash command using these values and return it as a clean, actionable string.
          Your output should look like a ready-to-execute bash command with no extraneous text.
        - Ensure the bash command uses the appropriate HTTP request package for the operating system:
          - For Linux/macOS, use 'cURL'.
          - For Windows, use 'PowerShell'.
        - Reference to SYSTEM_PROMPT 'Bash Commands' section for additional context on the task.

        REQUEST OBJECT (RequestInit dictionary of the Fetch API): ${JSON.stringify(request)}
        CONFIG OBJECT: ${JSON.stringify(config)}
        IMPORTANT:
          - You MUST NOT modify or process the response data in any way (e.g., jq, grep, or any other way of modifying the original data)/
            Your SOLE responsibility is to create a clean, unmodified bash command for execution.
          - Every single field in the config object MUST be accounted for in the final bash command.
          - DO NOT add any extra flags or arguments or flags unless they are explicitly state in REQUEST OBJECT or CONFIG OBJECT.
        `;

export class APIRequest {
  private config: Partial<APIRequestConfig>;

  constructor(config: Partial<APIRequestConfig> = {}) {
    this.config = config;
  }

  public fetch(
    requestBase: APIRequestType,
    config?: Partial<APIFetchConfig>,
  ): string {
    const request = this.processRequest(requestBase);
    return generatePrompt(request, { ...this.config, ...config });
  }

  private processRequest(request: APIRequestType): APIRequestType {
    if (request.params instanceof URLSearchParams) {
      request.params = request.params.toString();
    }
    return request;
  }
}
