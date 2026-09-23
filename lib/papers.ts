export type Section = { title: string; paragraphs: string[]; english?: string; diagram?: boolean };
export type Paper = {
  id: string;
  title: string;
  englishTitle: string;
  year: string;
  tags: string[];
  minutes: number;
  reason: string;
  source: string;
  sections: Section[];
  terms: { name: string; meaning: string }[];
  markdown?: string;
  contentStatus?: "metadata" | "reviewed";
  contentType?: "paper" | "research";
  outline?: { title: string; id: string }[];
};

export function isPaper(value: unknown): value is Paper {
  if (!value || typeof value !== "object") return false;
  const paper = value as Partial<Paper>;
  return typeof paper.id === "string"
    && typeof paper.title === "string"
    && typeof paper.englishTitle === "string"
    && typeof paper.year === "string"
    && Array.isArray(paper.tags)
    && paper.tags.every(tag => typeof tag === "string")
    && Number.isInteger(paper.minutes)
    && typeof paper.reason === "string"
    && typeof paper.source === "string"
    && (paper.contentStatus === undefined || paper.contentStatus === "metadata" || paper.contentStatus === "reviewed")
    && (paper.contentType === undefined || paper.contentType === "paper" || paper.contentType === "research")
    && Array.isArray(paper.sections)
    && Array.isArray(paper.terms);
}
