import fs from "node:fs";
import path from "node:path";

const DOMAIN_RE = /^(?:https?:\/\/)?(?:www\.)?([^/\s]+)/i;

export function normalizeDomain(value) {
  const match = DOMAIN_RE.exec(String(value).trim());
  if (!match) {
    throw new Error(`Could not parse a domain from "${value}".`);
  }
  return match[1].toLowerCase();
}

export function timestampSlug() {
  return new Date().toISOString().replaceAll(":", "").replaceAll("-", "").replace(/\.\d{3}Z$/, "Z");
}

export function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
  return dirPath;
}

export function writeJson(filePath, payload) {
  fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

export function writeCsv(filePath, rows) {
  if (!rows.length) {
    fs.writeFileSync(filePath, "", "utf8");
    return;
  }

  const headers = Object.keys(rows[0]);
  const escapeCell = (value) => {
    const text = value == null ? "" : String(value);
    if (/[",\n]/.test(text)) {
      return `"${text.replaceAll('"', '""')}"`;
    }
    return text;
  };

  const lines = [
    headers.join(","),
    ...rows.map((row) => headers.map((header) => escapeCell(row[header])).join(",")),
  ];
  fs.writeFileSync(filePath, `${lines.join("\n")}\n`, "utf8");
}

export function shorten(text, limit = 180) {
  if (!text) {
    return "";
  }
  const cleaned = String(text).trim().replace(/\s+/g, " ");
  if (cleaned.length <= limit) {
    return cleaned;
  }
  return `${cleaned.slice(0, limit - 3).trimEnd()}...`;
}

export function recursiveTemplateReplace(value, replacements) {
  if (Array.isArray(value)) {
    return value.map((item) => recursiveTemplateReplace(item, replacements));
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, recursiveTemplateReplace(item, replacements)]),
    );
  }
  if (typeof value === "string") {
    let rendered = value;
    for (const [key, replacement] of Object.entries(replacements)) {
      rendered = rendered.replaceAll(`{{${key}}}`, String(replacement));
    }
    return rendered;
  }
  return value;
}

export function dedupeBy(items, getKey) {
  const seen = new Map();
  for (const item of items) {
    const key = getKey(item);
    if (!seen.has(key)) {
      seen.set(key, item);
    }
  }
  return [...seen.values()];
}

export function loadDotEnv(filePath = ".env") {
  if (!fs.existsSync(filePath)) {
    return;
  }

  const content = fs.readFileSync(filePath, "utf8");
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }
    const separator = line.indexOf("=");
    if (separator === -1) {
      continue;
    }
    const key = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

export function resolveRoot(...parts) {
  return path.resolve(process.cwd(), ...parts);
}
