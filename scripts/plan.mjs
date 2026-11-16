import path from 'node:path';
export function nativePlan(inventory,agisProfiles,sourceProfiles) {
 const port4444=inventory.listeners.filter(x=>x.port===4444);
 const choices=agisProfiles.filter(p=>/[/\\]Google[/\\]Chrome[/\\]/i.test(p.userDataDir));
 if(!choices.length)return {action:'ASK_SOURCE_PROFILE',question:'Chon profile nguon de tao ban -agis:',choices:sourceProfiles,port4444,then:'Use selected choice.copyArguments with copy-profile; then open its destination. Do not ask for URL or offer manual launch/Chromium.'};
 if(choices.length>1)return {action:'ASK_AGIS_PROFILE',choices,port4444};
 if(port4444.length)return {action:'ASK_PORT',selection:choices[0],question:'Port 4444 dang duoc dung. Ban muon dung port nao?',owners:port4444};
 return {action:'OPEN',tool:'open',arguments:{browser:'chrome',userDataDir:choices[0].userDataDir,profileDirectory:choices[0].profileDirectory,port:'4444',url:'about:blank'}};
}
export function sourceChoice(p) {
 const name=(p.displayName||p.profileDirectory).replace(/[<>:"/\\|?*\x00-\x1f]/g,'_').replace(/[. ]+$/g,'');
 return {...p,copyArguments:{userDataDir:p.userDataDir,profileDirectory:p.profileDirectory,destinationRoot:path.join(path.dirname(p.userDataDir),name+'-agis'),copyAuthorized:'yes',timeout:120000}};
}
