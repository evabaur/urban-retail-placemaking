'use client';
import {useEffect,useRef,useState} from 'react';
import {emptyDraft,readDraft,writeDraft,FieldDraft} from './trek-storage';
import {cloudNotebook} from './trek-cloud';
type Cached=FieldDraft&{cloudRevision?:number;pending?:boolean};
export function useTrekDraft(key:string,preview=false,readOnly=false){
 const [draft,setDraft]=useState<FieldDraft>(emptyDraft),[ready,setReady]=useState(false),[status,setStatus]=useState('Opening notebook…'),[error,setError]=useState(''),[conflict,setConflict]=useState(false);
 const current=useRef<FieldDraft>(emptyDraft()),mounted=useRef(true),revision=useRef(0),dirty=useRef(false),busy=useRef(false),blocked=useRef(false),timer=useRef<ReturnType<typeof setTimeout>|null>(null);
 const cache=async()=>{await writeDraft(key,{...current.current,cloudRevision:revision.current,pending:dirty.current} as Cached);};
 function show(d:FieldDraft){current.current=d;if(mounted.current)setDraft(d);}
 async function persist(){
  if(readOnly||busy.current||!dirty.current||blocked.current)return;
  busy.current=true;const sending=current.current;
  if(mounted.current)setStatus(preview?'Saving preview…':'Saving to your account…');
  try{
   if(preview){await writeDraft(key,sending);if(current.current===sending)dirty.current=false;}
   else{const result=await cloudNotebook(key,sending,revision.current);revision.current=result.revision;if(current.current===sending){dirty.current=false;show(result.draft);}}
   await cache();if(mounted.current){setStatus(dirty.current?'Saving latest edits…':preview?'Saved in preview browser':'Saved to cloud · backed up');setError('');}
  }catch(e){const x=e as Error&{status?:number};if(x.status===409){blocked.current=true;if(mounted.current)setConflict(true);}if(mounted.current){setError(x.message);setStatus('Not synced · local copy kept');}}
  finally{busy.current=false;if(dirty.current&&!blocked.current&&mounted.current)timer.current=setTimeout(persist,3000);}
 }
 function change(fn:(d:FieldDraft)=>FieldDraft){if(readOnly||!ready)return;show({...fn(current.current),updated:new Date().toISOString()});dirty.current=true;setStatus('Unsynced edits');cache().catch(()=>setError('Local recovery is unavailable. Keep this page open until cloud save finishes.'));if(timer.current)clearTimeout(timer.current);timer.current=setTimeout(persist,1200);}
 async function reloadCloud(){if(busy.current)return;const x=await cloudNotebook(key);revision.current=x.revision;dirty.current=false;blocked.current=false;show(x.draft);setConflict(false);setError('');setStatus('Saved to cloud · backed up');await cache();}
 useEffect(()=>{
  mounted.current=true;let cancelled=false;
  if(readOnly){cloudNotebook(key).then(r=>{if(!cancelled){show(r.draft);revision.current=r.revision;setReady(true);setStatus('Student view · read-only cloud snapshot');}}).catch(()=>{if(!cancelled)setError('Notebook could not be loaded. Return to the teaching console and retry.');});return()=>{cancelled=true;mounted.current=false;};}
  (async()=>{const local=await readDraft(key).catch(()=>emptyDraft()) as Cached;if(preview){show(local);setReady(true);setStatus('Preview · this browser only');return;}
   try{const remote=await cloudNotebook(key);if(cancelled)return;revision.current=remote.revision;
    if(local.pending||(local.updated&&local.cloudRevision===undefined)){show(local);dirty.current=true;if(remote.revision!==(local.cloudRevision||0)){blocked.current=true;setConflict(true);setError('Local notes and a newer cloud copy exist. Download this copy before loading the cloud version.');}else timer.current=setTimeout(persist,0);}
    else show(remote.draft);setReady(true);setStatus(dirty.current?'Syncing saved local notes…':'Saved to cloud · backed up');
   }catch{if(cancelled)return;show(local);revision.current=local.cloudRevision||0;dirty.current=!!local.pending;setReady(true);setStatus('Offline · local recovery');setError('Cloud is unavailable. Edits stay on this device until sync succeeds.');}
  })();
  const refresh=async()=>{if(preview||busy.current||blocked.current)return;if(dirty.current){await persist();return;}busy.current=true;try{const x=await cloudNotebook(key);if(!cancelled&&!dirty.current&&x.revision!==revision.current){revision.current=x.revision;show(x.draft);await cache();setStatus('Synced from another device');}}catch{}finally{busy.current=false;}};
  const interval=setInterval(refresh,15000);window.addEventListener('focus',refresh);window.addEventListener('online',refresh);
  const leave=(e:BeforeUnloadEvent)=>{if(dirty.current){e.preventDefault();e.returnValue='';}};window.addEventListener('beforeunload',leave);
  return()=>{cancelled=true;mounted.current=false;clearInterval(interval);if(timer.current)clearTimeout(timer.current);window.removeEventListener('focus',refresh);window.removeEventListener('online',refresh);window.removeEventListener('beforeunload',leave);if(dirty.current&&!busy.current)void persist();};
 },[key,preview,readOnly]);
 return {draft,ready,status,error,setError,current,mounted,change,conflict,reloadCloud};
}
