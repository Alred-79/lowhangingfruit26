# Rounds: pitch and demo plan

RU Health Hack 2026, School of Health Professions track. One pitch covers both entries: Challenge 1
(Virtual Patient Encounter System) and Challenge 2 (Connected Care Journey).

Contents: (1) the four-minute script, (2) what each brief asks the pitch to explain and where the
script covers it, (3) demo run-of-show, (4) likely questions with honest answers.

Live URL: https://d3k6ssmfceay1x.cloudfront.net. Demo accounts share the password `rounds-demo`.

## 1. Four-minute script

About 620 spoken words without the optional paragraph, which is four minutes at about 155 words
a minute. The paragraph marked *(cut if over)* adds about ten seconds and can be dropped without
losing a required item. Rehearse with a timer; the section times are targets.

### 0:00 to 0:25. The problem and what Rounds is

> Standardized-patient sessions are expensive to run and hard to schedule, so students get few
> repetitions. Rounds is a telehealth simulator. The student talks with a virtual patient on the
> left, a chart fills in on the right, and feedback follows. We entered both challenges, with one
> engine underneath.

### 0:25 to 1:25. Challenge 1: solution, architecture, technical approach

> A faculty member describes a patient in a paragraph. One model call drafts the whole case: about
> thirty facts, each with a disclosure tier, exams and orders with fixed results, chart documents,
> learning objectives and an answer key. Faculty edit it, run a consistency check, and publish.
>
> A case is only data. There is no patient-specific code, so a patient created now runs now. The
> library has 81 patients across 63 roles.
>
> On every student message, a fast model proposes which locked facts were asked about. Then plain
> code decides what is released, from the fact's tier,
> the rapport the student has built, and the difficulty level. The patient model is shown only
> released facts, so it cannot leak the rest. A second model audits the reply and flags any
> clinical claim that is not in the case. The chart is written from the faculty's wording, never
> from model output, and an order can only return an approved result.
>
> *(cut if over)* Voice is the browser's speech recognition in and Amazon Polly out. The models
> are Claude on Amazon Bedrock.

### 1:25 to 1:50. Challenge 1: educational value

> Because we keep a ledger of what was disclosed, "what you found and what you missed" is a record,
> not an impression. Every rubric score comes with a quote and a turn number, and code checks that
> the quote exists. Students can repeat a patient in a different mood, book a follow-up visit where
> the patient remembers them, and a rating model picks the next difficulty.

### 1:50 to 3:20. Challenge 2: journey, architecture, continuity, SBAR, collaboration, level

> For Challenge 2 the same patient moves through several encounters. Walter Greene, 72, with
> diabetes, heart failure and kidney disease, is seen by an emergency physician, a hospitalist and
> a dietitian. The student joins as one of them. The AI plays the others from the provided
> personas, and those AI clinicians interview the same patient engine under the same disclosure rules.
>
> The team's shared patient state is a set of append-only entries. Every entry stores its source,
> the contributor's role, the encounter, the simulated time, a status and the quoted evidence.
> Statuses separate established, patient-reported, uncertain, disputed and unanswered. Typed links
> between entries, such as uses, contradicts and resolves, record how one piece of information
> led to another.
>
> Information moves forward three ways. Facts already disclosed are on record in the next
> encounter. The patient remembers who they have seen. And each clinician writes an SBAR to the next.
>
> We evaluate every SBAR, and the student's teamwork, against nineteen TeamSTEPPS-aligned
> behaviours. Each one is marked observed or not, with where the evidence is, the quote, and one
> piece of feedback. A quote the code cannot find is not credited.
>
> We built all three levels: Base, Enhanced and Stretch. For Stretch, the student can page any
> colleague, earlier or later in the order, or call out to the whole team, and the team holds a
> huddle over whatever is still disputed or unanswered. The final view shows each profession's
> contribution, how information flowed, what is unresolved, and a care plan whose every action
> cites its entries.

### 3:20 to 3:50. Limitations

> What it is not. The AI-drafted patients are labelled "not faculty-reviewed", and no clinician has
> checked them. The patient's wording is held by a prompt and an audit, not a hard guarantee. The
> chart is an Epic-style layout, not an EHR integration. The avatar is a still portrait. It runs on
> one server with SQLite, supports one human per journey, and has not been tested with students.

### 3:50 to 4:00. Close

