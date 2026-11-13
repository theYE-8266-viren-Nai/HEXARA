# Voice check-in setup (Vapi)

Simulated data. Not medical advice. Not diagnostic.

The Wellbeing page has an optional **Check in by voice**. The person answers the same short questions as the
on-screen sliders out loud. Horizon turns the spoken answers into the same 1 to 5 values, shows them for review,
and only fills in the form when the person presses **Fill in the form**. That works exactly like moving the sliders by hand: the
values stay on the device as a draft, and the check-in is recorded when the person presses **Save**.

It works in two ways:

| Mode | Needs | What it is |
| --- | --- | --- |
| **Demo voice** | nothing | A simulated conversation. No microphone, no network, nothing real is captured. Always available. |
| **Vapi voice** | a Vapi account, a public key and an assistant ID | A real spoken conversation. Audio is processed by Vapi and the speech and AI services it uses. |

Until the two values below are set, the app shows "not set up yet" and only offers the demo.

## What goes where (read this first)

Voice is different from the rest of Horizon, where check-ins stay on the device:

- **Your voice leaves the device** and goes to Vapi and its providers. The consent screen says so and must be ticked first.
- **The voice library includes error-reporting software.** Installing `@vapi-ai/web` also installs Daily's WebRTC library, which bundles
  Sentry error reporting (visible in `package-lock.json`). It loads only when a voice call starts. Horizon cannot see or control what it
  reports, so the consent screen mentions it. Review it yourself if that matters for your use.
- **Horizon does not record or save audio or what was said.** It keeps the conversation in memory only while the screen is open.
- **Horizon asks Vapi not to record, log, or keep transcripts** and ends the call after 3 minutes. Vapi records calls and keeps logs
  by default, so Horizon sends these settings on every call. **Horizon cannot check that Vapi honours them**, so also switch recording
  and logging off in the Vapi dashboard (step 3) and check your account's data settings.
- **Only numbers are applied to the form** (and the spoken words only if the person ticks a box to add them as a note). Nothing the person said is stored by Horizon otherwise.
- **Horizon, not the AI, decides what the answers are and what is urgent.** The assistant only speaks and listens. Pain or severe-symptom
  words (including mental-health crisis wording) stop the check-in and open the support options. A fixed word list decides this.
- **A mention counts even if negated** ("no pain" also stops the check-in). That is deliberate: it errs on the side of caution.

## Step 1: create a Vapi account (you do this)

Sign up at vapi.ai. Voice calls are charged by Vapi per minute of use, so check their current pricing and set a spending limit.
Do not paste any key into chat, code, or GitHub.

## Step 2: create an assistant (you do this)

In the Vapi dashboard create an assistant. Choose any speech-to-text, language model, and voice you like. Leave its **first message** empty
(Horizon sends one). Paste the following as the **system prompt** exactly. The `{{...}}` parts are filled in by Horizon on every call so the
assistant asks only the questions that exist on the current page (three on Active and Future, four on Retired):

```text
You are the voice for Horizon, a research demo wellbeing check-in.

Ask exactly these {{questionCount}} questions, one at a time, in this order, using this wording:
{{questions}}

After each answer, say a very short acknowledgement (a few words), then ask the next question.
If an answer is not a number from 1 to 5 or is unclear, ask the same question again once, briefly.

After the last question, ask: {{finalQuestion}}
Then say thank you, tell the person they can review their answers on screen, and end the call.

Rules:
- Never give medical advice. Never diagnose. Never suggest treatment or medication. Never explain what the numbers mean.
- If the person mentions pain, a severe or worsening symptom, an emergency, or hurting themselves, say only:
  "Please contact the crew medic or mission support now." Then end the call.
- Keep every reply under 15 words. Speak calmly.
```

## Step 3: dashboard settings (you do this)

- Turn **call recording off** and **logging off** for the assistant, and turn transcript storage off if the option is shown.
- Set a **maximum call duration** of 3 minutes or less.
- Set a **spending limit** on the account.
- A Vapi **public key** is designed to sit in a browser, which also means anyone who has it can start calls billed to you. If the
  dashboard lets you restrict the key to specific websites, restrict it to your own.

## Step 4: add the two values to your environment file (you do this)

Copy the **public** key and the **assistant ID** (never the private key) into `.env.local`, which is ignored by git:

```text
VITE_VAPI_PUBLIC_KEY=your-vapi-public-key
VITE_VAPI_ASSISTANT_ID=your-assistant-id
```

Restart `npm run dev`. The Wellbeing page now shows **Start voice check-in** next to the demo.

## Step 5: try it

1. Wellbeing, then **Start voice check-in**, tick the consent box, press **Start**, and allow the microphone.
2. Answer each question with a number from 1 to 5 ("three", "four out of five", or "high" all work).
3. Check the review screen shows what you said, then **Fill in the form** and **Save**.
4. Try saying a question's answer unclearly. It should be asked again, not guessed.
5. Say "I have pain". The check-in should stop and open the support options, with nothing kept.

## If something fails

| You see | Likely cause |
| --- | --- |
| "Microphone permission was blocked" | Allow the microphone for this site in the browser, or use the sliders. |
| "The voice service could not start or was interrupted" | Wrong key or assistant ID, no internet, or the call limit was reached. |
| The assistant asks a different number of questions than the screen | The system prompt in step 2 was changed. Paste it again exactly. |
| Nothing happens when answering | Speak clearly with a number. Unclear answers are asked again by design. |

## Not verified

The real Vapi call has not been tried with a real account in this repository. Everything else is covered by tests: the answer
parsing, the urgent-word guard, the consent screen, the review and apply steps, the demo, and the Vapi adapter against a fake
SDK and the real SDK's types. Please try step 5 once with your own account and report anything unexpected.
