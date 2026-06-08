import fs from "node:fs";

import { ConfigurationError } from "./exceptions.js";

function parseCsv(value, fallback) {
  if (!value) {
    return fallback;
  }
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function intFromEnv(name, fallback) {
  const raw = process.env[name];
  return raw ? Number.parseInt(raw, 10) : fallback;
}

function floatFromEnv(name, fallback) {
  const raw = process.env[name];
  return raw ? Number.parseFloat(raw) : fallback;
}

export function loadConfig() {
  return {
    oceanApiToken: process.env.OCEAN_API_TOKEN ?? null,
    oceanRequestTemplateJson: process.env.OCEAN_REQUEST_TEMPLATE_JSON ?? null,
    oceanRequestTemplatePath: process.env.OCEAN_REQUEST_TEMPLATE_PATH ?? null,
    oceanPageSize: intFromEnv("OCEAN_PAGE_SIZE", 25),
    prospeoApiKey: process.env.PROSPEO_API_KEY ?? null,
    prospeoSeniorities: parseCsv(process.env.PROSPEO_SENIORITIES, ["C-Suite", "Founder/Owner", "Vice President"]),
    prospeoPageLimit: intFromEnv("PROSPEO_PAGE_LIMIT", 4),
    brevoApiKey: process.env.BREVO_API_KEY ?? null,
    brevoSenderName: process.env.BREVO_SENDER_NAME ?? null,
    brevoSenderEmail: process.env.BREVO_SENDER_EMAIL ?? null,
    brevoReplyTo: process.env.BREVO_REPLY_TO ?? null,
    brevoTags: parseCsv(process.env.BREVO_TAGS, ["vocallabs-outreach"]),
    maxCompaniesDefault: intFromEnv("MAX_COMPANIES", 10),
    contactsPerCompanyDefault: intFromEnv("CONTACTS_PER_COMPANY", 2),
    requestTimeoutMs: intFromEnv("REQUEST_TIMEOUT_MS", 30000),
    retryAttempts: intFromEnv("RETRY_ATTEMPTS", 3),
    retryBackoffMs: floatFromEnv("RETRY_BACKOFF_MS", 1500),
    runRoot: process.env.RUN_ROOT ?? "runs",
  };
}

export function loadOceanTemplate(config) {
  if (config.oceanRequestTemplateJson) {
    return JSON.parse(config.oceanRequestTemplateJson);
  }
  if (config.oceanRequestTemplatePath) {
    return JSON.parse(fs.readFileSync(config.oceanRequestTemplatePath, "utf8"));
  }
  return null;
}

export function validatePipelineConfig(config) {
  const missing = [];
  if (!config.oceanApiToken) missing.push("OCEAN_API_TOKEN");
  if (!config.prospeoApiKey) missing.push("PROSPEO_API_KEY");
  if (missing.length) {
    throw new ConfigurationError(`Missing pipeline configuration: ${missing.join(", ")}`);
  }
}

export function validateBrevoConfig(config) {
  const missing = [];
  if (!config.brevoApiKey) missing.push("BREVO_API_KEY");
  if (!config.brevoSenderName) missing.push("BREVO_SENDER_NAME");
  if (!config.brevoSenderEmail) missing.push("BREVO_SENDER_EMAIL");
  if (missing.length) {
    throw new ConfigurationError(`Missing send configuration: ${missing.join(", ")}`);
  }
}
