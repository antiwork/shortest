import pc from "picocolors";
import { test } from "@/index";

export const main = () => {
  console.log(pc.cyan("\n🧪 Testing Assertion Implementation"));
  console.log(pc.cyan("================================"));

  let failedTests = 0;
  let passedTests = 0;

  try {
    // Test 1: Verify failing assertions are caught
    console.log(pc.cyan("\nTest 1: Verify failing assertions"));
    try {
      test("Test failing assertion", () => {
        expect(true).toBe(false);
      });

      console.log(pc.red("❌ Failed: Assertion should have thrown error"));
      failedTests++;
    } catch (error) {
      console.log(pc.green("✅ Passed: Caught failing assertion"), error);
      passedTests++;
    }

    // Test 2: Verify async assertions
    console.log(pc.cyan("\nTest 2: Verify async assertions"));
    try {
      test("Test async assertion", async () => {
        const result = await Promise.resolve(false);
        expect(result).toBe(true);
      });

      console.log(pc.red("❌ Failed: Async assertion should have thrown"));
      failedTests++;
    } catch (error) {
      console.log(pc.green("✅ Passed: Caught async failing assertion"), error);
      passedTests++;
    }

    // Summary
    console.log(pc.cyan("\n📊 Test Summary"));
    console.log(pc.cyan("============="));
    console.log(pc.green(`Passed: ${passedTests}`));
    console.log(pc.red(`Failed: ${failedTests}`));
  } catch (error) {
    console.error(pc.red("\n❌ Test script failed:"), error);
  }
};
