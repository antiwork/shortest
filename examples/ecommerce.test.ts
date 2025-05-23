import { shortest } from "@antiwork/shortest";

shortest.beforeAll(async ({ page }) => {
  await page.goto("http://localhost:3000");
  await page.waitForSelector("[data-testid='search-input']");
});

shortest.afterAll(async ({ page }) => {
  const context = page.context();
  await context.clearCookies();
});

shortest.beforeEach(async ({ page }) => {
  await page.goto("http://localhost:3000");
  await page.waitForSelector("[data-testid='search-input']");
});

// Natural language test for product search
shortest("Search for wireless headphones under $200 and verify results");

// Natural language test with configuration
shortest("Add Sony WH-1000XM4 to cart and verify price", {
  productName: "Sony WH-1000XM4",
  expectedPrice: 299.99,
  quantity: 1,
});

// Natural language test with multiple steps
shortest(`
  Search for wireless headphones
  Filter by price range $100-$300
  Sort by customer rating
  Add the highest rated item to cart
  Verify cart total is correct
`);

// Test with error handling
shortest("Test product search with invalid inputs", {
  searchQueries: ["", "@#$%^&*", "very long search query"],
  expectedError: "No results found",
});

// Test with verification steps
shortest("Complete purchase flow", {
  product: {
    name: "Wireless Headphones",
    price: 199.99,
  },
  shipping: {
    address: "123 Main St",
    city: "New York",
    zip: "10001",
  },
  payment: {
    type: "credit_card",
    number: "4242424242424242",
  },
})
  .expect("Product is added to cart")
  .expect("Shipping details are valid")
  .expect("Payment is processed")
  .expect("Order confirmation is received");

// Simple add to cart test
shortest("Add product to cart", async ({ page }) => {
  await page.goto("/product/123");
  await page.getByRole("button", { name: "Add to Cart" }).click();
  await page.getByText("Added to cart").waitFor();
});

// Add to cart test with verification
shortest("Add product to cart and verify", {
  productId: "123",
  quantity: 1,
})
  .expect("Navigate to product page")
  .expect("Add product to cart")
  .expect("Verify cart update", async ({ page }) => {
    await page.getByTestId("add-to-cart").click();
    await page.waitForSelector("[data-testid='cart-count']");
    const cartCount = await page.getByTestId("cart-count").textContent();
    expect(cartCount).toBe("1");
  })
  .after(async ({ page }) => {
    await page.getByTestId("clear-cart").click();
    await page.waitForSelector("[data-testid='empty-cart']");
  }); 