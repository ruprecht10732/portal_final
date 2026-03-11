import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { resolve, join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const PLACEHOLDER = '__APP_BUILD_ID__';
const TEXT_FILE_EXTENSIONS = new Set(['.css', '.html', '.js', '.map']);

const scriptPath = fileURLToPath(import.meta.url);
const rootDir = resolve(scriptPath, '..', '..');
const distDir = resolve(rootDir, 'dist/my-portal-app/browser');
const packageJson = JSON.parse(readFileSync(resolve(rootDir, 'package.json'), 'utf8'));

const getGitCommitSha = () => {
  const gitResult = spawnSync('git', ['rev-parse', '--short=12', 'HEAD'], {
    cwd: rootDir,
    encoding: 'utf8',
  });

  if (gitResult.status !== 0) {
    return null;
  }

  return gitResult.stdout.trim() || null;
};

const timestamp = new Date().toISOString().replace(/[^0-9A-Za-z]/g, '');
const buildId =
  process.env.APP_BUILD_ID?.trim() ||
  process.env.SOURCE_VERSION?.trim() ||
  process.env.GITHUB_SHA?.trim() ||
  process.env.CI_COMMIT_SHA?.trim() ||
  process.env.VERCEL_GIT_COMMIT_SHA?.trim() ||
  getGitCommitSha() ||
  `${packageJson.version}-${timestamp}`;

const ngCliPath = resolve(rootDir, 'node_modules/@angular/cli/bin/ng.js');
const buildArgs = process.argv.slice(2);
const buildResult = spawnSync(process.execPath, [ngCliPath, 'build', ...buildArgs], {
  cwd: rootDir,
  stdio: 'inherit',
});

if (buildResult.status !== 0) {
  process.exit(buildResult.status ?? 1);
}

let replacementCount = 0;

const replacePlaceholderInFile = filePath => {
  if (!TEXT_FILE_EXTENSIONS.has(extname(filePath))) {
    return;
  }

  const source = readFileSync(filePath, 'utf8');
  if (!source.includes(PLACEHOLDER)) {
    return;
  }

  const updated = source.split(PLACEHOLDER).join(buildId);
  replacementCount += source.split(PLACEHOLDER).length - 1;
  writeFileSync(filePath, updated);
};

const walk = directoryPath => {
  for (const entry of readdirSync(directoryPath)) {
    const entryPath = join(directoryPath, entry);
    const entryStats = statSync(entryPath);

    if (entryStats.isDirectory()) {
      walk(entryPath);
      continue;
    }

    replacePlaceholderInFile(entryPath);
  }
};

walk(distDir);

if (replacementCount === 0) {
  console.error(`Build stamp placeholder ${PLACEHOLDER} was not found in ${distDir}.`);
  process.exit(1);
}

console.log(`Stamped frontend build with APP_BUILD_ID=${buildId}`);