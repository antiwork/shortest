// TODO: Update to use Vercel AI SDK
// import Anthropic from "@anthropic-ai/sdk";
// import { SYSTEM_PROMPT } from "@/ai/prompts";
// import { BrowserTool } from "@/browser/core/browser-tool";
// import { BrowserManager } from "@/browser/manager";
// import { getConfig, initializeConfig } from "@/index";

// export async function main() {
//   const browserManager = new BrowserManager(getConfig());
//   const messages: Anthropic.Beta.Messages.BetaMessageParam[] = [];

//   const apiKey = process.env.ANTHROPIC_API_KEY;
//   if (!apiKey) {
//     console.error("Error: Anthropic API key not found in environment");
//     process.exit(1);
//   }

//   const anthropic = new Anthropic({
//     apiKey,
//   });

//   try {
//     await initializeConfig();
//     console.log("🚀 Launching browser...");
//     const context = await browserManager.launch();
//     const page = context.pages()[0];

//     const browserTool = new BrowserTool(page, browserManager, {
//       width: 1920,
//       height: 940,
//     });

//     // Simple test prompt
//     const testPrompt = `Validate the sign in functionality of the website you see`;

//     // Initial message
//     messages.push({
//       role: "user",
//       content: testPrompt,
//     });

//     while (true) {
//       try {
//         await new Promise((resolve) => setTimeout(resolve, 1000));

//         const response = await anthropic.beta.messages.create({
//           model: "claude-3-5-sonnet-20241022",
//           max_tokens: 1024,
//           messages,
//           system: SYSTEM_PROMPT,
//           tools: [
//             {
//               type: "computer_20241022",
//               name: "computer",
//               display_width_px: 1920,
//               display_height_px: 1080,
//               display_number: 1,
//             },
//           ],
//           betas: ["computer-use-2024-10-22"],
//         });

//         console.log("🤖 Assistant:", response.content);

//         // Add assistant's response to history
//         messages.push({
//           role: "assistant",
//           content: response.content,
//         });

//         // Check for tool use
//         if (response.stop_reason === "tool_use") {
//           const toolResults = response.content
//             .filter((block) => block.type === "tool_use")
//             .map((block) => {
//               const toolBlock =
//                 block as Anthropic.Beta.Messages.BetaToolUseBlock;
//               console.log("🔧 Tool Use:", toolBlock.name, toolBlock.input);

//               return {
//                 toolBlock,
//                 result: browserTool.execute(toolBlock.input as any),
//               };
//             });

//           const results = await Promise.all(toolResults.map((t) => t.result));

//           // Add tool results to message history with proper typing
//           messages.push({
//             role: "user",
//             content: results.map(
//               (result, index) =>
//                 ({
//                   type: "tool_result" as const,
//                   tool_use_id: toolResults[index].toolBlock.id,
//                   content: result.base64_image
//                     ? [
//                         {
//                           type: "image" as const,
//                           source: {
//                             type: "base64" as const,
//                             media_type: "image/jpeg" as const,
//                             data: result.base64_image,
//                           },
//                         },
//                       ]
//                     : [
//                         {
//                           type: "text" as const,
//                           text: result.output || "",
//                         },
//                       ],
//                 }) as Anthropic.Beta.Messages.BetaToolResultBlockParam,
//             ),
//           });

//           console.log("🛠️ Tool Results:", results);
//         } else {
//           console.log("✅ Test complete");
//           break;
//         }
//       } catch (error: any) {
//         if (error.message?.includes("rate_limit")) {
//           console.log("⏳ Rate limited, waiting 60s...");
//           await new Promise((resolve) => setTimeout(resolve, 60000));
//           continue;
//         }
//         throw error;
//       }
//     }
//   } catch (error) {
//     console.error("❌ Test failed:", error);
//   } finally {
//     console.log("\n🧹 Cleaning up...");
//     await browserManager.close();
//   }
// }

// console.log("🧪 Browser Integration Test");
// console.log("===========================");
