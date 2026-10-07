import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

// Initial read-only source consistency check.
// When VIPOAP approves a pricing change, update these expected public messages
// AND the applicable DB pricing rules and payment calculations together.
export const CHECKS = {
  'index.html': [
    ['standard home-visit headline', 'Home visits start from £49'],
    ['member home-visit price', 'Home visits £44 — save £5'],
  ],
  'services.html': [
    ['home visit', 'Home visit</h2><div class="price">£49'],
    ['additional 30 minutes', 'each additional 30 minutes is £30'],
    ['member discount', 'VIPOAP members pay £44'],
    ['remote support', 'Remote support</h2><div class="price">£25'],
  ],
  'membership.html': [
    ['standard home visit', 'Home visit: £49'],
    ['member home visit', 'Home visits at £44'],
    ['pay-as-you-go remote support', 'Remote help: £25'],
    ['no included remote minutes', 'No support minutes are bundled'],
  ],
  'terms.html': [
    ['booking terms standard visit', 'Home visits cost £49 for the first 30 minutes'],
    ['booking terms additional time', 'Each further agreed 30 minutes is £30'],
    ['booking terms remote support', 'Remote support costs £25 for the first 30 minutes'],
  ],
  'app/index.html': [
    ['booking 30 minutes', 'Home visit — £49'],
    ['booking 60 minutes', 'Up to 1 hour — £79'],
    ['booking 90 minutes', 'Up to 90 minutes — £109'],
  ],
  'assets/public-booking.js': [
    ['public booking price calculation', "duration===30?'£49'"],
  ],
  'migrations/0007_home_visit_pricing.sql': [
    ['home pricing rule', "'technology-home-standard'"],
    ['home pricing amount in pence', '4900,3000,30,30'],
  ],
  'migrations/0006_remote_support_pricing.sql': [
    ['remote pricing rule', "'technology-remote-standard'"],
    ['remote pricing amount in pence', '2500,2000,30,30'],
  ],
};

export function findIssues(sources) {
  const issues = [];
  for (const [path, checks] of Object.entries(CHECKS)) {
    const source = sources[path];
    if (typeof source !== 'string') {
      issues.push(path + ': unable to read source');
      continue;
    }
    for (const [label, expected] of checks) {
      if (!source.includes(expected)) {
        issues.push(path + ': expected ' + label + ' (' + expected + ')');
      }
    }
  }
  return issues;
}

export async function auditRepository(root = fileURLToPath(new URL('../', import.meta.url))) {
  const sources = {};
  await Promise.all(Object.keys(CHECKS).map(async (file) => {
    try {
      sources[file] = await readFile(resolve(root, file), 'utf8');
    } catch {
      sources[file] = null;
    }
  }));
  return findIssues(sources);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const issues = await auditRepository();
  if (issues.length) {
    console.error('VIPOAP operations copy audit flagged ' + issues.length + ' item(s):');
    for (const issue of issues) console.error(' - ' + issue);
    console.error('Verify approved pricing and intended copy before editing or deploying.');
    process.exitCode = 1;
  } else {
    console.log('VIPOAP source copy audit passed (' + Object.keys(CHECKS).length + ' files).');
    console.log('This does not verify live deployment, payment calculations or configured integrations.');
  }
}
