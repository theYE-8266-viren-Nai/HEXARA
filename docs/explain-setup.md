# "Explain this pattern" setup

Simulated data only. Not medical advice. Not diagnostic.

The button works **without any setup**: it shows a built-in explanation. The steps below add an optional
cloud AI wording. OrbitWell never puts an API key in the browser. Keys live only in Supabase secrets.

## What is sent, and when

Only when you press **Explain this pattern**, and only this de-identified summary: stage, pattern level,
pattern score, up to three signals (name, higher/lower, percent), data quality, and source. No names, ids,
dates, notes, raw readings, files, video, or images. The browser and the Edge Function both reject anything else
(`supabase/functions/_shared/validate.ts`). The summary goes to the AI service you choose and, with OpenRouter, on to
the company that runs the model. Check that model's page on OpenRouter for its data and logging policy.

## Free models only (the default, so credit can never run out)

The cloud features (Explain this pattern, the wellbeing AI feedback and the ORBIT chat) share the same secrets and the same free-only rule from
`supabase/functions/_shared/providers.ts`:

- A model is allowed only if it is `openrouter/free` or its id ends in `:free`.
- Anything else is refused **before any request is sent**, with the code `paid_model_blocked`. A paid model typed into `OPENROUTER_MODEL` by
  mistake therefore cannot spend credit. A comma list is refused if even one entry is not free.
- Anthropic is paid, so an `ANTHROPIC_API_KEY` alone is refused too, and a blocked OpenRouter model never quietly falls back to it.
- Only the owner can lift the guard, by setting the secret `ALLOW_PAID_MODELS=true` on purpose. Do not set it if you want to spend nothing.

The recommended, no-cost setting is:

```bash
supabase secrets set OPENROUTER_MODEL=openrouter/free
```

Free models can still be slow or rate limited (`429`). That never costs money: the app shows its built-in text and you can press the button again.
For extra safety, keep the OpenRouter key's credit limit tiny and never add credit.

## Which service is used

| You set | What happens |
| --- | --- |
| `OPENROUTER_API_KEY` and a free `OPENROUTER_MODEL` | OpenRouter is used with that model (wins if both services are set) |
| only `ANTHROPIC_API_KEY` | refused as paid, unless `ALLOW_PAID_MODELS=true` |
| nothing | the function answers "not configured" and the app shows the built-in text |

If `OPENROUTER_API_KEY` is set but `OPENROUTER_MODEL` is not, the function answers "model_missing" rather than guessing.

## One-time setup with OpenRouter (you run these, in your own terminal)

1. Create a key at openrouter.ai (Keys) and set a small spending limit on it. Keep it private. Never paste it into chat,
   code, or GitHub. If you ever do, delete that key on OpenRouter and make a new one.
2. Choose a model. **To spend nothing, use `openrouter/free`**: a router that picks an available free model for each request, so one busy model does not break it. You can also list up to three model ids separated by commas, for example `google/gemma-4-31b-it:free,google/gemma-4-26b-a4b-it:free`; OpenRouter tries the next one if the first fails or is rate limited. Otherwise choose one at openrouter.ai/models. Copy a single id exactly as shown (it looks like `vendor/model-name`). It must be a **chat/text model**: names containing "embed" are embedding models, which cannot write sentences and make OpenRouter answer 400. Avoid models labelled "reasoning" or "code" too; reasoning models can spend the short reply budget thinking and return no text. Free models can be slow or rate limited (`429`), and the router may pick different models, so wording quality varies. A free or very
   cheap model works for this short text, but a weaker model's wording is rejected by OrbitWell's safety check more often, so
   you would see the built-in text more often.
3. Install the Supabase CLI once: `brew install supabase/tap/supabase`, then log in and link this project:

```bash
supabase login
```

```bash
supabase link --project-ref chfvsmbsgdwauqbwnamv
```

4. Store the key and the model as server secrets (replace the placeholders; they are saved on Supabase, not in this repo):

```bash
supabase secrets set OPENROUTER_API_KEY=your-key-here
```

```bash
supabase secrets set OPENROUTER_MODEL=vendor/model-name
```

5. Deploy the function again (it must be redeployed after this change):

```bash
supabase functions deploy explain-pattern
```

## Using Anthropic instead

Set `ANTHROPIC_API_KEY` (and no OpenRouter key) and deploy:

```bash
supabase secrets set ANTHROPIC_API_KEY=your-key-here
```

## Check that it works

Open Home or Trends, choose the Recovery concern demo scenario, and press **Explain this pattern**. The label should read
**Explanation by OrbitWell (AI-assisted)**. If it reads **Built-in explanation**, the small note under it says it was
unavailable. To see the reason, send an empty request to the function and read the status:

- `503 not_configured`: no key secret is set.
- `503 paid_model_blocked`: the chosen model is not free (see above).
- `503 model_missing` or `model_invalid`: `OPENROUTER_MODEL` is missing or has odd characters.
- `502 upstream_error` with `upstreamStatus` and a short `upstreamMessage` from OpenRouter (for example "No auth credentials found" or a rate-limit reason): `400` the model id is not a chat model or does not exist (the function already retries once with the instructions inside the user message for models that reject a system message), `401` wrong or revoked key, `402` no credit, `404` unknown model, `429` rate limited.
- `502 unsafe_output`: the model's text failed OrbitWell's wording check twice (the function already asked once more).
- `400 invalid_request`: expected for an empty request when the secrets are fine.

In DevTools, Network tab, the `explain-pattern` request body should contain only the fields listed above.

## Safety checks

- The system prompt forbids diagnosis, conditions, probabilities, treatment, medication, clearance, and every topic in
  `NOT_ASSUMED` (`src/domain/deviceAssumptions.ts`). A test keeps both lists identical.
- Text from the cloud must pass `isSafeExplanation` in the Edge Function **and** again in the browser; otherwise the
  built-in text is shown. This applies to every provider.
- The function times out after 15 seconds (free models can be slow), cuts any reply that stopped mid-sentence back to its last full sentence, asks the model once more when a reply fails the wording check (only if under 8 seconds have passed; errors such as a wrong key or a rate limit are never retried), limits requests per user, rejects bodies over 4 KB, and never forwards a
  provider's full error body, only its status code and a short, sanitized, 200-character message (keys are redacted).
- Anyone who has the app's public key can call the function, so the spending limit on your key is the real safeguard.
