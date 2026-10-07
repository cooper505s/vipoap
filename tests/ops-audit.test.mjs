import test from 'node:test';
import assert from 'node:assert/strict';
import { CHECKS, auditRepository, findIssues } from '../scripts/ops-audit.mjs';

test('operations agent detects stale public pricing messages', () => {
  const sources = Object.fromEntries(
    Object.entries(CHECKS).map(([path, checks]) => [path, checks.map(([, expected]) => expected).join('\n')])
  );
  assert.deepEqual(findIssues(sources), []);
  sources['index.html'] = sources['index.html'].replace('Home visits start from £49', 'Home visits start from £39');
  assert.match(findIssues(sources).join('\n'), /index\.html: expected standard home-visit headline/);
});

test('operations agent flags unreadable source files', () => {
  assert.ok(findIssues({}).some((issue) => issue.includes('unable to read source')));
});

test('VIPOAP repo current public pricing copy matches recorded baseline', async () => {
  const issues = await auditRepository();
  assert.deepEqual(issues, [], issues.join('\n'));
});
