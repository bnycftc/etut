/** Curriculum data types. Pure data; no React/Expo imports. */

export interface Topic {
  /**
   * Stable id stored on study sessions, topic progress and mock-exam marks.
   * Format `<paper>.<subjectId>.<slug>` (ASCII, lower case, hyphens). Never rename or reuse.
   */
  id: string;
  /** Display name in Turkish (curriculum data, so it lives here and not in strings.ts). */
  name: string;
}

/** Timer subject id (see `subjects.ts`) → topics in curriculum order. */
export type SubjectTopics = Readonly<Partial<Record<string, readonly Topic[]>>>;
