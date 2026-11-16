'use client';
import {ArrowUpRight,Smartphone} from 'lucide-react';
import {canvasAppUrl} from '@/lib/canvas-links';
import './canvas-links.css';
export function CanvasLinks({url,label='Open Canvas'}:{url:string;label?:string}){
 const native=canvasAppUrl(url);
 return <span className={'canvas-link-options'+(native?' has-canvas-app':'')}>
  {native&&<a className="canvas-app-link" href={native}><Smartphone size={16}/>Open in Canvas App</a>}
  <a className="session-link" href={url} target="_blank" rel="noopener noreferrer">{label}<ArrowUpRight size={15}/></a>
 </span>;
}
