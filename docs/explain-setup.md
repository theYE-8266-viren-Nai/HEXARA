# "Explain this pattern" setup

Simulated data only. Not medical advice. Not diagnostic.

The button works **without any setup**: it shows a built-in explanation. The steps below add an optional
cloud AI wording. Horizon never puts an API key in the browser. Keys live only in Supabase secrets.

## What is sent, and when

Only when you press **Explain this pattern**, and only this de-identified summary: stage, pattern level,
pattern score, up to three signals (name, higher/lower, percent), data quality, and source. No names, ids,
dates, notes, raw readings, files, video, or images. The browser and the Edge Function both reject anything else
(`supabase/functions/_shared/validate.ts`). The summary goes to the AI service you choose and, with OpenRouter, on to
the company that runs the model. Check that model's page on OpenRouter for its data and logging policy.

## Which service is used

| You set | What happens |
| --- | --- |
| `OPENROUTER_API_KEY` and `OPENROUTER_MODEL` | OpenRouter is used with that model (wins if both services are set) |
| only `ANTHROPIC_API_KEY` | Anthropic is used with a built-in model |
| nothing | the function answers "not configured" and the app shows the built-in text |

If `OPENROUTER_API_KEY` is set but `OPENROUTER_MODEL` is not, the function answers "model_missing" rather than guessing.

## One-time setup with OpenRouter (you run these, in your own terminal)

1. Create a key at openrouter.ai (Keys) and set a small spending limit on it. Keep it private. Never paste it into chat,
   code, or GitHub. If you ever do, delete that key on OpenRouter and make a new one.
2. Choose a model at openrouter.ai/models. Copy its id exactly as shown (it looks like `vendor/model-name`). A free or very
   cheap model works for this short text, but a weaker model's wording is rejected by Horizon's safety check more often, so
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
**Explanation by Horizon (AI-assisted)**. If it reads **Built-in explanation**, the small note under it says it was
unavailable. To see the reason, send an empty request to the function and read the status:

- `503 not_configured`: no key secret is set.
- `503 model_missing` or `model_invalid`: `OPENROUTER_MODEL` is missing or has odd characters.
- `502 upstream_error` with `upstreamStatus`: `401` wrong or revoked key, `402` no credit, `404` unknown model, `429` rate limited.
- `502 unsafe_output`: the model's text failed Horizon's wording check.
- `400 invalid_request`: expected for an empty request when the secrets are fine.

In DevTools, Network tab, the `explain-pattern` request body should contain only the fields listed above.

## Safety checks

- The system prompt forbids diagnosis, conditions, probabilities, treatment, medication, clearance, and every topic in
  `NOT_ASSUMED` (`src/domain/deviceAssumptions.ts`). A test keeps both lists identical.
- Text from the cloud must pass `isSafeExplanation` in the Edge Function **and** again in the browser; otherwise the
  built-in text is shown. This applies to every provider.
- The function times out after 8 seconds, limits requests per user, rejects bodies over 4 KB, and never forwards a
  provider's error body, only its status code.
- Anyone who has the app's public key can call the function, so the spending limit on your key is the real safeguard.