> One engine, cases as data, and a ledger that makes the chart, the feedback and the team's shared
> record traceable. Thank you.

## 2. What the briefs ask the pitch to explain

| Brief | Item | Where in the script |
|---|---|---|
| Challenge 1 | The solution | 0:00 and 0:25 |
| Challenge 1 | Architecture | 0:25 (case as data; gatekeeper, policy, patient, audit, chart) |
| Challenge 1 | Technical approach | 0:25 (models, deterministic disclosure, approved results, voice) |
| Challenge 1 | Educational value | 1:25 |
| Challenge 2 | The patient journey | 1:50, first paragraph |
| Challenge 2 | System architecture | 1:50, second paragraph (entries, provenance fields, links) |
| Challenge 2 | Which challenge level was achieved | 1:50, last paragraph (Base, Enhanced and Stretch) |
| Challenge 2 | How patient continuity works | 1:50, first and third paragraphs (same engine, facts on record, patient memory) |
| Challenge 2 | How information moves between encounters | 1:50, third paragraph |
| Challenge 2 | How SBAR and communication evaluation works | 1:50, fourth paragraph |
| Challenge 2 | How interprofessional collaboration works | 1:50, last paragraph |
| Challenge 2 | Limitations | 3:20 |

## 3. Demo run-of-show

The Challenge 1 brief says a faculty member on the judging panel will create a new patient and then
run an encounter with it. Two waits are unavoidable and are planned for below: drafting a patient
takes one to two minutes and scoring a visit takes about 1 minute. A full care journey takes about 15
minutes, so the Challenge 2 demo uses a run completed beforehand plus a short live start.

### Before the session

1. Use Chrome. Open https://d3k6ssmfceay1x.cloudfront.net/api/health and confirm it returns
   `"ok": true`.
