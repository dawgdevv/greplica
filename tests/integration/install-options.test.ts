import { describe, test, expect, beforeAll } from 'vitest';
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../..', import.meta.url));
const cli = join(root, 'dist', 'apps', 'cli', 'main.js');

let greplicaHookGuidance: string;
let shouldRunAutoMemoryUpdates: (config: { session: { autoMemoryUpdates: boolean } }) => boolean;

beforeAll(async () => {
  const guidance = await import(new URL('../../dist/libs/hooks/guidance.js', import.meta.url).href);
  const worker = await import(new URL('../../dist/libs/hooks/worker.js', import.meta.url).href);
  greplicaHookGuidance = guidance.greplicaHookGuidance;
  shouldRunAutoMemoryUpdates = worker.shouldRunAutoMemoryUpdates;
});

function readConfig(greplicaHome: string) {
  return JSON.parse(readFileSync(join(greplicaHome, 'config.json'), 'utf8'));
}

function installInTempRepo(tmp: string, name: string, flags: string[], platform = 'codex') {
  const repo = join(tmp, name, 'repo');
  const greplicaHome = join(tmp, name, 'greplica-home');
  const codexHome = join(tmp, name, 'codex-home');
  const copilotHome = join(tmp, name, 'copilot-home');
  mkdirSync(repo, { recursive: true });
  execFileSync('git', ['init', '--quiet'], { cwd: repo, encoding: 'utf8' });

  const env: Record<string, string> = {
    ...process.env as Record<string, string>,
    GREPLICA_HOME: greplicaHome,
    CODEX_HOME: codexHome,
    COPILOT_HOME: copilotHome,
    XDG_CONFIG_HOME: join(tmp, name, 'xdg-config-home'),
    GREPLICA_INSTALL_SKIP_PREWARM: '1',
  };

  const output = execFileSync(process.execPath, [cli, 'install', '--platform', platform, '--embedding', 'local', ...flags], {
    cwd: repo,
    encoding: 'utf8',
    env,
  });

  execFileSync(process.execPath, [cli, 'doctor'], { cwd: repo, encoding: 'utf8', env });
  return { repo, greplicaHome, codexHome, copilotHome, output, env };
}

