# Rounds

Rounds is a telehealth virtual-patient simulator for health-professions education. A student holds a
video-style visit with an AI patient on the left of the screen while an electronic chart on the right
fills in as they learn things, then receives rubric feedback tied to quotes from the transcript.
Faculty build the patients as data in a Patient Studio, and can chain one patient through several
professional encounters as a Care Journey with a shared, traceable patient state.

RU Health Hack 2026, School of Health Professions track. This repository is the team's entry for both
challenges:

- **Challenge 1, "The Virtual Patient Encounter System"**: Patient Studio, encounter, feedback.
- **Challenge 2, "The Connected Care Journey"**: multi-encounter journeys, shared patient state,
  provenance, SBAR evaluation, huddle, integrated care plan.

| | |
|---|---|
| Live prototype | https://d3k6ssmfceay1x.cloudfront.net |
| Source | https://github.com/CANTSOAR/lowhangingfruit26 |
| Architecture, Challenge 1 and whole system | [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) |
| Architecture and integration, Challenge 2 | [docs/ARCHITECTURE-journeys.md](docs/ARCHITECTURE-journeys.md) |
| Pitch script and demo run-of-show | [docs/PITCH.md](docs/PITCH.md) |
| Developer notes | [docs/DEV.md](docs/DEV.md) |

## Demo accounts

Password for all four: `rounds-demo`

| Email | Role | Profession |
|---|---|---|
| `faculty@rounds.demo` | Faculty | Medicine |
| `student@rounds.demo` | Student | Medicine |
| `dietetics@rounds.demo` | Student | Dietetics |
| `nursing@rounds.demo` | Student | Nursing |

These accounts are shared, so you may see patients, visits and journey runs left by other people.
Use Chrome, Edge or Safari if you want to talk by microphone; typing works in any browser.

## What is in it

- **63 learner roles in 10 groups** (physician specialties, advanced practice, nursing, pharmacy,
  rehabilitation, nutrition, behavioral health, diagnostics, dental and vision, pre-hospital and
  community), defined as data in `data/professions.json`.
- **81 seed patients**, loaded on boot from `data/seed/cases/`, at least one per role. 73 were
  drafted by the model and are labelled "AI-drafted, not faculty-reviewed". 8 were expanded by the
  same generator from the faculty-provided sample patient details and are labelled "Sample".
- **2 seed care journeys** built on the sample patients Marcus Ramirez (4 encounters) and Walter
  Greene (3 encounters), using the 5 provided clinician personas in `data/clinicians/`.
- **One rubric by default**: the provided Patient Encounter Performance Rubric, 7 domains scored
  1 to 4. A second built-in rubric is a 12-item points checklist. Faculty can write their own in
  either format.
- **19 teamwork behaviours** in 4 TeamSTEPPS areas for Care Journeys.

## Walkthrough: Challenge 1 (create a patient, publish, run the visit, read the feedback)

Wall-clock time is about 8 minutes, of which one to two minutes is the model drafting the patient and
about 1 minute is scoring. To skip the drafting wait, open any existing patient in Patient Studio and
start at step 5.

1. Open the live URL and sign in as `faculty@rounds.demo`.
2. Top bar: **Patient Studio**, then **New patient**.
3. The **Describe the patient** tab is selected. Either type a paragraph about your own patient, or
   click the example chip **Chest pain, smoker** under the description box (it fills in the
   description and learning goals and sets the learner to Medicine). Optional: set a target
   difficulty, or attach a guideline as a PDF under **Source document**. Click **Continue**.
4. If the page **A few quick questions** appears, click a suggested answer for each (or skip them)
   and click **Draft the patient**. A progress page shows the elapsed time. One model call writes
   the whole case, so there is nothing partial to show until it finishes.
5. The editor opens on the new draft. In the left-hand section list look at:
   - **Facts and disclosure**: each fact has patient wording, chart wording and a tier
     (Volunteered, When asked, Needs trust, Guarded).
   - **Exams and orders**: each has a fixed result.
   - **Documents**: lab reports, notes, trend charts, each with a rule for when it appears.
   - **Knowledge sources**, **Learning objectives**, **Answer key**, **Rubric**.
   Edit anything directly, or click **Ask the guide** and type a change in plain language; it comes
   back as a before/after diff that you accept or reject.
