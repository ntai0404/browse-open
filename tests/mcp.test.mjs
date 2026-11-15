import test from 'node:test';
import assert from 'node:assert/strict';
import {dispatch,invoke,tools} from '../scripts/mcp-server.mjs';
test('MCP advertises only implemented CLI operations',async()=>{
  const initialized=await dispatch({jsonrpc:'2.0',id:1,method:'initialize',params:{protocolVersion:'2024-11-05'}});
  assert.equal(initialized.result.serverInfo.name,'chromium-open');
  const listed=await dispatch({jsonrpc:'2.0',id:2,method:'tools/list'});
  assert.deepEqual(listed.result.tools.map(t=>t.name),['doctor','profiles','connect','tabs','open','verify','native_launch']);
  assert.equal(tools.find(t=>t.name==='open').inputSchema.additionalProperties,false);
  assert.equal(tools.find(t=>t.name==='open').annotations.openWorldHint,true);
});
test('MCP refuses arbitrary shell commands and unknown arguments',async()=>{
  await assert.rejects(invoke('shell',{command:'anything'}),/Unknown tool/);
  await assert.rejects(invoke('doctor',{command:'anything'}),/Unknown argument/);
  await assert.rejects(invoke('open',{url:'https://example.com/'}),/Missing argument/);
});
test('MCP preserves real CLI BLOCKED JSON and exit code',async()=>{
  const result=await invoke('profiles',{userDataDir:'C:\\chromium-open-profile-that-does-not-exist'});
  assert.equal(result.status,'BLOCKED');assert.equal(result.error.code,'PROFILE_NOT_FOUND');assert.equal(result.transport.exitCode,3);assert.deepEqual(result.effects,{});
});
test('MCP validates timeout and PID before spawn',async()=>{
  await assert.rejects(invoke('doctor',{timeout:1}),/Invalid integer/);
  await assert.rejects(invoke('connect',{userDataDir:'root',profileDirectory:'Default',instance:-1}),/Invalid integer/);
});

test('MCP open without URL reaches the CLI and preserves missing-profile BLOCKED',async()=>{
  const result=await invoke('open',{userDataDir:'C:\\chromium-open-profile-that-does-not-exist',profileDirectory:'Default'});
  assert.equal(result.status,'BLOCKED');assert.equal(result.error.code,'PROFILE_NOT_FOUND');assert.equal(result.transport.exitCode,3);assert.deepEqual(result.effects,{});
});

test('native MCP guards missing profile and does not report control as passed',async()=>{
 const r=await invoke('native_launch',{executable:'C:/missing/chrome.exe',userDataDir:'C:/browse-open-no-such-profile',profileDirectory:'Default'});
 assert.equal(r.status,'BLOCKED');assert.equal(r.error.code,'PROFILE_NOT_FOUND');assert.deepEqual(r.effects,{});
});
