# Original v11 specification index

The exact v11 pre-prototype documents are preserved in the consolidated planning archive. This index explains how they are used now.

| File | Role now |
|---|---|
| `00-overview.md` | Durable product purpose and high-level semantic contract. |
| `01-semantic-model.md` | Durable normalized semantic entities and FeatureScope model. |
| `02-project-structure-and-discovery.md` | Discovery/root/folder conventions; still architectural reference. |
| `03-test-description-grammar.md` | Canonical 3-part/4-part naming grammar; current. |
| `04-parameterized-situations.md` | Parameterized Situation principles; current, with runtime deltas recorded separately. |
| `05-assertion-model.md` | Literal assertion model and responsibility concepts; responsibility implementation remains retained work. |
| `06-e2e-joining-and-projection.md` | Scoped exact join and projection rules; current. |
| `07-code-first-configuration.md` | Symbol-safe configuration direction; physical config shape has evolved in prototype. |
| `08-cross-language-conventions.md` | Future adapter conventions; retained for later language expansion. |
| `09-runtime-security-and-output.md` | Runtime/trust/process policy; current except explicit empirical deltas (for example Vitest truncation/path handling). |
| `10-extension-features.md` | Feature backlog/checklist; use together with Master Plan statuses. |
| `11-implementation-sequence.md` | Historical roadmap. No longer the active execution sequence. |
| `12-open-questions.md` | Historical open questions; Master Plan carries current blocking/non-blocking status. |
| `13-golden-examples.md` | Golden semantic examples; still valuable for future acceptance fixtures. |
| `14-decisions-summary.md` | Historical decision snapshot; `DECISIONS-AND-DELTAS.md` records later empirical changes. |

## Rule

If an old v11 statement conflicts with a recorded post-prototype delta, keep the old statement for history and use the delta for current implementation. Do not silently edit v11.
