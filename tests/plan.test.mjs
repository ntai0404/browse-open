import test from 'node:test';import assert from 'node:assert/strict';import {nativePlan} from '../scripts/plan.mjs';
const p={userDataDir:'C:/Users/U/Google/Chrome/A-agis',profileDirectory:'Profile 1'};
test('no agis requires source choice even for single profile',()=>assert.equal(nativePlan({listeners:[]},[],[p]).action,'ASK_SOURCE_PROFILE'));
test('multiple agis never silently selected',()=>assert.equal(nativePlan({listeners:[]},[p,p],[]).action,'ASK_AGIS_PROFILE'));
test('occupied 4444 requires user port',()=>assert.equal(nativePlan({listeners:[{port:4444,pid:1}]},[p],[]).action,'ASK_PORT'));
test('one agis with free default port yields directly executable open',()=>assert.deepEqual(nativePlan({listeners:[]},[p],[]).arguments,{browser:'chrome',userDataDir:p.userDataDir,profileDirectory:'Profile 1',port:'4444',url:'about:blank'}));
