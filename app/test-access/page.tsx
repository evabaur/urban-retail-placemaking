'use client';
import {useEffect,useRef,useState} from 'react';

export default function TestAccess(){
 const started=useRef(false),[error,setError]=useState('');
 useEffect(()=>{
  if(started.current)return;started.current=true;
  const token=window.location.hash.slice(1);
  window.history.replaceState(null,'','/test-access');
  if(!token){setError('This test link is missing or expired. Ask the teaching team for a new link.');return;}
  fetch('/api/test-access',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'redeem',token})})
   .then(async r=>{if(!r.ok){const d:any=await r.json();throw new Error(d.error||'Unable to sign in.');}window.location.replace('/');})
   .catch(e=>setError(e.message||'Unable to sign in. Please reopen the original link to retry.'));
 },[]);
 return <main style={{maxWidth:480,margin:'15vh auto',padding:24,color:'#003865'}}><h1>Urban Retail Placemaking</h1><p>{error||'Signing in to Test Student…'}</p><p>This account contains isolated test work only.</p>{error&&<a href="/">Return to sign in</a>}</main>;
}
