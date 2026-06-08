#!/usr/bin/env node

import { loadConfig } from "./config.js";
import { PipelineError, UserAborted } from "./exceptions.js";
import { createLogger } from "./logger.js";
import { OutreachPipeline } from "./pipeline.js";
import { loadDotEnv, normalizeDomain } from "./utils.js";

function printHelp() {
  console.log(`usage: outreach-pipeline [options] <seed_domain>

Run the Ocean.io -> Prospeo -> Eazyreach -> Brevo outreach pipeline.

options:
  --max-companies <n>          Maximum number of lookalike companies to process.
  --contacts-per-company <n>   Maximum Prospeo contacts to keep per company.
  --dry-run                    Run enrichment and draft generation, but skip Brevo sends.
  --yes                        Skip the send confirmation prompt.
  -h, --help                   Show help.
`);
}

function parseArgs(argv) {
  const options = {
    maxCompanies: null,
    contactsPerCompany: null,
    dryRun: false,
    autoConfirm: false,
    seedDomain: null,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "-h" || arg === "--help") {
      printHelp();
      process.exit(0);
    }
    if (arg === "--dry-run") {
      options.dryRun = true;
      continue;
    }
    if (arg === "--yes") {
      options.autoConfirm = true;
      continue;
    }
    if (arg === "--max-companies") {
      options.maxCompanies = Number.parseInt(argv[++i], 10);
      continue;
    }
    if (arg === "--contacts-per-company") {
      options.contactsPerCompany = Number.parseInt(argv[++i], 10);
      continue;
    }
    if (arg.startsWith("--")) {
      throw new Error(`Unknown option: ${arg}`);
    }
    if (!options.seedDomain) {
      options.seedDomain = normalizeDomain(arg);
      continue;
    }
    throw new Error(`Unexpected argument: ${arg}`);
  }

  if (!options.seedDomain) {
    throw new Error("A seed domain is required.");
  }

  return options;
}

async function main() {
  loadDotEnv();
  const parsed = parseArgs(process.argv.slice(2));
  const config = loadConfig();
  const logger = createLogger();
  const pipeline = new OutreachPipeline({ config, logger });

  const options = {
    seedDomain: parsed.seedDomain,
    maxCompanies: parsed.maxCompanies ?? config.maxCompaniesDefault,
    contactsPerCompany: parsed.contactsPerCompany ?? config.contactsPerCompanyDefault,
    dryRun: parsed.dryRun,
    autoConfirm: parsed.autoConfirm,
  };

  try {
    const result = await pipeline.run(options);
    const sent = result.sendResults.filter((item) => item.success).length;
    const failed = result.sendResults.filter((item) => !item.success).length;
    console.log(`Run complete. Artifacts saved to ${result.runDir}`);
    console.log(`Prospects ready: ${result.prospects.length} | Emails sent: ${sent} | Send failures: ${failed}`);
    process.exit(0);
  } catch (error) {
    if (error instanceof UserAborted) {
      logger.warn(error.message);
      process.exit(2);
    }
    if (error instanceof PipelineError) {
      logger.error(error.message);
      process.exit(1);
    }
    logger.error(`Unexpected failure: ${error.message}`);
    process.exit(1);
  }
}

main();
