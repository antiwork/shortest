import { shortest } from "@antiwork/shortest";

shortest([
  "Visit the homepage",
  "Verify logo and main navigation elements are visible",
  "Click on Sign In button",
  "Enter valid credentials and submit",
  "Verify redirect to dashboard",
]);

shortest([
  "Navigate to pricing page from main menu",
  "Verify pricing cards are displayed",
  "Check pricing tiers and features list",
  "Verify subscription buttons are present",
]);

shortest(
  [
    "Log in to the application",
    "Navigate to dashboard",
    "Use repository filter dropdown",
    "Apply build status filter",
    "Verify filtered pull requests are displayed",
  ],
  { email: process.env.SHORTEST_LOGIN_EMAIL },
);

shortest(
  [
    "Log in to the application",
    "Navigate to settings page",
    "Verify subscription details are visible",
    "Check available subscription management options",
  ],
  { email: process.env.SHORTEST_LOGIN_EMAIL },
);

shortest([
  "Click Sign Up button from homepage",
  "Enter new account details",
  "Submit registration form",
  "Verify successful account creation",
  "Confirm redirect to dashboard",
]);

shortest(
  [
    "Log in to the application",
    "Click on user profile button",
    "Select sign out option",
    "Verify successful logout",
    "Confirm redirect to homepage",
  ],
  { email: process.env.SHORTEST_LOGIN_EMAIL },
);
