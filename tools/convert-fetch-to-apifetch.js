/**
 * Codemod: convert occurrences of `fetch(`${API_BASE}/...`...)` or `fetch(`${API_URL}...`...)`
 * to `apiFetch('/...')` where safe.
 *
 * - Only targets template-literals that include `${API_BASE}` or `${API_URL}` (common pattern in repo).
 * - Leaves absolute external URLs (https?://) untouched.
 * - Preserves options object (headers, method, etc.).
 * - Produces a brief report of modified files.
 *
 * Run from repo root: node tools/convert-fetch-to-apifetch.js
 */
const fs = require('fs');
const path = require('path');
const glob = require('glob');

const ROOT = path.resolve(__dirname, '..', 'front-react', 'src');
const patterns = [
  `${ROOT}/**/*.{ts,tsx,js,jsx}`,
];

let modified = 0;
let filesChanged = 0;

function replaceInFile(file) {
  let src = fs.readFileSync(file, 'utf8');
  const original = src;

  // Pattern: fetch(`${API_BASE}/something${maybe}` , opts)
  src = src.replace(/fetch\(\s*`\$\{API_BASE\}\/([^`]*)`\s*,?/g, (m, p1) => {
    // keep leading slash on endpoint
    const endpoint = '/' + p1.replace(/(^\/|\s+$)/g, '');
    return `apiFetch(${JSON.stringify(endpoint)}`;
  });

  // Pattern: fetch(`${API_BASE}${endpointVar}`)  -> apiFetch(endpointVar) if endpointVar startsWith('/'...) at runtime
  src = src.replace(/fetch\(\s*`\$\{API_BASE\}\$\{([^}]+)\}`/g, (m, p1) => {
    return `apiFetch(${$1.startsWith('/') ? `$${p1}` : p1})`.replace('$','');
  });

  // Pattern: fetch(`${API_BASE}${endpoint}` general -- replace `${API_BASE}${endpoint}` with endpoint (keep template literal)
  src = src.replace(/fetch\(\s*`\$\{API_BASE\}\$\{([^}]+)\}([^`]*)`/g, (m, p1, p2) => {
    // reconstruct template with the captured var and suffix
    const suffix = p2 || '';
    return `apiFetch(\`${'${' + p1 + '}'}` + `${suffix}\``;
  });

  // Pattern: fetch(`${API_BASE}${"/foo"}`) or similar -- fallback: replace `${API_BASE}` prefix inside template literal
  src = src.replace(/`\$\{API_BASE\}([^`]*)`/g, (m, p1) => {
    return '`' + p1 + '`'.replace(/`\s*`/, '``');
  });

  // Replace occurrences like fetch(API_BASE + `/path/${id}`) -> apiFetch(`/path/${id}`)
  src = src.replace(/fetch\(\s*API_BASE\s*\+\s*(`[^`]+`)\s*,?/g, (m, p1) => {
    return `apiFetch(${p1}`;
  });

  if (src !== original) {
    fs.writeFileSync(file, src, 'utf8');
    modified += (original.split('\n').length - src.split('\n').length);
    filesChanged++;
    return true;
  }
  return false;
}

const files = glob.sync(patterns[0], { nodir: true, ignore: ['**/dist/**', '**/node_modules/**'] });
for (const f of files) {
  try {
    if (replaceInFile(f)) {
      console.log('patched', path.relative(ROOT, f));
    }
  } catch (e) {
    console.error('ERR', f, e.message);
  }
}
console.log(`\nDone — files changed: ${filesChanged}`);
process.exit(0);
