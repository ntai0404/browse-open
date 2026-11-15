import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {copyProfile} from '../scripts/profile-copy.mjs';
function fixture(t) {
 const base=fs.mkdtempSync(path.join(os.tmpdir(),'browse-native-copy-'));
 t.after(()=>fs.rmSync(base,{recursive:true,force:true}));
 const root=path.join(base,'source');fs.mkdirSync(path.join(root,'Profile 1'),{recursive:true});
 fs.writeFileSync(path.join(root,'Local State'),JSON.stringify({profile:{info_cache:{'Profile 1':{name:'Selected user'}}}}));
 fs.writeFileSync(path.join(root,'Profile 1','Preferences'),'{}');
 return {base,root,opts:{'user-data-dir':root,'profile-directory':'Profile 1','destination-root':path.join(base,'copy'),'copy-authorized':'yes'}};
}
test('authorized copy preserves selected data and reports omitted cache without touching source',async t=>{
 const {root,opts}=fixture(t);fs.mkdirSync(path.join(root,'Profile 1','Cache'));fs.writeFileSync(path.join(root,'Profile 1','Cache','sample'),'cache');
 fs.writeFileSync(path.join(root,'Profile 1','Bookmarks'),'user-bookmark');
 const effects={};const r=await copyProfile(opts,()=>10000,effects);
 assert.equal(fs.readFileSync(path.join(r.userDataDir,'Profile 1','Bookmarks'),'utf8'),'user-bookmark');
 assert.equal(fs.readFileSync(path.join(root,'Profile 1','Bookmarks'),'utf8'),'user-bookmark');
 assert.equal(fs.existsSync(path.join(r.userDataDir,'Profile 1','Cache')),false);
 assert.equal(r.copiedFiles,3);assert.equal(r.omissions.length,1);assert.equal(r.loginSession,'NOT_TESTED');assert.equal(r.complete,false);
 assert.equal(effects.profileCopyRoot,r.userDataDir);
 assert.equal(JSON.parse(fs.readFileSync(path.join(r.userDataDir,'browse-open-copy.json'))).consistency,'BEST_EFFORT_NOT_ATOMIC');
});
test('copy rejects missing authorization, existing destinations and destination inside source',async t=>{
 const {root,opts}=fixture(t);
 await assert.rejects(copyProfile({...opts,'copy-authorized':'no'},()=>1000,{}),e=>e.code==='COPY_AUTHORIZATION_REQUIRED');
 await assert.rejects(copyProfile({...opts,'destination-root':root},()=>1000,{}),e=>e.code==='DESTINATION_EXISTS');
 await assert.rejects(copyProfile({...opts,'destination-root':path.join(root,'nested')},()=>1000,{}),e=>e.code==='INVALID_DESTINATION');
 assert.equal(fs.existsSync(opts['destination-root']),false);
});
test('copy missing selected profile does not create destination',async t=>{
 const {opts}=fixture(t);
 await assert.rejects(copyProfile({...opts,'profile-directory':'Missing'},()=>1000,{}),e=>e.code==='PROFILE_NOT_FOUND');
 assert.equal(fs.existsSync(opts['destination-root']),false);
});
