<p align="center">
  <img src="https://github.com/user-attachments/assets/57d23950-206b-4640-a649-66a175660ade" alt="Shortest logo" width="128" />
</p>

# Shortest

AI-powered natural language end-to-end testing framework.

<video src="https://github.com/user-attachments/assets/d443279e-7364-452b-9f50-0c8dd0cf55fc" controls autoplay loop muted>
Your browser does not support the video tag.
</video>

## Features

- Natural language E2E testing framework
- AI-powered test execution using Anthropic Claude API
- Built on Playwright
- GitHub integration with 2FA support
- Email validation with Mailosaur

## Using Shortest in your project

If helpful, [here's a short video](https://github.com/antiwork/shortest/issues/143#issuecomment-2564488173)!

### Installation

Use the `shortest init` command to streamline the setup process in a new or existing project.

The `shortest init` command will:

```sh
npx @antiwork/shortest init
```

This will:

- Automatically install the `@antiwork/shortest` package as a dev dependency if it is not already installed
- Create a default `shortest.config.ts` file with boilerplate configuration
- Generate a `.env.local` file (unless present) with placeholders for required environment variables, such as `ANTHROPIC_API_KEY`
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
      ignoreHTTPSErrors: true
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

### API testing

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

### CI setup

You can run Shortest in your CI/CD pipeline by running tests in headless mode. Make sure to add your Anthropic API key to your CI/CD pipeline secrets.

[See example here](https://github.com/antiwork/shortest/blob/main/.github/workflows/shortest.yml)

### GitHub 2FA login setup

Shortest supports login using GitHub 2FA. For GitHub authentication tests:

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

## Shortest CLI development

The [NPM package](https://www.npmjs.com/package/@antiwork/shortest) is located in [`packages/shortest/`](./packages/shortest). See [CONTRIBUTING](./packages/shortest/CONTRIBUTING.md) guide.

## Web app development

This guide will help you set up the Shortest web app for local development.

### Prerequisites

- React >=19.0.0 (if using with Next.js 14+ or Server Actions)
- Next.js >=14.0.0 (if using Server Components/Actions)

> [!WARNING]
> Using this package with React 18 in Next.js 14+ projects may cause type conflicts with Server Actions and `useFormStatus`
>
> If you encounter type errors with form actions or React hooks, ensure you're using React 19

### Getting started

1. Clone the repository:

```bash
git clone https://github.com/antiwork/shortest.git
cd shortest
```

2. Install dependencies:

```bash
npm install -g pnpm
pnpm install
```

### Environment setup

#### For Antiwork team members

Pull Vercel env vars:

```bash
pnpm i -g vercel
vercel link
vercel env pull
```

#### For other contributors

1. Run `pnpm run setup` to configure the environment variables.
2. The setup wizard will ask you for information. Refer to "Services Configuration" section below for more details.

### Set up the database

```bash
pnpm drizzle-kit generate
pnpm db:migrate
pnpm db:seed # creates stripe products, currently unused
```

### Services configuration

You'll need to set up the following services for local development. If you're not an Antiwork Vercel team member, you'll need to either run the setup wizard `pnpm run setup` or manually configure each of these services and add the corresponding environment variables to your `.env.local` file:

<details>
<summary>Clerk</summary>

1. Go to [clerk.com](https://clerk.com) and create a new app.
2. Name it whatever you like and **disable all login methods except GitHub**.
   ![Clerk App Login](https://github.com/user-attachments/assets/1de7aebc-8e9d-431a-ae13-af60635307a1)
3. Once created, copy the environment variables to your `.env.local` file.
   ![Clerk Env Variables](https://github.com/user-attachments/assets/df3381e6-017a-4e01-8bd3-5793e5f5d31e)
4. In the Clerk dashboard, disable the "Require the same device and browser" setting to ensure tests with Mailosaur work properly.

</details>

<details>
<summary>Vercel Postgres</summary>

1. Go to your dashboard at [vercel.com](https://vercel.com).
2. Navigate to the Storage tab and click the `Create Database` button.
   ![Vercel Create Database](https://github.com/user-attachments/assets/acdf3ba7-31a6-498b-860c-171018d5ba02)
3. Choose `Postgres` from the `Browse Storage` menu.
   ![Neon Postgres](https://github.com/user-attachments/assets/9ad2a391-5213-4f31-a6c3-b9e54c69bb2e)
4. Copy your environment variables from the `Quickstart` `.env.local` tab.
   ![Vercel Postgres .env.local](https://github.com/user-attachments/assets/e48f1d96-2fd6-4e2e-aaa6-eeb5922cc521)

</details>

<details>
<summary>Anthropic</summary>

1. Go to your dashboard at [anthropic.com](https://anthropic.com) and grab your API Key.
   - Note: If you've never done this before, you will need to answer some questions and likely load your account with a balance. Not much is needed to test the app.
     ![Anthropic API Key](https://github.com/user-attachments/assets/0905ed4b-5815-4d50-bf43-8713a4397674)

</details>

<details>
<summary>Stripe</summary>

1. Go to your `Developers` dashboard at [stripe.com](https://stripe.com).
2. Turn on `Test mode`.
3. Go to the `API Keys` tab and copy your `Secret key`.
   ![Stripe Secret Key](https://github.com/user-attachments/assets/0830b226-f2c2-4b92-a28f-f4682ad03ec0)
4. Go to the terminal of your project and type `pnpm run stripe:webhooks`. It will prompt you to login with a code then give you your `STRIPE_WEBHOOK_SECRET`.
   ![Stripe Webhook Secret](https://github.com/user-attachments/assets/b02531ed-5c31-40ba-8483-32880aa3ca36)

</details>

<details>
<summary>GitHub OAuth</summary>

1. Create a GitHub OAuth App:

   - Go to your GitHub account settings.
   - Navigate to `Developer settings` > `OAuth Apps` > `New OAuth App`.
   - Fill in the application details:
     - **Application name**: Choose any name for your app
     - **Homepage URL**: Set to `http://localhost:3000` for local development
     - **Authorization callback URL**: Use the Clerk-provided callback URL (found in below image)
       ![Github OAuth App](https://github.com/user-attachments/assets/1af635fd-dedc-401c-a45a-159cb20bb209)

2. Configure Clerk with GitHub OAuth:
   - Go to your Clerk dashboard.
   - Navigate to `Configure` > `SSO Connections` > `GitHub`.
   - Select `Use custom credentials`
   - Enter your `Client ID` and `Client Secret` from the GitHub OAuth app you just created.
   - Add `repo` to the `Scopes`
     ![Clerk Custom Credentials](https://github.com/user-attachments/assets/31d414e1-4e1e-4725-8649-ec1826c6e53e)

</details>

<details>
<summary>Mailosaur</summary>

1. [Sign up](https://mailosaur.com/app/signup) for an account with Mailosaur.
2. Create a new Inbox/Server.
3. Go to [API Keys](https://mailosaur.com/app/keys) and create a standard key.
4. Update the environment variables:
   - `MAILOSAUR_API_KEY`: Your API key
   - `MAILOSAUR_SERVER_ID`: Your server ID

The email used to test the login flow will have the format `shortest@<MAILOSAUR_SERVER_ID>.mailosaur.net`, where
`MAILOSAUR_SERVER_ID` is your server ID.
Make sure to add the email as a new user under the Clerk app.

</details>

### Running locally

Run the development server:

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser to see the app in action.
