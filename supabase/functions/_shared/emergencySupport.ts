/** Fixed conversational support, not diagnosis, triage, or an exhaustive symptom detector.
 * Public first-aid sources describe Earth settings; onboard protocols take precedence. */
export type EmergencyTopic = "breathing" | "chest" | "stroke" | "bleeding" | "allergy" | "seizure" | "unresponsive" | "poisoning" | "burn" | "injury" | "temperature" | "glucose" | "mission" | "distress" | "illness" | "general" | "check_in" | "medication";
export type SupportResource = { label: string; url: string };
export type EmergencySupport = { topic: EmergencyTopic; content: string; resources: SupportResource[] };
export const GLUCOSE_GUIDANCE_URL = "https://www.niddk.nih.gov/health-information/diabetes/overview/preventing-problems/low-blood-glucose-hypoglycemia";
export const EMERGENCY_GUIDANCE = "Contact your crew medic and mission control now using your mission emergency channel. On Earth, contact local emergency services. Do not wait for this chat. Follow your mission-approved emergency procedures and the medical team's instructions. OrbitWell cannot diagnose or provide emergency care. No one has been contacted by this app.";
export const GLUCOSE_GUIDANCE = "If blood sugar may be low, contact your crew medic now and follow your clinician-provided low-blood-sugar plan. Insulin lowers blood sugar; do not use it to treat suspected low blood sugar. If someone is unconscious, having a seizure, or unable to swallow safely, get emergency medical help immediately and do not give food or drink by mouth. OrbitWell does not measure blood glucose or determine whether it is high or low, and cannot advise medication doses. No one has been contacted by this app.";
const FIRST_AID = { label: "MedlinePlus · First aid", url: "https://www.medlineplus.gov/firstaid.html" };
const NHS_HELP = { label: "NHS · Recognising emergencies", url: "https://www.nhs.uk/nhs-services/urgent-and-emergency-care-services/when-to-call-999/" };
const NHS = (path: string, label: string): SupportResource => ({ label: `NHS · ${label}`, url: `https://www.nhs.uk/${path}/` });

