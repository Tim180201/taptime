import { expect, it } from 'vitest';
import { isValidTimeReviewReason } from '../src/index.js';
it.each(['\u00a0\t','\n\r','\u0001\u007f\u0085','\u200b\ufeff'])
('T106: rejects invisible reason %j', value => expect(isValidTimeReviewReason(value)).toBe(false));
it('T106: accepts visible text without rewriting evidence',()=>expect(isValidTimeReviewReason(' \tBeleg geprüft\n ')).toBe(true));
