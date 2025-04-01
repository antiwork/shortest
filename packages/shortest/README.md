# Shortest

AI-powered natural language end-to-end testing framework.

## Features

- Natural language test writing
- AI-powered test execution using Claude computer use API
- Built on Playwright
- GitHub integration with 2FA support

### Installation

Use the `shortest init` command to streamline the setup process in a new or existing project.

The `shortest init` command will:

```sh
npx @antiwork/shortest init
```

This will:

- Automatically install the `@antiwork/shortest` package as a dev dependency if it is not already installed
- Create a default `shortest.config.ts` file with boilerplate configuration
- Generate a `.env.local` file (unless present) with placeholders for required environment variables, such as
  `SHORTEST_ANTHROPIC_API_KEY` or `ANTHROPIC_API_KEY`
- Add `.env.local` and `.shortest/` to `.gitignore`

### Quick start

1. Determine your test entry and add your Anthropic API key in config file: `shortest.config.ts`

```typescript
import type { ShortestConfig } from "@antiwork/shortest";

export default {
  headless: false,
  baseUrl: "http://localhost:3000",
  browser: {
    contextOptions: {
      ignoreHTTPSErrors: true,
    },
  },
  testPattern: "**/*.test.ts",
  ai: {
    provider: "anthropic",
  },
} satisfies ShortestConfig;
```
The Anthropic API key defaults to `SHORTEST_ANTHROPIC_API_KEY` / `ANTHROPIC_API_KEY` environment variables. Can be overwritten via `ai.config.apiKey`.

Optionally, you can configure browser behavior using the `browser.contextOptions` property in your configuration file. This allows you to pass custom [Playwright browser context options](https://playwright.dev/docs/api/class-browser#browser-new-context).

2. Create test files using the pattern specified in the config: `app/login.test.ts`

```typescript
import { shortest } from "@antiwork/shortest";

shortest("Login to the app using email and password", {
  username: process.env.GITHUB_USERNAME,
  password: process.env.GITHUB_PASSWORD,
});
```

### Using callback functions

You can also use callback functions to add additional assertions and other logic. AI will execute the callback function after the test
execution in browser is completed.

```typescript
import { shortest } from "@antiwork/shortest";
import { db } from "@/lib/db/drizzle";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

shortest("Login to the app using username and password", {
  username: process.env.USERNAME,
  password: process.env.PASSWORD,
}).after(async ({ page }) => {
  // Get current user's clerk ID from the page
  const clerkId = await page.evaluate(() => {
    return window.localStorage.getItem("clerk-user");
  });

  if (!clerkId) {
    throw new Error("User not found in database");
  }

  // Query the database
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.clerkId, clerkId))
    .limit(1);

  expect(user).toBeDefined();
});
```

### Lifecycle hooks

You can use lifecycle hooks to run code before and after the test.

```typescript
import { shortest } from "@antiwork/shortest";

shortest.beforeAll(async ({ page }) => {
  await clerkSetup({
    frontendApiUrl:
      process.env.PLAYWRIGHT_TEST_BASE_URL ?? "http://localhost:3000",
  });
});

shortest.beforeEach(async ({ page }) => {
  await clerk.signIn({
    page,
    signInParams: {
      strategy: "email_code",
      identifier: "iffy+clerk_test@example.com",
    },
  });
});

shortest.afterEach(async ({ page }) => {
  await page.close();
});

shortest.afterAll(async ({ page }) => {
  await clerk.signOut({ page });
});
```

### Chaining tests

Shortest supports flexible test chaining patterns:

```typescript
// Sequential test chain
shortest([
  "user can login with email and password",
  "user can modify their account-level refund policy",
]);

// Reusable test flows
const loginAsLawyer = "login as lawyer with valid credentials";
const loginAsContractor = "login as contractor with valid credentials";
const allAppActions = ["send invoice to company", "view invoices"];

// Combine flows with spread operator
shortest([loginAsLawyer, ...allAppActions]);
shortest([loginAsContractor, ...allAppActions]);
```

Shortest's style allows non-engineers such as designers, marketers, and PMs to write tests. Here are some examples:

```typescript
shortest("visit every page and ensure no typos");
shortest("visit every page and ensure mobile layout isn't janky");
shortest("visit every page and ensure dark mode is considered");
```

### API Testing

Test API endpoints using natural language

```typescript
const req = new APIRequest({
  baseURL: API_BASE_URI,
});

shortest(
  "Ensure the response contains only active users",
  req.fetch({
    url: "/users",
    method: "GET",
    params: new URLSearchParams({
      active: true,
    }),
  }),
);
```

Or simply:

```typescript
shortest(`
  Test the API GET endpoint ${API_BASE_URI}/users with query parameter { "active": true }
  Expect the response to contain only active users
`);
```

### Running tests

```bash
pnpm shortest                   # Run all tests
pnpm shortest login.test.ts     # Run specific tests from a file
pnpm shortest login.test.ts:23  # Run specific test from a file using a line number
pnpm shortest --headless        # Run in headless mode using
```

You can find example tests in the [`examples`](./examples) directory.

### GitHub 2FA login setup

Shortest currently supports login using Github 2FA. For GitHub authentication tests:

1. Go to your repository settings
2. Navigate to "Password and Authentication"
3. Click on "Authenticator App"
4. Select "Use your authenticator app"
5. Click "Setup key" to obtain the OTP secret
6. Add the OTP secret to your `.env.local` file or use the Shortest CLI to add it
7. Enter the 2FA code displayed in your terminal into Github's Authenticator setup page to complete the process

```bash
shortest --github-code --secret=<OTP_SECRET>
```

### Environment setup

Required in `.env.local`:

```bash
ANTHROPIC_API_KEY=your_api_key
GITHUB_TOTP_SECRET=your_secret  # Only for GitHub auth tests
```

### CI setup

You can run Shortest in your CI/CD pipeline by running tests in headless mode. Make sure to add your Anthropic API key to your CI/CD pipeline secrets.

## Resources

- Visit [GitHub](https://github.com/antiwork/shortest) for detailed docs
- [Contributing guide](./CONTRIBUTING.md)
- [Changelog](https://github.com/antiwork/shortest/releases)

### Prerequisites

- React >=19.0.0 (if using with Next.js 14+ or Server Actions)
- Next.js >=14.0.0 (if using Server Components/Actions)

> [!WARNING]
> Using this package with React 18 in Next.js 14+ projects may cause type conflicts with Server Actions and `useFormStatus`
> If you encounter type errors with form actions or React hooks, ensure you're using React 19
