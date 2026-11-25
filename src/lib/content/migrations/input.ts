import 'server-only';

import { z } from 'zod';

import { stripNulls } from '../pipeline';
import { adminListQuery } from '../sanity/queries';
import { documentIdSchema, documentSchemas } from '../schema';
import { type SkillCopyInput, type SkillOwnerRef } from './plan';

/**
 * Loads and validates what `planSkillCopy` needs (#65). Sources are parsed with
 * the full document schemas and skipped when invalid; owners only need their id
 * and link lists, so an unrelated invalid field does not block them.
 */

const ownerSchema = z.object({
  id: documentIdSchema,
  rev: z.string().min(1).max(64),
  techIds: z.array(documentIdSchema).default([]),
  skillIds: z.array(documentIdSchema).default([]),
});

export interface SkippedDocument {
  id: string;
  /**
   * Field paths only, never values.
   */
  paths: string[];
  type: string;
}

export type GroqRunner = (query: string) => Promise<unknown>;

function idOf(row: unknown): string {
  const id = (row as { id?: unknown } | null)?.id;

  return typeof id === 'string' ? id : '(no id)';
}

function pathsOf(error: z.ZodError): string[] {
  return [...new Set(error.issues.map((issue) => issue.path.join('.') || '(root)'))];
}

export async function loadSkillCopyInput(
  fetch: GroqRunner,
): Promise<{ input: SkillCopyInput; skipped: SkippedDocument[] }> {
  const skipped: SkippedDocument[] = [];

  async function rows(type: keyof typeof documentSchemas): Promise<unknown[]> {
    const result = await fetch(adminListQuery(type));

    return Array.isArray(result) ? result.map(stripNulls) : [];
  }

  async function sources<T extends 'practice' | 'skill' | 'technology'>(
    type: T,
  ): Promise<Array<z.infer<(typeof documentSchemas)[T]>>> {
    const valid: Array<z.infer<(typeof documentSchemas)[T]>> = [];

    for (const row of await rows(type)) {
      const result = documentSchemas[type].safeParse(row);

      if (result.success) {
        valid.push(result.data as z.infer<(typeof documentSchemas)[T]>);
      } else {
        skipped.push({ type, id: idOf(row), paths: pathsOf(result.error) });
      }
    }

    return valid;
  }

  async function owners(type: 'experience' | 'project'): Promise<SkillOwnerRef[]> {
    const valid: SkillOwnerRef[] = [];

    for (const row of await rows(type)) {
      const result = ownerSchema.safeParse(row);

      if (result.success) {
        valid.push(result.data);
      } else {
        skipped.push({ type, id: idOf(row), paths: pathsOf(result.error) });
      }
    }

    return valid;
  }

  const technologies = await sources('technology');
  const practices = await sources('practice');
  const skills = await sources('skill');
  const projects = await owners('project');
  const experience = await owners('experience');

  return { input: { technologies, practices, skills, projects, experience }, skipped };
}