const TOPICS: Record<EmergencyTopic, { label: string; detail: string; resources: SupportResource[] }> = {
  unresponsive: { label: "Unresponsiveness", detail: "Tell the responder immediately if the person cannot be woken or is not breathing normally. Follow their CPR/AED instructions and your training; do not give food or drink by mouth.", resources: [FIRST_AID] },
  breathing: { label: "Breathing or choking", detail: "Tell the medic whether the person can speak, cough, or breathe. Ask a nearby crewmate to assist and use your approved first-aid training while medical support guides you.", resources: [FIRST_AID] },
  chest: { label: "Chest symptoms", detail: "Stop exertion and tell the medic when the chest discomfort started and whether breathing is affected. Do not drive yourself to medical care on Earth.", resources: [NHS("conditions/heart-attack", "Chest symptoms")] },
  stroke: { label: "Sudden weakness or speech changes", detail: "Tell medical support about any sudden face drooping, one-sided weakness, speech difficulty, or vision change, and when it began. Seek help even if it has stopped; I cannot tell what caused it.", resources: [NHS("conditions/stroke/symptoms", "Sudden neurological symptoms")] },
  bleeding: { label: "Bleeding", detail: "For external bleeding, use firm pressure with a clean dressing or cloth if there is no object embedded in the wound. Do not remove an embedded object. Tell the medic if the bleeding continues.", resources: [{ label: "British Red Cross · Heavy bleeding", url: "https://www.redcross.org.uk/first-aid/learn-first-aid/bleeding-heavily" }] },
  allergy: { label: "Allergic reaction", detail: "Tell the medic immediately about swelling of the lips, tongue or throat, or breathing difficulty. If you have a clinician-provided emergency allergy plan, follow it while help is being reached; do not wait for chat to decide treatment.", resources: [NHS("conditions/anaphylaxis", "Serious allergic reactions")] },
  seizure: { label: "Seizure", detail: "Keep nearby hazards away if you can do so safely. Do not put anything in the person's mouth. Note when it started and whether they regain awareness, and tell the medic.", resources: [NHS("symptoms/what-to-do-if-someone-has-a-seizure-fit", "Seizure first aid")] },
  poisoning: { label: "Poison or overdose", detail: "Tell the medic what substance may be involved, how much, and when. Keep its label or packaging if available. Do not make the person vomit or give food or drink while awaiting professional advice.", resources: [NHS("conditions/poisoning", "Poisoning")] },
  burn: { label: "Burn or electrical injury", detail: "Avoid further contact with the hazard. Do not touch someone still in contact with electricity. Do not pull off material stuck to a burn or put creams or oils on it. Tell the medic what caused the injury; use the onboard burn protocol.", resources: [NHS("conditions/burns-and-scalds", "Burns and scalds"), FIRST_AID] },
  injury: { label: "Injury", detail: "Tell the medic where the injury is and how it happened, including any head or neck impact. Avoid unnecessary movement and follow the responder's instructions.", resources: [FIRST_AID] },
  temperature: { label: "Heat or cold exposure", detail: "Tell the medic about the exposure and any confusion, collapse, or change in breathing. Use your mission's approved environmental and medical procedures; I cannot assess temperature injury from this chat.", resources: [FIRST_AID] },
  glucose: { label: "Blood sugar concern", detail: GLUCOSE_GUIDANCE, resources: [{ label: "NIH · Blood sugar guidance", url: GLUCOSE_GUIDANCE_URL }] },
  mission: { label: "Mission environment hazard", detail: "Alert mission control about the environmental alarm, exposure, or equipment problem. Use the specific onboard emergency checklist and trained crew response. I cannot determine cabin safety, exposure dose, or equipment actions from chat.", resources: [] },
  distress: { label: "Personal safety", detail: "If you might hurt yourself or someone else, reach a nearby crewmate and crew medical support now. On Earth, use local emergency services if there is immediate danger. Tell them directly that you need help staying safe.", resources: [NHS_HELP] },
  illness: { label: "Feeling unwell", detail: "Tell the medic about the symptoms, when they began, and whether they are worsening. Mention persistent vomiting, severe pain, new confusion, or trouble breathing right away. I cannot determine the cause from chat.", resources: [FIRST_AID] },
  general: { label: "Urgent support", detail: "Tell the responder what happened, your exact location, and whether the person is awake and breathing normally. You can describe any situation here, but reaching human support comes first.", resources: [NHS_HELP] },
  check_in: { label: "Symptom conversation", detail: "I'm here to listen. What are you feeling, and when did it start? If symptoms are sudden, severe, rapidly worsening, or feel unsafe, contact your crew medic now; on Earth, use local emergency services. Do not wait for chat. I cannot diagnose, and no one has been contacted by this app.", resources: [FIRST_AID] },
  medication: { label: "Medication question", detail: "I can help you prepare questions for your crew medic, but I cannot prescribe, recommend injections, or choose medication doses. Follow your clinician's existing plan. If this is urgent, contact mission medical support now; on Earth, contact local emergency services. No one has been contacted by this app.", resources: [] },
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
  const result = (content: string): EmergencySupport => ({ topic, content, resources: item.resources });
  if (previousTopic && !detected) {
    if (/what.{0,20}(?:tell|say)|summary|handoff/.test(text)) return result("Tell the medic in your own words: what happened, your exact location, when it started, whether the person is awake and breathing normally, and what has changed. Share any actual device readings with their time and units; do not use OrbitWell's simulated values as evidence. Include known allergies and any actions already taken. I have not sent this information to anyone.");
    if (/\balone\b|^no[.! ]*$|can'?t reach|cannot reach|no (?:medic|help|signal)|disconnected/.test(text)) return result("I'm here in chat, but I cannot reach help for you. Use your backup mission emergency channel or alert the nearest crewmate using your approved procedures now. On Earth, contact local emergency services and give your location. Keep trying human support rather than waiting here. What is happening now?");
    if (/medic.{0,15}(?:with|here)|help.{0,15}(?:way|here)|(?:called|contacted|reached).{0,20}(?:medic|support|help)|^yes[.! ]*$/.test(text)) return result("If medical support is with you or responding, follow their instructions first. Tell them about any changes, even if you feel better. I can help you organise what to tell them, but cannot confirm that the situation is safe. No one has been contacted by this app.");
    return result(`I'm still here in chat. Please share that update with your crew medic; I cannot judge whether things are improving. ${topic === "check_in" ? "What symptoms are you noticing? If they are sudden, severe, or worsening, reach medical support now." : "Continue following their instructions and your mission emergency procedures. Has human medical support been reached?"} No one has been contacted by this app.`);
  }
  if (topic === "check_in" || topic === "medication") return result(item.detail);
  if (topic === "glucose") return result(`I'm here with you in chat. ${GLUCOSE_GUIDANCE}\n\nOn Earth, contact local emergency services if this is urgent. Is a crewmate or medic with you?`);
  return result(`I'm here with you in chat. ${EMERGENCY_GUIDANCE}\n\n${item.detail}\n\nIf you can reply without delaying help: is a crewmate or medic with you?`);
}

/** Educational NASA questions may contain hazard words without reporting an active emergency. */
export function getUrgentSupport(message: string, previousTopic?: EmergencyTopic): EmergencySupport | undefined {
  if (previousTopic) return getEmergencySupport(message, previousTopic);
  const text = normalize(message);
  const educationalQuestion = /^(what|why|how|when|where|which|does|do|is|are|can|could|would|explain|tell me about)\b/.test(text)
    && /\b(nasa|space|spaceflight|astronaut|spacecraft|mission|iss|microgravity|radiation|orbit|lunar|mars)\b/.test(text);
  return educationalQuestion ? undefined : getEmergencySupport(message);
}
