import { z } from 'zod';

// Source information for installed skills
export const SkillSourceSchema = z.object({
  type: z.enum(['registry', 'github', 'git', 'local', 'url']),
  url: z.string().optional(), // GitHub/URL source
  ref: z.string().optional(), // Git ref/branch
  id: z.string().optional(), // Registry workflow ID
});

// Individual skill manifest entry
export const SkillManifestSchema = z.object({
  name: z.string(),
  version: z.string(),
  installedAt: z.string().datetime(),
  source: SkillSourceSchema,
  scope: z.enum(['global', 'project']),
});

// Overall outclaw manifest
export const OutclawManifestSchema = z.object({
  version: z.literal(1),
  skills: z.array(SkillManifestSchema),
});

export type SkillSource = z.infer<typeof SkillSourceSchema>;
export type SkillManifest = z.infer<typeof SkillManifestSchema>;
export type OutclawManifest = z.infer<typeof OutclawManifestSchema>;
