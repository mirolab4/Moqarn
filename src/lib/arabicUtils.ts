/**
 * Utilities for Arabic text normalization, drug search, and effective price calculations
 */

// Mapping of Eastern Arabic (Arabic-Indic) numerals to Western Arabic numerals
const ARABIC_INDIC_DIGITS: Record<string, string> = {
  '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4',
  '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9',
  '۰': '0', '۱': '1', '۲': '2', '۳': '3', '۴': '4',
  '۵': '5', '۶': '6', '۷': '7', '۸': '8', '۹': '9'
};

// Arabic diacritics regex (harakat & shadda & tanween)
const ARABIC_DIACRITICS_REGEX = /[\u064B-\u065F\u0670\u06D6-\u06ED]/g;

/**
 * Normalizes Arabic and Latin text for flexible, error-tolerant search:
 * - Removes Arabic diacritics (fatha, damma, kasra, tanween, etc.)
 * - Unifies alef forms: أ, إ, آ, ٱ -> ا
 * - Converts Alef Maksura: ى -> ي
 * - Converts Ta Marbuta: ة -> ه
 * - Converts Arabic-Indic numbers: ٠-٩ -> 0-9
 * - Removes non-alphanumeric punctuation and extra spaces
 * - Lowercases Latin characters
 */
export function normalizeArabic(text: string): string {
  if (!text) return '';

  let normalized = String(text);

  // Convert Arabic-Indic numerals
  normalized = normalized.replace(/[٠-٩۰-۹]/g, (digit) => ARABIC_INDIC_DIGITS[digit] || digit);

  // Remove diacritics
  normalized = normalized.replace(ARABIC_DIACRITICS_REGEX, '');

  // Unify Alef forms
  normalized = normalized.replace(/[أإآٱ]/g, 'ا');

  // Convert ى to ي
  normalized = normalized.replace(/ى/g, 'ي');

  // Convert ة to ه
  normalized = normalized.replace(/ة/g, 'ه');

  // Normalize Hamza forms: ئ, ؤ -> ء or standardise
  normalized = normalized.replace(/ؤ/g, 'و');
  normalized = normalized.replace(/ئ/g, 'ي');

  // Convert Latin to lower case
  normalized = normalized.toLowerCase();

  // Normalize punctuation and multi-spaces
  normalized = normalized.replace(/[-_./,+*&%#@!?:;()\[\]{}|\\"'`~]/g, ' ');
  normalized = normalized.replace(/\s+/g, ' ').trim();

  return normalized;
}

/**
 * Calculates effective wholesale unit price taking into account:
 * - Original price
 * - Discount percentage (e.g. 5%)
 * - Bonus formula (e.g. "10+1" => buy=10, free=1)
 * Formula: effective = price × (1 − discount%) × buy / (buy + free)
 */
export function calculateEffectivePrice(
  price: number,
  discount: number,
  bonusBuy: number,
  bonusFree: number
): number {
  const p = Math.max(0, Number(price) || 0);
  const d = Math.max(0, Math.min(100, Number(discount) || 0));
  const buy = Math.max(0, Number(bonusBuy) || 0);
  const free = Math.max(0, Number(bonusFree) || 0);

  const discountMultiplier = 1 - (d / 100);
  let effective = p * discountMultiplier;

  if (buy > 0 && free > 0) {
    effective = effective * (buy / (buy + free));
  }

  return Math.round(effective * 100) / 100;
}

/**
 * Parses bonus string expressions such as "10+1", "12 + 2", "5+1", "10 + 0", "0"
 */
export function parseBonusString(bonusStr: string): { buy: number; free: number; text: string } {
  if (!bonusStr) return { buy: 0, free: 0, text: '0' };
  
  const clean = bonusStr.replace(/[٠-٩]/g, (d) => ARABIC_INDIC_DIGITS[d] || d).trim();
  const match = clean.match(/(\d+)\s*\+\s*(\d+)/);
  if (match) {
    const buy = parseInt(match[1], 10) || 0;
    const free = parseInt(match[2], 10) || 0;
    return {
      buy,
      free,
      text: free > 0 ? `${buy}+${free}` : `${buy}`
    };
  }

  const num = parseInt(clean, 10);
  if (!isNaN(num) && num > 0) {
    return { buy: num, free: 0, text: `${num}` };
  }

  return { buy: 0, free: 0, text: clean || '0' };
}

/**
 * Fuzzy token matching for search query against drug name:
 * Supports sub-string search, word prefix match, and token overlapping
 */
export function matchDrugSearch(drugName: string, searchQuery: string): { matches: boolean; score: number } {
  if (!searchQuery.trim()) return { matches: true, score: 0 };

  const normalizedTarget = normalizeArabic(drugName);
  const normalizedQuery = normalizeArabic(searchQuery);

  // Exact or direct substring match
  if (normalizedTarget.includes(normalizedQuery)) {
    return { matches: true, score: 100 - (normalizedTarget.length - normalizedQuery.length) };
  }

  const queryTokens = normalizedQuery.split(' ').filter(Boolean);
  const targetTokens = normalizedTarget.split(' ').filter(Boolean);

  let matchedTokens = 0;
  for (const qToken of queryTokens) {
    const found = targetTokens.some(tToken => tToken.includes(qToken) || qToken.includes(tToken));
    if (found) {
      matchedTokens++;
    }
  }

  const matches = matchedTokens === queryTokens.length;
  const score = (matchedTokens / queryTokens.length) * 50;

  return { matches, score };
}

/**
 * Formats time difference in friendly Arabic:
 * "منذ قليل", "منذ 3 ساعات", "اليوم", "أمس", "منذ 3 أيام", "منذ أسبوعين", "منذ شهر"
 */
export function formatArabicTimeAgo(dateInput: string | Date | number | undefined | null): string {
  if (!dateInput) return 'غير محدد';

  const date = new Date(dateInput);
  if (isNaN(date.getTime())) return 'غير محدد';

  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHours = Math.floor(diffMin / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSec < 60) return 'منذ لحظات';
  if (diffMin < 60) return `منذ ${diffMin} دقيقة`;
  if (diffHours < 24) return `منذ ${diffHours} ساعة`;
  if (diffDays === 1) return 'أمس';
  if (diffDays === 2) return 'منذ يومين';
  if (diffDays >= 3 && diffDays <= 10) return `منذ ${diffDays} أيام`;
  if (diffDays > 10 && diffDays <= 30) return `منذ ${diffDays} يوماً`;
  if (diffDays > 30 && diffDays < 60) return 'منذ شهر';
  if (diffDays >= 60) return `منذ ${Math.floor(diffDays / 30)} أشهر`;

  return date.toLocaleDateString('ar-EG');
}

/**
 * Formats currency amount in Egyptian Pound or Saudi Riyal notation
 */
export function formatCurrency(amount: number): string {
  const num = Number(amount) || 0;
  return num.toLocaleString('ar-EG', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }) + ' ج.م';
}
