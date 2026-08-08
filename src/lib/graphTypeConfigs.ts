export interface GraphTypeConfig {
  order: string[];
  labels: Record<string, string>;
  colors: Record<string, { bg: string; border: string }>;
  columnX: Record<string, number>;
}

export const EVIDENCE_GRAPH_TYPES: GraphTypeConfig = {
  order: ["party", "allegation", "evidence", "gap"],
  labels: {
    party: "Parties",
    allegation: "Allegations",
    evidence: "Evidence",
    gap: "Gaps",
  },
  colors: {
    party: { bg: "#eef2ff", border: "#6366f1" },
    allegation: { bg: "#fef3c7", border: "#d97706" },
    evidence: { bg: "#dcfce7", border: "#16a34a" },
    gap: { bg: "#fee2e2", border: "#dc2626" },
  },
  columnX: { party: 0, allegation: 340, evidence: 680, gap: 1020 },
};

// weakness (in the opposing case) -> theory (a defence theory it supports)
// -> issue (an evidentiary/procedural issue that theory raises) -> step (an
// investigative step needed to develop the theory or resolve the issue).
export const DEFENCE_GRAPH_TYPES: GraphTypeConfig = {
  order: ["weakness", "theory", "issue", "step"],
  labels: {
    weakness: "Opposing-case weaknesses",
    theory: "Defence theories",
    issue: "Evidentiary/procedural issues",
    step: "Next steps",
  },
  colors: {
    weakness: { bg: "#fee2e2", border: "#dc2626" },
    theory: { bg: "#dbeafe", border: "#2563eb" },
    issue: { bg: "#fef3c7", border: "#d97706" },
    step: { bg: "#dcfce7", border: "#16a34a" },
  },
  columnX: { weakness: 0, theory: 340, issue: 680, step: 1020 },
};

// document (a piece of evidence) -> allegation (what it relates to) ->
// gap (an allegation with missing evidence). Unlike EVIDENCE_GRAPH_TYPES
// above (which reformats an already-generated matrix), this graph analyzes
// the matter's raw documents directly — see extractEvidenceConnections.
export const CONNECTIONS_GRAPH_TYPES: GraphTypeConfig = {
  order: ["document", "allegation", "gap"],
  labels: {
    document: "Documents",
    allegation: "Allegations",
    gap: "Gaps",
  },
  colors: {
    document: { bg: "#dcfce7", border: "#16a34a" },
    allegation: { bg: "#fef3c7", border: "#d97706" },
    gap: { bg: "#fee2e2", border: "#dc2626" },
  },
  columnX: { document: 0, allegation: 340, gap: 680 },
};

// Keyed registry so the chromeless fullscreen view (opened in a new tab,
// see /graph-view/[id]) can look up the right config from a short string
// in the URL/localStorage instead of needing to serialize the config
// itself.
export const GRAPH_TYPE_CONFIGS: Record<string, GraphTypeConfig> = {
  evidence: EVIDENCE_GRAPH_TYPES,
  defence: DEFENCE_GRAPH_TYPES,
  connections: CONNECTIONS_GRAPH_TYPES,
};
export type GraphKind = keyof typeof GRAPH_TYPE_CONFIGS;
