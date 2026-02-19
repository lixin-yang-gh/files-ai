// src/main/redaction-config.ts
// ────────────────────────────────────────────────────────────────
// Centralized redaction configuration using redactum defaults
// ────────────────────────────────────────────────────────────────

import { redactum, PolicyCategory, Policy } from 'redactum';

// ── Exact string replacements – highest priority, exact match only ──
// (keep this for known/company-specific or test values)
export const EXACT_REPLACEMENTS: Record<string, string> = {
  'nbnco': '[COMPANY_NAME]',
  'nbn-': '[COMPANY_NAME]-',
  '-nbn': '-[COMPANY_NAME]',
  ' nbn ': ' [COMPANY_NAME] ',
  // Add more known fixed strings here if needed, e.g.:
  // 'sk_test_abc123': '[STRIPE_TEST_KEY]',
  // Never commit real secrets here!
};

// ── Optional custom patterns (only UUID if built-in is not sufficient) ──
// Most redactum versions already detect UUIDs well — test and remove if redundant
export const CUSTOM_PATTERNS: Policy[] = [
  {
    name: 'UUID',
    pattern: /[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/gi,
    category: PolicyCategory.CUSTOM,
  },
  // Add more only if needed (e.g. custom password hashes, internal IDs)
];

// ── Simple dynamic placeholder logic ──
export function getPlaceholderForCategory(category: string): string {
  if (category === 'UUID') return '[UUID]';
  if (category.includes('KEY') || category.includes('TOKEN')) return '[SECRET]';
  if (category.includes('PASSWORD') || category === 'DATABASE_CREDENTIALS') return '[PASSWORD]';
  if (category.includes('CREDENTIAL')) return '[CREDENTIAL]';
  return `[${category}]`; // fallback – clear and informative
}

// ── Main redaction function – uses ALL default built-in policies ──
export function redactContent(text: string): string {
  // Step 1: Apply exact string replacements first (precise & fast)
  let result = text;
  for (const [secret, placeholder] of Object.entries(EXACT_REPLACEMENTS)) {
    if (!secret.trim()) continue;
    const escaped = secret.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    result = result.replace(new RegExp(escaped, 'g'), placeholder);
  }

  // Step 2: Apply redactum with ALL built-in policies + optional customs
  // → omit 'policies' option → uses all ~197 default patterns automatically
  const resultAfterRedactum = redactum(result, {
    // policies: undefined,           // ← default = all built-ins (recommended)
    customPolicies: CUSTOM_PATTERNS.length > 0 ? CUSTOM_PATTERNS : undefined,
    replacement: (match: string, category: string) =>
      getPlaceholderForCategory(category),
    // preserveLength: true,       // ← uncomment for ***** style (same length)
  });

  return resultAfterRedactum.redactedText;
}