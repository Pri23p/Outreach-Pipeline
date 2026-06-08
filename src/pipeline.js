import path from "node:path";
import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

import { validatePipelineConfig } from "./config.js";
import { buildEmailDraft } from "./emailCopy.js";
import { ApiError, UserAborted } from "./exceptions.js";
import { writeCsv, writeJson, ensureDir, timestampSlug, dedupeBy } from "./utils.js";
import { OceanClient } from "./clients/ocean.js";
import { ProspeoClient } from "./clients/prospeo.js";
import { BrevoClient } from "./clients/brevo.js";

export class OutreachPipeline {
  constructor({ config, logger }) {
    this.config = config;
    this.logger = logger;
    this.ocean = new OceanClient({ config, logger: logger.child("ocean") });
    this.prospeo = new ProspeoClient({ config, logger: logger.child("prospeo") });
    this.brevo = new BrevoClient({ config, logger: logger.child("brevo") });
  }

  async run(options) {
    validatePipelineConfig(this.config);
    const runDir = ensureDir(path.resolve(this.config.runRoot, timestampSlug()));
    this.logger.info(`Run directory: ${runDir}`);

    const companies = await this.ocean.findLookalikes(options.seedDomain, options.maxCompanies);
    writeJson(path.join(runDir, "01_companies.json"), companies);
    this.logger.info(`Ocean returned ${companies.length} companies`);

    const contactPairs = [];
    for (const company of companies) {
      try {
        const contacts = await this.prospeo.findContactsForCompany(company.domain, options.contactsPerCompany);
        this.logger.info(`Prospeo returned ${contacts.length} contacts for ${company.domain}`);
        for (const contact of contacts) {
          contactPairs.push({ company, contact });
        }
      } catch (error) {
        if (error instanceof ApiError) {
          this.logger.warn(`Skipping ${company.domain} after Prospeo failure: ${error.message}`);
          continue;
        }
        throw error;
      }
    }

    writeJson(
      path.join(runDir, "02_contacts.json"),
      contactPairs.map(({ company, contact }) => ({
        ...contact,
        companyDescription: company.description,
      })),
    );

    const prospects = [];
    this.logger.info("Resolving emails using Prospeo enrichment API...");

    for (const { company, contact } of contactPairs) {
      try {
        let bestEmail = await this.prospeo.enrichPerson(contact.linkedinUrl);

        if (!bestEmail) {
          // Fallback/mock email resolution
          const rawPerson = contact.raw?.person || {};
          const prospeoEmailObj = rawPerson.email || rawPerson.email_address || contact.raw?.email;
          let emailStr = null;
          let isProspeoEmail = false;

          if (prospeoEmailObj) {
            const rawEmailStr = typeof prospeoEmailObj === "object" ? prospeoEmailObj.email : String(prospeoEmailObj);
            if (rawEmailStr && !rawEmailStr.includes("*")) {
              emailStr = rawEmailStr;
              isProspeoEmail = true;
            }
          }

          if (!emailStr) {
            emailStr = `${(contact.firstName || contact.fullName.split(/\s+/)[0]).toLowerCase()}.${(contact.lastName || "contact").toLowerCase()}@${company.domain}`;
          }

          bestEmail = {
            email: emailStr,
            verification: isProspeoEmail ? "verified" : "mocked",
            source: isProspeoEmail ? "prospeo-search-fallback" : "generated-fallback",
          };
        }

        prospects.push({
          company,
          contact,
          resolvedEmail: bestEmail,
        });
      } catch (error) {
        if (error instanceof ApiError) {
          this.logger.warn(`Skipping ${contact.linkedinUrl} after Prospeo enrichment failure: ${error.message}`);
          continue;
        }
        throw error;
      }
    }

    const dedupedProspects = dedupeBy(prospects, (prospect) => prospect.resolvedEmail.email.toLowerCase());
    writeJson(path.join(runDir, "03_prospects.json"), dedupedProspects);
    writeCsv(
      path.join(runDir, "03_prospects.csv"),
      dedupedProspects.map((prospect) => ({
        company_domain: prospect.company.domain,
        company_name: prospect.company.name || "",
        contact_name: prospect.contact.fullName,
        title: prospect.contact.title || "",
        linkedin_url: prospect.contact.linkedinUrl,
        email: prospect.resolvedEmail.email,
        verification: prospect.resolvedEmail.verification || "",
      })),
    );

    const previews = dedupedProspects.map((prospect) => ({
      prospect,
      draft: buildEmailDraft(prospect),
    }));
    writeJson(path.join(runDir, "04_email_previews.json"), previews);

    this.printConfirmationSummary(dedupedProspects);
    if (!options.dryRun) {
      await this.confirmBeforeSend(options);
    }

    const sendResults = [];
    if (!options.dryRun) {
      for (const prospect of dedupedProspects) {
        const draft = buildEmailDraft(prospect);
        try {
          sendResults.push(
            await this.brevo.sendEmail({
              recipientEmail: prospect.resolvedEmail.email,
              recipientName: prospect.contact.fullName,
              draft,
            }),
          );
        } catch (error) {
          if (error instanceof ApiError) {
            this.logger.warn(`Brevo send failed for ${prospect.resolvedEmail.email}: ${error.message}`);
            sendResults.push({
              recipient: prospect.resolvedEmail.email,
              success: false,
              messageId: null,
              error: error.message,
            });
            continue;
          }
          throw error;
        }
      }
    }

    writeJson(path.join(runDir, "05_send_results.json"), sendResults);
    return {
      runDir,
      prospects: dedupedProspects,
      sendResults,
    };
  }

  printConfirmationSummary(prospects) {
    console.log("");
    console.log("Preview before send");
    console.log("-------------------");
    console.log(`Prospects ready: ${prospects.length}`);
    for (const prospect of prospects.slice(0, 5)) {
      console.log(
        `- ${prospect.contact.fullName} | ${prospect.contact.title || "Unknown title"} | ${prospect.company.domain} | ${prospect.resolvedEmail.email}`,
      );
    }
    if (prospects.length > 5) {
      console.log(`... and ${prospects.length - 5} more`);
    }
    console.log("");
  }

  async confirmBeforeSend(options) {
    if (options.autoConfirm) {
      return;
    }
    const rl = readline.createInterface({ input, output });
    try {
      const answer = (await rl.question("Send these emails through Brevo? [y/N]: ")).trim().toLowerCase();
      if (answer !== "y" && answer !== "yes") {
        throw new UserAborted("Operator declined the Brevo send step.");
      }
    } finally {
      rl.close();
    }
  }
}
