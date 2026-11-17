# PillID — How it works

A hosted vision model (through Vercel AI Gateway) reads the photo and suggests a name.
Every drug fact shown comes from public data (openFDA labels + RxNorm), and the user
confirms the name against the packaging before anything is saved.

```mermaid
flowchart TD
    U([Signed-in user]) -->|photo of one pill| SCAN[Scan screen<br/>photo downsized in browser]
    SCAN -->|JPEG + access token| ID["/api/identify<br/>auth · daily limit · image checks"]

    subgraph MODEL["Hosted model (Vercel AI Gateway)"]
        GV["vision read<br/>imprint · shape · color<br/>best-guess name"]
        GX["label reader<br/>one call per drug label<br/>must quote the label"]
    end
    subgraph PUBLIC["Public reference data"]
        RX["RxNorm / RxNav<br/>name → canonical name + rxcui"]
        FDA["openFDA drug label<br/>purpose · warnings · interactions"]
    end

    ID --> GV
    GV -->|guessed name| RX
    RX -->|canonical name| FDA
    FDA --> RESULT[Result card<br/>guess + FDA label]
    RESULT -->|wrong? user types the name| LK["/api/lookup<br/>RxNorm + openFDA only"]
    LK --> RESULT

    RESULT -->|user confirms| SB[(Supabase<br/>medications · private pill-images<br/>row-level security per user)]
    SB --> CAB[Cabinet grid]

    CAB -->|2+ meds| IX["/api/interactions<br/>reads the cabinet server-side"]
    IX --> GX
    GX -->|quotes checked against label text| OUT[Findings with quotes<br/>+ list of anything not checked]

    classDef ui fill:#FFFFFF,stroke:#A6C2A9,stroke-width:2px,color:#2C3A2E;
    classDef api fill:#3C5544,stroke:#3C5544,color:#FFFFFF;
    classDef model fill:#5B8266,stroke:#4A6B54,color:#FFFFFF;
    classDef data fill:#FBF3E2,stroke:#E6C77E,color:#92651B;
    classDef cloud fill:#ECFEFF,stroke:#22D3EE,color:#155E75;
    classDef out fill:#F1F5F1,stroke:#7BA888,color:#2F4336;

    class SCAN,CAB,RESULT ui;
    class ID,IX,LK api;
    class GV,GX model;
    class RX,FDA data;
    class SB cloud;
    class OUT out;
```

## The grounding contract

| Stage | Who decides | Source of truth |
|-------|-------------|-----------------|
| Read the pill | hosted vision model | the photo only — a suggestion, not an identification |
| Final name | **the user**, against the packaging | the packaging |
| Canonical name + `rxcui` | RxNorm / RxNav | NIH RxNorm |
| Purpose / warnings / interaction text | openFDA | FDA drug labels |
| Which cabinet drugs a label warns about | model, one label at a time | that label's text; each finding carries a quote that is checked against the label |
| Severity | model estimate | none — FDA labels do not grade interactions, and the UI says so |

> The NIH RxNav **Drug Interaction API** was retired in Jan 2024, so interaction warnings are
> grounded in each drug's openFDA label text rather than a dedicated interaction endpoint.
