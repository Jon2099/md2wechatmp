import { z } from 'zod'

const builtinThemeIdSchema = z.enum([
  'ocean-blue',
  'graphite',
  'terracotta',
  'jade',
  'magazine',
  'amber',
  'violet',
  'ink',
])

export const themeIdSchema = z.union([
  builtinThemeIdSchema,
  z.string().max(64).regex(/^custom-[a-zA-Z0-9_-]+$/),
])

export const docIdSchema = z.string().regex(/^doc-[a-z0-9]{4,32}$/)

export const compileOptionsSchema = z
  .object({
    includeTitle: z.boolean().default(true),
    listMode: z.enum(['native', 'static']),
    tableFallback: z.enum(['none', 'records']),
    codeWrap: z.enum(['soft', 'scroll']),
    firstLineIndent: z.boolean(),
    highlight: z.boolean(),
    mathMode: z.enum(['svg', 'raw']).default('svg'),
  })
  .strict()

export const compileRequestSchema = z
  .object({
    docId: docIdSchema,
    revision: z.number().int().min(0).max(1_000_000),
    themeId: themeIdSchema,
    options: compileOptionsSchema,
  })
  .strict()

export const updateSourceSchema = z
  .object({
    docId: docIdSchema,
    baseRevision: z.number().int().min(0).max(1_000_000),
    text: z.string().max(1_000_000),
  })
  .strict()

export const revisionRequestSchema = z
  .object({
    docId: docIdSchema,
    revision: z.number().int().min(0).max(1_000_000),
  })
  .strict()

export const closeRequestSchema = revisionRequestSchema.extend({ docId: docIdSchema.nullable() }).strict()

export const copyRequestSchema = z
  .object({
    snapshotId: z.string().min(1).max(128),
    expectedRevision: z.number().int().min(0).max(1_000_000),
  })
  .strict()

export const exportRequestSchema = copyRequestSchema
  .extend({ includeCopyButton: z.boolean() })
  .strict()

export const cancelRequestSchema = z
  .object({ taskId: z.string().min(1).max(128) })
  .strict()

export const recoveryRequestSchema = z
  .object({ docId: docIdSchema })
  .strict()

export const reloadRequestSchema = z
  .object({ docId: docIdSchema })
  .strict()

export const settingsPatchSchema = z
  .object({
    themeId: themeIdSchema.optional(),
    // 补丁仅包含显式修改的字段，不能注入完整配置的默认值。
    options: compileOptionsSchema.partial().extend({
      includeTitle: z.boolean().optional(),
      mathMode: z.enum(['svg', 'raw']).optional(),
    }).optional(),
    previewWidth: z.union([z.literal(320), z.literal(375), z.literal(430)]).optional(),
    lastFilePath: z.string().max(4096).nullable().optional(),
    dismissHelpOnStartup: z.boolean().optional(),
    autoSaveInterval: z.number().int().min(0).max(3600).optional(),
  })
  .strict()
