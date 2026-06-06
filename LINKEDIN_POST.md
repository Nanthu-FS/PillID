# PillID — LinkedIn caption (no emojis)

---

I built PillID: a local-first medicine cabinet that identifies a pill from a photo and cross-checks interactions across everything you are taking.

The hard part of a medication app is not the UI. It is trust. A language model will confidently invent drug facts, and that is exactly the wrong failure mode for medicine. So I designed PillID around a strict grounding contract: the model is allowed to look, but not to make up facts.

How it works:

- Vision runs on-device. A photo of a single pill goes to gemma4:12b running locally through Ollama. The model reports only what it can observe — imprint, shape, color — plus a calibrated best-guess name and a confidence score.
- Names are normalized against NIH RxNorm, which maps the guess to a canonical drug and an rxcui identifier.
- Every drug fact comes from the openFDA drug label: purpose, warnings, and interaction text. The model never authors these.
- Interactions are cross-checked by feeding the cabinet's FDA label text back to gemma4:12b, which only matches and assigns severity (minor, moderate, major) against that text. In testing it correctly flagged the lisinopril and ibuprofen interaction — reduced blood-pressure control and kidney risk — grounded in the label, not in model memory.

A detail worth sharing: the NIH RxNav Drug Interaction API was retired in early 2024. Rather than depend on a dead endpoint, I grounded interactions in each drug's openFDA label text instead. The model does the matching; the facts stay sourced.

The stack: Next.js and Tailwind for a calm, accessible "pharmacy" interface, Ollama with gemma4:12b for multimodal reasoning, Supabase for the cabinet and pill-photo storage, and openFDA plus RxNorm for grounded data with no API keys required.

What I like most is the privacy story. The image never leaves the machine. The intelligence is local; the references are public and citable.

Not medical advice, and the app says so on every screen. But as an exercise in building AI that stays honest about what it knows, this was the most interesting one yet.

Built with Next.js, Tailwind, Ollama, gemma4:12b, Supabase, openFDA, and RxNorm.

#LocalAI #Gemma #Ollama #HealthTech #NextJS #Supabase #AIEngineering #OnDeviceAI