6. Click **Check consistency** (top bar). Rule checks and a model review list contradictions with
   proposed fixes. Apply or dismiss them.
7. Click **Publish**. The dialog shows any open high-severity issues. Tick the review box only if
   you have actually reviewed the clinical content; otherwise the patient is published with the
   label "AI-drafted, not faculty-reviewed". Click **Publish**.
8. Click **Test visit** (top bar) to run the visit exactly as a student would. Alternatively sign in
   as `student@rounds.demo`, open **Practice**, find the patient and click **Start visit**.
9. In the waiting room, tick **Use my microphone** if you want voice, then **Join visit**.
10. Interview the patient. Things to try:
    - an open question ("What brings you in today?"), then a specific one;
    - a sensitive question asked bluntly, then again after acknowledging how the patient feels:
      the patient deflects the first time and the comfort meter moves;
    - a closed question about a symptom the case does not contain: the patient says no;
    - chart tab **Results & orders**: request "ECG" or "lipid panel", then something the case does
      not have ("brain MRI") to see the refusal;
    - chart tabs **This visit**, **Chart review** and **Activity** as they fill in;
    - **Coach hint** (practice mode only).
11. Click the red **End visit** button, fill in the write-up, click **Submit for feedback**.
12. After about a minute the feedback page opens: rubric score per domain with quoted evidence and
    turn numbers, findings elicited and missed, learning objectives, patient-versus-chart
    mismatches, safety and accuracy, how the interview was built, what to do next time, and the
    annotated transcript. From here **Book a follow-up visit** starts a second visit in which the
    patient remembers the first.

## Walkthrough: Challenge 2 (join a care journey, watch colleagues, your visit, SBAR, huddle, integrated view)

A full run does not fit in five minutes. Each AI colleague's encounter takes roughly 80 to 110
seconds, and the run also includes your own visit, scoring, and writing the care plan; allow about
15 minutes for the three-encounter journey below. If you only have five minutes, do steps 1 to 5 to
see continuity and provenance, then sign in as `faculty@rounds.demo`, open **Care Journeys**, open
the journey and click **Open run** on any finished student run to see the huddle, the integrated
view and the teamwork trace.

1. Sign in as `student@rounds.demo` (any student account works).
2. Top bar: **Care Journeys**. On "Walter Greene: uncontrolled diabetes, heart failure and kidney
   disease across three professions" click **Choose your role**.
3. Click **Join as hospitalist (internal medicine)**. This is the middle encounter, so you both
   receive a handoff and write one. The AI plays the emergency physician and the dietitian.
4. **Watch a colleague.** Encounter 1 runs with the AI emergency physician interviewing the same
   patient engine; the conversation streams in. When it ends the hub shows what the encounter added
   to the shared patient state and the SBAR addressed to you, with a review of that SBAR as a
   worked example.
5. Click **Start your visit**. It is the normal visit screen with one extra chart tab, **Care
   team**: the handoff you received and the shared patient state so far. Click any line to see who
   recorded it, in which encounter, at what simulated time, with what status, and the quoted words
   it rests on. Facts already disclosed to the emergency physician are already in your chart.
   **Page a colleague** sends a consult or a call-out.
6. Interview the patient, click **End visit**, write the note, **Submit for feedback**. You return
   to the journey hub while your findings are added to the shared state.
7. Click **Write the handoff**, fill in Situation, Background, Assessment and Recommendation, and
   click **Send handoff**. The review lists each communication behaviour as observed or not, with
   the SBAR section and quote it is based on and one piece of feedback.
8. Encounter 3 runs: the AI dietitian reads your SBAR and the shared state before seeing the patient.
9. Click **Go to the huddle**, then **Open the huddle**. The agenda is what is still disputed,
   uncertain or unanswered. For each item type how you would settle it and click **Put it to the
   team**. Then click **Close the huddle and write the care plan**.
10. Click **Open the integrated patient view**. Three tabs: **Integrated patient view** (coordinated
    care plan with the professions each action rests on, what each profession contributed, influence
    chains, the established/uncertain/disputed/unanswered board, how the state evolved), **Team
    messages**, and **Teamwork evaluation**.

## Requirements mapped to the product and the code

Paths under `src/` unless they start with `data/`, `docs/` or `scripts/`.

### Challenge 1, Base

