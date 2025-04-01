import { shortest } from "@/index";

shortest(
  "Visit github.com and verify the global navigation header layout. Check GitHub logo, search bar, navigation items (Pull requests, Issues, Marketplace, Explore), and profile dropdown maintain correct spacing and alignment",
  {
    url: "https://github.com",
    regions: [
      "header.Header-old",
      ".header-search-button",
      ".AppHeader-globalBar",
    ],
    tolerance: 0.1,
  },
);

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

const ALLOWED_TEST_BEARER = "Bearer 1234567890";
const TESTING_API_BASE_URI = "https://api.example.com";

shortest(
  `Test the API POST endpoint ${TESTING_API_BASE_URI}/assert-bearer with body { "flagged": "false" } without providing a bearer token.`,
).expect("Expect the response to indicate that the token is missing");

shortest(`
  Test the API POST endpoint ${TESTING_API_BASE_URI}/assert-bearer with body { "flagged": "true" } and the bearer token ${ALLOWED_TEST_BEARER}.
  Expect the response to show "flagged": true
`).expect("True to be true");
