import { ApiError, ConfigurationError } from "../exceptions.js";
import { dedupeBy } from "../utils.js";
import { BaseHttpClient } from "./base.js";

export class ProspeoClient extends BaseHttpClient {
  constructor({ config, logger }) {
    super({
      logger,
      timeoutMs: config.requestTimeoutMs,
      retryAttempts: config.retryAttempts,
      retryBackoffMs: config.retryBackoffMs,
    });
    this.config = config;
    this.searchUrl = "https://api.prospeo.io/search-person";
  }

  async findContactsForCompany(domain, targetCount) {
    if (!this.config.prospeoApiKey) {
      throw new ConfigurationError("PROSPEO_API_KEY is required.");
    }

    const contacts = [];
    for (let page = 1; page <= this.config.prospeoPageLimit; page += 1) {
      const response = await this.requestJson("POST", this.searchUrl, {
        headers: {
          "Content-Type": "application/json",
          "X-KEY": this.config.prospeoApiKey,
        },
        jsonBody: {
          page,
          filters: {
            company: {
              websites: {
                include: [domain],
              },
            },
            person_seniority: {
              include: this.config.prospeoSeniorities,
            },
          },
        },
        allowedStatuses: [200, 400],
      });

      if (response?.error === true) {
        if (response?.error_code === "NO_RESULTS") {
          return [];
        }
        throw new ApiError(`Prospeo search failed for ${domain}: ${response?.error_code ?? "unknown error"}`, {
          payload: response,
        });
      }

      for (const item of response?.results ?? []) {
        const person = item.person ?? {};
        const company = item.company ?? {};
        if (!person.linkedin_url || !person.full_name) {
          continue;
        }

        contacts.push({
          companyDomain: domain,
          companyName: company.name ?? company.legal_name ?? company.domain ?? null,
          personId: person.person_id ?? null,
          fullName: person.full_name,
          firstName: person.first_name ?? null,
          lastName: person.last_name ?? null,
          title: person.current_job_title ?? null,
          seniority: person.job_history?.[0]?.seniority ?? null,
          linkedinUrl: person.linkedin_url,
          raw: item,
        });

        if (contacts.length >= targetCount) {
          break;
        }
      }

      if (contacts.length >= targetCount) {
        break;
      }

      const totalPage = Number(response?.pagination?.total_page ?? page);
      if (page >= totalPage) {
        break;
      }
    }

    return dedupeBy(contacts, (contact) => (contact.linkedinUrl || contact.personId || contact.fullName).toLowerCase())
      .slice(0, targetCount);
  }

  async enrichPerson(linkedinUrl) {
    if (!this.config.prospeoApiKey) {
      throw new ConfigurationError("PROSPEO_API_KEY is required.");
    }

    const response = await this.requestJson("POST", "https://api.prospeo.io/enrich-person", {
      headers: {
        "Content-Type": "application/json",
        "X-KEY": this.config.prospeoApiKey,
      },
      jsonBody: {
        data: {
          linkedin_url: linkedinUrl,
        },
      },
      allowedStatuses: [200, 400],
    });

    if (response?.error === true) {
      if (response?.error_code === "NO_RESULTS") {
        return null;
      }
      throw new ApiError(`Prospeo enrichment failed for ${linkedinUrl}: ${response?.error_code ?? "unknown error"}`, {
        payload: response,
      });
    }

    const person = response?.person ?? {};
    if (!person.email) {
      return null;
    }

    const emailObj = person.email;
    const emailStr = typeof emailObj === "object" ? emailObj.email : String(emailObj);
    const verificationStr = typeof emailObj === "object" ? emailObj.status : (person.email_status || null);

    return {
      email: emailStr,
      verification: verificationStr,
      source: "prospeo-enrichment",
    };
  }
}
