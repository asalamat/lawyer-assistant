import { formatDateOnly } from "./formatDate";
import {
  getMatter,
  listContradictionAnalyses,
  listCrownPositionAnalyses,
  listDigests,
  listDisclosureChecklists,
  listDocuments,
  listEvidenceMatrices,
  listExhibitLists,
  listMissingEvidenceReports,
  listPrivilegeReviews,
  listRedlineAnalyses,
} from "./matters";
import { listMatterTasks } from "./tasks";

export interface ReportSection {
  heading: string;
  content: string;
}

export interface MatterReport {
  matterTitle: string;
  fileNumber: string;
  sections: ReportSection[];
}

// One combined report gathering every generated analysis + a documents/
// tasks index for a matter — the "download or email the whole file" button.
// Each AI section only ever includes the LATEST generated version (same as
// what its own tab shows via list*()[0]) — a full history isn't the point
// here, a current snapshot is. Sections with nothing generated yet are
// omitted entirely rather than shown empty.
export async function buildMatterReport(matterId: string): Promise<MatterReport | null> {
  const matter = await getMatter(matterId);
  if (!matter) return null;

  const [
    digests,
    evidenceMatrices,
    contradictions,
    exhibitLists,
    disclosureChecklists,
    crownPositions,
    privilegeReviews,
    redlineAnalyses,
    missingEvidenceReports,
    documents,
    tasks,
  ] = await Promise.all([
    listDigests(matterId),
    listEvidenceMatrices(matterId),
    listContradictionAnalyses(matterId),
    listExhibitLists(matterId),
    listDisclosureChecklists(matterId),
    listCrownPositionAnalyses(matterId),
    listPrivilegeReviews(matterId),
    listRedlineAnalyses(matterId),
    listMissingEvidenceReports(matterId),
    listDocuments(matterId),
    listMatterTasks(matterId),
  ]);

  const sections: ReportSection[] = [];
  const addIfPresent = (heading: string, list: { content: string }[]) => {
    if (list[0]?.content) sections.push({ heading, content: list[0].content });
  };

  addIfPresent("Matter Digest", digests);
  addIfPresent("Evidence Matrix", evidenceMatrices);
  addIfPresent("Contradictions", contradictions);
  addIfPresent("Exhibit List", exhibitLists);
  addIfPresent("Disclosure Checklist", disclosureChecklists);
  addIfPresent("Crown Position Analysis", crownPositions);
  addIfPresent("Privilege Review", privilegeReviews);
  addIfPresent("Redline Analysis", redlineAnalyses);
  addIfPresent("Missing Evidence Report", missingEvidenceReports);

  if (documents.length > 0) {
    sections.push({
      heading: "Documents",
      content: documents.map((d) => `- ${d.fileName} (${formatDateOnly(d.uploadedAt.slice(0, 10))})`).join("\n"),
    });
  }
  if (tasks.length > 0) {
    sections.push({
      heading: "Tasks",
      content: tasks
        .map((t) => `- [${t.completed ? "x" : " "}] ${t.title}${t.dueDate ? ` (due ${formatDateOnly(t.dueDate.slice(0, 10))})` : ""}`)
        .join("\n"),
    });
  }

  return { matterTitle: matter.title, fileNumber: matter.fileNumber, sections };
}
