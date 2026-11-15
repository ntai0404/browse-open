import {Failure,requireThat,verifyTab} from './core.mjs';
async function evaluate(cdp,sessionId,expression) {
 const r=await cdp.call('Runtime.evaluate',{expression,returnByValue:true},sessionId);
 requireThat(!r.exceptionDetails,'DOM_ACTION_FAILED','DOM selector/action failed',5);
 return r.result?.value;
}
export async function domAction(command,opts,cdp,instance,address,remaining,effects) {
 requireThat(opts.target&&opts.url,'VERIFICATION_SELECTION_REQUIRED','DOM actions require --target and the expected exact --url',2);
 if(command!=='read')requireThat(opts.selector,'SELECTOR_REQUIRED','Pass --selector for fill/click',2);
 if(command==='fill')requireThat(opts.value!==undefined,'VALUE_REQUIRED','Pass --value, including empty string to clear',2);
 await verifyTab(cdp,opts.target,opts.url,remaining);
 const {sessionId}=await cdp.call('Target.attachToTarget',{targetId:opts.target,flatten:true});
 try {
  if(command!=='read') {
   const info=await evaluate(cdp,sessionId,`(()=>{const e=document.querySelector(${JSON.stringify(opts.selector)});if(!e||e.disabled||e.readOnly)return {ok:false};if(e.type==='password'||e.type==='file')return {ok:false};e.scrollIntoView({block:'center'});const r=e.getBoundingClientRect();if(!r.width||!r.height)return {ok:false};const hit=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);if(!hit||!(hit===e||e.contains(hit)))return {ok:false};${command==='fill'?`if(!(e instanceof HTMLInputElement||e instanceof HTMLTextAreaElement))return {ok:false};e.focus();e.select();`:''}return {ok:true,x:r.left+r.width/2,y:r.top+r.height/2};})()`);
   requireThat(info?.ok,'ELEMENT_NOT_ACTIONABLE','Selector is absent, hidden, disabled or unsupported',5);
   effects.domActionAttempted={command,target:opts.target};
   if(command==='fill')await cdp.call('Input.insertText',{text:opts.value},sessionId);
   else {
    await cdp.call('Input.dispatchMouseEvent',{type:'mousePressed',x:info.x,y:info.y,button:'left',buttons:1,clickCount:1},sessionId);
    await cdp.call('Input.dispatchMouseEvent',{type:'mouseReleased',x:info.x,y:info.y,button:'left',buttons:0,clickCount:1},sessionId);
   }
  }
  const snapshot=await evaluate(cdp,sessionId,`(()=>{const e=${opts.selector?'document.querySelector('+JSON.stringify(opts.selector)+')':'document.body'};return {url:location.href,title:document.title,readyState:document.readyState,found:!!e,text:e?.innerText?.slice(0,8000)||e?.textContent?.slice(0,8000)||'',value:e&&e.type!=='password'&&e.type!=='file'&&'value' in e?e.value:null};})()`);
  if(command==='fill')requireThat(snapshot?.value===opts.value,'VALUE_MISMATCH','DOM input readback differs from requested value',5);
  return {selection:{userDataDir:instance.userDataDir,profileDirectory:instance.profileDirectory},instance,endpoint:address,targetId:opts.target,command,snapshot,verification:{connectionIdentity:true,expectedUrlBeforeAction:true,inputReadback:command==='fill'?true:'NOT_APPLICABLE',clickOutcome:command==='click'?'REQUIRES_READBACK':'NOT_APPLICABLE'}};
 }finally{try{await cdp.call('Target.detachFromTarget',{sessionId});}catch{}}
}
