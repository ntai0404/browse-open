import fs from 'node:fs';
import path from 'node:path';
import {profile,requireThat,Failure} from './core.mjs';

// Only selected profile and root metadata; never overwrite, follow links or alter source.
export async function copyProfile(opts,remaining,effects) {
  requireThat(opts['copy-authorized']==='yes','COPY_AUTHORIZATION_REQUIRED','User must authorize copying this selected profile; pass --copy-authorized yes',3);
  const selection=profile(opts['user-data-dir'],opts['profile-directory']);
  const destination=opts['destination-root'];
  requireThat(destination&&path.isAbsolute(destination),'INVALID_DESTINATION','Pass a new absolute --destination-root',2);
  requireThat(!fs.existsSync(destination),'DESTINATION_EXISTS','Destination already exists; select a new path');
  requireThat(fs.existsSync(path.dirname(destination))&&fs.statSync(path.dirname(destination)).isDirectory(),'DESTINATION_PARENT_MISSING','Destination parent must be an existing directory');
  const parent=fs.realpathSync(path.dirname(destination));
  const dest=path.join(parent,path.basename(destination));
  const state=JSON.parse(fs.readFileSync(path.join(selection.userDataDir,'Local State'),'utf8'));
  const name=(state.profile?.info_cache?.[selection.profileDirectory]?.name||selection.profileDirectory).replace(/[<>:"/\\|?*\x00-\x1f]/g,'_').replace(/[. ]+$/g,'');
  const expected=path.join(path.dirname(selection.userDataDir),name+'-agis');
  requireThat(dest.toLowerCase()===expected.toLowerCase(),'AGIS_DESTINATION_REQUIRED','Copy destination must be the selected display-name-agis root beside source User Data',3,{expectedDestination:expected});
  const relative=path.relative(selection.userDataDir,dest);
  requireThat(relative.startsWith('..'+path.sep)||path.isAbsolute(relative),'INVALID_DESTINATION','Destination cannot be inside the source root',2);
  fs.mkdirSync(dest);effects.profileCopyRoot=dest;
  const ignored=new Set(['Cache','Code Cache','GPUCache','DawnCache','DawnGraphiteCache','DawnWebGPUCache','GrShaderCache','ShaderCache','CacheStorage','ScriptCache','SingletonLock','SingletonCookie','SingletonSocket','LOCK']);
  let copiedFiles=0;const omissions=[];
  const note=(file,reason)=>omissions.push({file,reason});
  async function file(source,target,relative) {
    remaining();
    try {await fs.promises.copyFile(source,target,fs.constants.COPYFILE_EXCL);copiedFiles++;}
    catch(e) {note(relative,e.code||'COPY_FAILED');}
  }
  await file(path.join(selection.userDataDir,'Local State'),path.join(dest,'Local State'),'Local State');
  async function walk(source,target,prefix) {
    remaining();await fs.promises.mkdir(target,{recursive:true});
    for(const entry of await fs.promises.readdir(source,{withFileTypes:true})) {
      remaining();const rel=path.join(prefix,entry.name);
      if(ignored.has(entry.name)){note(rel,'CACHE_OR_LOCK_EXCLUDED');continue;}
      if(entry.isSymbolicLink()){note(rel,'LINK_EXCLUDED');continue;}
      if(entry.isDirectory())await walk(path.join(source,entry.name),path.join(target,entry.name),rel);
      else if(entry.isFile())await file(path.join(source,entry.name),path.join(target,entry.name),rel);
    }
  }
  await walk(path.join(selection.userDataDir,selection.profileDirectory),path.join(dest,selection.profileDirectory),selection.profileDirectory);
  const data={source:selection,userDataDir:dest,profileDirectory:selection.profileDirectory,copiedFiles,omissions,consistency:'BEST_EFFORT_NOT_ATOMIC',loginSession:'NOT_TESTED',complete:omissions.length===0};
  await fs.promises.writeFile(path.join(dest,'browse-open-copy.json'),JSON.stringify(data,null,2));
  try {profile(dest,selection.profileDirectory);}catch {throw new Failure('COPY_INCOMPLETE','Required Local State or Preferences could not be copied; inspect destination manifest',5,{destination:dest});}
  return {...data,omissions:omissions.slice(0,12),omissionCount:omissions.length,omissionsTruncated:omissions.length>12,manifestPath:path.join(dest,'browse-open-copy.json')};
}
