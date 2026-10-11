# Care Journeys: architecture and integration

Challenge 2, "The Connected Care Journey". This document describes what is built in the Poscere
repository: how one virtual patient moves through several professional encounters, how the team's
shared understanding of that patient is stored and traced, how information moves between
encounters, and how interprofessional communication is evaluated.

It is written for judges and for engineers who have not seen the code. File paths are given so
every claim can be checked.

## 1. What the system does

A faculty member picks one published patient case and defines an ordered list of encounters, each
with a professional role, a faculty-provided clinician persona, a focus, a simulated time, and the
text a student and the patient are given for that encounter (brief, tasks, booked reason, and the
patient's own reason for the call). Every encounter is an outpatient telehealth visit with the
patient at home. A
student opens the journey and chooses "Join as ..." for one encounter. The run then proceeds:

```
existing record ─► encounter 1 ─► SBAR ─► encounter 2 ─► SBAR ─► encounter 3 ─► ... ─► huddle ─► integrated view
                     │                      │                      │                     │
                     ▼                      ▼                      ▼                     ▼
              ┌──────────────────────────────────────────────────────────────────────────────┐
              │  shared patient state: append-only entries + typed relations between them    │
              └──────────────────────────────────────────────────────────────────────────────┘
```

- For the encounter the student chose, the student interviews the virtual patient in the normal
  Poscere visit screen, with a "Care team" tab showing the shared state and the handoff received.
- For every other encounter, an AI clinician (one of the five provided personas) conducts the
  visit while the student watches it stream.
- After every encounter the shared patient state is updated and the professional writes an SBAR
  to the next one.
- At any time the student can message any colleague, earlier or later in the order.
- After the last encounter the team holds a huddle over whatever is still disputed, uncertain or
  unanswered, then the integrated patient view, the coordinated care plan and the student's
  teamwork trace are produced.

Two journeys are seeded from the provided patients and personas
(`data/seed/journeys/*.json`): Marcus Ramirez (emergency medicine, cardiology, clinical pharmacy,
dietetics) and Walter Greene (emergency medicine, hospital medicine, dietetics).

### Challenge levels

| Level | Requirement | Where |
|---|---|---|
| Base | Three or more encounters, same patient, provided personas, student in one role, AI in the rest | `runner.ts`, `clinician.ts` |
| Base | Shared state updated after each encounter, record plus discovered information | `extract.ts` |
| Base | Earlier information influences a later encounter | `createStageEncounter`, `runAiVisit`, `uses` links |
| Base | Established / uncertain / disagreement / unanswered distinguished | entry `status`, derived `effectiveStatus` |
| Base | Provenance: source, role, encounter, timing | columns on every `state_entries` row |
| Base | Integrated representation and coherent care plan | `view.ts`, `synthesis.ts`, `FinalView.tsx` |
| Enhanced | SBAR handoffs, TeamSTEPPS-aligned explainable behavioral trace | `handoff.ts` |
| Stretch | Reach forward and backward, consults, call-outs, check-backs, closed loops, huddle, reconciliation, collaborative plan change | `collab.ts` |

All paths below are under `src/lib/journey/` unless stated.

## 2. Patient-state architecture

The shared patient state is not a document and not a chat log. It is a set of small typed
**entries** plus typed **relations** between them.

### Entries (`state_entries`, defined in `src/lib/db.ts`)

One row is one piece of knowledge about the patient. Fields:

| Field | Meaning |
|---|---|
| `kind` | `record`, `finding`, `result`, `goal`, `assessment`, `interpretation`, `recommendation`, `referral`, `plan_item`, `uncertainty`, `open_question`, `disagreement`, `follow_up`, `consult`, `callout`, `resolution`, `plan_change` |
| `status` | `established`, `patient_reported`, `uncertain`, `disputed`, `open_question`, `resolved` |
| `source` | `record`, `patient`, `exam`, `test`, `clinician`, `consult`, `huddle` |
| `contributor_role`, `contributor_name`, `contributor_is_ai` | who added it, in which professional role, and whether that was an AI colleague or the student |
| `stage_id`, `stage_order`, `encounter_id` | which encounter of the journey, and the engine encounter that carried it |
| `sim_time`, `created_at` | simulated time of the encounter and the real time of recording |
| `fact_id` | the case fact it corresponds to, when it came from the disclosure ledger |
| `evidence` | JSON: where the supporting words are (visit turn, note, record, consult, huddle), the quote, and whether the quote was verified |
| `meta` | flags such as values not found in the approved case file, importance, follow-up owner |

Entries are **append-only**. `addEntry()` in `store.ts` is the only writer and there is no update
or delete path. When knowledge changes, a new entry is added and linked to the old one.

### Relations (`state_links`, defined in `src/lib/schema/journeys.ts`)

`from_entry → to_entry` with a `relation` (`uses`, `confirms`, `contradicts`, `updates`, `answers`,
`resolves`), the stage in which the relation was made, and its own evidence quote. A relation is
what turns a pile of notes into a traceable story: "the cardiologist's question in turn 3 *uses*
the emergency physician's finding; the patient's answer is a new entry; the pharmacist's
recommendation *uses* that".

### Status that changes without editing

An entry's stored `status` is never changed. The status shown to users is **derived** when the
state is read, by one function (`deriveStatus()` in `types.ts`, used by `entriesOf()` in `store.ts`):

- any inbound `resolves` or `answers` relation makes it read as `resolved`;
- otherwise an inbound `confirms` relation from an approved result or record makes it read as
  `established` (a result that confirms what the patient said settles it);
- otherwise an inbound `contradicts` relation **from a disagreement entry** makes it read as
  `disputed`. A clinician's remark or interpretation never disputes an entry;
- otherwise it reads as written.

`answers` and `resolves` are only recorded for an entry that supplies the missing information. A
recommendation, referral or plan to find out is linked with `uses` and the question stays open; in
the huddle such an outcome is recorded as "stays open, with an owner".

Counts are computed by one function as well (`statusBoard()` in `types.ts`): the hub header, the
status board and the "how the state evolved" chart all call it (the chart with an "as of this point"
argument), so they cannot disagree. An open item that a later entry restates (for example the
huddle's "still open, owner X") is counted once, under the later entry.

The provenance panel shows both ("recorded as established; changed by a later entry") and the
relation history, so the earlier view of the patient is always recoverable. The "how the state
evolved" chart recomputes this derived status as of each point in the journey.

### What goes into the state, and how

After each encounter `extractStage()` (`extract.ts`) runs two passes.

1. **Deterministic, from the engine's disclosure ledger.** The single-encounter engine
   (`src/lib/engine/`) records exactly which faculty-approved facts the patient disclosed and
   which approved exam or test results were returned. Each disclosed fact becomes an entry with
   `source = patient`, `status = patient_reported`, its `fact_id`, and the patient's reply in that
   turn as evidence. Each result becomes an entry with `source = exam | test | record`,
   `status = established`. (A judgment whose only quoted evidence is the patient's words is
   dropped in pass 2: patient statements enter through the ledger only.) The chart-at-start items and documents on file become `record` entries
   at stage 0 when the run is created (`seedRecord()`), **with their content**: each lab row with
   value, unit, reference range and flag, each medication row, plotted points of a trend, or the
   text of a note (`documentText()`). A document released by a check during a visit is added the
   same way in that encounter. So an AI colleague asked about the HbA1c answers from the lab report
   on file instead of saying no information is available. Faculty-authored patient-versus-record
   mismatches become `disputed` entries once both sides are in the shared state: the patient's
   claim has been disclosed and the contradicting record is on file or has been pulled by a check. No model is involved
   in this pass, so a patient fact or a lab value can only enter the state if the case file contains it.

2. **Model-extracted clinician contributions.** One structured call (the "smart" model) reads the
   transcript and the clinician's note and proposes assessments, interpretations,
   recommendations, referrals, care-plan items, goals, uncertainties, open questions,
   disagreements with earlier entries, and follow-ups. Each proposal must carry a quote and a
   location. The code then checks it:
   - the quote must occur in the stated turn or in the note (punctuation and case are ignored;
     a wrong turn number is repaired if the quote is found elsewhere);
   - a claim about something that happened (a disagreement, a follow-up, a patient goal) with no
     verifiable quote is **dropped**; a judgment with no verifiable quote is kept but
     **downgraded to `uncertain`** and marked "evidence not verified";
   - a dose or lab-style value that appears nowhere in the case file, the record, the transcript
     or the note causes the entry to be dropped; a value that the clinician did say but that is
     not in the approved case file is kept and flagged in `meta.unverifiedValues`;
   - `relates_to` must name an existing entry; `answers` and `resolves` are only accepted
     against an entry that is actually open, and never from a recommendation, referral, plan item,
     question or uncertainty.
   Model-extracted entries can never be of kind `finding`, `result` or `record`.

3. **"Uses" relations.** The same call lists each turn in which the clinician's words drew on a
   specific earlier entry (quote verified against the clinician's line in that turn). AI clinicians
   also declare, with each question they ask, which earlier entries prompted it. Each such turn
   gives candidate links: (thing learned in that turn → earlier entry).

4. **Every proposed relation is checked before it is stored** (`verifyLinks()` in `extract.ts`).
   One narrow call (temperature 0) receives all candidates for the encounter, names the subject of
   each side, and must agree, for each, that: a `uses` link is between the clinician's words, the earlier entry and the new
   information **on the same subject** (a result ordered in the same turn about something else is
   rejected); a judgment that "builds on" an entry is about that entry's subject; an `answers`
   link supplies the missing information; a `contradicts` link is two incompatible factual claims
   about the same thing (otherwise the entry is kept as the clinician's interpretation and nothing
   is disputed). If this check fails to run, `uses` links survive only on plain word overlap and
   `answers` / `contradicts` are not recorded: a missing link is preferred to a false one. The
   quote stored on a `uses` link is the sentence of the clinician's turn that refers to the earlier
   entry (`bestSentence()`). If a question about an earlier entry produced no new approved finding,
   a `follow_up` entry says exactly that.

## 3. Workflow and information-transfer strategy

Information reaches a later encounter through four channels, all fed from the same entries.

| Channel | Receives | Mechanism |
|---|---|---|
| The patient | Everything already disclosed, a memory of who they saw and how long ago, and why they are on today's call | `createEncounter({ initialDisclosed, journey.patientMemory, journey.patientReason })` |
| The next clinician's chart | Shared state so far with provenance, and the handoff | `cfg.journey.priorContext`; `JourneyChartTab` for the student; prompt context for an AI clinician |
| The next clinician's instructions | The SBAR addressed to them | `handoffs` table |
| Out-of-sequence messages | Consults, clarifications and call-outs sent to them | `team_messages`, injected into an AI clinician's context by `inboxFor()` |

### Patient continuity

Every stage is a fresh engine encounter on the **same case snapshot**, so facts, approved results
and persona are identical across the journey. `createStageEncounter()` (`clinician.ts`) passes:

- `initialDisclosed`: the fact ids already disclosed in earlier stages. The engine marks them as
  on record, shows them in the chart, and includes them in "what you have already told" in the
  patient prompt, so the patient stays consistent and later clinicians cannot "discover" them again.
- `patientMemory`: a short patient's-eye account built without a model (`context.ts`): who they
  spoke to, when and how long ago that is today (simulated-time labels such as "Week 2, Tue 11:00"
  are parsed into days), which topics came up and which checks were done, and who they are speaking
  to today. It tells the patient that anything described earlier as "this morning" belongs to that
  earlier day, and that they were at home between visits.
- per-stage overrides on `cfg.journey` (`src/lib/types.ts`): `roleTitle`, `brief`, `tasks`,
  `patientReason`, `reason` and `ai`, all taken from the stage definition. The source case was
  written for one profession; these make the waiting room, the chart header and the patient's
  opening frame belong to the stage. When a stage leaves them empty, neutral defaults built from
  the role are used (`stageBrief()` and friends in `types.ts`), never the case's own brief.

### AI clinician encounters stay inside the engine

`runAiVisit()` (`clinician.ts`) does not let a model write the patient. For each of 5 exchanges
(configurable with `JOURNEY_AI_TURNS`):

1. the clinician model (persona brief from the faculty profile, the stage focus, the shared state
   with short labels and the content of documents on file, the SBAR it received, messages from
   colleagues, and what the ledger has confirmed so far in this visit) returns the next thing to
   say, the labels of earlier entries that prompted it, and optionally one check to request;
2. the line is passed to the engine's `runTurn()`, exactly as a student's message would be, so the
   gatekeeper and the tier and rapport rules decide what the patient discloses;
3. a requested check goes through `runAction()`, which can only return an approved result.

**The setting is fixed for every AI clinician** (`SETTING_RULES` in `clinician.ts`, used in the
visit, the note and the handoff): each encounter is an outpatient telehealth visit; the clinician
cannot admit, order beyond the listed checks, or start, stop or change a medicine; anything more is
a recommendation to the team; the record is authoritative and the patient's medication list is not
corrected from assumptions; assessments may not exceed the record and the confirmed findings; a
check may only be announced if it is requested through the engine in the same turn. Two regular
expressions back this up: a line or handoff that says the patient is being admitted or that
something was ordered, started or stopped, or a line that announces a check without requesting
one, is sent back once for correction.

The clinician then writes a note and an SBAR (`writeNoteAndHandoff()`). The **findings** come only
from the entries recorded for that stage; the transcript is deliberately not given to that call, so
anything the patient model said that the ledger did not back cannot reach the note. The **handoff**
is written against the whole shared state: the call also receives the earlier encounters, the
earlier handoffs and the list of items still open anywhere in the journey, and is told not to ask
for what an earlier professional already did and to carry forward the most important open items
(safety first). The note is then run through the same evidence-checked extraction as a student's note.

### Orchestration

`runner.ts` holds one background worker per run. It advances whatever a machine can do (AI stages,
state extraction) and stops whenever the student has to act (their visit, their SBAR, the huddle).
Stage progress is persisted in `journey_stage_runs` (`pending → running → visit_done → complete`
for AI stages; `ready → awaiting_handoff → complete` for the student's), so a restart resumes: an
interrupted AI visit is discarded and re-run (nothing from it had been written to the state), and an
interrupted extraction is repeated idempotently. Closing the huddle only marks it closed and
returns; the worker then writes the care plan and the evaluation, keeps whichever of the two
succeeded, retries once, and on failure stores the error on the run so the hub shows "Stopped" with
a retry button. Because that step is ordinary worker state, it too resumes on the next page load
after a restart.

`ensureProgress()` first asks `hasWork()` (a cheap, side-effect-free check). With nothing to do it
starts nothing and emits nothing, so reading a run (`GET /api/journeys/runs/:id`) can never cause
the client to read it again.

Events from the worker are buffered and served as Server-Sent Events
(`GET /api/journeys/runs/:id/stream`), which is how the student watches a colleague's visit unfold.
A reconnecting client sends `?after=<seq>&epoch=<id>` and receives what it missed; a new page
receives the visit in progress marked `replay`, which the client draws but never treats as news.
The client (`useRun()` in `shared.tsx`) fetches the run through a single function that allows one
request in flight and at least 2.5 s between background fetches, listens to the stream and polls
every 8 s only while the server is working, and makes no requests while the run is waiting on the
learner. The run does not depend on the browser being connected. Slow calls return through
`longJson` (whitespace heartbeats, then JSON) to survive proxy idle timeouts.

The student's own visit happens on the standard `/encounter/:id` screen. When it is scored, that
screen redirects to `/journey/:runId`; the hub sees the scored encounter, extracts state, and asks
for the SBAR.

## 4. State persistence

SQLite (better-sqlite3), one file. Tables used by this feature:

| Table | Holds |
|---|---|
| `journeys` | definition: case id, title, `spec` JSON with the ordered stages (role, persona, focus, simulated time, brief, tasks, patient's reason, booked reason) |
| `clinicians` | the faculty-provided personas, loaded from `data/clinicians/*.json` |
| `journey_runs` | one student's run: chosen stage, status, `huddle`, `synthesis` and `evaluation` JSON, `error` when the final write-up failed |
| `journey_stage_runs` | per-stage progress and the engine encounter id |
| `state_entries` | the shared patient state |
| `state_links` | relations between entries |
| `handoffs` | SBARs with their evaluation |
| `team_messages` | consult threads, call-outs, huddle positions and proposals, plan-change proposals |
| `encounters`, `messages` | the engine's own tables: one encounter per stage, full transcripts |

Everything the final view shows is recomputed from these rows by `buildView()` (`view.ts`); nothing
is cached in memory except the live event buffer.

## 5. Provenance model

The question "who said this, when, during which encounter?" is answered per entry by stored
columns, not by inference:

```
Finding:        Takes OTC ibuprofen 400mg 2-3 times weekly for chronic back/joint pain
Source:         Patient
Contributed by: Dr. Priya Narang (AI colleague)
Role:           Hospitalist (internal medicine)
Encounter:      Encounter 2
Simulated time: Week 1, Thu 13:30
Status:         Patient-reported
Evidence:       Visit transcript, turn 3 (patient): "I take Advil for my back, maybe two three times a week..."
History:        Builds on → "Medications: ... Ibuprofen 400 mg PRN ..." (existing record)
                Used by   → "NSAID use is contraindicated in this patient ..." (Dr. Narang)
                Used by   → consult reply to the dietitian (encounter 3)
```

Selecting any entry anywhere in the interface (chart tab, stage pages, huddle, care plan chips,
influence chains) opens this panel (`ProvenancePanel` in `src/components/journey/shared.tsx`).
When a later professional changes or interprets a piece of information, that is a new entry with
its own provenance and a relation back, so both contributions remain traceable.

**Influence chains** (`buildChains()` in `view.ts`) are computed only from stored relations (each of
which passed the same-subject check described in section 2) and handoff citations: an entry, the SBAR that passed it on (AI SBARs cite the entries they pass on),
the later question that drew on it (with the quoted words and turn), the new information that
question produced, who built on that, and the care-plan item that rests on it. No model is asked
to narrate how information flowed.

## 6. Data-sharing strategy

- **What a professional sees.** Entries from the existing record and from encounters before their
  own, plus consult replies and call-outs. Later encounters do not exist yet when the student is
  in theirs, so nothing has to be hidden.
- **What an AI colleague knows.** In a consult, an AI clinician is given the shared state and, only
  if their stage has already happened, their own transcript. A clinician who has not seen the
  patient is told so in the prompt and answers from the record only. The entry created from the
  exchange is marked `uncertain` when the colleague has not seen the patient or cites nothing.
  Only clinically meaningful content becomes an entry, as one clean statement the colleague
  supplies for the chart; acknowledgements, read-backs, thanks and logistics stay in the thread.
- **How colleagues address the student.** Every prompt that can speak to or about the learner
  carries one line (`learnerLine()` in `store.ts`): first name only, never "Dr.", and the learner's
  work is referred to by their role in the journey, not their home profession.
- **What the student's browser receives.** The run view contains entries, handoffs and
  transcripts. It never contains the case profile, undisclosed facts or the answer key.
- **Access.** A run is readable by its owner and by faculty; only the owner can act on it
  (`access.ts`).
- **Clinical guardrails.** Patient statements and results reach the state only from the engine's
  ledger. Model-written text (clinician notes, SBARs, consult replies, huddle outcomes, plan items)
  is checked for dose and lab-style values that do not occur in approved content
  (`unverifiedValues()` in `context.ts`); such values are dropped or visibly flagged depending on
  where they appear. Clinicians' assessments are stored with `source = clinician` and labeled as
  judgment, never as findings.

## 7. Communication evaluation design

The output is a behavioral trace, not a score. The behaviors are data
(`BEHAVIOURS` in `types.ts`), aligned to four TeamSTEPPS areas:

- **Communication** (judged from an SBAR): situation; relevant background; important findings;
  findings distinguished from interpretation; uncertainty stated; next action requested.
- **Situation monitoring:** reviewed prior information; recognized changes; noticed
  contradictions; identified unresolved concerns; recognized missing information.
- **Mutual support:** asked for clarification; responded to requests; acknowledged a colleague's
  contribution; escalated appropriately.
- **Leadership and coordination:** responsibilities; next steps; patient goals; coordinated
  recommendations.

For each behavior the trace stores `observed` (yes / no / no opportunity), the **evidence
location** in words ("SBAR → Recommendation", "Visit, turn 4", "Consult with Dr. Bennet", "Team
huddle", "Written note"), the **quote**, and **actionable feedback**.

How it is produced (`handoff.ts`):

- `evaluateSbar()` runs on every handoff. The model sees the SBAR, what was actually learned in the
  author's encounter (so "important findings" and "uncertainty" are judged against what there was
  to pass on), what earlier encounters had already found and done, and what was still open. A
  request for something already done is not credited as a next action, and omitting a
  safety-relevant open item costs "uncertainty stated". The student's SBAR is evaluated as soon as
  it is sent and shown before the journey moves on. The AI colleagues' SBARs are evaluated the same
  way and shown as worked examples, with feedback written in the third person.
- `evaluateStudent()` runs when the huddle closes and covers the remaining thirteen behaviors
  across five labeled sources: the student's visit, written note, SBAR, messages with colleagues
  and huddle contributions. It is also given system-recorded facts: which turns were linked to
  earlier entries, the handoff the student received, and what was open when they started.
- Every quote is verified by code against the stated source: case and punctuation are ignored and
  a run of at least four consecutive quoted words is enough, so a trimmed or re-punctuated quote
  still verifies. If it is found in a different source the location is corrected. A behavior
  marked "observed" whose quote cannot be found is **not credited** and says so. Only the student's
  own words count as evidence.
- The summary is written last, by a separate small call that sees only the checked per-behavior
  results, so it cannot praise a behavior that was not credited.

Closed-loop communication is detected structurally. Each consult message is classified as a
request, information, question, check-back, confirmation, read-back or answer; a loop is marked
closed when a request or piece of information is read back and then confirmed, or when the
student checks back and the colleague confirms.

Faculty see each student's trace per journey at `/faculty/journeys/:id`.

## 8. Active collaboration (Stretch)

All in `collab.ts`; all exchanges are stored in `team_messages` and also enter the shared state as
entries with relations.

- **Reach backward / forward, consults.** From the chart's Care team tab during the visit, or from
  the hub, the student messages any colleague. Replies are grounded as described in section 6. A
  message to a colleague who has not yet seen the patient is placed in that clinician's context
  when their encounter runs, so a forward heads-up changes what they ask.
- **Call-outs.** A message to the whole team; each colleague acknowledges with a read-back; it is
  shown to every later AI clinician.
- **Check-backs and closed loops.** Detected as above and labeled in the thread.
- **Huddle and reconciliation.** Candidates are the entries still `disputed`, `open_question` or
  `uncertain`. The model that writes the positions also chooses the agenda from those candidates
  (five by default), ranked by clinical importance with patient safety first (possible medication
  errors or duplications, medicines not taken, patient-versus-record conflicts), not by recency;
  only candidates can be chosen and gaps are filled deterministically. Each AI colleague whose role
  an item touches states a position citing entries. The student proposes how to settle each item;
  the best-placed colleague responds, agreeing or pushing back, and the outcome is written as a new
  entry: `resolution` with `resolves` relations to the original (and to both sides of a
  disagreement), or a new `open_question` with an owner and an `updates` relation when the team
  does not have the information to settle it. The model is instructed never to settle a question by
  inventing a fact, an outcome containing an unverified value cannot be recorded as resolved, and
  an unanswered question or uncertainty is only recorded as resolved when the outcome itself
  supplies the answer (the call must say so explicitly); an agreed plan to find out stays open.
- **Collaborative care-plan change.** After the plan is written the student can propose a change to
  any item; the owning colleague accepts (with refined wording) or declines with a reason. An
  accepted change keeps the previous wording as a revision on the item and adds a `plan_change`
  entry linked to the entries involved.

## 9. Final integrated representation and care plan

`/journey/:runId`, "Integrated patient view" (`FinalView.tsx`), built from `buildView()`:

1. a summary and a Use / Contribute / Identify / Communicate table per encounter, counted from
   entries, relations and handoffs;
2. the coordinated care plan;
3. what each profession contributed, grouped by role and by kind of contribution;
4. influence chains drawn as flows;
5. a board of established, patient-reported, uncertain, disputed, still unanswered and resolved items;
6. how the state evolved after each encounter.

The care plan (`synthesis.ts`) is model-written under constraints that are enforced by code:

- it is organized by patient problem or goal with the patient's own goal stated, not by profession;
- each action names owner roles and must cite entries; citations that do not resolve to real
  entries are removed, and an action left with none, or containing a value not present in the
  state, is dropped (the page says how many were dropped);
- for each action the code computes which professions' entries it rests on (`professionsOf()`; the
  existing record and the huddle are not professions) and shows "combines N professions", which
  makes synthesis versus compilation visible; an accepted plan change recomputes it;
- the plan writer sees each entry with the role that contributed it (no personal names), and a
  rationale that credits a role none of whose entries the action cites is replaced by an
  attribution computed from the cited entries;
- huddle resolutions override the entries they resolve; open items become actions to close the gap
  with an owner.

## 10. Extensibility

- **A new journey** is data: a row in `journeys` (or a JSON file in `data/seed/journeys/`). Faculty
  build one at `/faculty/journeys/new`, where a guide model proposes stages from the case, the
  persona roster and the role catalog (including each stage's student brief, tasks, booked reason
  and the patient's reason for the call), and faculty edit and publish. A persona is only cast in
  a role of its own profession; when none of the provided personas fits a role (nursing, for
  example) a plain named clinician of that profession plays it. Student-facing text that contains
  a medicine or value not on the record at start is discarded in favor of a neutral default.
  Seed journeys are refreshed from their files on boot unless faculty have edited them.
- **A new profession** is an entry in `data/professions.json`. Stages reference roles by id and are
  resolved at runtime (`resolveProfession()`), with a fallback if an id is not in the catalog; the
  stage's own role title is what is displayed.
- **A new clinician persona** is a JSON file in `data/clinicians/`; `personaBrief()` reads the
  provided profile structure.
- **A new teamwork behavior** is one line in `BEHAVIOURS`; evaluation and display iterate over it.
- **A new kind of entry or relation** is a string; the store, view and provenance panel are
  generic over them.
- **Any case** that runs in the single-encounter engine can be used in a journey unchanged,
  because a stage is an ordinary engine encounter with two extra inputs.
- The engine (`src/lib/engine/`) knows about journeys only through `cfg.journey`: prior context,
  the patient's memory and the per-stage overrides listed in section 3.

### Routes

Pages: `/student/journeys`, `/student/journeys/:id` (choose a role; accepts `?assignment=`),
`/journey/:runId` (hub and final view), `/faculty/journeys`, `/faculty/journeys/new`,
`/faculty/journeys/:id`.

API (`src/app/api/journeys/`): `GET/POST /api/journeys`, `POST /api/journeys/propose`,
`GET/PATCH /api/journeys/:id`, `POST /api/journeys/runs`, `GET /api/journeys/runs/:runId`,
`GET .../stream` (SSE), `POST .../retry`, `POST .../handoff`, `POST .../consult`,
`POST .../huddle` (`start` | `resolve` | `close`), `POST .../plan`.

## 11. Limitations

- **One human per run.** A run has one student and AI colleagues. Two students cannot yet take
  two roles in the same run, although nothing in the state model assumes a single human.
- **The cases were written for one profession.** The provided patients are nutrition-visit cases.
  Their facts and approved results are reused for every professional, so an emergency physician
  or cardiologist can only uncover what that case file contains. The waiting room, chart header and
  the patient's reason for the call are per stage, but the case's own facts still surface (a
  patient may volunteer "my doctor wants me to see someone about my eating" to any clinician,
  because that is an approved fact), and the chart's summary panel still lists the case's original
  "Reason for visit" row. Role-specific fact sets per stage would make non-nutrition encounters richer.
- **The patient model can say things the ledger did not approve.** The engine restricts what is
  *disclosed*, but the patient's wording is generated and occasionally adds a symptom or a
  biographical detail when asked a leading question. Such statements never become entries (only
  ledger facts do), AI clinicians are told to treat them as unconfirmed, and the AI note is written
  without the transcript, but a student can still read them in the conversation, and a clinician's
  in-visit remark built on one can be extracted as an `uncertain` interpretation.
- **Clinician interpretations are model-generated.** Assessments and recommendations by AI
  colleagues are labeled as judgment, value-checked and evidence-checked, but they are not
  faculty-reviewed clinical content.
- **Extraction and evaluation depend on a model.** Quote verification removes fabricated evidence;
  it cannot guarantee that every contribution was captured or that a "not observed" is right.
  "Uses" relations depend on a model recognizing that a question drew on an earlier entry and on
  a second model agreeing; the design errs towards under-linking.
- **The setting rules for AI clinicians are prompts plus two pattern checks**, not a proof. A
  clinician can still phrase an over-reach in words the patterns do not catch.
- **Timing.** An AI encounter takes roughly two minutes (five exchanges, then note, handoff,
  extraction and the relation check). A student who joins as the fourth professional watches about five minutes of
  colleagues' visits first.
- **Simulated time is a label**, not a clock; it orders encounters, appears in provenance, and is
  parsed only to tell the patient how many days ago each earlier visit was.
- **In-process worker.** The run worker lives in the Node process (state is in SQLite, so a restart
  resumes, but there is no multi-instance coordination).
- **AI-stage encounters are stored under the student's user id** with status `abandoned` so they
  do not appear as the student's attempts; they are identified through `journey_stage_runs`.
