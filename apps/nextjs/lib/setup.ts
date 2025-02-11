import { exec } from "node:child_process";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import readline from "node:readline";
import { promisify } from "node:util";

const execAsync = promisify(exec);

function question(query: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) =>
    rl.question(query, (ans) => {
      rl.close();
      resolve(ans);
    }),
  );
}

async function checkStripeCLI() {
  console.log(
    "Step 1: Checking if Stripe CLI is installed and authenticated...",
  );
  try {
    await execAsync("stripe --version");
    console.log("Stripe CLI is installed.");

    // Check if Stripe CLI is authenticated
    try {
      await execAsync("stripe config --list");
      console.log("Stripe CLI is authenticated.");
    } catch (error) {
      console.log(
        `Stripe CLI is not authenticated or the authentication has expired. ${error}`,
      );
      console.log("Please run: stripe login");
      const answer = await question(
        "Have you completed the authentication? (y/n): ",
      );
      if (answer.toLowerCase() !== "y") {
        console.log(
          "Please authenticate with Stripe CLI and run this script again.",
        );
        process.exit(1);
      }

      // Verify authentication after user confirms login
      try {
        await execAsync("stripe config --list");
        console.log("Stripe CLI authentication confirmed.");
      } catch (error) {
        console.error(`Failed to verify Stripe CLI authentication. ${error}`);
        process.exit(1);
      }
    }
  } catch (error) {
    console.error(`Stripe CLI is not installed. ${error}`);
    console.log("To install Stripe CLI, follow these steps:");
    console.log("1. Visit: https://docs.stripe.com/stripe-cli");
    console.log(
      "2. Download and install the Stripe CLI for your operating system. Remember to add it to your PATH.",
    );
    console.log("3. After installation, run: stripe login");
    console.log(
      "After installation and authentication, please run this setup script again.",
    );
    process.exit(1);
  }
}

async function setupPostgresConfig(): Promise<Object> {
  console.log("Step 2: Setting up Postgres");
  const dbChoice = await question(
    "Do you want to use a local Postgres instance with Docker (L) or a remote Postgres instance using Vercel Postgres (R)? (L/R): ",
  );

  if (dbChoice.toLowerCase() === "l") {
    console.log("Setting up local Postgres instance with Docker...");
    const postgresConfig = await setupLocalPostgres();
    return postgresConfig;
  } else {
    console.log(
      "You can find your Postgres environment variables at your Vercel project dashboard: https://vercel.com/dashboard Refer to the README.md for more details.",
    );
    const POSTGRES_URL = await question("Enter your POSTGRES_URL: ");
    const POSTGRES_URL_NO_SSL = await question(
      "Enter your POSTGRES_URL_NO_SSL: ",
    );
    const POSTGRES_URL_NON_POOLING = await question(
      "Enter your POSTGRES_URL_NON_POOLING: ",
    );
    const POSTGRES_USER = await question("Enter your POSTGRES_USER: ");
    const POSTGRES_HOST = await question("Enter your POSTGRES_HOST: ");
    const POSTGRES_PASSWORD = await question("Enter your POSTGRES_PASSWORD: ");
    const POSTGRES_DATABASE = await question("Enter your POSTGRES_DATABASE: ");

    const postgresConfig = {
      POSTGRES_URL,
      POSTGRES_URL_NO_SSL,
      POSTGRES_URL_NON_POOLING,
      POSTGRES_USER,
      POSTGRES_HOST,
      POSTGRES_PASSWORD,
      POSTGRES_DATABASE,
    };
    return postgresConfig;
  }
}

