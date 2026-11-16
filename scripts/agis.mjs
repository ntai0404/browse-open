import fs from 'node:fs';
import path from 'node:path';
export function discoverAgis(roots) {
 const found=new Map();
 for(const root of roots.filter(Boolean)) {
  const parent=path.dirname(path.resolve(root));
  if(!fs.existsSync(parent))continue;
  for(const entry of fs.readdirSync(parent,{withFileTypes:true})) {
   if(!entry.isDirectory()||!entry.name.endsWith('-agis'))continue;
   const candidate=path.join(parent,entry.name);
   try {
    const state=JSON.parse(fs.readFileSync(path.join(candidate,'Local State'),'utf8'));
    for(const p of fs.readdirSync(candidate,{withFileTypes:true})) {
     if(!p.isDirectory()||['System Profile','Guest Profile'].includes(p.name)||!fs.existsSync(path.join(candidate,p.name,'Preferences')))continue;
     const row={userDataDir:candidate,profileDirectory:p.name,displayName:state.profile?.info_cache?.[p.name]?.name||null,agis:true};
     found.set(candidate.toLowerCase()+'|'+p.name,row);
    }
   }catch{/* Invalid or incomplete copies are not selectable. */}
  }
 }
 return [...found.values()];
}