| Requirement | Where in the product | Where in the code |
|---|---|---|
| Faculty patient-profile creation (structured or descriptive) | Patient Studio > New patient: describe, fill in a form, import JSON, or start empty | `components/studio/NewCaseWizard.tsx`, `app/api/cases/generate`, `app/api/cases/clarify`, `lib/casegen.ts` |
| Patient knowledge and artifact management | Editor sections Knowledge sources (paste or upload PDF/TXT/MD) and Documents (tables, trend charts, audiograms, report text, uploaded image or PDF) | `components/studio/sections/Knowledge.tsx`, `sections/Artifacts.tsx`, `lib/studio/uploads.ts` |
| Define when information and artifacts become available | Fact tiers in Facts and disclosure; per-document rule "from the start", "when the student does an exam or order", "when the patient discloses a fact" | `Fact.tier` and `Artifact.release` in `lib/types.ts`; `decide()` in `lib/engine/gatekeeper.ts`; `releaseArtifacts()` in `lib/engine/encounter.ts` |
| Review and correct generated information | Section editors; Ask the guide (proposed patch shown as a diff); Student preview | `components/studio/CaseEditor.tsx`, `GuidePanel.tsx`, `PatchDiff.tsx`, `lib/studio/patch.ts`, `lib/studio/ai.ts` |
| Check internal consistency | Check consistency: deterministic rules plus a model review, each issue with a proposed fix | `lib/studio/checks.ts`, `modelCheck()` in `lib/studio/ai.ts`, `app/api/cases/[id]/check` |
| Approve and publish | Publish dialog; blocked on open high-severity issues unless acknowledged; faculty-reviewed mark | `app/api/cases/[id]/status` |
| Multiple reusable profiles | Patient Studio library with search and filters, duplicate, archive, export/import; variants for repeat practice | `components/studio/CaseLibrary.tsx`, `lib/studio/store.ts`, `app/api/cases/[id]/{duplicate,export,variants}` |
| Complete student encounter with any published profile, no patient-specific code | Practice > Start visit; the engine reads only the case JSON | `lib/engine/encounter.ts`, `components/visit/Visit.tsx` |
| Split screen: interaction left, dynamic record right | Visit screen: video panel and transcript on the left; chart tabs Summary, This visit, Results & orders, Chart review, Activity on the right | `components/visit/Visit.tsx`, `components/visit/ChartPanel.tsx`, `components/chart/ArtifactView.tsx` |
| Progressive information disclosure | Facts appear in This visit only when asked for and released; reluctant facts need rapport | `gatekeep()` and `decide()` in `lib/engine/gatekeeper.ts` |
| Patient identity, memory and state | Same persona and prior statements every turn; comfort meter; follow-up visits | `lib/engine/patient.ts`, `EncounterState` in `lib/types.ts`, `patient_relationships` table |
| Clinical grounding and consistency | Patient model sees only released facts; orders return only approved results; unsupported claims are flagged in the transcript | `patientSystem()`, `auditReply()`, `matchActions()`, `runAction()` |
| Record of what was disclosed | Activity tab during the visit; annotated transcript on the feedback page | `EncounterState.disclosed`, `messages.meta` |
| Encounter logging | Every encounter, message, order, state snapshot and feedback is stored | `encounters` and `messages` tables in `lib/db.ts` |
| Feedback driven by faculty objectives, explainable | Feedback page | `lib/engine/feedback.ts`, `app/encounter/[id]/feedback/page.tsx` |

### Challenge 1, Stretch

