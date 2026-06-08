# Automated Outreach Pipeline

Node.js CLI pipeline for the Vocallabs take-home: one seed domain in, then Ocean.io, Prospeo, Eazyreach, and Brevo run in sequence with no manual handoff between stages.

## What it does

1. Uses Ocean.io to turn a seed domain into lookalike company domains.
2. Uses Prospeo to find C-suite, founder, and VP contacts for each company.
3. Uses Eazyreach to resolve work emails from LinkedIn URLs.
4. Generates personalized outreach copy automatically.
5. Shows a human confirmation checkpoint before Brevo sends.
6. Saves every stage output under `runs/<timestamp>/` for auditability and demos.

## Project layout

```text
src/
  cli.js
  pipeline.js
  emailCopy.js
  config.js
  utils.js
  clients/
    ocean.js
    prospeo.js
    eazyreach.js
    brevo.js
tests/
```

## Setup

```bash
npm install
copy .env.example .env
```

Fill in:

- `OCEAN_API_TOKEN`
- `PROSPEO_API_KEY`
- `EAZYREACH_CLIENT_ID`
- `EAZYREACH_CLIENT_SECRET`
- `BREVO_API_KEY`
- `BREVO_SENDER_NAME`
- `BREVO_SENDER_EMAIL`

## Important note about Ocean

Ocean's search payload is workspace-specific. This repo supports two modes:

1. `Recommended`: provide `OCEAN_REQUEST_TEMPLATE_PATH` or `OCEAN_REQUEST_TEMPLATE_JSON` with the exact body you want sent to `POST https://api.ocean.io/v3/search/companies`.
2. `Fallback`: the code ships with a best-effort default payload using `includeDomains`, but you should override it if your Ocean setup expects a different filter shape.

The template supports `{{seed_domain}}` and `{{limit}}` placeholders.

Example:

```json
{
  "size": "{{limit}}",
  "companiesFilters": {
    "includeDomains": ["{{seed_domain}}"]
  },
  "fields": ["domain", "name", "description", "primaryCountry"]
}
```

## Usage

Dry run first:

```bash
npm start -- stripe.com --max-companies 5 --contacts-per-company 2 --dry-run
```

Real send with confirmation:

```bash
npm start -- stripe.com --max-companies 5 --contacts-per-company 2
```

Skip the confirmation prompt:

```bash
npm start -- stripe.com --yes
```

## Artifacts

Each run writes:

- `01_companies.json`
- `02_contacts.json`
- `03_prospects.json`
- `03_prospects.csv`
- `04_email_previews.json`
- `05_send_results.json`

## Testing

```bash
npm test
```

## API references used

- Ocean.io auth and company search docs: `https://docs.ocean.io/getting-started/authentication` and `https://docs.ocean.io/search/searchCompaniesV3`
- Prospeo search person docs: `https://prospeo.io/api-docs/search-person`
- Eazyreach docs: `https://docs.eazyreach.app/eazyreach`
- Brevo transactional email docs: `https://developers.brevo.com/docs/send-a-transactional-email`
