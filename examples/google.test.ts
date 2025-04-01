import { shortest } from "@antiwork/shortest";

shortest.beforeAll(async ({ page }) => {
  await page.goto("https://google.com");
  const acceptButton = await page.$("[aria-label='Accept all']");
  if (acceptButton) await acceptButton.click();
});

shortest.afterAll(async ({ page }) => {
  const context = page.context();
  await context.clearCookies();
});

shortest.beforeEach(async ({ page }) => {
  await page.goto("https://google.com");
  await page.waitForSelector("[aria-label='Search']");
});

// Basic search test with callback
shortest(
  "Perform a Google search for 'shortest test framework'",
  async ({ page }) => {
    await page.getByLabel("Search").click();
    await page.keyboard.type("shortest test framework");
    await page.keyboard.press("Enter");
  },
);

// Test with error handling and custom assertions
shortest("Test Google's error handling for invalid searches", {
  searchQueries: ["@#$%^&*", "≈∆˚¬≤µµ˜∫", ""],
})
  .expect("Enter special characters and verify error handling")
  .expect("Check error message visibility", async ({ page }) => {
    const errorMsg = await page
      .getByRole("heading", { level: 1 })
      .textContent();
    expect(errorMsg).toContain("did not match any documents");
  });

// Advanced search with multiple steps and payload
shortest("Test Google's advanced search features", {
  searchParams: {
    query: "javascript testing",
    exactPhrase: "end to end testing",
    excludeWords: "selenium",
    fileType: "pdf",
    lastUpdate: "past year",
  },
})
  .expect("Access advanced search")
  .expect("Fill advanced search form with payload data")
  .expect("Verify search results match criteria", async ({ page }) => {
    const results = await page.$$(".g");
    for (const result of results.slice(0, 5)) {
      const text = (await result.textContent()) || "";
      expect(text.toLowerCase()).toContain("pdf");
    }
  })
  .after(async ({ page }) => {
    await page.goto("https://google.com/preferences");
    await page.getByRole("button", { name: "Reset" }).click();
  });
