import {PDFDocument,rgb,PDFFont} from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import type {Vpa,VpaDraft} from './vpa';

export async function createVpaPdf(v:Vpa,d:VpaDraft,name:string,uni:string,fontBytes:Uint8Array,photos:{bytes:Uint8Array;type:string;caption:string}[],demo=false){
 const pdf=await PDFDocument.create();pdf.registerFontkit(fontkit);
 const font=await pdf.embedFont(fontBytes,{subset:true});
 let page=pdf.addPage([595.28,841.89]),y=785;const left=48,width=499;
 const ink=rgb(.09,.23,.20),muted=rgb(.35,.40,.37);
 function newPage(){page=pdf.addPage([595.28,841.89]);y=785;}
 function text(value:string,size=11,color=ink){
  for(const paragraph of value.replace(/\r/g,'').split('\n')){
   let line='';
   for(const word of paragraph.split(/\s+/)){
    const next=line?line+' '+word:word;
    if(font.widthOfTextAtSize(next,size)>width&&line){if(y<66)newPage();page.drawText(line,{x:left,y,size,font,color});y-=size*1.5;line='';}
    for(const char of (line?' ':'')+word){if(font.widthOfTextAtSize(line+char,size)>width&&line){if(y<66)newPage();page.drawText(line,{x:left,y,size,font,color});y-=size*1.5;line='';}line+=char;}
   }
   if(y<66)newPage();if(line)page.drawText(line,{x:left,y,size,font,color});y-=size*1.5;
  }
 }
 text('URBAN RETAIL PLACEMAKING',10,muted);y-=12;
 text(v.id.toUpperCase()+' | '+v.title,21);y-=8;
 text(name+' ('+uni+')',11);text(demo?'TEST ACCOUNT - not a Canvas submission':'Field analysis - submission attachment',10,muted);y-=20;
 for(const q of v.questions){if(y<140)newPage();text(q.label,12);y-=4;text(d.answers[q.key]||'Not answered',11);y-=16;}
 if(photos.length){newPage();text('Photographic evidence',18);y-=12;for(const p of photos){
  const image=p.type==='image/png'?await pdf.embedPng(p.bytes):await pdf.embedJpg(p.bytes);
  const scale=Math.min(width/image.width,300/image.height,1),w=image.width*scale,h=image.height*scale;
  if(y-h<90)newPage();page.drawImage(image,{x:left,y:y-h,width:w,height:h});y-=h+20;text(p.caption,10,muted);y-=14;
 }}
 pdf.getPages().forEach((p,i)=>{p.drawLine({start:{x:48,y:45},end:{x:547,y:45},color:rgb(.8,.84,.81),thickness:.5});p.drawText(`${v.id.toUpperCase()} · ${i+1} / ${pdf.getPageCount()}`,{x:48,y:28,size:9,font,color:muted});});
 pdf.setTitle(v.id.toUpperCase()+' - '+v.title);pdf.setAuthor(name);
 return pdf.save();
}
