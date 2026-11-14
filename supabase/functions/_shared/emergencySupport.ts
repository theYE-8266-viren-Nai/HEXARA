/** Fixed conversational support, not diagnosis, triage, or an exhaustive symptom detector.
 * Public first-aid sources describe Earth settings; onboard protocols take precedence. */
export type EmergencyTopic = "breathing" | "chest" | "stroke" | "bleeding" | "allergy" | "seizure" | "unresponsive" | "poisoning" | "burn" | "injury" | "temperature" | "glucose" | "mission" | "distress" | "illness" | "general" | "check_in" | "medication";
export type SupportResource = { label: string; url: string };
export type EmergencySupport = { topic: EmergencyTopic; content: string; details?: string; resources: SupportResource[] };
export const GLUCOSE_GUIDANCE_URL = "https://www.niddk.nih.gov/health-information/diabetes/overview/preventing-problems/low-blood-glucose-hypoglycemia";
export const EMERGENCY_GUIDANCE = "Contact your crew medic and mission control now.\nOn Earth: call local emergency services. Do not wait for this chat.";
export const GLUCOSE_GUIDANCE = "Contact your crew medic now; on Earth, local emergency services.\nFollow your clinician's plan. Insulin lowers blood sugar: do not use it to treat suspected low blood sugar.\nUnconscious, seizing, or unable to swallow: get emergency help; no food or drink by mouth.\nOrbitWell does not measure blood glucose or choose doses. No one has been contacted.";
const FIRST_AID = { label: "MedlinePlus · First aid", url: "https://www.medlineplus.gov/firstaid.html" };
const NHS_HELP = { label: "NHS · Recognising emergencies", url: "https://www.nhs.uk/nhs-services/urgent-and-emergency-care-services/when-to-call-999/" };
const NHS = (path: string, label: string): SupportResource => ({ label: `NHS · ${label}`, url: `https://www.nhs.uk/${path}/` });

const TOPICS: Record<EmergencyTopic, { label: string; detail: string; resources: SupportResource[] }> = {
  unresponsive: { label: "Unresponsiveness", detail: "If the person cannot be woken or isn't breathing normally, tell the responder immediately.\nFollow their CPR/AED instructions and your training. No food or drink by mouth.", resources: [FIRST_AID] },
  breathing: { label: "Breathing or choking", detail: "Get a nearby crewmate.\nTell the medic if the person can speak, cough, or breathe. Follow approved first-aid training and medical instructions.", resources: [FIRST_AID] },
  chest: { label: "Chest symptoms", detail: "Stop exertion. Tell the medic when it started and if breathing is affected.\nOn Earth, do not drive yourself to care.", resources: [NHS("conditions/heart-attack", "Chest symptoms")] },
  stroke: { label: "Sudden weakness or speech changes", detail: "Report sudden weakness, face drooping, speech or vision changes, and when it began.\nGet help even if it has stopped.", resources: [NHS("conditions/stroke/symptoms", "Sudden neurological symptoms")] },
  bleeding: { label: "Bleeding", detail: "External bleeding, no embedded object: apply firm pressure with clean cloth.\nDo not remove or press on an embedded object. Follow the medic's instructions.", resources: [{ label: "British Red Cross · Heavy bleeding", url: "https://www.redcross.org.uk/first-aid/learn-first-aid/bleeding-heavily" }] },
  allergy: { label: "Allergic reaction", detail: "Report throat/tongue swelling or breathing difficulty immediately.\nFollow your clinician's emergency allergy plan while reaching help.", resources: [NHS("conditions/anaphylaxis", "Serious allergic reactions")] },
  seizure: { label: "Seizure", detail: "Move nearby hazards only if safe.\nDo not put anything in the person's mouth. Note the start time; tell the medic.", resources: [NHS("symptoms/what-to-do-if-someone-has-a-seizure-fit", "Seizure first aid")] },
  poisoning: { label: "Poison or overdose", detail: "Do not make the person vomit or give food/drink.\nKeep packaging. Tell the medic what, how much, and when.", resources: [NHS("conditions/poisoning", "Poisoning")] },
  burn: { label: "Burn or electrical injury", detail: "Avoid the hazard. Do not touch someone still in contact with electricity.\nLeave material stuck to a burn. No creams/oils. Follow the onboard burn protocol.", resources: [NHS("conditions/burns-and-scalds", "Burns and scalds"), FIRST_AID] },
  injury: { label: "Injury", detail: "Avoid unnecessary movement.\nReport where/how the injury happened, especially head or neck impact. Follow the medic's instructions.", resources: [FIRST_AID] },
  temperature: { label: "Heat or cold exposure", detail: "Report heat/cold exposure, confusion, collapse, or breathing changes.\nFollow onboard environmental procedures and medical instructions.", resources: [FIRST_AID] },
  glucose: { label: "Blood sugar concern", detail: GLUCOSE_GUIDANCE, resources: [{ label: "NIH · Blood sugar guidance", url: GLUCOSE_GUIDANCE_URL }] },
  mission: { label: "Mission environment hazard", detail: "Report the alarm/exposure. Use the specific onboard emergency checklist.\nChat cannot determine cabin safety, exposure dose, or equipment actions.", resources: [] },
  distress: { label: "Personal safety", detail: "Reach a nearby crewmate now. Say you need help staying safe.\nFollow crew medical support's instructions.", resources: [NHS_HELP] },
  illness: { label: "Feeling unwell", detail: "Report symptoms, when they began, and any worsening.\nFlag severe pain, persistent vomiting, confusion, or breathing trouble immediately.", resources: [FIRST_AID] },
  general: { label: "Urgent support", detail: "Report what happened, your location, and whether the person is awake and breathing normally.\nFollow mission emergency procedures.", resources: [NHS_HELP] },
  check_in: { label: "Symptom conversation", detail: "What are you feeling, and when did it start?\nSudden, severe, or worsening symptoms: contact your crew medic now; on Earth, local emergency services. Don't wait for chat.\nI cannot diagnose. No one has been contacted.", resources: [FIRST_AID] },
  medication: { label: "Medication question", detail: "Ask your crew medic. Follow your clinician's existing plan.\nI cannot prescribe or choose injections/doses.\nUrgent: contact medical support now; on Earth, local emergency services. No one has been contacted.", resources: [] },
};

