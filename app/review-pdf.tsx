'use client';
import {useEffect,useRef,useState} from 'react';
import {Button} from '@/components/ui/button';
// Render locally in the browser: no third-party viewer and no PDF scripts/actions.
export default function ReviewPdf({url,name}:{url:string;name:string}){
 const canvas=useRef<HTMLCanvasElement>(null),[pdf,setPdf]=useState<any>(null),[page,setPage]=useState(1),[error,setError]=useState(''),[loading,setLoading]=useState(true);
 useEffect(()=>{let disposed=false,doc:any;const controller=new AbortController();setPdf(null);setPage(1);setError('');setLoading(true);
  (async()=>{const r=await fetch(url,{signal:controller.signal});if(!r.ok)throw Error('This document is no longer available.');const bytes=await r.arrayBuffer();if(bytes.byteLength>20*1024*1024)throw Error('This PDF is too large to preview. Please download it.');const {getDocumentProxy}=await import('unpdf');doc=await getDocumentProxy(new Uint8Array(bytes),{maxImageSize:16777216,useSystemFonts:true});if(doc.numPages>100)throw Error('Preview supports up to 100 pages. Please download this PDF.');if(!disposed)setPdf(doc);else await doc.destroy();})().catch(e=>{if(!disposed){setError(e.message);setLoading(false)}});
  return()=>{disposed=true;controller.abort();doc?.destroy();};
 },[url]);
 useEffect(()=>{if(!pdf||!canvas.current)return;let active=true,task:any;setLoading(true);setError('');(async()=>{const p=await pdf.getPage(page);if(!active)return;const viewport=p.getViewport({scale:1.3}),node=canvas.current!;node.width=Math.ceil(viewport.width);node.height=Math.ceil(viewport.height);task=p.render({canvas:node,canvasContext:node.getContext('2d'),viewport});await task.promise;if(active)setLoading(false);})().catch(e=>{if(active){setError('Preview could not render. Download the original PDF to read it.');setLoading(false)}});return()=>{active=false;task?.cancel()};},[pdf,page]);
 return <section className="review-pdf" aria-label={'PDF preview: '+name}><div className="row between"><Button type="button" variant="outline" disabled={!pdf||page<=1||loading} onClick={()=>setPage(p=>p-1)}>Previous</Button><span>Page {page} / {pdf?.numPages||'—'}</span><Button type="button" variant="outline" disabled={!pdf||page>=pdf.numPages||loading} onClick={()=>setPage(p=>p+1)}>Next</Button></div>{loading&&<p role="status">Loading PDF…</p>}{error&&<p role="alert">{error}</p>}<canvas ref={canvas} aria-label={`${name}, page ${page}`} style={{width:'100%',height:'auto',display:error?'none':'block'}}/></section>;
}
