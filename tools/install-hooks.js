// Installs repo git hooks into .git/hooks (works from main checkout).
// Run: npm run hooks:install
import { copyFileSync, chmodSync, existsSync, mkdirSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const gitDir = execSync('git rev-parse --git-dir', { cwd: root }).toString().trim();
const hooksDir = join(root, gitDir, 'hooks');
if (!existsSync(hooksDir)) mkdirSync(hooksDir, { recursive: true });

const src = join(root, 'tools', 'githooks', 'pre-push');
const dst = join(hooksDir, 'pre-push');
copyFileSync(src, dst);
try { chmodSync(dst, 0o755); } catch { /* windows: ignore */ }
console.log('[hooks] installed pre-push ->', dst);
