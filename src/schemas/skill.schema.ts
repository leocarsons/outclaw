import { z } from 'zod';

// SKILL.md frontmatter schema
export const SkillFrontmatterSchema = z.object({
  name: z
    .string()
    .min(1, 'Name is required')
    .regex(/^[a-z0-9-]+$/, 'Name must be lowercase alphanumeric with hyphens'),

  description: z
    .string()
    .min(10, 'Description should be detailed for good triggering'),

  version: z
    .string()
    .regex(/^\d+\.\d+\.\d+$/, 'Version must be semver format')
    .optional(),

  'disable-model-invocation': z.boolean().optional().default(false),

  'user-invocable': z.boolean().optional().default(true),

  'allowed-tools': z
    .union([z.string(), z.array(z.string())])
    .optional()
    .transform((val) => {
      if (typeof val === 'string') {
        return val.split(',').map((t) => t.trim());
      }
      return val;
    }),

  'argument-hint': z.string().optional(),

  model: z.string().optional(),

  context: z.enum(['normal', 'fork']).optional(),

  agent: z.string().optional(),

  license: z.string().optional(),

  author: z
    .union([
      z.string(),
      z.object({
        name: z.string(),
        email: z.string().email().optional(),
        url: z.string().url().optional(),
      }),
    ])
    .optional(),

  keywords: z.array(z.string()).optional(),

  repository: z.string().optional(),
});

// Full skill schema including content
export const SkillSchema = SkillFrontmatterSchema.extend({
  content: z.string().min(1, 'Skill content is required'),
  path: z.string(),
});

export type SkillFrontmatter = z.infer<typeof SkillFrontmatterSchema>;
export type Skill = z.infer<typeof SkillSchema>;
