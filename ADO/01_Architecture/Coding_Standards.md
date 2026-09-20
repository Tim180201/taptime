# Coding Standards

Status: Draft

## Current Rule

No application code exists yet. Therefore this document defines baseline expectations only.

## Baseline Standards

- Prefer simple architecture over clever abstractions.
- Keep domain logic separate from UI code.
- Keep infrastructure integrations behind explicit interfaces.
- Do not mix raw external events with validated business records.
- Write tests for critical domain behavior and security-sensitive code.
- Document intentional shortcuts in ADO before merging.

## Future Additions

After the stack decision, this document must be extended with concrete standards for:

- language
- formatting
- linting
- testing
- directory conventions
- naming conventions
- error handling
- logging
- security handling

## Importe (18.09.2026)

Relative Importe und Re-Exporte werden **ohne Dateiendung** geschrieben (`from './Foo'`), wie
die 88 bestehenden Zeilen in `packages/core/src/index.ts`. Eine `.js`-Endung auf einer
`.ts`-Quelle bauen TypeScript, Vitest und Vite problemlos; **Metro** — der Buendler der App —
loest sie nicht auf und bricht ab. Gemerkt hat es am 18.09. allein der CI-Schritt
`npx expo export --platform android` (Commit `adc7258`, repariert in `dcdaebb`). Dieser Schritt
bleibt deshalb in der CI, auch wenn er langsam ist: Er ist die einzige Instanz, die den
Buendler der App wirklich fragt.
