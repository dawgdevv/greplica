import { describe, test, expect, beforeAll } from 'vitest';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

let openDatabase: (path: string) => import('better-sqlite3').Database;
let SqliteRepository: new (db: import('better-sqlite3').Database) => unknown;
let KnowledgeGraphService: new (repository: unknown) => {
  initRepo: (input: { repo_root: string; repo_name: string; default_branch: string }) => { working_scope_id: string };
  buildGraphView: (input: { repo_name: string }) => string;
};

beforeAll(async () => {
  const db = await import(new URL('../../dist/libs/storage/sqlite/db.js', import.meta.url).href);
  const repo = await import(new URL('../../dist/libs/storage/sqlite/repository.js', import.meta.url).href);
  const kg = await import(new URL('../../dist/libs/knowledge-graph/service.js', import.meta.url).href);
  openDatabase = db.openDatabase;
  SqliteRepository = repo.SqliteRepository;
  KnowledgeGraphService = kg.KnowledgeGraphService;
});

describe('graph view', () => {
  test('renders components without anchors', () => {
    const tmp = mkdtempSync(join(tmpdir(), 'greplica-graph-view-test-'));
    const db = openDatabase(join(tmp, 'graph.db'));

    try {
      const repository = new (SqliteRepository as any)(db);
      const service = new (KnowledgeGraphService as any)(repository);
      const repo = {
        repo_root: join(tmp, 'repo'),
        repo_name: 'graph-view-null-anchor',
        default_branch: 'main',
      };

      const initialized = service.initRepo(repo);
      const memoryCommit = repository.createMemoryCommit({ scope_id: initialized.working_scope_id, title: 'Seed null component anchor' });

      repository.createProposalRecords(initialized.working_scope_id, memoryCommit.id, {
        title: 'Seed null component anchor',
        creates: { components: [{ id: 'component.no_anchor', name: 'Component Without Anchor' }] },
      });

      const html = service.buildGraphView(repo);

      expect(html).toMatch(/Component Without Anchor/);
      expect(html).toMatch(/Greplica graph view/);
    } finally {
      db.close();
    }
  });
});
