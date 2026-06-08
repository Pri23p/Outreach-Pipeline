import test from "node:test";
import assert from "node:assert/strict";

import { normalizeDomain, recursiveTemplateReplace } from "../src/utils.js";

test("normalizeDomain handles full URLs", () => {
  assert.equal(normalizeDomain("https://www.example.com/path"), "example.com");
});

test("recursiveTemplateReplace updates nested values", () => {
  const rendered = recursiveTemplateReplace(
    {
      seed: "{{seed_domain}}",
      nested: {
        items: ["{{seed_domain}}", "{{limit}}"],
      },
    },
    {
      seed_domain: "example.com",
      limit: 5,
    },
  );

  assert.deepEqual(rendered, {
    seed: "example.com",
    nested: {
      items: ["example.com", "5"],
    },
  });
});
