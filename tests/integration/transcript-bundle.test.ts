import { describe, test, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../..', import.meta.url));
const cli = join(root, 'dist', 'apps', 'cli', 'main.js');

describe('transcript bundle', () => {
  test('bundles codex transcripts and strips system instructions', () => {
    const tmp = mkdtempSync(join(tmpdir(), 'greplica-transcript-bundle-test-'));
    const codexOne = join(tmp, 'codex-one.jsonl');
    const codexTwo = join(tmp, 'codex-two.jsonl');
    const codexOut = join(tmp, 'codex-bundle.md');

    writeFileSync(
      codexOne,
      [
        JSON.stringify({
          type: 'session_meta',
          payload: { id: 'codex-session-one', timestamp: '2026-06-25T00:00:00.000Z', cwd: '/repo/example' },
        }),
        JSON.stringify({
          timestamp: '2026-06-25T00:01:00.000Z',
          type: 'event_msg',
          payload: { type: 'user_message', message: 'Remember this durable Codex insight. <system_instruction>do not keep this</system_instruction>' },
        }),
      ].join('\n'),
      'utf8',
    );

    writeFileSync(
      codexTwo,
      [
        JSON.stringify({
          type: 'session_meta',
          payload: { id: 'codex-session-two', cwd: '/repo/example' },
        }),
        JSON.stringify({
          timestamp: '2026-06-25T00:02:00.000Z',
          type: 'event_msg',
          payload: { type: 'agent_message', message: 'A second Codex transcript fact. <developer_instruction>drop this</developer_instruction>' },
        }),
      ].join('\n'),
      'utf8',
    );

    const output = execFileSync(
      process.execPath,
      [cli, 'transcript', 'bundle', '--platform', 'codex', '--file', codexOne, '--file', codexTwo, '--out', codexOut],
      { encoding: 'utf8' },
    );

    const bundle = readFileSync(codexOut, 'utf8');

    expect(output).toMatch(/Wrote transcript bundle/);
    expect(output).toMatch(/codex-session:codex-session-one/);
    expect(output).toMatch(/codex-session:codex-session-two/);
    expect(bundle).toMatch(/file_count: 2/);
    expect(bundle).toMatch(/session_ref: codex-session:codex-session-one/);
    expect(bundle).toMatch(/session_ref: codex-session:codex-session-two/);
    expect(bundle).toMatch(/Remember this durable Codex insight/);
    expect(bundle).toMatch(/A second Codex transcript fact/);
    expect(bundle).not.toMatch(/do not keep this/);
    expect(bundle).not.toMatch(/drop this/);
  });

  test('bundles claude transcript', () => {
    const tmp = mkdtempSync(join(tmpdir(), 'greplica-transcript-bundle-test-'));
    const claudeOne = join(tmp, 'claude-one.jsonl');
    const claudeOut = join(tmp, 'claude-bundle.md');

    writeFileSync(
      claudeOne,
      [
        JSON.stringify({
          type: 'user',
          sessionId: 'claude-session-one',
          cwd: '/repo/example',
          timestamp: '2026-06-25T00:03:00.000Z',
          message: { role: 'user', content: [{ type: 'text', text: 'Remember this durable Claude insight.' }] },
        }),
      ].join('\n'),
      'utf8',
    );

    const output = execFileSync(
      process.execPath,
      [cli, 'transcript', 'bundle', '--platform', 'claude', '--file', claudeOne, '--out', claudeOut],
      { encoding: 'utf8' },
    );

    const bundle = readFileSync(claudeOut, 'utf8');

    expect(output).toMatch(/claude-code-session:claude-session-one/);
    expect(bundle).toMatch(/session_ref: claude-code-session:claude-session-one/);
    expect(bundle).toMatch(/Remember this durable Claude insight/);
  });

  test('bundles copilot transcript and strips system instructions', () => {
    const tmp = mkdtempSync(join(tmpdir(), 'greplica-transcript-bundle-test-'));
    const copilotOne = join(tmp, 'copilot-one.jsonl');
    const copilotOut = join(tmp, 'copilot-bundle.md');

    writeFileSync(
      copilotOne,
      [
        JSON.stringify({
          type: 'session.start',
          data: { sessionId: 'copilot-session-one', copilotVersion: '1.0.66', context: { cwd: '/repo/example', repository: 'Autoloops/greplica', branch: 'copilot-test' } },
          timestamp: '2026-06-25T00:03:30.000Z',
        }),
        JSON.stringify({ type: 'session.model_change', data: { newModel: 'claude-haiku-4.5' }, timestamp: '2026-06-25T00:03:45.000Z' }),
        JSON.stringify({
          session_id: 'copilot-session-one',
          cwd: '/repo/example',
          timestamp: '2026-06-25T00:04:00.000Z',
          role: 'user',
          content: 'Remember this durable Copilot insight. <system_instruction>remove this</system_instruction>',
        }),
        JSON.stringify({
          session_id: 'copilot-session-one',
          cwd: '/repo/example',
          timestamp: '2026-06-25T00:05:00.000Z',
          role: 'assistant',
          content: [{ type: 'text', text: 'A Copilot assistant fact.' }],
        }),
      ].join('\n'),
      'utf8',
    );

    const output = execFileSync(
      process.execPath,
      [cli, 'transcript', 'bundle', '--platform', 'copilot', '--file', copilotOne, '--out', copilotOut],
      { encoding: 'utf8' },
    );

    const bundle = readFileSync(copilotOut, 'utf8');

    expect(output).toMatch(/copilot-session:copilot-session-one/);
    expect(bundle).toMatch(/session_ref: copilot-session:copilot-session-one/);
    expect(bundle).toMatch(/repository: Autoloops\/greplica/);
    expect(bundle).toMatch(/branch: copilot-test/);
    expect(bundle).toMatch(/Remember this durable Copilot insight/);
    expect(bundle).toMatch(/A Copilot assistant fact/);
    expect(bundle).not.toMatch(/remove this/);
  });

  test('errors on missing transcript file', () => {
    const tmp = mkdtempSync(join(tmpdir(), 'greplica-transcript-bundle-test-'));
    expect(() =>
      execFileSync(
        process.execPath,
        [cli, 'transcript', 'bundle', '--platform', 'codex', '--file', join(tmp, 'missing.jsonl'), '--out', join(tmp, 'missing.md')],
        { encoding: 'utf8', stdio: 'pipe' },
      ),
    ).toThrow(/Transcript file does not exist/);
  });

  test('errors on unsupported opencode platform', () => {
    const tmp = mkdtempSync(join(tmpdir(), 'greplica-transcript-bundle-test-'));
    const codexOne = join(tmp, 'opencode-one.jsonl');
    writeFileSync(codexOne, '{}', 'utf8');
    expect(() =>
      execFileSync(
        process.execPath,
        [cli, 'transcript', 'bundle', '--platform', 'opencode', '--file', codexOne, '--out', join(tmp, 'opencode-bundle.md')],
        { encoding: 'utf8', stdio: 'pipe' },
      ),
    ).toThrow(/OpenCode transcript projection is not supported yet/);
  });
});
