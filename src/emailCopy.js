import { shorten } from "./utils.js";

function htmlEscape(text) {
  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function buildEmailDraft(prospect) {
  const firstName = prospect.contact.firstName || prospect.contact.fullName.split(/\s+/)[0];
  const companyName = prospect.company.name || prospect.contact.companyName || prospect.company.domain;
  const title = prospect.contact.title || "your team";
  const description = shorten(prospect.company.description, 160);

  const lines = [
    `Hi ${firstName},`,
    "",
    `I came across ${companyName} while researching teams in ${prospect.company.primaryCountry || "your space"}.`,
    `Your role as ${title} stood out, and I thought a lightweight automation idea might be relevant.`,
    description
      ? `What caught my eye: ${description}`
      : `What caught my eye is that ${companyName} looks like the kind of team where faster outbound ops usually compound quickly.`,
    "",
    "We help teams automate prospect sourcing, contact enrichment, and personalized outbound so campaigns launch faster with less ops overhead.",
    "If useful, I can send over a short teardown of how I would structure the workflow for your team.",
    "",
    "Worth a quick reply?",
    "",
    "Best,",
    "Your Name",
  ];

  return {
    subject: `Idea for ${companyName}'s ${title} pipeline`,
    textBody: lines.join("\n"),
    htmlBody: lines.map((line) => (line ? htmlEscape(line) : "")).join("<br/>"),
  };
}
