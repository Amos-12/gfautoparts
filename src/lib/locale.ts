import i18n from '@/i18n';
import { fr, enUS, es } from 'date-fns/locale';
import type { Locale } from 'date-fns';

type SupportedLanguage = 'fr' | 'en' | 'es';

const localeMap: Record<SupportedLanguage, string> = {
  fr: 'fr-FR',
  en: 'en-US',
  es: 'es-ES',
};

const dateFnsLocaleMap: Record<SupportedLanguage, Locale> = {
  fr,
  en: enUS,
  es,
};

export const getCurrentLanguage = (): SupportedLanguage => {
  const language = (i18n.resolvedLanguage || i18n.language || 'fr').slice(0, 2) as SupportedLanguage;
  return localeMap[language] ? language : 'fr';
};

export const getCurrentLocale = (): string => localeMap[getCurrentLanguage()];

export const getDateFnsLocale = (): Locale => dateFnsLocaleMap[getCurrentLanguage()];

export const formatLocalizedNumber = (
  value: number,
  options: Intl.NumberFormatOptions = {},
): string => new Intl.NumberFormat(getCurrentLocale(), options).format(value);

export const formatLocalizedDate = (
  value: string | number | Date,
  options: Intl.DateTimeFormatOptions = {},
): string => new Intl.DateTimeFormat(getCurrentLocale(), options).format(new Date(value));

export const formatLocalizedDateTime = (
  value: string | number | Date,
  options: Intl.DateTimeFormatOptions = {},
): string => new Intl.DateTimeFormat(getCurrentLocale(), options).format(new Date(value));

export const formatLocalizedTime = (
  value: string | number | Date,
  options: Intl.DateTimeFormatOptions = {},
): string => new Intl.DateTimeFormat(getCurrentLocale(), options).format(new Date(value));
