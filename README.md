# PillID — your calm medicine cabinet

Take a photo of a pill, get a suggestion of what it is with its FDA label, and cross-check
interactions across everything in your medicine cabinet. A hosted vision model (through
Vercel AI Gateway) reads the photo; all drug facts come from **public data** (openFDA labels
+ RxNorm), never from the model.

> ⚠️ **Not medical advice.** PillID can be wrong. A photo is not enough to identify a pill
> reliably — always confirm with the original packaging, a pharmacist, or your doctor before
> taking or changing any medication.

## How it works

| Step | What happens | Source of truth |
|------|--------------|-----------------|
| **Scan** | the model reads the photo → imprint, shape, color, best-guess name | hosted vision model |
| **Normalize** | guessed name → canonical drug + `rxcui` | NIH **RxNorm** (RxNav) |
| **Label** | purpose / warnings / interaction text for the canonical name | **openFDA** drug label |
| **Confirm** | you check the name against the packaging, or type the right one | you |
| **Cabinet** | save the medication (photo + label) to your account | **Supabase** (Postgres + Storage) |
| **Interactions** | each drug's FDA label is checked against the rest of your cabinet | openFDA labels |

See [FLOWCHART.md](FLOWCHART.md) for the full flow.

### What the interaction check does and doesn't do

- Each label is read in its own model call, and every finding must quote the label. The
  quote is checked against the label text; a quote that can't be matched is marked as such.
- Anything that could not be checked (no label found, label too long, a failed call) is
  listed, so "nothing flagged" is never shown for a partial check.
- Severity is the model's estimate. FDA labels describe interactions but do not grade them.
- Labels don't list every interaction. The NIH RxNav interaction API was retired in Jan 2024,
  so there is no dedicated interaction database behind this.

### Privacy

- Photos are downsized in the browser and sent to the hosted model to be read.
- A photo is stored only if you save the medication, in a **private** storage bucket.
- Row-level security limits every medication and photo to the account that saved it.

## Stack

- **Next.js 14** (App Router) + **Tailwind CSS**
- **Vercel AI Gateway** via the AI SDK, for the vision read and the label reader
- **Supabase** — Auth (email sign-in link), Postgres, private Storage
- **openFDA** + **RxNorm** for drug data (no API key required)

## Setup

Requires **Node.js 22+**.

1. **Supabase.** Create a project, then run
   [`supabase/migrations/20261117000000_pillid_schema.sql`](supabase/migrations/20261117000000_pillid_schema.sql)
   in the SQL editor (or `supabase db push`). It creates the `medications` and `api_usage`
   tables, the private `pill-images` bucket, and all row-level security policies.
   Under **Authentication → URL Configuration**, set the Site URL to where the app runs and
   add it to the redirect allow-list (e.g. `http://localhost:3008` and your Vercel URL).
2. **Environment.** Copy `.env.example` to `.env.local` and fill it in.
3. **Run.**
   ```bash
   npm install
   npm run dev
   ```
   Open <http://localhost:3008>.

### Environment

| Var | Purpose |
|-----|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase publishable (anon) key |
| `AI_GATEWAY_API_KEY` | AI Gateway key — local development only; not needed on Vercel |
| `AI_GATEWAY_MODEL` | Gateway model ID; must accept images. Default `flint-v1.0` |
| `IDENTIFY_DAILY_LIMIT` | Optional. Scans per user per 24h (default 25) |
| `INTERACTIONS_DAILY_LIMIT` | Optional. Interaction checks per user per 24h (default 15) |

## Deploy to Vercel

1. Import the repository in Vercel (framework preset: Next.js).
2. Add `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` and, if you want a
   model other than the default, `AI_GATEWAY_MODEL`.
3. Make sure AI Gateway is enabled for the team. Deployments authenticate to it with their
   OIDC token, so no API key is needed.
4. Add the deployment URL to Supabase's Site URL / redirect allow-list.

## Routes

- `/` — **Scan**: photograph a pill, review the suggestion + label, confirm, save
- `/cabinet` — **Cabinet**: your saved medications
- `/interactions` — **Interactions**: FDA-label cross-check with quotes
- `POST /api/identify` — vision read + RxNorm + openFDA (signed-in, daily limit)
- `POST /api/lookup` — RxNorm + openFDA for a typed name (signed-in, no model call)
- `POST /api/interactions` — label-grounded interaction check (signed-in, daily limit)

## License

[MIT](LICENSE)
