import {groupNavigation} from '../admin/navigation-groups.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {staffNavigation,customerNavigation,routePath} from '../assets/portal-navigation.js';
import {BUILT_IN_ROLES} from '../functions/_shared/permissions.js';
const session=role=>({...BUILT_IN_ROLES[role],role,territoryIds:['*']});
test('HQ has one complete menu even when page metadata changes',()=>{
 const owner=session('owner'),base=staffNavigation(owner);for(const workspace of ['engineer','admin',undefined])assert.deepEqual(staffNavigation({...owner,workspace}),base);
 const hrefs=base.map(item=>item.href);assert.equal(new Set(hrefs).size,hrefs.length);for(const href of ['/admin','/admin/control','/admin/safety','/admin/training','/admin/company','/admin/ai-staff','/admin/os'])assert.ok(hrefs.includes(href));
});
test('partner navigation stays focused on assigned work, learning and support',()=>{
 const items=staffNavigation(session('operator'));assert.deepEqual(items.map(i=>i.href),['/admin','/admin/my-payments','/admin/training','/admin/knowledge','/admin/safety','/admin/profile','/admin/marketing']);assert.ok(items.every(i=>!['System','Company'].includes(i.section)));
});
test('menu respects delegated permissions and global-only intake scope',()=>{
 const items=staffNavigation({role:'custom',permissions:['view_training','manage_followups'],territoryIds:['andover']});assert.deepEqual(items.map(i=>i.href),['/admin/help-requests','/admin/training','/admin/knowledge']);assert.deepEqual(staffNavigation({role:'custom',permissions:[],territoryIds:['*']}),[]);
});
test('customer navigation contains only customer panels and canonical staff paths remain active',()=>{
 assert.deepEqual(customerNavigation.map(i=>i[0]),['overview','appointments','invoices','membership','family','home','help','settings']);for(const path of ['/admin/','/admin/index.html','/admin'])assert.equal(routePath(path),'/admin');assert.equal(routePath('/admin/os.html#serviceStatus'),'/admin/os');
});

test('compact groups retain every authorised destination in its existing order',()=>{for(const role of ['owner','admin','operator','viewer']){const items=staffNavigation(session(role)),groups=groupNavigation(items);assert.deepEqual(groups.flatMap(group=>group.items),items);assert.equal(new Set(groups.map(group=>group.section)).size,groups.length);if(role==='owner'){assert.equal(groups.length,7);assert.ok(items.length>groups.length*2)}}});
test('grouping an empty permission-filtered menu does not introduce destinations',()=>assert.deepEqual(groupNavigation([]),[]));