describe('install options', () => {
  test('auto-save mode installs hooks and enables auto memory updates', () => {
    const tmp = mkdtempSync(join(tmpdir(), 'greplica-install-options-test-'));
    const autoSave = installInTempRepo(tmp, 'auto-save', ['--hooks', 'enabled', '--auto-memory', 'enabled']);

    expect(autoSave.output).toMatch(/Hooks: installed for UserPromptSubmit, Stop\./);
    expect(autoSave.output).toMatch(/Automatic memory updates: enabled\./);
    expect(existsSync(join(autoSave.codexHome, 'hooks.json'))).toBe(true);
    expect(readConfig(autoSave.greplicaHome).session.autoMemoryUpdates).toBe(true);
    expect(shouldRunAutoMemoryUpdates(readConfig(autoSave.greplicaHome))).toBe(true);
  });

  test('guidance-only mode installs hooks and injects guidance but disables auto memory updates', () => {
    const tmp = mkdtempSync(join(tmpdir(), 'greplica-install-options-test-'));
    const guidanceOnly = installInTempRepo(tmp, 'guidance-only', ['--hooks', 'enabled', '--auto-memory', 'disabled']);

    expect(guidanceOnly.output).toMatch(/Hooks: installed for UserPromptSubmit, Stop\./);
    expect(guidanceOnly.output).toMatch(/Automatic memory updates: disabled\./);
    expect(existsSync(join(guidanceOnly.codexHome, 'hooks.json'))).toBe(true);
    expect(readConfig(guidanceOnly.greplicaHome).session.autoMemoryUpdates).toBe(false);
    expect(shouldRunAutoMemoryUpdates(readConfig(guidanceOnly.greplicaHome))).toBe(false);

    const hookOutput = execFileSync(
      process.execPath,
      [cli, 'hook', 'ingest', '--platform', 'codex'],
      {
        cwd: guidanceOnly.repo,
        encoding: 'utf8',
        input: JSON.stringify({ hook_event_name: 'UserPromptSubmit', session_id: 'guidance-only-session', cwd: guidanceOnly.repo }),
        env: guidanceOnly.env,
      },
    );

    expect(hookOutput).toMatch(/Greplica hook guidance/);
    expect(hookOutput).toMatch(/greplica graph context/);
  });

  test('no-hooks mode does not install hooks and disables auto memory updates', () => {
    const tmp = mkdtempSync(join(tmpdir(), 'greplica-install-options-test-'));
    const noHooks = installInTempRepo(tmp, 'no-hooks', ['--hooks', 'disabled']);

    expect(noHooks.output).toMatch(/Hooks: not installed\./);
    expect(noHooks.output).toMatch(/Automatic memory updates: disabled\./);
    expect(noHooks.output).toMatch(/To give future agents Greplica guidance without hooks/);
    expect(noHooks.output).toContain(greplicaHookGuidance);
    expect(existsSync(join(noHooks.codexHome, 'hooks.json'))).toBe(false);
    expect(readConfig(noHooks.greplicaHome).session.autoMemoryUpdates).toBe(false);
  });

  test('opencode does not support hooks but installs skills', () => {
    const tmp = mkdtempSync(join(tmpdir(), 'greplica-install-options-test-'));
    const unsupportedHooks = installInTempRepo(tmp, 'unsupported-hooks', ['--hooks', 'enabled', '--auto-memory', 'enabled'], 'opencode');

    expect(unsupportedHooks.output).toMatch(/Hooks: not installed for this platform\./);
    expect(unsupportedHooks.output).toMatch(/Automatic memory updates: disabled\./);
    expect(readConfig(unsupportedHooks.greplicaHome).session.autoMemoryUpdates).toBe(false);
  });

  test('copilot installs hooks and enables auto memory updates', () => {
    const tmp = mkdtempSync(join(tmpdir(), 'greplica-install-options-test-'));
    const copilotHooks = installInTempRepo(tmp, 'copilot-hooks', ['--hooks', 'enabled', '--auto-memory', 'enabled'], 'copilot');

    expect(copilotHooks.output).toMatch(/Installed Greplica for GitHub Copilot CLI\./);
    expect(copilotHooks.output).toMatch(/Hooks: installed for SessionStart, Stop\./);
    expect(copilotHooks.output).toMatch(/Automatic memory updates: enabled\./);
    expect(existsSync(join(copilotHooks.copilotHome, 'hooks', 'greplica.json'))).toBe(true);
    expect(readConfig(copilotHooks.greplicaHome).session.autoMemoryUpdates).toBe(true);
  });

  test('rejects auto-memory enabled without hooks enabled', () => {
    const tmp = mkdtempSync(join(tmpdir(), 'greplica-install-options-test-'));
    const noHooks = installInTempRepo(tmp, 'invalid-combo', ['--hooks', 'disabled']);

    const invalid = spawnSync(
      process.execPath,
      [cli, 'install', '--platform', 'codex', '--embedding', 'local', '--hooks', 'disabled', '--auto-memory', 'enabled'],
      { cwd: noHooks.repo, encoding: 'utf8', env: noHooks.env },
    );

    expect(invalid.status).not.toBe(0);
    expect(invalid.stderr).toMatch(/--auto-memory enabled requires --hooks enabled/);
  });

  test('rejects invalid flag values', () => {
    const tmp = mkdtempSync(join(tmpdir(), 'greplica-install-options-test-'));
    const noHooks = installInTempRepo(tmp, 'invalid-flag', ['--hooks', 'disabled']);

    const invalidValue = spawnSync(
      process.execPath,
      [cli, 'install', '--platform', 'codex', '--embedding', 'local', '--hooks', 'sometimes'],
      { cwd: noHooks.repo, encoding: 'utf8', env: noHooks.env },
    );

    expect(invalidValue.status).not.toBe(0);
    expect(invalidValue.stderr).toMatch(/expected enabled or disabled/);
  });
});
