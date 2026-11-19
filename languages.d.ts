export interface Language {
  name: string;
  nativeName: string;
  locale: string;
  jw: string;
  wiki: string;
  word: string;
  section: string[];
  voices: string[];
  sample?: string;
}
export const LANGUAGES: Record<string, Language>;
export function languageConfig(code: string): Language;
export function sourceExample(source: string, code?: string): string;
export const wikiHosts: string[];

export function jwLanguage(url: string): string;
