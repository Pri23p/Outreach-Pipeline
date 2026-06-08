import { loadOceanTemplate } from "../config.js";
import { ConfigurationError } from "../exceptions.js";
import { recursiveTemplateReplace, dedupeBy } from "../utils.js";
import { BaseHttpClient } from "./base.js";

export class OceanClient extends BaseHttpClient {
  constructor({ config, logger }) {
    super({
      logger,
      timeoutMs: config.requestTimeoutMs,
      retryAttempts: config.retryAttempts,
      retryBackoffMs: config.retryBackoffMs,
    });
    this.config = config;
    this.searchUrl = "https://api.ocean.io/v3/search/companies";
  }

  async findLookalikes(seedDomain, limit) {
    if (!this.config.oceanApiToken) {
      throw new ConfigurationError("OCEAN_API_TOKEN is required.");
    }

    const payload = this.buildPayload(seedDomain, limit);
    const companies = [];
    let searchAfter = null;

    while (companies.length < limit) {
      const requestPayload = {
        ...payload,
        size: Math.min(limit - companies.length, payload.size ?? this.config.oceanPageSize),
        ...(searchAfter ? { searchAfter } : {}),
      };

      const response = await this.requestJson("POST", this.searchUrl, {
        headers: {
          "Content-Type": "application/json",
          "X-Api-Token": this.config.oceanApiToken,
        },
        jsonBody: requestPayload,
      });

      const batch = response?.companies ?? [];
      for (const item of batch) {
        const company = item.company ?? {};
        if (!company.domain || company.domain === seedDomain) {
          continue;
        }
        companies.push({
          domain: company.domain,
          name: company.name ?? null,
          description: company.description ?? null,
          primaryCountry: company.primaryCountry ?? null,
          companySize: company.companySize ?? null,
          industries: company.industries ?? [],
          technologies: company.technologies ?? [],
          raw: company,
        });
        if (companies.length >= limit) {
          break;
        }
      }

      searchAfter = response?.searchAfter ?? null;
      if (!batch.length || !searchAfter) {
        break;
      }
    }

    return dedupeBy(companies, (company) => company.domain).slice(0, limit);
  }

  buildPayload(seedDomain, limit) {
    const template = loadOceanTemplate(this.config);
    if (template) {
      const rendered = recursiveTemplateReplace(template, {
        seed_domain: seedDomain,
        limit,
      });
      if (!rendered || typeof rendered !== "object" || Array.isArray(rendered)) {
        throw new ConfigurationError("Ocean request template must render to a JSON object.");
      }
      return rendered;
    }

    return {
      size: Math.min(limit, this.config.oceanPageSize),
      companiesFilters: {
        lookalikeDomains: [seedDomain],
      },
      fields: ["domain", "name", "description", "primaryCountry", "companySize", "industries", "technologies"],
    };
  }
}
