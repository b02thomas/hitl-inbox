import test from 'node:test';
import { get as httpGet } from 'node:http';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { openStore } from '../src/store.mjs';
import { serve } from '../src/server.mjs';

const fixture = () => JSON.parse(readFileSync(new URL('../examples/decision.json',import.meta.url),'utf8'));
const cli = new URL('../bin/hitl.mjs',import.meta.url).pathname;
function setup(t) {
  const directory = mkdtempSync(join(tmpdir(),'hitl-test-'));
  const store = openStore(directory);
  t.after(() => { store.close(); rmSync(directory,{recursive:true,force:true}); });
  return {directory,store};
}
const decision = (version = 1) => ({version,action:'approve',optionId:'A',actor:'Test Operator',note:'Synthetische Testfreigabe'});
function run(directory,args,input) {
  return spawnSync(process.execPath,[cli,...args],{env:{...process.env,HITL_HOME:directory},input:input && JSON.stringify(input),encoding:'utf8'});
}

// Owner boundary: durable CLI receipt, duplicate retries and concurrent agents must not lose entries.
test('CLI persists submission across processes; pending, missing and stale are never approved', t => {
  const {directory} = setup(t);
  const submitted = run(directory,['submit','--file','-'],fixture());
  assert.equal(submitted.status,0,submitted.stderr);
  const entry = JSON.parse(submitted.stdout);
  const loaded = JSON.parse(run(directory,['show',entry.id]).stdout);
  assert.equal(loaded.entry.title,fixture().title);
  assert.equal(loaded.events.length,1);
  const blocked = run(directory,['check',entry.id,'--revision','demo-v1']);
  assert.equal(blocked.status,4); assert.equal(JSON.parse(blocked.stdout).allowed,false);
  assert.equal(run(directory,['check','missing','--revision','demo-v1']).status,2);
  assert.equal(run(directory,['check',entry.id]).status,2);
  assert.equal(run(directory,['check',entry.id,'--revison','demo-v1']).status,2);
});
test('same key is idempotent; conflicting content is rejected without replacing evidence', t => {
  const {store} = setup(t); const original = store.submit(fixture());
  assert.equal(store.submit(fixture()).id,original.id);
  assert.throws(() => store.submit({...fixture(),title:'Changed'}),/Konflikt/);
  assert.equal(store.get(original.id).title,fixture().title);
  assert.equal(store.events(original.id).length,1);
});
test('concurrent CLI submissions retain each unique finding and deduplicate retries', async t => {
  const {directory,store} = setup(t);
  const submit = value => new Promise((resolve,reject) => {
    const child = spawn(process.execPath,[cli,'submit','--file','-'],{env:{...process.env,HITL_HOME:directory}});
    let output = '',error = ''; child.stdout.on('data',chunk => output += chunk); child.stderr.on('data',chunk => error += chunk);
    child.on('error',reject); child.on('close',code => code === 0 ? resolve(JSON.parse(output)) : reject(new Error(error)));
    child.stdin.end(JSON.stringify(value));
  });
  const results = await Promise.all([submit(fixture()),submit(fixture()),submit({...fixture(),key:'second'})]);
  assert.equal(results[0].id,results[1].id); assert.equal(store.list().length,2);
});
test('invalid input cannot create a phantom entry or approval', t => {
  const {store} = setup(t);
  for (const value of [{...fixture(),status:'approved'},{...fixture(),evidence:[]},{...fixture(),options:[]},{...fixture(),recommendation:{optionId:'Z',reason:'Unknown'}}]) assert.throws(() => store.submit(value));
  assert.equal(store.list().length,0);
});
// HTTP boundary owns browser decision provenance, version conflicts and cross-site denial.
test('browser decision survives restart; stale form and foreign origin are rejected', async t => {
  const {store,directory} = setup(t); const entry = store.submit(fixture());
  const {server,origin} = await serve(store,0); t.after(() => new Promise(resolve => server.close(resolve)));
  const inbox = await (await fetch(`${origin}/api/inbox`)).json();
  const post = (body,headers = {}) => fetch(`${origin}/api/entries/${entry.id}/decision`,{method:'POST',headers:{'Content-Type':'application/json',Origin:origin,'X-HITL-CSRF':inbox.csrf,...headers},body:JSON.stringify(body)});
  assert.equal((await post(decision(),{Origin:'https://outside.invalid'})).status,403);
  assert.equal((await post(decision(),{'X-HITL-CSRF':'wrong'})).status,403);
  assert.equal(store.get(entry.id).status,'open');
  assert.equal((await post({...decision(),optionId:'Z'})).status,400);
  assert.equal((await post(decision())).status,200);
  assert.equal((await post({...decision(),action:'clarify',optionId:undefined})).status,400);
  const allowed = run(directory,['check',entry.id,'--revision','demo-v1']);
  assert.equal(allowed.status,0,allowed.stderr); assert.equal(JSON.parse(allowed.stdout).decision.optionId,'A');
  const stale = run(directory,['check',entry.id,'--revision','demo-v2']);
  assert.equal(stale.status,4); assert.equal(JSON.parse(stale.stdout).stale,true);
  const reopened = openStore(directory); assert.equal(reopened.get(entry.id).decision.actor,'Test Operator'); reopened.close();
  assert.equal(store.events(entry.id).length,2);
});
test('clarification, comments and timeout do not release a blocked agent', async t => {
  const {store,directory} = setup(t); const entry = store.submit(fixture());
  assert.equal(run(directory,['wait',entry.id,'--revision','demo-v1','--timeout','1']).status,4);
  store.decide(entry.id,{version:1,action:'clarify',note:'Bitte Quelle ergänzen',actor:'Test Operator'});
  store.comment(entry.id,{text:'Weitere Recherche',actor:'Agent'});
  assert.equal(run(directory,['check',entry.id,'--revision','demo-v1']).status,4);
  assert.equal(store.get(entry.id).status,'clarification');
  assert.throws(() => store.complete(entry.id,{version:2,revision:'fixed',evidence:'test passed'}),/Freigabeversion/);
  store.decide(entry.id,decision(2)); assert.equal(store.get(entry.id).status,'approved');
});
test('rejection remains terminal; completion requires exact approval version and evidence', t => {
  const {store,directory} = setup(t); const entry = store.submit(fixture());
  store.decide(entry.id,{version:1,action:'reject',note:'Nicht umsetzen',actor:'Test Operator'});
  assert.equal(run(directory,['check',entry.id,'--revision','demo-v1']).status,4);
  assert.throws(() => store.decide(entry.id,decision(2)),/Konflikt/);
  const second = store.submit({...fixture(),key:'approved'}); store.decide(second.id,decision());
  assert.throws(() => store.complete(second.id,{version:1,revision:'fixed',evidence:'Tests bestanden'}),/Freigabeversion/);
  assert.throws(() => store.complete(second.id,{version:2,revision:'fixed',evidence:''}));
  const result = store.complete(second.id,{version:2,revision:'fixed',evidence:'Synthetischer Nachweis'});
  assert.equal(result.status,'completed'); assert.equal(store.events(second.id).length,3);
});
test('HTTP only serves fixed assets, denies foreign Host, and returns a recoverable error for malformed JSON', async t => {
  const {store} = setup(t); const entry = store.submit(fixture());
  const {server,origin} = await serve(store,0); t.after(() => new Promise(resolve => server.close(resolve)));
  const page = await fetch(origin); assert.equal(page.status,200); assert.match(page.headers.get('content-security-policy'),/frame-ancestors 'none'/);
  assert.equal((await fetch(`${origin}/package.json`)).status,404);
  const foreignHostStatus = await new Promise((resolve,reject) => {
    httpGet(`${origin}/api/inbox`,{headers:{Host:'outside.invalid'}},response => { response.resume(); resolve(response.statusCode); }).on('error',reject);
  });
  assert.equal(foreignHostStatus,403);
  const {csrf} = await (await fetch(`${origin}/api/inbox`)).json();
  const result = await fetch(`${origin}/api/entries/${entry.id}/decision`,{method:'POST',headers:{Origin:origin,'X-HITL-CSRF':csrf,'Content-Type':'application/json'},body:'{'});
  assert.equal(result.status,400); assert.equal(store.get(entry.id).status,'open');
});
