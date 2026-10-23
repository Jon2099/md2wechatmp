import javascript from 'shiki/langs/javascript.mjs'
import typescript from 'shiki/langs/typescript.mjs'
import json from 'shiki/langs/json.mjs'
import bash from 'shiki/langs/bash.mjs'
import shellscript from 'shiki/langs/shellscript.mjs'
import python from 'shiki/langs/python.mjs'
import go from 'shiki/langs/go.mjs'
import rust from 'shiki/langs/rust.mjs'
import java from 'shiki/langs/java.mjs'
import sql from 'shiki/langs/sql.mjs'
import yaml from 'shiki/langs/yaml.mjs'
import html from 'shiki/langs/html.mjs'
import css from 'shiki/langs/css.mjs'
import xml from 'shiki/langs/xml.mjs'
import markdown from 'shiki/langs/markdown.mjs'
import diff from 'shiki/langs/diff.mjs'
import ini from 'shiki/langs/ini.mjs'
import c from 'shiki/langs/c.mjs'
import cpp from 'shiki/langs/cpp.mjs'
import toml from 'shiki/langs/toml.mjs'
import githubLight from 'shiki/themes/github-light.mjs'
import vitesseLight from 'shiki/themes/vitesse-light.mjs'
import minLight from 'shiki/themes/min-light.mjs'
import catppuccinLatte from 'shiki/themes/catppuccin-latte.mjs'

export const LANGS = [
  javascript,
  typescript,
  json,
  bash,
  shellscript,
  python,
  go,
  rust,
  java,
  sql,
  yaml,
  html,
  css,
  xml,
  markdown,
  diff,
  ini,
  c,
  cpp,
  toml,
]

export const SHIKI_THEMES = [githubLight, vitesseLight, minLight, catppuccinLatte]

/** 围栏语言别名 → shiki 语言 id；不在表内的语言不做高亮 */
export const LANG_ALIASES: Record<string, string> = {
  js: 'javascript',
  javascript: 'javascript',
  mjs: 'javascript',
  cjs: 'javascript',
  jsx: 'javascript',
  ts: 'typescript',
  typescript: 'typescript',
  tsx: 'typescript',
  json: 'json',
  jsonc: 'json',
  bash: 'bash',
  sh: 'bash',
  shell: 'shellscript',
  zsh: 'shellscript',
  py: 'python',
  python: 'python',
  go: 'go',
  golang: 'go',
  rs: 'rust',
  rust: 'rust',
  java: 'java',
  sql: 'sql',
  yaml: 'yaml',
  yml: 'yaml',
  html: 'html',
  css: 'css',
  scss: 'css',
  xml: 'xml',
  svg: 'xml',
  md: 'markdown',
  markdown: 'markdown',
  diff: 'diff',
  patch: 'diff',
  ini: 'ini',
  conf: 'ini',
  c: 'c',
  h: 'c',
  cpp: 'cpp',
  'c++': 'cpp',
  hpp: 'cpp',
  toml: 'toml',
}

export const DIAGRAM_LANGS = new Set([
  'mermaid',
  'plantuml',
  'puml',
  'dot',
  'graphviz',
  'flow',
  'sequence',
])

export const THEME_ALIASES: Record<string, string> = {
  'github-light': 'github-light',
  'vitesse-light': 'vitesse-light',
  'min-light': 'min-light',
  'catppuccin-latte': 'catppuccin-latte',
}
