import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {BUILT_IN_ROLES,PERMISSIONS} from '../functions/_shared/permissions.js';

const read=file=>fs.readFileSync(new URL(`../${file}`,import.meta.url),'utf8');

test('owner sees everything while partners cannot access central administration',()=>{
  assert.deepEqual(BUILT_IN_ROLES.owner.permissions,['*']);
  assert.ok(PERMISSIONS.includes('manage_marketing'));
  for(const permission of ['manage_calls','manage_customers','manage_followups','view_training','manage_marketing','report_incidents'])assert.ok(BUILT_IN_ROLES.operator.permissions.includes(permission));
  for(const permission of ['manage_operations','manage_billing','view_franchise','manage_roles','manage_operators'])assert.ok(!BUILT_IN_ROLES.operator.permissions.includes(permission));
  for(const permission of ['manage_operations','manage_billing','view_franchise','manage_operators'])assert.ok(BUILT_IN_ROLES.admin.permissions.includes(permission));
  assert.ok(!BUILT_IN_ROLES.admin.permissions.includes('manage_roles'));
});

test('every page declares its workspace permission',()=>{
  const expected={
    'admin/index.html':'manage_calls','admin/customers.html':'manage_customers','admin/health-check.html':'manage_customers',
    'admin/help-requests.html':'manage_followups','admin/safety.html':'report_incidents','admin/training.html':'view_training',
    'admin/knowledge.html':'view_training','admin/marketing.html':'manage_marketing','admin/os.html':'manage_operations',
    'admin/billing.html':'manage_billing','admin/franchise.html':'view_franchise'
  };
  for(const [file,permission] of Object.entries(expected))assert.match(read(file),new RegExp(`data-page-permission="${permission}"`),file);
});

test('navigation clearly separates partner and central admin destinations',()=>{
  const navigation=read('admin/mobile-nav.js');
  assert.match(navigation,/Partner workspace/);
  assert.match(navigation,/Admin centre/);
  assert.match(navigation,/My work/);
  assert.match(navigation,/Admin overview/);
  assert.match(navigation,/Network & access/);
  assert.match(navigation,/showDenied/);
  assert.match(navigation,/data-page-permission|pagePermission/);
});

test('mixed pages hide privileged tools from partner roles',()=>{
  assert.match(read('admin/safety.html'),/data-requires-permission="manage_incidents"/);
  assert.match(read('admin/training.html'),/data-requires-permission="manage_training"/);
  assert.match(read('admin/customers.html'),/requiresPermission='export_data'/);
  assert.match(read('admin/franchise.html'),/data-requires-permission="manage_territories"/);
  assert.match(read('admin/franchise.html'),/data-requires-permission="manage_operators"/);
  assert.match(read('admin/franchise-tools.js'),/data-requires-permission="manage_roles"/);
  assert.match(read('admin/franchise-brand.js'),/requiresPermission='manage_brand'/);
  assert.match(read('admin/compliance.js'),/requiresPermission='manage_operators'/);
});

test('central APIs enforce central permissions',()=>{
  assert.match(read('functions/api/admin/dashboard.js'),/manage_operations/);
  assert.match(read('functions/api/admin/health.js'),/manage_operations/);
  assert.match(read('functions/api/admin/job-assignment.js'),/manage_operations/);
  assert.match(read('functions/api/admin/roles.js'),/manage_roles/);
  assert.match(read('functions/api/admin/marketing.js'),/manage_marketing/);
  assert.match(read('functions/api/admin/help-requests.js'),/manage_followups/);
});

test('installed OS opens on the partner-safe home',()=>{
  const manifest=JSON.parse(read('admin/manifest.webmanifest'));
  assert.equal(manifest.start_url,'/admin/');
  assert.ok(manifest.shortcuts.every(item=>!['/admin/os','/admin/billing','/admin/franchise'].includes(item.url)));
});