async function setupLocalPostgres() {
  console.log("Checking if Docker is installed and running...");
  try {
    // Check Docker version
    const { stdout: dockerVersion } = await execAsync("docker --version");
    console.log(`Docker is installed: ${dockerVersion.trim()}`);

    // Check if Docker daemon is running
    await execAsync("docker info");
    console.log("Docker daemon is running.");
  } catch (error) {
    console.error("Error checking Docker:", error);
    console.error("Docker is not installed or not running properly.");
    console.log(
      "To install Docker, visit: https://docs.docker.com/get-docker/",
    );
    console.log(
      "Make sure Docker is installed and the Docker daemon is running.",
    );
    process.exit(1);
  }

  console.log("Setting up local Postgres...");
  const dbUser =
    (await question("Enter the Postgres user name (default: postgres): ")) ||
    "postgres";
  const dbPassword =
    (await question("Enter the Postgres password (default: postgres): ")) ||
    "postgres";
  const dbName =
    (await question(
      "Enter the Postgres database name (default: postgres): ",
    )) || "postgres";

  console.log("Creating docker-compose.yml file...");
  const dockerComposeContent = `
services:
  postgres:
    image: postgres:16.4-alpine
    container_name: shortest_postgres
    environment:
      POSTGRES_DB: ${dbName}
      POSTGRES_USER: ${dbUser}
      POSTGRES_PASSWORD: ${dbPassword}
    ports:
      - "54322:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

volumes:
  postgres_data:
`;

  await fs.writeFile(
    path.join(process.cwd(), "docker-compose.yml"),
    dockerComposeContent,
  );
  console.log("docker-compose.yml file created.");

  console.log("Starting Docker container with `docker compose up -d`...");
  try {
    await execAsync("docker compose up -d");
    console.log("Docker container started successfully.");

    // Extract PostgreSQL environment variables from the Docker container
    const { stdout: containerName } = await execAsync(
      "docker compose ps -q postgres",
    );
    const postgresContainer = containerName.trim();

    const getEnvVar = async (varName: string) => {
      const { stdout } = await execAsync(
        `docker exec ${postgresContainer} printenv ${varName}`,
      );
      return stdout.trim();
    };

    const POSTGRES_USER = await getEnvVar("POSTGRES_USER");
    const POSTGRES_PASSWORD = await getEnvVar("POSTGRES_PASSWORD");
    const POSTGRES_DATABASE = await getEnvVar("POSTGRES_DB");
    const POSTGRES_HOST = "localhost"; // We use localhost since we're port forwarding
    const POSTGRES_PORT = "54322"; // The port we're forwarding to

    return {
      POSTGRES_URL: `postgres://${POSTGRES_USER}:${POSTGRES_PASSWORD}@${POSTGRES_HOST}:${POSTGRES_PORT}/${POSTGRES_DATABASE}`,
      POSTGRES_URL_NO_SSL: `postgres://${POSTGRES_USER}:${POSTGRES_PASSWORD}@${POSTGRES_HOST}:${POSTGRES_PORT}/${POSTGRES_DATABASE}?sslmode=disable`,
      POSTGRES_URL_NON_POOLING: `postgres://${POSTGRES_USER}:${POSTGRES_PASSWORD}@${POSTGRES_HOST}:${POSTGRES_PORT}/${POSTGRES_DATABASE}?sslmode=disable&connection_limit=1`,
      POSTGRES_USER,
      POSTGRES_PASSWORD,
      POSTGRES_HOST,
      POSTGRES_DATABASE,
    };
  } catch (error) {
    console.error(
      `Failed to start Docker container or extract environment variables. ${error}`,
    );
    process.exit(1);
  }
}

async function promptForStripeSecretKey(): Promise<string> {
  console.log("Step 3: Getting Stripe Secret Key");
  console.log(
    "You can find your Stripe Secret Key at: https://dashboard.stripe.com/test/apikeys Refer to the README.md for more details.",
  );
  return await question("Enter your Stripe Secret Key: ");
}

async function setupStripeWebhook(): Promise<string> {
  console.log("Step 4: Creating Stripe webhook...");
  try {
    const { stdout } = await execAsync("stripe listen --print-secret");
    const match = stdout.match(/whsec_[a-zA-Z0-9]+/);
    if (!match) {
      throw new Error("Failed to extract Stripe webhook secret");
    }
    console.log("Stripe webhook created.");
    return match[0];
  } catch (error) {
    console.error(
      "Failed to create Stripe webhook. Check your Stripe CLI installation and permissions.",
    );
    if (os.platform() === "win32") {
      console.log(
        "Note: On Windows, you may need to run this script as an administrator.",
      );
    }
    throw error;
  }
}

async function promptForClerkKeys(): Promise<{
  publishableKey: string;
  secretKey: string;
}> {
  console.log("Step 5: Getting Clerk Keys");
  console.log(
    "You can find your Clerk keys at: https://dashboard.clerk.com/ Refer to the README.md for more details.",
  );
  const publishableKey = await question("Enter your Clerk Publishable Key: ");
  const secretKey = await question("Enter your Clerk Secret Key: ");
  return { publishableKey, secretKey };
}