2. **Window A, faculty.** Sign in as `faculty@rounds.demo`. Two tabs:
   - A1: **Patient Studio**, the library.
   - A2: open the seed patient **Helen Kowalczyk** ("Progressive Fatigue and Exertional Dyspnea in
     a 67-Year-Old on Chronic NSAIDs") in the editor and click **Check consistency** once, so the
     Consistency check section has results to show. This tab is what you talk over during drafting.
3. **Window B, student.** A separate browser profile or a private window, because the session is a
   cookie. Sign in as `student@rounds.demo`. Three tabs:
   - B1: a **finished care journey run**. Do this at least 20 minutes ahead: **Care Journeys** >
     Walter Greene > **Choose your role** > **Join as hospitalist (internal medicine)**, then
     complete your visit, the SBAR, the huddle and the care plan. Leave the tab on the journey page.
   - B2: **Progress**, after at least two scored practice visits so the rating chart has points.
   - B3: the feedback page of one of those scored visits, as a fallback if live scoring is slow.
4. In Window A, start one **Test visit** on any patient, allow the microphone when the browser asks,
   and end it. This grants the permission before the judges are watching.
5. The demo accounts are shared. Check the library for patients left by other people with similar
   names to the one you expect the judge to create.

### Part 1: Challenge 1, about 9 minutes

| Time | Who | Clicks | Say |
|---|---|---|---|
| 0:00 | Judge, Window A tab A1 | **New patient**. In **Describe the patient**, pick the learner role and type a paragraph about a patient. Optional: learning goals, target difficulty, a source document. **Continue**. | "Describe anyone you teach with. Details you give are kept as written; the model fills in the rest." |
| 0:40 | Judge | If **A few quick questions** appears: click answers, then **Draft the patient**. | "It asks only about things that would change the case clinically." |
| 1:00 | Presenter, switch to tab A2 | Drafting is running (one to two minutes). In Helen Kowalczyk's editor click **Facts and disclosure**. | "While that is being written, this is what will come back. Each fact has the patient's wording, the chart's wording and a tier: volunteered, when asked, needs trust, guarded." |
| 1:40 | Presenter | **Documents**, open a lab report. Point at "When does this document appear in the student's chart?" | "Documents are released from the start, by an order, or by a disclosure." |
| 2:10 | Presenter | **Consistency check**. Open one issue and its proposed fix. | "Rules catch structure. A model review compares every place the same value appears and proposes a patch. Nothing is applied until the faculty member accepts it." |
| 2:40 | Presenter | **Student preview**, scroll to "Not visible yet". | "This is all a student sees at the start, and this is what they have to earn." |
| 3:10 | Presenter, back to tab A1 | The new patient's editor has opened. Point at the "AI-drafted, not faculty-reviewed" notice. Click **Facts and disclosure** briefly, then **Check consistency**. | "This is the judge's patient. No code was written or deployed for it." While the check runs: "It stays labelled as not reviewed until a faculty member says otherwise." |
| 4:00 | Judge | **Publish**. Read the dialog. Leave the review box unticked unless the judge has actually reviewed it. **Publish**. | "Publishing is blocked on open high-severity issues unless you acknowledge them." |
| 4:20 | Judge | **Test visit**. Tick **Use my microphone**. **Join visit**. | "Same visit screen a student gets." |
| 4:30 | Judge | Talk to the patient for about three minutes. Prompt them: an open question; a specific question; a sensitive question asked bluntly, then again with empathy; a closed question about a symptom they did not put in the case. | Point at the right side each time a fact is filed under **This visit**. On the deflection: "The comfort meter moved; that fact needs trust." On the made-up symptom: "The patient says no. If the model does add something, it is flagged as not in the case record." |
| 6:30 | Judge | Chart tab **Results & orders**: request a test that is in the case, then one that is not. Open **Chart review** to see the released document. | "Only approved results can come back." |
| 7:15 | Judge | Red **End visit** button. One line in each write-up box. **Submit for feedback**. | |
| 7:30 | Presenter | Scoring is running (about 1 minute). Switch to Window B tab B2, **Progress**. | "While it scores: what was elicited and missed is already known from the ledger. The model is scoring the seven rubric domains and has to quote the transcript; code then checks each quote. Meanwhile, this is a student's rating per rubric domain. It is an Elo-style update with the patient's difficulty level as the opponent, and it picks the next level at an expected score near 70 percent. No language model chooses it." |
| 8:30 | Presenter, back to Window A | Feedback page. Scroll: rubric with evidence, **Findings you missed**, **Learning objectives**, **Safety and accuracy**, **Transcript**. | "Every score points at a turn. Missed findings come from the disclosure record. Objectives linked to facts are decided by that record, not by the model." |

If drafting fails: click **Try again** on the same page (the description is kept). If it fails
twice, run Part 1 from 4:20 using Helen Kowalczyk and say so. If scoring has not returned after two
minutes, show tab B3 and return later; a submitted visit can be scored again from its feedback page
with **Score this visit**.

### Part 2: Challenge 2, about 5 minutes

Use Window B (student).

| Time | Clicks | Say |
|---|---|---|
| 0:00 | New tab: **Care Journeys** > "Marcus Ramirez: heart failure, new diabetes and weight loss across four professions" > **Choose your role**. | "One patient, four encounters. The student picks a role; the AI plays the other three from the provided personas." |
| 0:20 | **Join as cardiologist**. Encounter 1 starts; the AI emergency physician's conversation streams. Let it run for about 40 seconds. | "This is an AI clinician interviewing the same patient engine. Its questions go through the same gatekeeper and tier rules as a student's, so it only learns what the case allows." |
| 1:00 | Switch to tab B1, the finished Walter Greene run. Open Encounter 1. Show "What this encounter added to the shared patient state" and the SBAR with its review. | "After each encounter the state is updated. Patient statements and results come straight from the engine's ledger. Clinicians' assessments are extracted by a model and kept only if their quote is found." |
| 1:40 | Open your own encounter. Show "Earlier information this encounter drew on". Click one entry to open the provenance panel. | "Who said it, in which role, in which encounter, at what simulated time, with what status, and the words it rests on." |
| 2:20 | Show **Your SBAR handoff** and **Review of the handoff**. | "Six communication behaviours per SBAR. Observed or not, the SBAR section, the quote, the feedback." |
| 2:50 | Open the huddle section. | "The agenda is built by code from what is still disputed, uncertain or unanswered. The student proposes; a colleague agrees or pushes back; the outcome is a new entry linked to the old ones. The team is told never to settle a question by inventing a fact." |
| 3:30 | **Integrated patient view** tab. Scroll: care plan ("Rests on", combines N professions), contributions by profession, influence chains, status board. | "The plan is organised by problem, not by profession. Every action cites entries; actions that cite nothing real are dropped." |
| 4:20 | **Teamwork evaluation** tab. | "The remaining thirteen behaviours across the visit, the note, the messages and the huddle. Only the student's own words count as evidence." |
| 4:50 | Optional: in Window A (faculty), **Care Journeys** > the Walter Greene journey > **Open run**. | "Faculty see the same run and trace." |

### Lines to avoid

Do not say the patient "cannot hallucinate", that the cases are "clinically validated", that it
"integrates with Epic" or Canvas, or that it has been tested with students. None of those is true.

## 4. Likely questions, honest answers

**How do you stop the patient from inventing clinical facts?**
Three layers, and only the first two are hard. Code decides which facts are released, and the chart
and order results are faculty-approved text that no model writes. The patient model is given only
the released facts and told to deny everything else. A second model then audits each reply and
flags unapproved clinical claims in the transcript. The patient can still say something outside the
case, the flag arrives after the sentence is shown, and if the audit call fails nothing is flagged.
What we can promise is that such a statement never reaches the chart, the feedback's findings or
the shared patient state.

**Has a clinician reviewed the patients?**
No. 73 of the 81 library patients are labelled "AI-drafted, not faculty-reviewed". The other 8 start
from the sample patient details we were given and were expanded by the same generator. The
consistency check finds contradictions inside a case; it does not establish that the medicine is right.

**How do you know the rubric scores are right?**
We do not know yet. They are a model's judgement and have not been compared with faculty raters.
What we did is limit how much depends on it: findings and linked objectives come from the ledger,
each score must quote the transcript and the quote is checked, low scores on two domains and any
safety concern flag the visit for instructor review, and faculty can adjust the score.

**Is that a real EHR? Is it connected to Canvas?**
Neither. The chart is an Epic-style layout drawn from the case data. There is no LMS integration;
grades export as CSV and cases as JSON. LTI launch and grade passback are future work.

**Is the avatar a video?**
No. It is a still portrait in a call frame with a speaking state and captions, with a Polly voice.
There is no lip-sync.

**Does voice work everywhere?**
Speech input uses the browser's speech recognition, so Chrome, Edge and Safari. In other browsers
the student types. Patient speech works wherever audio plays.

**What do the knowledge sources do? Is this RAG?**
No retrieval. A source document is given to the case drafter so the case agrees with it, and to the
feedback scorer, which judges clinical accuracy only against the answer key and those sources. The
patient does not read them.

**What happens when a student orders a test you did not anticipate?**
It comes back as "no approved result is available for this in the case file", and feedback lists it
under requests that were not part of the case. We chose a refusal over a generated value.

**Why two or three minutes to create a patient?**
One call writes the history, medications, labs, documents and answer key together so they agree.
Splitting it would give progress to show and more places for the parts to disagree. Scoring is
slow for a similar reason: one call with the whole transcript and rubric.

**Which models, and why not the largest?**
Claude Haiku 4.5 for the per-turn gatekeeper, order matching, audit and patient memory; Claude
Sonnet 4.5 for the patient's and clinicians' voices; Claude Sonnet 5 for drafting, review, scoring
and synthesis. Opus-class models were not available on the hackathon account.

**How would this scale?**
As built it would not: one EC2 instance, one SQLite file, background workers in the same process.
The encounter state is already a row per visit, so moving to PostgreSQL and more than one server is
conventional work, but it has not been done.

**How do you add a new profession, or a new patient?**
A profession is one entry in `data/professions.json`. A patient is created in the studio or
imported as JSON. Neither needs code.

**In Challenge 2, does earlier information really change later encounters, or is it just shown?**
Both are recorded separately. Facts already disclosed are on record in the next encounter's chart.
When a later clinician's question draws on an earlier entry, that is stored as a "uses" link with
the quoted words, and the influence chains in the final view are built only from those links.
Linking depends on a model recognising the connection, so it can over- or under-link.

**Can two students take two roles in the same journey?**
Not yet. A run has one student and AI colleagues.

**The provided patients are nutrition cases. Does a cardiologist get a real cardiology visit?**
Only as far as the case file goes. Every professional draws on the same approved facts and results,
so a non-nutrition role can only uncover what that case contains.

**What about privacy?**
All patients are synthetic. Student transcripts are stored in the application database on the
hackathon AWS account. Registration is open and there is no SSO, so this is not ready for real
student data.

**How long will the demo URL stay up?**
Until the hackathon AWS account is closed. The repository runs locally with your own Bedrock and
Polly access.
