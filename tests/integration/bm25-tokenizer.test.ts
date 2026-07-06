import { describe, test, expect, beforeAll } from 'vitest';

let tokenize: (text: string) => string[];
let scoreBm25: (query: string, documents: { key: string; text: string }[], config: unknown) => { id: string }[];
let graphContextConfig: unknown;

beforeAll(async () => {
  const bm25 = await import(new URL('../../dist/libs/knowledge-graph/graph-context/bm25.js', import.meta.url).href);
  const config = await import(new URL('../../dist/libs/knowledge-graph/graph-context/config.js', import.meta.url).href);
  tokenize = bm25.tokenize;
  scoreBm25 = bm25.scoreBm25;
  graphContextConfig = config.graphContextConfig;
});

describe('BM25 tokenizer', () => {
  test('camelCase emits sub-tokens and keeps full lowercased token', () => {
    const tokens = tokenize('handleUserAuth');
    expect(tokens).toContain('user');
    expect(tokens).toContain('auth');
    expect(tokens).toContain('handle');
    expect(tokens).toContain('handleuserauth');
  });

  test('PascalCase emits sub-tokens', () => {
    expect(tokenize('HandleUserAuth')).toContain('user');
  });

  test('snake_case emits sub-tokens and keeps original token', () => {
    const tokens = tokenize('handle_user_auth');
    expect(tokens).toContain('user');
    expect(tokens).toContain('handle_user_auth');
  });

  test('kebab-case emits sub-tokens', () => {
    expect(tokenize('graph-context')).toContain('graph');
    expect(tokenize('graph-context')).toContain('context');
  });

  test('letter-number boundary emits sub-tokens', () => {
    expect(tokenize('user2FA')).toContain('user');
    expect(tokenize('user2FA')).toContain('fa');
  });

  test('English stemming variants still apply', () => {
    expect(tokenize('tokens')).toContain('token');
  });

  test('BM25 matches camelCase doc tokens to spaced query terms', () => {
    const documents = [{ key: 'doc:auth', text: 'The handleUserAuth function validates sessions.' }];
    const ranked = scoreBm25('user auth validation', documents, graphContextConfig);
    expect(ranked[0]?.id).toBe('doc:auth');
  });
});
