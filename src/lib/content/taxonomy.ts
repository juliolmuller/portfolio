/**
 * Client-safe category ids. Keep this file free of zod and `server-only`.
 */

export const techCategories = [
  'language',
  'frontend',
  'backend',
  'data',
  'cloud',
  'integration',
  'ai',
] as const;

export type TechCategory = (typeof techCategories)[number];

/**
 * Hero title fonts, alphabetical; the module that loads them is
 * `styles/title-fonts.ts`.
 */
export const titleFonts = [
  'amita',
  'courgette',
  'euphoria-script',
  'kaushan-script',
  'lobster',
  'pacifico',
  'princess-sofia',
  'redressed',
  'rock-salt',
  'sacramento',
] as const;

export type TitleFont = (typeof titleFonts)[number];

export const titleFontLabels: Record<TitleFont, string> = {
  'amita': 'Amita',
  'courgette': 'Courgette',
  'euphoria-script': 'Euphoria Script',
  'kaushan-script': 'Kaushan Script',
  'lobster': 'Lobster',
  'pacifico': 'Pacifico',
  'princess-sofia': 'Princess Sofia',
  'redressed': 'Redressed',
  'rock-salt': 'Rock Salt (no accents)',
  'sacramento': 'Sacramento',
};

/**
 * The CSS font stack for a title font; matches the `variable` names in
 * `src/styles/title-fonts.ts`.
 */
export const titleFontFamily = (font: TitleFont): string => `var(--font-title-${font})`;
