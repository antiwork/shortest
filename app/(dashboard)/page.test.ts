import { shortest } from "@antiwork/shortest";

shortest("Verify that buttons on the landing page are rounded");

shortest("Click on the GitHub link").expect(
  "It opens up the GitHub project page",
);

const loginEmail = `shortest@${process.env.MAILOSAUR_SERVER_ID}.mailosaur.net`;
shortest("Log in", { email: loginEmail }).expect(
  "Check Manage Account page from user icon menu",
);
