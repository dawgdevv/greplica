import { describe, test, expect, beforeAll } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';

const tmpRoot = mkdtempSync(join(tmpdir(), 'greplica-repo-context-test-'));

let detectRepoContext: (cwd: string) => { repo_root: string; repo_name: string; default_branch: string; remote_url: string | undefined };

beforeAll(async () => {
  const repoContext = await import(new URL('../../dist/apps/cli/repo-context.js', import.meta.url).href);
  detectRepoContext = repoContext.detectRepoContext;
});

function initRepo(path: string) {
  mkdirSync(path);
  execFileSync('git', ['init', '--quiet'], { cwd: path, encoding: 'utf8' });
  return path;
}

function git(cwd: string, ...args: string[]) {
  return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

describe('repo context detection', () => {
  test('falls back to folder name for non-git directories', () => {
    const nonGitFolder = join(tmpRoot, 'plain-folder');
    mkdirSync(nonGitFolder);

    const fallbackContext = detectRepoContext(nonGitFolder);

    expect(fallbackContext.repo_root).toBe(realpathSync(nonGitFolder));
    expect(fallbackContext.repo_name).toBe(basename(nonGitFolder));
    expect(fallbackContext.default_branch).toBe('main');
    expect(fallbackContext.remote_url).toBeUndefined();
  });

  test('parses ssh remote urls', () => {
    const sshRepo = initRepo(join(tmpRoot, 'ssh-repo'));
    git(sshRepo, 'remote', 'add', 'origin', 'git@github.com:Autoloops/greplica.git');

    const sshContext = detectRepoContext(sshRepo);

    expect(sshContext.repo_root).toBe(realpathSync(sshRepo));
    expect(sshContext.remote_url).toBe('git@github.com:Autoloops/greplica.git');
    expect(sshContext.repo_name).toBe('greplica');
  });

  test('parses https remote urls', () => {
    const httpsRepo = initRepo(join(tmpRoot, 'https-repo'));
    git(httpsRepo, 'remote', 'add', 'origin', 'https://github.com/Autoloops/greplica.git');

    const httpsContext = detectRepoContext(httpsRepo);

    expect(httpsContext.remote_url).toBe('https://github.com/Autoloops/greplica.git');
    expect(httpsContext.repo_name).toBe('greplica');
  });

  test('detects default branch from remote HEAD', () => {
    const branchRepo = initRepo(join(tmpRoot, 'branch-repo'));
    git(branchRepo, 'remote', 'add', 'origin', 'https://github.com/Autoloops/greplica.git');
    git(branchRepo, 'symbolic-ref', 'refs/remotes/origin/HEAD', 'refs/remotes/origin/trunk');

    const branchContext = detectRepoContext(branchRepo);

    expect(branchContext.default_branch).toBe('trunk');
  });

  test('falls back to main when remote HEAD is missing', () => {
    const noRemoteHeadRepo = initRepo(join(tmpRoot, 'no-remote-head-repo'));
    git(noRemoteHeadRepo, 'remote', 'add', 'origin', 'https://github.com/Autoloops/greplica.git');

    const noRemoteHeadContext = detectRepoContext(noRemoteHeadRepo);

    expect(noRemoteHeadContext.default_branch).toBe('main');
  });
});