const BRIEF_SUPPORT: Record<EmergencyTopic, string> = {
  unresponsive: "Contact crew medic now. Earth: emergency services.\nUnresponsive or abnormal breathing? Follow responder CPR/AED instructions.\nNo food/drink by mouth.",
  breathing: "Contact crew medic now. Earth: emergency services.\nGet a nearby crewmate.\nReport ability to speak, cough, or breathe.",
  chest: "Contact crew medic now. Earth: emergency services.\nStop exertion. Report start time.\nDo not drive yourself.",
  stroke: "Contact crew medic now. Earth: emergency services.\nReport when symptoms started.\nGet help even if symptoms stop.",
  bleeding: "Contact crew medic now. Earth: emergency services.\nExternal bleeding without embedded objects: firm pressure with clean cloth.\nLeave embedded objects untouched.",
  allergy: "Contact crew medic now. Earth: emergency services.\nFollow your prescribed emergency allergy plan.\nReport throat swelling or breathing trouble.",
  seizure: "Contact crew medic now. Earth: emergency services.\nClear nearby hazards safely. Nothing in the mouth.\nNote start time.",
  poisoning: "Contact crew medic now. Earth: emergency services.\nDo not induce vomiting or give food/drink.\nKeep packaging.",
  burn: "Contact crew medic now. Earth: emergency services.\nDo not touch someone connected to electricity.\nLeave stuck clothing. No creams/oils.",
  injury: "Contact crew medic now. Earth: emergency services.\nAvoid unnecessary movement.\nReport head/neck impact.",
  temperature: "Contact crew medic now. Earth: emergency services.\nReport exposure, confusion, or breathing changes.\nFollow onboard protocols.",
  glucose: "Contact crew medic now. Earth: emergency services.\nSuspected low sugar: no insulin. Follow your clinician's plan.\nUnconscious/unable to swallow: no food/drink.",
  mission: "Contact mission control and crew medic now.\nUse the onboard emergency checklist.\nChat cannot assess cabin safety.",
  distress: "Contact crew medic now. Earth: emergency services.\nReach a nearby crewmate.\nSay you need help staying safe.",
  illness: "Contact your crew medic.\nReport symptoms, start time, and worsening.\nSevere symptoms? Get urgent help now. Earth: emergency services.",
  general: "Contact crew medic now. Earth: emergency services.\nReport your location and what happened.\nIs the person awake and breathing?",
  check_in: "What are you feeling? When did it start?\nSevere or worsening? Crew medic now. Earth: emergency services.",
  medication: "Ask your crew medic. Follow your existing care plan.\nI cannot prescribe or choose injections/doses.\nUrgent? Crew medic now. Earth: emergency services.",
};

export const SUPPORT_TOPICS = Object.entries(TOPICS).map(([id, topic]) => ({ id: id as EmergencyTopic, label: topic.label }));
const normalize = (text: string) => text.normalize("NFKC").toLowerCase().replace(/[’‘]/g, "'").replace(/[-_]/g, " ");

