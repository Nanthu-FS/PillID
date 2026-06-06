# PillID — your calm medicine cabinet

Identify a pill from a photo and cross-check interactions across everything in your
medicine cabinet. Runs the vision model **locally** with `gemma4:12b` via Ollama; all
drug facts are **grounded in real public data** (openFDA labels + RxNorm), never invented
by the model.

> ⚠️ **Not medical advice.** PillID can be wrong. It is an informational tool — always
> confirm with the original packaging, a pharmacist, or your doctor before taking or
> changing any medication.

## How it works

| Step | What happens | Source of truth |
|------|--------------|-----------------|
| **Scan** | `gemma4:12b` reads the photo → imprint, shape, color, best-guess name + confidence | local vision model |
| **Normalize** | guessed name → canonical drug + `rxcui` | NIH **RxNorm** (RxNav) |
| **Label** | pull purpose / warnings / interaction text | **openFDA** drug label |
| **Cabinet** | save medications (photo + label) | **Supabase** (Postgres + Storage) |
| **Interactions** | `gemma4:12b` cross-references your cabinet **against the FDA label text only** → pairs + severity | openFDA labels |

> Note: the NIH RxNav *Drug Interaction* API was retired in Jan 2024, so interactions are
> grounded in each drug's **openFDA label interaction text** instead — the model matches and
> summarizes, it does not invent the warnings.

## Stack

- **Next.js 14** (App Router) + **Tailwind CSS** — soft "calm pharmacy" UI
- **Ollama** running **`gemma4:12b`** (multimodal) for vision + interaction reasoning
- **Supabase** for the medicine-cabinet table and pill-photo storage
- **openFDA** + **RxNorm** for grounded drug data (no API key required)

## Prerequisites

1. **Ollama ≥ 0.30** with the model pulled:
   ```bash
   ollama pull gemma4:12b
   ```
2. **Node.js 18+**
3. A **Supabase** project (this repo is wired to one already; see `.env.local`).

## Setup

```bash
cd pill_id
npm install
# .env.local is already populated for the PillID Supabase project.
npm run dev
```

Open <http://localhost:3008>.

### Environment

See `.env.example`:

| Var | Purpose |
|-----|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase publishable key |
| `OLLAMA_URL` | default `http://localhost:11434` |
| `OLLAMA_MODEL` | default `gemma4:12b` |

## Database

The `medications` table and the public `pill-images` storage bucket are created by the
Supabase migration `create_pillid_schema`. RLS is enabled with a permissive policy
(local single-user app using the publishable key).

## Routes

- `/` — **Scan**: capture/upload a pill, see identification + label, save to cabinet
- `/cabinet` — **Cabinet**: grid of saved medications
- `/interactions` — **Interactions**: FDA-grounded cross-check with severity levels
- `POST /api/identify` — vision + RxNorm + openFDA enrichment
- `POST /api/interactions` — FDA-label-grounded interaction reasoning