| Requirement | Status | Where |
|---|---|---|
| Real-time voice interaction | Built. Microphone input through the browser's speech recognition; patient speech through Amazon Polly generative voices, synthesised sentence by sentence while the reply streams. | `components/visit/Visit.tsx`, `lib/tts.ts`, `app/api/tts` |
| Avatar-based interaction | Partial. A still portrait in a video-call frame with a speaking state and captions. No lip-sync or animated avatar. | `components/visit/Visit.tsx`, `public/portraits/` |
| Multimodal interaction | Partial. Voice and text in; voice, text, tables, plotted charts, images and PDFs out. The student's camera is a local self-view only; nothing is analysed. | `components/chart/ArtifactView.tsx` |
| Adaptive patient behavior | Built. Five difficulty levels, seven persona variations for repeat attempts, faculty-approved variants, rapport-dependent disclosure, and an Elo-style learner model that sets the next level. | `lib/engine/difficulty.ts`, `lib/adaptive.ts`, `app/student/progress` |
| Advanced memory/state | Built. Per-turn state snapshots (rewind to an earlier turn and branch), follow-up visits with patient memory and carried-over trust. | `rewind()` in `lib/engine/encounter.ts`, `rememberVisit()` in `lib/engine/feedback.ts` |
| Clinical artifact generation and interaction | Built. Generated lab tables with reference flags, trend charts, audiograms, notes; documents released by orders or disclosures; deliberate patient-versus-chart mismatches scored in feedback. | `lib/casegen.ts`, `components/chart/ArtifactView.tsx` |
| Integration APIs (Canvas and similar) | Not built. What exists: case export and import as JSON, gradebook export as CSV, and a JSON HTTP API under `/api` that uses a session cookie. LTI or a Canvas grade passback is future work. | `app/api/cases/[id]/export`, `app/api/assignments/[id]/csv` |

Also built, beyond the brief: courses with join codes, homework/exam/practice assignments with
attempt limits and held feedback, a gradebook with the most-missed findings per assignment, faculty
review notes and score adjustment, and a Live Visits console where an instructor can watch a visit,
pause it and send a note (`lib/courses/`, `components/courses/`, `app/faculty/`).

### Challenge 2

Details and file-level references are in [docs/ARCHITECTURE-journeys.md](docs/ARCHITECTURE-journeys.md).
All code paths are under `src/lib/journey/` unless stated.

| Level | Requirement | Where in the product | Where in the code |
|---|---|---|---|
| Base | At least three encounters, same patient, provided personas, student in one role, AI in the rest | Care Journeys > Choose your role > Join as ... | `runner.ts`, `clinician.ts`, `data/seed/journeys/`, `data/clinicians/` |
| Base | Shared patient state, updated after each encounter, from existing records and from interactions | "What this encounter added to the shared patient state" on each stage; Care team chart tab | `extract.ts`, `store.ts`, `state_entries` and `state_links` tables |
| Base | Earlier information influences a later encounter | Facts already disclosed are in the next clinician's chart; "Earlier information this encounter drew on"; influence chains | `createStageEncounter()` and `runAiVisit()` in `clinician.ts`, `buildChains()` in `view.ts` |
| Base | Established, uncertain, disagreement, unanswered distinguished | Status on every entry; status board in the integrated view | entry `status` and derived status in `store.ts` |
| Base | Provenance: source, professional role, encounter, timing | Click any entry for the provenance panel | columns on `state_entries`; `ProvenancePanel` in `components/journey/shared.tsx` |
| Base | Integrated patient representation and coherent care plan | Integrated patient view | `view.ts`, `synthesis.ts`, `components/journey/FinalView.tsx` |
| Enhanced | SBAR handoffs and TeamSTEPPS-aligned evaluation with an explainable behavioural trace | Write the handoff; Review of the handoff; Teamwork evaluation tab | `handoff.ts`, `BEHAVIOURS` in `types.ts` |
| Stretch | Reach forward and backward, consults, call-outs, check-backs, closed loops | Page a colleague; Team messages tab | `consult()` and `callOut()` in `collab.ts` |
| Stretch | Huddle and reconciliation of conflicting interpretations | Team huddle | `startHuddle()`, `resolveHuddleItem()` in `collab.ts` |
| Stretch | Collaborative modification of the care plan | "Propose a change to this item" on a care-plan action | `proposePlanChange()` in `collab.ts` |

## Run it locally

Requirements: Node.js 20 or later, and AWS credentials that can call Amazon Bedrock (Claude Haiku
4.5, Claude Sonnet 4.5 and Claude Sonnet 5) and Amazon Polly generative voices. The default region
is `us-west-2`.

```bash
npm install
cp .env.example .env.local   # fill in AWS_* and SESSION_SECRET
npm run dev                  # http://localhost:3000
```

`.env.example` lists the variables: `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`,
`AWS_SESSION_TOKEN`, `SESSION_SECRET`. Optional overrides read by the code: `MODEL_FAST`,
`MODEL_CHAT`, `MODEL_SMART` (Bedrock model ids), `DB_PATH`, `UPLOAD_DIR`, `JOURNEY_AI_TURNS`.

