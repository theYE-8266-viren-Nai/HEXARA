# "Explain this pattern" setup

Simulated data only. Not medical advice. Not diagnostic.

The button works **without any setup**: it shows a built-in explanation. The steps below add an optional
cloud AI wording (Claude). Horizon never puts an API key in the browser. The key lives only in Supabase secrets.

## What is sent, and when

Only when you press **Explain this pattern**, and only this de-identified summary: stage, pattern level,
pattern score, up to three signals (name, higher/lower, percent), data quality, and source. No names, ids,
dates, notes, raw readings, files, video, or images. The browser and the Edge Function both reject anything else
(`supabase/functions/_shared/validate.ts`).

## One-time setup (you run these, in your own terminal)

1. Create an Anthropic API key at console.anthropic.com and set a small spending limit. Keep it private.
   Never paste it into chat, code, or GitHub.
2. Install the Supabase CLI: `brew install supabase/tap/supabase`
3. Log in and link this project:

```bash
supabase login
```

```bash
supabase link --project-ref chfvsmbsgdwauqbwnamv
```

4. Store the key as a server secret (replace the placeholder; it is saved on Supabase, not in this repo):

```bash
supabase secrets set ANTHROPIC_API_KEY=your-key-here
```

5. Deploy the function:

```bash
supabase functions deploy explain-pattern
```

## Check that it works

Open Home or Trends, press **Explain this pattern**. The label should read **Explanation by Horizon (AI-assisted)**.
If it reads **Built-in explanation**, the small note under it says why (not set up, error, too slow, or the
text failed Horizon's wording check). In DevTools, Network tab, the `explain-pattern` request body should
contain only the fields listed above.

## Safety checks

- The system prompt forbids diagnosis, conditions, probabilities, treatment, medication, clearance, and every topic in
  `NOT_ASSUMED` (`src/domain/deviceAssumptions.ts`). A test keeps both lists identical.
- Text from the cloud must pass `isSafeExplanation` in the Edge Function **and** again in the browser; otherwise the
  built-in text is shown.
- The function times out after 8 seconds, limits requests per user, and rejects bodies over 4 KB.
