import {runtime,identity,now,uid,audit} from './server';
// Durable write-ahead log. Never record cookies, tokens, credentials or raw URLs.
const contentFields:Record<string,string[]>={'vpa/draft':['revision','includeNotes','answers','photos','ppt','video','importedFrom'],review:['allocation','scores','comment','comments','id'],'review-draft':['id','scores','comments','comment'],assessment:['round','target','scores','well','improve','privateNote'],'assessment-draft':['round','target','scores','well','improve','privateNote','revision'],booking:['id','slot','note']};
export async function beginActivity(req:Request){
 const user=await identity(req);if(!user)return null;
 const url=new URL(req.url),path=url.pathname.replace(/^\/api\//,''),id=uid();
 const context:Record<string,string>={};for(const k of ['course','vpa','trek','kind','id']){const v=url.searchParams.get(k);if(v)context[k]=v.slice(0,160);}
 const event:any={schema:1,id,at:now(),actor:user.id,actingAs:user.actor?user.id:null,operator:user.actor||user.id,course:user.course,method:req.method,path,context};
 if(req.method==='POST'&&contentFields[path]&&req.headers.get('content-type')?.includes('application/json')){
  const text=await req.clone().text();if(text.length<=1024*1024){try{const data=JSON.parse(text);event.input=Object.fromEntries(contentFields[path].filter(k=>k in data).map(k=>[k,data[k]]));}catch{event.malformedInput=true;}}
 }
 const key=`activity/${user.course}/${event.at.slice(0,10)}/${id}`;
 await runtime().BUCKET.put(key+'/request.json',JSON.stringify(event),{httpMetadata:{contentType:'application/json'}});
 return{key,event,user};
}
export async function finishActivity(entry:Awaited<ReturnType<typeof beginActivity>>,response:Response){
 if(!entry)return;
 const result={requestId:entry.event.id,at:now(),status:response.status,success:response.ok,backup:response.headers.get('X-Backup-Status')};
 await runtime().BUCKET.put(entry.key+'/result.json',JSON.stringify(result),{httpMetadata:{contentType:'application/json'}});
 await audit(entry.user.actor||entry.user.id,`${entry.event.method} ${entry.event.path} ${response.status}`,JSON.stringify({requestId:entry.event.id,...entry.event.context}));
 response.headers.set('X-Request-ID',entry.event.id);
}
