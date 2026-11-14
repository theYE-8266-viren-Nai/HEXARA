# ORBIT · NASA Research Assistant

ORBIT is Horizon's floating NASA research assistant for Future and Active workspaces. Retired astronauts start in a private, built-in conversation about life after flight and can explicitly switch to NASA research. NASA answers come from an indexed set of official public NASA sources. ORBIT is not a doctor, emergency service, mission authority, or substitute for qualified crew, medical, engineering, or flight-control teams.

## User workflow

1. Open the floating robot from any workspace page.
2. Ask a NASA or space question. The starter questions demonstrate human spaceflight, ISS engineering, and radiation topics.
3. A successful reply is labelled **NASA-grounded AI response** and contains numbered references such as `[1]`.
4. Open the source cards under the reply to inspect the NASA title, collection, date when available, excerpt, and direct official URL.
5. If retrieval finds no adequate support, ORBIT says it could not verify the answer. OpenRouter is not called for that question.

Visible replies show at most 30 words in 1–3 short lines, with longer fixed guidance and references collapsed under "More guidance". Urgent escalation and key cautions remain visible. NASA research prompts request the same concise format; server and browser checks reject generated replies over 30 words, 250 characters, or three nonempty lines. Older cloud replies outside this contract get a brief notice.

`supabase/functions/_shared/emergencySupport.ts` provides fixed conversational guidance for breathing/choking, chest symptoms, sudden neurological changes, bleeding, allergy, seizure, unresponsiveness, poisoning/overdose, burns, injuries, heat/cold exposure, glucose, personal safety, illness, medication questions, and mission hazards. Unfamiliar urgent concerns get general escalation guidance. `chatSafety.ts` shares this routing with the repository and Edge Function while retaining the output wording guard. This broad keyword matching is not exhaustive and must never be presented as emergency detection or triage.

The assistant does not share dashboard readings. NASA research chats are stored by life stage in the owner's Supabase session. Retired private conversation stays in browser session memory and is not sent to cloud AI or saved to the account.

## FAQ categories and voice

The panel groups starter questions by the selected stage: health and human
spaceflight, Future preparation, Active mission support, Retired follow-up,
missions and engineering, and NASA science topics. These cards only help users
find a question; every factual answer still requires evidence from the NASA
index. The selected stage changes examples and suggested Horizon destinations,
not the evidence standard, and personal readings or private notes are never
included in a text or voice request.

Optional browser push-to-talk voice uses Vapi as an input/output layer. It must
be configured with the public client values below; no OpenRouter or Supabase
service key belongs in a `VITE_` variable:

```text
VITE_VAPI_PUBLIC_KEY
VITE_VAPI_ASSISTANT_ID
```

The Vapi assistant must be configured to call the same server-side ORBIT chat
tool/endpoint and speak only its validated `answer`. Without those values, text
chat remains available and the panel honestly reports that voice is unavailable.
Voice uses the same NASA retrieval, citation, emergency, and no-evidence rules;
it is not a second answer engine.

## Urgent-language boundary

Clear personal urgent language is handled locally first. The original statement is not persisted and is not sent to OpenRouter. ORBIT displays deterministic guidance to contact the crew medic, mission emergency channel, or local emergency services on Earth, and says that the app has not contacted anyone.

For an in-space emergency, onboard procedures, crew instructions, mission
control, and the crew medic always take priority. ORBIT is only a visible
reminder and research assistant; it cannot call anyone, issue mission commands,
or replace the approved emergency procedure.

After that warning, the user may choose **Ask NASA about this topic**. ORBIT shows a neutral research question, such as “What does NASA documentation report about respiratory concerns during human spaceflight?” Nothing is sent until the user confirms. Only that sanitized question is uploaded and persisted.

Educational questions such as “How does NASA study breathing changes in spaceflight?” or “What has NASA learned about radiation beyond low Earth orbit?” are treated as research questions, not personal emergencies.

## Grounding architecture

- `nasa_documents` stores source metadata; `nasa_chunks` stores text, generated full-text search data, and 384-dimensional `gte-small` embeddings.
- Both tables have RLS enabled and no browser-role grants or policies. Only server-side service-role code can ingest or retrieve them.
- `search_nasa_chunks` combines the top lexical and semantic candidates with reciprocal-rank fusion. A result needs lexical evidence or semantic similarity of at least `0.70`.
- `chat-assistant` authenticates the user, checks conversation ownership, embeds the question, retrieves at most eight passages, and sends only the question, limited NASA-focused history, and retrieved passages to OpenRouter.
- The model must return an answer plus retrieved source IDs. The server rejects invented IDs, unsupported URLs, missing citation markers, and unsafe diagnostic or operational wording.
- Citation metadata is saved as an immutable snapshot with each assistant message.

The bootstrap corpus contains 26 official sources across human spaceflight, ISS, Artemis, engineering, aeronautics, astrophysics, planetary science, Earth science, technical standards, and OSDR. The sync process preserves a reviewed source summary when a NASA page cannot be fetched. It currently indexes one compact 350–500-token bootstrap chunk per registry source; expanding to deeper document-level chunking is a future corpus task.

## Free OpenRouter configuration

ORBIT uses `OPENROUTER_MODEL=openrouter/free`. This keeps model usage free when OpenRouter has an eligible free route, but availability, latency, limits, and the selected underlying model can change. Horizon does not silently switch to a paid model. If the free route is unavailable or returns invalid cited JSON, the UI reports that cloud research is unavailable; it does not invent a response.

Required Supabase secrets:

```text
OPENROUTER_API_KEY
OPENROUTER_MODEL=openrouter/free
NASA_INGEST_SECRET
```

Keys stay in Supabase/GitHub secrets and must never use a `VITE_` prefix or be committed. Deployment order:

```bash
supabase db push --remote=<project-ref> --yes
supabase functions deploy nasa-corpus-ingest --remote=<project-ref> --use-api --no-verify-jwt --yes
supabase functions deploy chat-assistant --remote=<project-ref> --use-api --yes
NASA_INGEST_SECRET=<matching-secret> npm run nasa:sync
NASA_INGEST_SECRET=<matching-secret> npm run nasa:benchmark
npm run test:nasa-rls
```

The same `NASA_INGEST_SECRET` must be configured in Supabase and the weekly GitHub Action. The ingestion endpoint is not user-facing and additionally checks an allowlist of NASA domains.

## Verification record

- Live corpus: 26 documents, 26 bootstrap chunks, 15 collections.
- Retrieval benchmark: 24/24 representative questions found the expected official NASA source in the top five (100%).
- Live free-model smoke test: the ISS control-moment-gyroscope question returned a cited `nasa_grounded` answer through `openrouter/free`.
- Browser-role verification: NASA tables and search RPC are inaccessible; chat conversations/messages remain owner-only.

The benchmark measures retrieval, not factual completeness. NASA citations provide educational evidence and are not operational authority or medical advice.
