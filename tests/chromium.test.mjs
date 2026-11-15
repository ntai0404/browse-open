import test from 'node:test';
import assert from 'node:assert/strict';
import {perform,normalizeInventory,connect} from '../scripts/core.mjs';
test('retired browser choices are rejected before launch',async()=>{
 for(const browser of ['chrome','chrome-beta']) await assert.rejects(perform('open',{browser,url:'about:blank','user-data-dir':'absent','profile-directory':'Default'},{inventory:async()=>({processes:[],listeners:[]}),effects:{}},Date.now()+1000),e=>['INVALID_BROWSER','PROFILE_NOT_FOUND'].includes(e.code));
});
test('DOM target is mandatory before inventory',async()=>{await assert.rejects(perform('fill',{}, {inventory:()=>{throw Error('Unexpected inspection');}},Date.now()+1000),e=>e.code==='VERIFICATION_SELECTION_REQUIRED');});
