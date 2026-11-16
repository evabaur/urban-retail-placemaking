import {audit,check,getRecord,hash,identity,one,passwordHash,rateLimit,run,save,session,string,uid,User} from './server';

// A revocable testing capability, never a login bypass for live users.
export async function testAccess(req:Request){
 const body:any=await req.json();
 const target=await one<User>('SELECT * FROM users WHERE id=?','fa26-test-student');
 check(target&&target.id==='fa26-test-student'&&target.course==='sandbox'&&target.role==='student'&&!target.disabled&&!target.must_change,'Test account is unavailable.',403);
 if(['create','revoke','configure'].includes(body.action)){
  const operator=await identity(req);
  check(operator&&operator.uni==='owner01'&&operator.role==='staff'&&operator.course==='live'&&!operator.actor&&!operator.must_change,'Owner only.',403);
  if(body.action==='configure'){
   const password=string(body.password,256),uni=string(body.uni,50);
   check(uni==='teststudent'&&password.length>=6,'Use the classroom test username and at least six characters.');
   const existing=await one<User>('SELECT * FROM users WHERE uni=?',uni);check(!existing||existing.id===target.id,'Username is already in use.',409);
   await run("UPDATE users SET uni=?,name=?,password=?,must_change=0 WHERE id=? AND course='sandbox' AND role='student'",uni,uni,await passwordHash(password),target.id);
   await run('DELETE FROM sessions WHERE user_id=?',target.id);
   await run("DELETE FROM records WHERE kind='test-access-link' AND owner=?",target.id);
   await audit(operator.id,'test-account-configure',target.id);
   return Response.json({ok:true,uni},{headers:{'Cache-Control':'no-store'}});
  }
  await run("DELETE FROM records WHERE kind='test-access-link' AND course='sandbox'");
  await audit(operator.id,'test-access-'+body.action,target.id);
  if(body.action==='revoke')return Response.json({ok:true},{headers:{'Cache-Control':'no-store'}});
  const token=uid()+uid(),expires=body.nonExpiring===true?null:Date.now()+24*3600000;
  await save('test-access-link','sandbox','test-access:'+await hash(token),{expires,passwordVersion:await hash(target.password)},target.id);
  return Response.json({url:new URL('/test-access',req.url).href+'#'+token,expires:expires===null?null:new Date(expires).toISOString()},{headers:{'Cache-Control':'no-store'}});
 }
 check(body.action==='redeem','Unknown action.');
 await rateLimit('test-access-ip:'+await hash(req.headers.get('cf-connecting-ip')||'local'),60);
 const token=string(body.token,80);check(/^[0-9a-f-]{72}$/.test(token),'Invalid or expired test link.',401);
 const link=await getRecord('test-access:'+await hash(token),'test-access-link','sandbox');
 check(link&&link.owner===target.id&&(link.expires===null||link.expires>Date.now())&&link.passwordVersion===await hash(target.password),'Invalid or expired test link.',401);
 await audit(target.id,'test-link-login');
 return Response.json({ok:true},{headers:{'Cache-Control':'no-store','Set-Cookie':await session(req,target)}});
}
