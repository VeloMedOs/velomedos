/**
 * Quick-insert chief-complaint templates grouped by system.
 * Inserted (prepended) into the textarea — never replace existing text.
 */
export type CcTemplate = { id: string; label: string; body: string };
export type CcGroup = { key: "cardio" | "resp" | "gi"; label: string; items: CcTemplate[] };

export const CC_TEMPLATES: CcGroup[] = [
  {
    key: "cardio", label: "Cardio", items: [
      { id: "cp_typical", label: "Typical chest pain",       body: "Substernal pressure radiating to left arm, exertional, 7/10, > 20 min. Diaphoresis. No relief at rest." },
      { id: "cp_pleuritic", label: "Pleuritic chest pain",   body: "Sharp left-sided pain, worse on inspiration. No fever. No leg swelling." },
      { id: "palpitations", label: "Palpitations",           body: "Sudden-onset palpitations, regular, 30 minutes. No syncope. Caffeine intake earlier today." },
      { id: "syncope",   label: "Syncope",                   body: "Witnessed loss of consciousness ~10 s while standing. No incontinence, no postictal phase." },
      { id: "dyspnea_chf", label: "Dyspnea on exertion",     body: "Progressive dyspnea over 1 week. Orthopnea (3 pillows). Bilateral ankle oedema." },
    ],
  },
  {
    key: "resp", label: "Respiratory", items: [
      { id: "sob_asthma", label: "Acute SOB / wheeze",       body: "Acute shortness of breath with audible wheeze. Known asthmatic. Used salbutamol x3, no relief." },
      { id: "cough_prod", label: "Productive cough",         body: "Productive cough x 4 days, yellow-green sputum. Fever 38.6 °C. Right-sided pleuritic chest pain." },
      { id: "hemoptysis", label: "Haemoptysis",              body: "Streaks of blood in sputum x 2 days. No weight loss, no night sweats. Non-smoker." },
      { id: "pe_risk",    label: "Sudden pleuritic SOB",     body: "Sudden pleuritic chest pain and dyspnea. Recent long-haul flight. Right calf tender." },
      { id: "uri",        label: "Upper respiratory",        body: "Sore throat, rhinorrhoea, mild fever x 3 days. No dyspnea, no chest pain." },
    ],
  },
  {
    key: "gi", label: "GI", items: [
      { id: "rlq_pain",   label: "Right lower quadrant pain", body: "Periumbilical pain migrating to RLQ over 8 h. Anorexia, nausea, low-grade fever." },
      { id: "epigastric", label: "Epigastric pain",           body: "Burning epigastric pain, worse on empty stomach, partially relieved by antacids." },
      { id: "vomiting",   label: "Vomiting / diarrhea",       body: "Non-bilious vomiting x 6, watery diarrhea x 4 in 24 h. Decreased oral intake." },
      { id: "rectal_bleed", label: "PR bleeding",             body: "Fresh blood per rectum, mixed with stool x 2 days. No melena. No weight loss." },
      { id: "jaundice",   label: "Jaundice",                  body: "Painless jaundice noted by family x 5 days. Dark urine, pale stools. No alcohol use." },
    ],
  },
];
