// Fixed MARCH intervention catalog shown identically on every card.
// Deliberately includes far more options than any single card needs —
// the list itself must never hint at the correct answer.
export const MARCH_CATEGORIES = [
  {
    key: "massive_hemorrhage",
    label: "M — Massive Hemorrhage",
    actions: [
      { id: "tourniquet", label: "Apply tourniquet" },
      { id: "pressure_dressing", label: "Apply pressure dressing" },
      { id: "hemostatic_dressing", label: "Pack wound w/ hemostatic gauze" },
      { id: "wound_packing", label: "Pack wound (plain gauze)" },
      { id: "junctional_tourniquet", label: "Apply junctional tourniquet" },
    ],
  },
  {
    key: "airway",
    label: "A — Airway",
    actions: [
      { id: "airway_adjunct", label: "Insert nasopharyngeal airway (NPA)" },
      { id: "advanced_airway", label: "Insert advanced/supraglottic airway" },
      { id: "recovery_position", label: "Place in recovery position" },
      { id: "cric", label: "Perform surgical cricothyroidotomy" },
      { id: "suction_airway", label: "Suction airway" },
      { id: "jaw_thrust", label: "Jaw thrust / chin lift / airway positioning" },
    ],
  },
  {
    key: "respiration",
    label: "R — Respiration",
    actions: [
      { id: "needle_decompression", label: "Needle decompression" },
      { id: "chest_seal", label: "Apply occlusive chest seal" },
      { id: "chest_seal_vented", label: "Apply vented chest seal" },
      { id: "chest_tube", label: "Place chest tube" },
      { id: "supplemental_o2", label: "Give supplemental O2" },
    ],
  },
  {
    key: "circulation",
    label: "C — Circulation",
    actions: [
      { id: "iv_access", label: "Establish IV/IO access" },
      { id: "iv_fluids", label: "Administer IV fluids" },
      { id: "blood_product", label: "Administer blood product" },
      { id: "txa", label: "Administer TXA" },
      { id: "splint", label: "Splint fracture" },
      { id: "traction_splint", label: "Apply traction splint (femur fracture)" },
      { id: "pelvic_binder", label: "Apply pelvic binder" },
      { id: "reduce_fracture", label: "Reduce/realign fracture" },
      { id: "evisceration_care", label: "Cover evisceration w/ moist sterile dressing" },
      { id: "abdominal_binder_supportive_care", label: "Apply abdominal binder (supportive care)" },
      { id: "wound_dressing", label: "Clean and dress wound (minor)" },
    ],
  },
  {
    key: "hypothermia_head",
    label: "H — Hypothermia / Head / Other",
    actions: [
      { id: "hypothermia_prevention", label: "Apply hypothermia blanket" },
      { id: "c_spine_precautions", label: "C-spine precautions" },
      { id: "head_injury_monitoring", label: "Monitor for ↓ mental status (TBI)" },
      { id: "cover_burn_dressing", label: "Cover burn w/ dry dressing" },
      { id: "eye_shield", label: "Apply rigid eye shield" },
      { id: "eye_patch_pressure", label: "Apply eye patch with pressure" },
      { id: "pain_management", label: "Administer pain medication" },
      { id: "antidote_administration", label: "Administer CBRN antidote/auto-injector" },
      { id: "decon", label: "Perform decontamination" },
      { id: "behavioral_deescalation", label: "Behavioral de-escalation / buddy monitor" },
      { id: "mace_assessment", label: "Perform MACE concussion assessment" },
      { id: "remove_from_duty_rest", label: "Remove from duty and allow rest" },
      { id: "dying_breath_radio_call", label: "Acknowledge / radio report (dying breath)" },
      { id: "safety_equipment_provided", label: "Log: safety equipment was worn/used (ROE)" },
      { id: "safety_equipment_provided_not_used", label: "Log: safety equipment provided but not used (ROE)" },
      { id: "safety_equipment_unavailable", label: "Log: safety equipment was unavailable (ROE)" },
      { id: "reassure_monitor", label: "Reassure and continue to monitor" },
    ],
  },
];

export const ALL_ACTION_IDS = MARCH_CATEGORIES.flatMap((c) => c.actions.map((a) => a.id));

export function actionLabel(id) {
  for (const cat of MARCH_CATEGORIES) {
    const found = cat.actions.find((a) => a.id === id);
    if (found) return found.label;
  }
  return id;
}
