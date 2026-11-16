import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {discoverAgis} from '../scripts/agis.mjs';
test('find valid sibling -agis copies without selecting ordinary or incomplete roots',t=>{
 const parent=fs.mkdtempSync(path.join(os.tmpdir(),'browse-agis-'));t.after(()=>fs.rmSync(parent,{recursive:true,force:true}));
 for(const name of ['A-agis','B-agis','old-copy','broken-agis']){
  const root=path.join(parent,name);fs.mkdirSync(path.join(root,'Profile 1'),{recursive:true});
  fs.writeFileSync(path.join(root,'Profile 1','Preferences'),'{}');
  if(name!=='broken-agis')fs.writeFileSync(path.join(root,'Local State'),JSON.stringify({profile:{info_cache:{'Profile 1':{name}}}}));
 }
 const roots=discoverAgis([path.join(parent,'User Data'),path.join(parent,'User Data')]);
 assert.deepEqual(roots.map(r=>path.basename(r.userDataDir)).sort(),['A-agis','B-agis']);
 assert.ok(roots.every(r=>r.profileDirectory==='Profile 1'&&r.agis));
});
