import test from "node:test";
import assert from "node:assert/strict";

import { buildEmailDraft } from "../src/emailCopy.js";

test("buildEmailDraft personalizes the outreach copy", () => {
  const draft = buildEmailDraft({
    company: {
      domain: "acme.com",
      name: "Acme",
      description: "Acme helps sales teams move faster with structured outbound operations.",
      primaryCountry: "United States",
    },
    contact: {
      companyDomain: "acme.com",
      companyName: "Acme",
      fullName: "Jane Doe",
      firstName: "Jane",
      title: "VP Sales",
      linkedinUrl: "https://www.linkedin.com/in/janedoe",
    },
    resolvedEmail: {
      email: "jane@acme.com",
      verification: "verified",
      source: "eazyreach",
    },
  });

  assert.match(draft.subject, /Acme/);
  assert.match(draft.textBody, /Jane/);
  assert.match(draft.textBody, /VP Sales/);
  assert.match(draft.textBody, /Acme helps sales teams move faster/);
});
