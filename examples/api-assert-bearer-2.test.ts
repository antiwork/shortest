import { shortest, APIRequest } from "@antiwork/shortest";
import { ALLOWED_TEST_BEARER, TESTING_API_BASE_URI } from "@/lib/constants";

const req = new APIRequest({
  baseURL: TESTING_API_BASE_URI,
  extraHTTPHeaders: {
    "Content-Type": "application/json",
  },
});

shortest(
  "Ensure the request without a bearer token returns a message indicating the absence of the token",
  req.fetch({
    url: "/assert-bearer",
    method: "POST",
    body: JSON.stringify({ flagged: "false" }),
  }),
);

shortest(
  `Bearer token is ${ALLOWED_TEST_BEARER}. Ensure the request with a valid bearer token returns request body`,
  req.fetch({
    url: "/assert-bearer",
    method: "POST",
    body: JSON.stringify({ flagged: "true" }),
  }),
);
