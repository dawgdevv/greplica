import { describe, test, expect, beforeAll } from 'vitest';

let normalizeProposal: (input: unknown) => unknown;
let validateProposal: (proposal: unknown) => { valid: boolean; errors: string[] };

beforeAll(async () => {
  const proposal = await import(new URL('../../dist/libs/knowledge-graph/proposal.js', import.meta.url).href);
  const validate = await import(new URL('../../dist/libs/knowledge-graph/validate-proposal.js', import.meta.url).href);
  normalizeProposal = proposal.normalizeProposal;
  validateProposal = validate.validateProposal;
});

const components = [
  { id: 'component.a', name: 'A' },
  { id: 'component.b', name: 'B' },
];

describe('proposal validation', () => {
  test('does not crash on edges using from_id/to_id and reports a clear error', () => {
    const malformedEdge = {
      title: 'Malformed edge repro',
      creates: {
        components,
        edges: [{ from_id: 'component.a', to_id: 'component.b', kind: 'contains' }],
      },
    };

    let normalized: unknown;
    expect(() => {
      normalized = normalizeProposal(malformedEdge);
    }).not.toThrow();

    const malformedResult = validateProposal(normalized!);
    expect(malformedResult.valid).toBe(false);
    expect(malformedResult.errors.some((error: string) => error.includes("from'/'to"))).toBe(true);
  });

  test('does not crash on edges missing kind and reports them invalid', () => {
    const missingKindEdge = {
      title: 'Missing kind repro',
      creates: {
        components,
        edges: [{ from: 'component.a', to: 'component.b' }],
      },
    };

    let normalizedMissingKind: unknown;
    expect(() => {
      normalizedMissingKind = normalizeProposal(missingKindEdge);
    }).not.toThrow();

    expect(validateProposal(normalizedMissingKind!).valid).toBe(false);
  });

  test('accepts well-formed compact edges', () => {
    const compactEdge = {
      title: 'Compact edge',
      creates: {
        components,
        edges: [{ kind: 'contains', from: 'component.a', to: 'component.b' }],
      },
    };

    const compactResult = validateProposal(normalizeProposal(compactEdge));
    expect(compactResult.valid).toBe(true);
  });
});
