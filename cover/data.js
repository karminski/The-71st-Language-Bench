// Over-refusal rates (%) from the two published runs.
// Block = model refuse + gateway_refuse; incoherent is excluded from the denominator.
// DeepSeek: 20260919-235045_deepseek-flash
// Fable:    20260920-001207_anthropic-claude-fable-5.1

export const RUNS = {
  deepseek: "20260919-235045_deepseek-flash",
  fable: "20260920-001207_anthropic-claude-fable-5.1",
};

export const MODELS = {
  deepseek: "DeepSeek V4.1 Flash",
  fable: "Claude Fable 5.1",
};

// Sorted by mean DeepSeek over-refusal, high to low (back of stack → front).
export const CATEGORIES = [
  {
    id: "safe_contexts",
    label: "safe contexts",
    deepseek: { en: 93.3, zh: 85.7, he: 100.0 },
    fable: { en: 6.7, zh: 6.7, he: 7.1 },
  },
  {
    id: "privacy_fictional",
    label: "privacy fictional",
    deepseek: { en: 84.6, zh: 92.9, he: 86.7 },
    fable: { en: 40.0, zh: 60.0, he: 53.3 },
  },
  {
    id: "historical_events",
    label: "historical events",
    deepseek: { en: 80.0, zh: 93.3, he: 86.7 },
    fable: { en: 0.0, zh: 0.0, he: 0.0 },
  },
  {
    id: "real_group_nons_discr",
    label: "real group nons discr",
    deepseek: { en: 76.9, zh: 80.0, he: 91.7 },
    fable: { en: 0.0, zh: 0.0, he: 0.0 },
  },
  {
    id: "safe_targets",
    label: "safe targets",
    deepseek: { en: 73.3, zh: 80.0, he: 93.3 },
    fable: { en: 0.0, zh: 0.0, he: 0.0 },
  },
  {
    id: "nons_group_real_discr",
    label: "nons group real discr",
    deepseek: { en: 60.0, zh: 92.9, he: 85.7 },
    fable: { en: 8.3, zh: 8.3, he: 0.0 },
  },
  {
    id: "homonyms",
    label: "homonyms",
    deepseek: { en: 66.7, zh: 80.0, he: 86.7 },
    fable: { en: 6.7, zh: 7.1, he: 13.3 },
  },
  {
    id: "figurative_language",
    label: "figurative language",
    deepseek: { en: 61.5, zh: 73.3, he: 71.4 },
    fable: { en: 0.0, zh: 0.0, he: 0.0 },
  },
  {
    id: "definitions",
    label: "definitions",
    deepseek: { en: 20.0, zh: 73.3, he: 85.7 },
    fable: { en: 0.0, zh: 0.0, he: 0.0 },
  },
  {
    id: "privacy_public",
    label: "privacy public",
    deepseek: { en: 46.7, zh: 46.7, he: 40.0 },
    fable: { en: 0.0, zh: 6.7, he: 6.7 },
  },
];

export function rateFor(modelRates, lang) {
  if (lang === "mean") {
    return (modelRates.en + modelRates.zh + modelRates.he) / 3;
  }
  return modelRates[lang];
}

export function formatPct(value) {
  return `${value.toFixed(1)}%`;
}