// Conservative matching is a routing convenience, never a severity assessment.
const rules: Array<[EmergencyTopic, RegExp]> = [
  ["unresponsive", /\b(unconscious|unresponsive|collapsed?)\b|pass(?:ed|ing)? out|can'?t wake|cannot wake|not breathing|stopped breathing/],
  ["distress", /hurt myself|kill myself|end my life|suicid\w*|hurt someone|harm myself/],
  ["allergy", /\b(allerg\w*|anaphyl\w*)\b|(?:throat|tongue|lips?).{0,20}(?:swell|swoll|tight)|(?:swell|swoll).{0,20}(?:throat|tongue|lips?)/],
  ["stroke", /\b(stroke|slurr\w*|paralys\w*)\b|face.{0,12}droop|one side.{0,20}(?:weak|numb)|(?:weak|numb).{0,20}one side|sudden.{0,20}(?:vision|speech)/],
  ["breathing", /\b(breath\w*|chok\w*|gasp\w*|wheez\w*|asthma)\b|can'?t get air|cannot get air/],
  ["chest", /\b(chest|heart attack|palpitation\w*)\b/],
  ["bleeding", /\b(bleed\w*|hemorrhag\w*|haemorrhag\w*)\b|losing blood\b(?!\s*sugar)|blood loss/],
  ["seizure", /\b(seizure\w*|convuls\w*|epilep\w*)\b/],
  ["poisoning", /\b(poison\w*|overdos\w*)\b|swallowed.{0,25}(?:chemical|cleaner|bleach|pills)|toxic.{0,12}(?:fumes|gas)/],
  ["mission", /\b(decompression|radiation|dosimeter)\b|cabin pressure|oxygen (?:leak|alarm|failure)|co2 alarm|carbon dioxide|air leak|smoke alarm/],
  ["burn", /\b(burn\w*|scald\w*|electrocut\w*)\b|electric(?:al)? shock/],
  ["temperature", /heat\s*stroke|heat exhaustion|hypothermia|frostbite|overheating/],
  ["glucose", /\b(insulin|glucose|hypoglyc\w*|hyperglyc\w*|blood\s*sugar)\b/],
  ["injury", /\b(injur\w*|fractur\w*|broken|sprain\w*|wound\w*)\b|hit my head|head trauma|neck pain|cut (?:my|his|her|their)/],
  ["medication", /\b(inject\w*|dos(?:e|es|ing)|medicat\w*|prescri\w*|\d+\s*(?:mg|mcg|ml|units))\b/],
  ["general", /\b(emergency|urgent|severe|faint\w*|dizz\w*|confus\w*)\b|need help now/],
  ["illness", /\b(pain|hurts?|ache\w*|headache\w*|vomit\w*|diarrh\w*|fever|nause\w*)\b/],
  ["check_in", /feel(?:ing)? (?:unwell|sick|ill|bad|weird)|not feel(?:ing)? (?:well|right|good)|something.{0,8}wrong|symptom\w*/],
];

export function getEmergencySupport(message: string, previousTopic?: EmergencyTopic): EmergencySupport | undefined {
  const text = normalize(message);
  const detected = rules.find(([, pattern]) => pattern.test(text))?.[0];
  // A newly reported red flag replaces the prior topic; vague follow-ups stay local.
  const topic = detected ?? previousTopic;
  if (!topic) return undefined;
  const item = TOPICS[topic];
  const result = (details: string, content = BRIEF_SUPPORT[topic]): EmergencySupport => ({ topic, content, details, resources: item.resources });
  if (previousTopic && !detected) {
    if (/what.{0,20}(?:tell|say)|summary|handoff/.test(text)) return result("Tell the medic:\n• Symptoms, location, start time, changes.\n• Awake? Breathing normally?\n• Actual readings, time/units, allergies, actions taken.\nDo not use OrbitWell's simulated values. Nothing sent automatically.", "Tell the medic symptoms, location, start time, and breathing/awareness.\nInclude actual readings and actions taken.\nNever use simulated values.");
    if (/\balone\b|^no[.! ]*$|can'?t reach|cannot reach|no (?:medic|help|signal)|disconnected/.test(text)) return result("Use your backup mission emergency channel or alert a nearby crewmate now.\nOn Earth: call local emergency services; give your location.\nDo not wait here. I cannot reach help for you.", "Use the backup emergency channel or alert a crewmate now.\nEarth: call emergency services; give your location.\nI cannot contact help.");
    if (/medic.{0,15}(?:with|here)|help.{0,15}(?:way|here)|(?:called|contacted|reached).{0,20}(?:medic|support|help)|^yes[.! ]*$/.test(text)) return result("Follow the medic's instructions. Report any changes, even if you feel better.\nI cannot confirm that the situation is safe. No one has been contacted by this app.", "Follow the medic's instructions.\nReport changes, even if you feel better.\nChat cannot confirm safety.");
    return result(`Share that update with your crew medic. I cannot judge whether things are improving.\n${topic === "check_in" ? "Sudden, severe, or worsening: reach medical support now." : "Follow medical instructions and mission emergency procedures."}\nNo one has been contacted.`, "Tell your crew medic what changed.\nFollow their instructions.\nWorsening? Reach emergency support now.");
  }
  if (topic === "check_in" || topic === "medication") return result(item.detail);
  if (topic === "glucose") return result(GLUCOSE_GUIDANCE);
  return result(`${EMERGENCY_GUIDANCE}\n${item.detail}\nI cannot diagnose. No one has been contacted.`);
}
