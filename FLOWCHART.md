# PillID — How it works

End-to-end flow. The vision model runs **locally** (gemma4:12b via Ollama); all drug
facts are **grounded** in public data (openFDA labels + RxNorm). The model never invents
warnings or interactions.

```mermaid
flowchart TD
    U([User]) -->|photo of one pill| SCAN[Scan screen]
    SCAN -->|base64 image| ID["/api/identify"]

    subgraph LOCAL["On-device (Ollama)"]
        GV["gemma4:12b — vision<br/>reads imprint · shape · color<br/>best-guess name + confidence"]
    end
    subgraph PUBLIC["Public reference data"]
        RX["RxNorm / RxNav<br/>name → canonical + rxcui"]
        FDA["openFDA drug label<br/>purpose · warnings · interactions"]
    end

    ID --> GV
    GV -->|guessed name| RX
    GV -->|guessed name| FDA
    RX --> RESULT
    FDA --> RESULT
    GV --> RESULT[Result card<br/>confidence ring + label]

    RESULT -->|Add to cabinet| SB[(Supabase<br/>medications + pill-images)]
    SB --> CAB[Cabinet grid]

    CAB -->|2+ meds| IX["/api/interactions"]
    IX -->|per-med label text| FDA2["openFDA interaction text"]
    FDA2 --> GX["gemma4:12b — reasoning<br/>cross-reference cabinet<br/>vs FDA text only"]
    GX --> OUT[Interaction results<br/>minor · moderate · major]

    classDef ui fill:#FFFFFF,stroke:#A6C2A9,stroke-width:2px,color:#2C3A2E;
    classDef api fill:#3C5544,stroke:#3C5544,color:#FFFFFF;
    classDef local fill:#5B8266,stroke:#4A6B54,color:#FFFFFF;
    classDef data fill:#FBF3E2,stroke:#E6C77E,color:#92651B;
    classDef cloud fill:#ECFEFF,stroke:#22D3EE,color:#155E75;
    classDef out fill:#F1F5F1,stroke:#7BA888,color:#2F4336;

    class SCAN,CAB,RESULT ui;
    class ID,IX api;
    class GV,GX local;
    class RX,FDA,FDA2 data;
    class SB cloud;
    class OUT out;
```

## The grounding contract

| Stage | Who decides | Source of truth |
|-------|-------------|-----------------|
| Read the pill | `gemma4:12b` (local vision) | the photo only |
| Canonical name + `rxcui` | RxNorm / RxNav | NIH RxNorm |
| Purpose / warnings / interaction text | openFDA | FDA drug labels |
| Interaction pairs + severity | `gemma4:12b` *matches & scores* | **only** the openFDA label text provided |

> The NIH RxNav **Drug Interaction API** was retired in Jan 2024, so interaction warnings are
> grounded in each drug's openFDA label text rather than a dedicated interaction endpoint.
