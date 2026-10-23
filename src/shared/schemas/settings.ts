import { z } from 'zod'
import type { AppSettings } from '../models/document'
import { DEFAULT_COMPILE_OPTIONS } from '../models/compile'
import { SETTINGS_SCHEMA_VERSION } from '../versions'

export const DEFAULT_SETTINGS: AppSettings = {
  schemaVersion: SETTINGS_SCHEMA_VERSION,
  themeId: 'ocean-blue',
  options: { ...DEFAULT_COMPILE_OPTIONS },
  previewWidth: 375,
  lastFilePath: null,
  dismissHelpOnStartup: false,
}

export const compileOptionValuesSchema = z
  .object({
    listMode: z.enum(['native', 'static']),
    tableFallback: z.enum(['none', 'records']),
    codeWrap: z.enum(['soft', 'scroll']),
    firstLineIndent: z.boolean(),
    highlight: z.boolean(),
    mathMode: z.enum(['svg', 'raw']).default('svg'),
  })
  .strict()

export const appSettingsSchema = z
  .object({
    schemaVersion: z.number().int().min(1),
    themeId: z.string().min(1).max(64),
    options: compileOptionValuesSchema,
    previewWidth: z.union([z.literal(320), z.literal(375), z.literal(430)]),
    lastFilePath: z.string().max(4096).nullable(),
    dismissHelpOnStartup: z.boolean().default(false),
  })
  .strict()

export function normalizeSettings(raw: unknown): AppSettings {
  const parsed = appSettingsSchema.safeParse(raw)
  if (!parsed.success) {
    return { ...DEFAULT_SETTINGS, options: { ...DEFAULT_COMPILE_OPTIONS } }
  }
  return parsed.data
}