On first start the server creates `data/app.db`, loads the seed patients, clinician personas, seed
journeys and the four demo accounts. Without AWS credentials the pages load but every model call
(patient replies, drafting, scoring) fails.

Engine smoke test against one seed case with a throwaway database:

```bash
npx tsx --env-file=.env.local scripts/sim-test.ts
```

More detail, including how to run several dev servers side by side, is in [docs/DEV.md](docs/DEV.md).

## Repository layout

```
data/
  professions.json        role catalog (63 roles); adding a role is one entry here
  rubrics/                the provided encounter rubric
  clinicians/             the five provided clinician personas
  samples/                the faculty-provided sample patient details
  seed/cases/             81 seed patients, loaded on boot
  seed/journeys/          2 seed care journeys
docs/                     architecture, pitch, developer notes, challenge video transcripts
public/portraits/         patient portraits
scripts/                  seed-library generation and checks, portraits, engine smoke test, ship.sh
src/
  app/                    Next.js App Router: pages and API routes
    faculty/              Patient Studio, Care Journeys, Courses, Live Visits
    student/              home, practice library, care journeys, progress
    encounter/[id]/       the visit screen and the feedback page
    journey/[runId]/      care journey hub and integrated view
    api/                  cases, encounters, journeys, courses, assignments, rubrics, uploads, tts
  components/             studio, visit, chart, journey, courses
  lib/
    types.ts              CaseProfile and the other shared types; read this first
    casegen.ts            case drafting and normalisation
    engine/               gatekeeper, patient prompt, encounter loop, feedback, difficulty
    adaptive.ts           learner model
    studio/               consistency checks, patches, uploads, rubric validation
    journey/              care journeys: runner, shared state, SBAR, huddle, synthesis
    courses/              courses, assignments, gradebook
    llm.ts, tts.ts        Bedrock and Polly clients
    db.ts, schema/        SQLite schema
```

## Limitations

- **Clinical content has not been checked by a clinician.** The 73 AI-drafted library patients are
  labelled "AI-drafted, not faculty-reviewed". The 8 "Sample" patients start from the
  faculty-provided details but were expanded into full cases by the same generator. The consistency
  check finds contradictions inside a case; it does not establish that the case is clinically correct.
- **Grounding is strong for the chart and weaker for the patient's wording.** Which facts are
  released, what is written to the chart, and what an order returns are decided by code from case
  data. The patient's sentences are generated: the model is given only released facts and told to
  deny anything else, and a second model audits each reply and flags unapproved clinical claims in
  the transcript. That is a prompt plus a detector, not a guarantee. The flag appears after the
  reply has been shown, and if the audit call fails nothing is flagged.
- **Not validated with learners.** Nothing here has been tested with real students or faculty, and
  the rubric scores have not been compared with human raters.
- **Not an EHR integration.** The chart is an Epic-style layout rendered from case data. There is no
  connection to Epic or any other record system, and no real patient data.
- **Voice input depends on the browser.** It uses the browser's speech recognition (Chrome, Edge,
  Safari). Elsewhere the microphone button is disabled and the student types.
- **The "avatar" is a still portrait** with a speaking state and captions, not lip-synced video.
  Seed patients without a portrait show initials.
- **Knowledge sources are not retrieved during the conversation.** They are given to the case
  drafter, the consistency review and the feedback scorer (truncated). The patient does not read them.
- **No LMS integration.** Export is JSON and CSV only.
- **Single instance.** SQLite in one file on one EC2 instance, with in-process background workers
  for care journeys. No horizontal scaling.
- **Open registration.** Anyone can create an account, including a faculty account. There is no
  SSO and no email verification.
- **Infrastructure is scripted, not templated.** `infra/` holds the AWS CLI commands, instance
  bootstrap and CloudFront config used to stand the server up. It is not Terraform or
  CloudFormation and has only been run once, on the hackathon account.
- **Temporary infrastructure.** The live URL runs on the hackathon's AWS account and will stop
  working when that account is closed.
- **Model choice was constrained.** Opus-class models were not available on the account. Drafting,
  review, scoring and synthesis run on Claude Sonnet 5.
- **Care Journey limits** (one human per run, cases written for one profession, long waits for late
  roles) are listed in docs/ARCHITECTURE-journeys.md, section 11.