async function promptForAnthropicApiKey(): Promise<string> {
  console.log("Step 6: Getting Anthropic API Key");
  console.log(
    "You can find your Anthropic API Key at: https://www.anthropic.com/ Refer to the README.md for more details.",
  );
  return await question("Enter your Anthropic API Key: ");
}

async function promptForGitHubOAuth(): Promise<void> {
  console.log("Step 7: Setting up GitHub OAuth");
  console.log("Create a GitHub OAuth App as described in the README.md file.");
  console.log('Check "Github OAuth" section for more details.');

  const confirmed = await question("Have you completed these steps? (y/n): ");
  if (confirmed.toLowerCase() !== "y") {
    console.log("Please complete the GitHub OAuth setup before continuing.");
    process.exit(1);
  }
}

async function promptForGitHubTOTP(): Promise<string | undefined> {
  console.log("\nStep 8: GitHub 2FA TOTP Setup (Optional)");
  console.log(
    "If you want to test GitHub 2FA login, you'll need to add a TOTP secret.",
  );

  const setupNow = await question(
    "Would you like to set up GitHub 2FA TOTP now? (y/n): ",
  );

  if (setupNow.toLowerCase() === "y") {
    return await question(
      "Enter your GitHub TOTP secret (from repo settings > Password and Authentication): ",
    );
  }
  return undefined;
}

async function writeEnvFile(envVars: Record<string, string>) {
  console.log("Step 8: Writing environment variables to .env.local");
  const envContent = Object.entries(envVars)
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");

  await fs.writeFile(path.join(process.cwd(), ".env.local"), envContent);
  console.log(".env.local file created with the necessary variables.");
}

async function main() {
  await checkStripeCLI();

  const postgresConfig = await setupPostgresConfig();
  const {
    POSTGRES_URL,
    POSTGRES_URL_NO_SSL,
    POSTGRES_URL_NON_POOLING,
    POSTGRES_USER,
    POSTGRES_HOST,
    POSTGRES_PASSWORD,
    POSTGRES_DATABASE,
  } = postgresConfig as {
    POSTGRES_URL: string;
    POSTGRES_URL_NO_SSL: string;
    POSTGRES_URL_NON_POOLING: string;
    POSTGRES_USER: string;
    POSTGRES_HOST: string;
    POSTGRES_PASSWORD: string;
    POSTGRES_DATABASE: string;
  };

  const STRIPE_SECRET_KEY = await promptForStripeSecretKey();
  const STRIPE_WEBHOOK_SECRET = await setupStripeWebhook();
  const {
    publishableKey: NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
    secretKey: CLERK_SECRET_KEY,
  } = await promptForClerkKeys();
  const ANTHROPIC_API_KEY = await promptForAnthropicApiKey();
  await promptForGitHubOAuth();
  const GITHUB_TOTP_SECRET = (await promptForGitHubTOTP()) || "";
  const CLERK_SIGN_IN_FALLBACK_REDIRECT_URL = "/dashboard";
  const CLERK_SIGN_UP_FALLBACK_REDIRECT_URL = "/dashboard";
  const NEXT_PUBLIC_CLERK_SIGN_IN_URL = "/signin";
  const NEXT_PUBLIC_CLERK_SIGN_UP_URL = "/signup";
  const NEXT_PUBLIC_CLERK_SIGN_IN_FORCE_REDIRECT_URL = "/dashboard";

  await writeEnvFile({
    CLERK_SIGN_IN_FALLBACK_REDIRECT_URL,
    CLERK_SIGN_UP_FALLBACK_REDIRECT_URL,
    NEXT_PUBLIC_CLERK_SIGN_IN_URL,
    NEXT_PUBLIC_CLERK_SIGN_UP_URL,
    STRIPE_SECRET_KEY,
    STRIPE_WEBHOOK_SECRET,
    NEXT_PUBLIC_CLERK_SIGN_IN_FORCE_REDIRECT_URL,
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
    CLERK_SECRET_KEY,
    POSTGRES_URL,
    POSTGRES_URL_NO_SSL,
    POSTGRES_URL_NON_POOLING,
    POSTGRES_USER,
    POSTGRES_HOST,
    POSTGRES_PASSWORD,
    POSTGRES_DATABASE,
    ANTHROPIC_API_KEY,
    GITHUB_TOTP_SECRET,
  });

  console.log("🎉 Setup completed successfully!");
}

main().catch(console.error);
