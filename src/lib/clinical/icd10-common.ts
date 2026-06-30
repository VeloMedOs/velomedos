/**
 * Curated subset of ICD-10-AM codes most commonly used in adult acute
 * encounters. English `display` only; bilingual coding is out of scope.
 * Source: ICD-10-AM 12th edition tabular index (subset selected for
 * UX typeahead — not an exhaustive code list).
 */
export type IcdEntry = { code: string; display: string; chapter: string };

export const ICD10_COMMON: IcdEntry[] = [
  // Cardiovascular
  { code: "I10",    display: "Essential (primary) hypertension",                      chapter: "Circulatory" },
  { code: "I11.9",  display: "Hypertensive heart disease without heart failure",      chapter: "Circulatory" },
  { code: "I20.0",  display: "Unstable angina",                                       chapter: "Circulatory" },
  { code: "I20.9",  display: "Angina pectoris, unspecified",                          chapter: "Circulatory" },
  { code: "I21.4",  display: "Acute subendocardial myocardial infarction (NSTEMI)",   chapter: "Circulatory" },
  { code: "I21.9",  display: "Acute myocardial infarction, unspecified",              chapter: "Circulatory" },
  { code: "I25.10", display: "Atherosclerotic heart disease without angina",          chapter: "Circulatory" },
  { code: "I48.0",  display: "Paroxysmal atrial fibrillation",                        chapter: "Circulatory" },
  { code: "I48.91", display: "Atrial fibrillation, unspecified",                      chapter: "Circulatory" },
  { code: "I50.9",  display: "Heart failure, unspecified",                            chapter: "Circulatory" },
  { code: "I63.9",  display: "Cerebral infarction, unspecified",                      chapter: "Circulatory" },
  { code: "I64",    display: "Stroke, not specified as haemorrhage or infarction",    chapter: "Circulatory" },
  { code: "I80.2",  display: "Phlebitis & thrombophlebitis of lower extremity",       chapter: "Circulatory" },
  { code: "I26.99", display: "Pulmonary embolism without acute cor pulmonale",        chapter: "Circulatory" },

  // Respiratory
  { code: "J18.9",  display: "Pneumonia, unspecified organism",                       chapter: "Respiratory" },
  { code: "J20.9",  display: "Acute bronchitis, unspecified",                         chapter: "Respiratory" },
  { code: "J44.1",  display: "COPD with acute exacerbation",                          chapter: "Respiratory" },
  { code: "J45.901",display: "Unspecified asthma with acute exacerbation",            chapter: "Respiratory" },
  { code: "J81",    display: "Pulmonary oedema",                                      chapter: "Respiratory" },
  { code: "J96.01", display: "Acute respiratory failure with hypoxia",                chapter: "Respiratory" },
  { code: "J06.9",  display: "Acute upper respiratory infection, unspecified",        chapter: "Respiratory" },

  // Gastro
  { code: "K21.9",  display: "Gastro-oesophageal reflux disease without oesophagitis",chapter: "Digestive" },
  { code: "K25.9",  display: "Gastric ulcer, unspecified",                            chapter: "Digestive" },
  { code: "K29.70", display: "Gastritis, unspecified",                                chapter: "Digestive" },
  { code: "K35.80", display: "Acute appendicitis, unspecified",                       chapter: "Digestive" },
  { code: "K57.30", display: "Diverticulosis of large intestine",                     chapter: "Digestive" },
  { code: "K80.20", display: "Cholelithiasis without cholecystitis",                  chapter: "Digestive" },
  { code: "K85.9",  display: "Acute pancreatitis, unspecified",                       chapter: "Digestive" },
  { code: "K92.2",  display: "Gastrointestinal haemorrhage, unspecified",             chapter: "Digestive" },

  // Endocrine / metabolic
  { code: "E10.9",  display: "Type 1 diabetes mellitus without complications",        chapter: "Endocrine" },
  { code: "E11.9",  display: "Type 2 diabetes mellitus without complications",        chapter: "Endocrine" },
  { code: "E11.65", display: "Type 2 diabetes mellitus with hyperglycaemia",          chapter: "Endocrine" },
  { code: "E66.9",  display: "Obesity, unspecified",                                  chapter: "Endocrine" },
  { code: "E78.5",  display: "Hyperlipidaemia, unspecified",                          chapter: "Endocrine" },
  { code: "E86.0",  display: "Dehydration",                                           chapter: "Endocrine" },
  { code: "E87.6",  display: "Hypokalaemia",                                          chapter: "Endocrine" },

  // Genitourinary
  { code: "N17.9",  display: "Acute kidney injury, unspecified",                      chapter: "Genitourinary" },
  { code: "N18.6",  display: "End-stage renal disease",                               chapter: "Genitourinary" },
  { code: "N20.0",  display: "Calculus of kidney",                                    chapter: "Genitourinary" },
  { code: "N39.0",  display: "Urinary tract infection, site not specified",           chapter: "Genitourinary" },

  // Infections / Sepsis
  { code: "A09",    display: "Infectious gastroenteritis & colitis, unspecified",     chapter: "Infectious" },
  { code: "A41.9",  display: "Sepsis, unspecified organism",                          chapter: "Infectious" },
  { code: "B34.9",  display: "Viral infection, unspecified",                          chapter: "Infectious" },
  { code: "U07.1",  display: "COVID-19, virus identified",                            chapter: "Infectious" },

  // Neurology / mental health
  { code: "G40.909",display: "Epilepsy, unspecified, without status epilepticus",     chapter: "Neurology" },
  { code: "G43.909",display: "Migraine, unspecified, without status migrainosus",     chapter: "Neurology" },
  { code: "R51",    display: "Headache",                                              chapter: "Neurology" },
  { code: "F32.9",  display: "Major depressive disorder, single episode, unspecified",chapter: "Mental health" },
  { code: "F41.1",  display: "Generalised anxiety disorder",                          chapter: "Mental health" },

  // Trauma / MSK
  { code: "S06.0X0A",display: "Concussion without loss of consciousness, initial",    chapter: "Injury" },
  { code: "S42.001A",display: "Fracture of clavicle, unspecified, initial",           chapter: "Injury" },
  { code: "S52.501A",display: "Fracture of lower end of radius, initial",             chapter: "Injury" },
  { code: "S72.001A",display: "Fracture of neck of femur, initial",                   chapter: "Injury" },
  { code: "M54.5",  display: "Low back pain",                                         chapter: "Musculoskeletal" },
  { code: "M25.561",display: "Pain in right knee",                                    chapter: "Musculoskeletal" },
  { code: "M79.7",  display: "Fibromyalgia",                                          chapter: "Musculoskeletal" },

  // Symptoms / signs
  { code: "R07.9",  display: "Chest pain, unspecified",                               chapter: "Symptoms" },
  { code: "R10.9",  display: "Unspecified abdominal pain",                            chapter: "Symptoms" },
  { code: "R11.2",  display: "Nausea with vomiting, unspecified",                     chapter: "Symptoms" },
  { code: "R42",    display: "Dizziness and giddiness",                               chapter: "Symptoms" },
  { code: "R50.9",  display: "Fever, unspecified",                                    chapter: "Symptoms" },
  { code: "R55",    display: "Syncope and collapse",                                  chapter: "Symptoms" },
  { code: "R56.9",  display: "Unspecified convulsions",                               chapter: "Symptoms" },
  { code: "R06.02", display: "Shortness of breath",                                   chapter: "Symptoms" },

  // Pregnancy / obstetric
  { code: "O80",    display: "Encounter for full-term uncomplicated delivery",        chapter: "Obstetric" },
  { code: "Z34.90", display: "Encounter for supervision of normal pregnancy",         chapter: "Obstetric" },

  // Encounters / aftercare
  { code: "Z00.00", display: "Encounter for general adult medical examination",       chapter: "Factors" },
  { code: "Z51.11", display: "Encounter for antineoplastic chemotherapy",             chapter: "Factors" },
  { code: "Z79.4",  display: "Long term (current) use of insulin",                    chapter: "Factors" },
];

/** Case-insensitive code/display search; returns up to `limit`. */
export function searchIcd(q: string, limit = 8): IcdEntry[] {
  const s = q.trim().toLowerCase();
  if (!s) return [];
  const hits: IcdEntry[] = [];
  for (const e of ICD10_COMMON) {
    if (hits.length >= limit) break;
    if (e.code.toLowerCase().startsWith(s) || e.display.toLowerCase().includes(s)) hits.push(e);
  }
  return hits;
}
