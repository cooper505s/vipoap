import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read=file=>fs.readFileSync(new URL(`../${file}`,import.meta.url),'utf8');
const pages=['admin/index.html','admin/customers.html','admin/os.html','admin/helpdesk.html','admin/billing.html','admin/franchise.html','admin/training.html','admin/health-check.html','admin/help-requests.html','admin/knowledge.html','admin/marketing.html','admin/safety.html','admin/my-payments.html'];

test('VIPOAP OS is independently installable and keeps admin shortcuts private',()=>{
  const manifest=JSON.parse(read('admin/manifest.webmanifest'));
  assert.equal(manifest.name,'VIPOAP OS');
  assert.equal(manifest.start_url,'/admin/');
  assert.equal(manifest.scope,'/admin/');
  assert.equal(manifest.display,'standalone');
  assert.ok(manifest.icons.every(x=>x.src.includes('vipoap-os-icon-')));
  assert.ok(manifest.shortcuts.every(x=>!['/admin/customers','/admin/health-check','/admin/help-requests','/admin/billing','/admin/franchise'].includes(x.url)));
});

test('every OS workspace is installable and includes permission-aware navigation',()=>{
  for(const page of pages){
    const html=read(page);
    assert.match(html,/manifest\.webmanifest/);
    assert.match(html,/mobile-nav\.js\?v=(2|3|4)/);
    assert.match(html,/apple-mobile-web-app-capable/);
  }
});

test('every OS workspace uses the same stable page shell and header',()=>{
  for(const page of pages){
    const html=read(page);
    assert.match(html,/header\.css\?v=5/);
    assert.match(html,/<main class="shell">/);
    assert.match(html,/<header class="top card os-page-header">/);
    assert.match(html,/class="os-brand"/);
    assert.match(html,/Administration portal/);
    assert.match(html,/os-header-controls/);
    assert.match(html,/os-install-slot/);
    assert.match(html,/os-page-heading/);
  }
});

test('OS service worker never intercepts APIs and versions the shared shell',()=>{
  const worker=read('admin/service-worker.js');
  const navigation=read('admin/mobile-nav.js');
  assert.match(worker,/startsWith\('\/api\/'\)/);
  assert.match(worker,/request\.method!==\'GET\'/);
  for(const asset of ['vipoap-os-v40','email-login.js?v=6','mobile-nav.js?v=4','knowledge.js?v=2','/admin/hq','header.css','callout-camera.js','billing-settlements.js','availability-calendar.js','operational-health.js?v=2','launch-readiness.js','backup-controls.js','restore-controls.js','maintenance-controls.js','distribution-alerts.js','manual-assignment.js','training-learning.js?v=2','ticket-workspace.js?v=2','ticket-workspace.js?v=3','control-overview.js?v=1','zoho-sync.js','reviews.js','connectivity.js','vipoap-os-icon-192','/admin/training','/admin/knowledge','/admin/franchise','/admin/safety','/admin/my-payments','/admin/helpdesk','my-payments.js'])assert.ok(worker.includes(asset),asset);
  assert.match(navigation,/connectivity\.js/);
  assert.match(navigation,/vipoap-os-icon-192/);
});

test('engineers have a confidential safety and stop-work interface',()=>{
  const page=read('admin/safety.html');
  const nav=read('admin/mobile-nav.js');
  assert.match(page,/Safety and safeguarding/);
  assert.match(page,/Stop this job and place payment into review/);
  assert.match(page,/Never record passwords, PINs or one-time banking codes/);
  assert.match(nav,/\/admin\/safety/);
});

test('My Work uses a seven-day service-aware booking calendar',()=>{
  const page=read('admin/index.html');
  const calendar=read('admin/availability-calendar.js');
  const operators=read('admin/franchise-tools.js');
  assert.match(page,/availability-calendar\.js/);
  for(const day of ['monday','tuesday','wednesday','thursday','friday','saturday','sunday'])assert.match(calendar,new RegExp(day));
  assert.match(calendar,/Copy Monday to weekdays/);
  assert.match(calendar,/data-service/);
  assert.match(calendar,/type="date"/);
  assert.match(operators,/editServiceHome/);
  assert.match(operators,/editServiceRemote/);
});

test('HQ dashboard highlights operational exceptions and manually assigns unfilled bookings',()=>{
  const page=read('admin/os.html');
  const alerts=read('admin/distribution-alerts.js');
  const assignment=read('admin/manual-assignment.js');
  assert.match(page,/distribution-alerts\.js/);
  assert.match(page,/manual-assignment\.js/);
  assert.match(alerts,/HQ attention queue/);
  assert.match(alerts,/Needs attention/);
  assert.match(alerts,/data\.attention/);
  assert.match(assignment,/Choose available engineer/);
  assert.match(assignment,/job-assignment/);
});

test('navigation uses effective permissions and installs only in the shared header slot',()=>{
  const navigation=read('admin/mobile-nav.js');
  for(const permission of ['manage_operations','manage_marketing','manage_customers','manage_billing','view_franchise'])assert.match(navigation,new RegExp(permission));
  assert.match(navigation,/\/api\/admin\/session/);
  assert.match(navigation,/\.os-install-slot/);
  assert.doesNotMatch(navigation,/\.top \.actions,\.top/);
});
