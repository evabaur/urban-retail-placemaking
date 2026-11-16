export function canvasAppUrl(value:string){
 try{const u=new URL(value);if(u.protocol!=='https:'||u.hostname!=='canvas.example.edu'||u.port||u.username||u.password||!/^\/(courses|files)\//.test(u.pathname))return null;
 return 'canvas-courses://'+u.host+u.pathname+u.search+u.hash;
 }catch{return null;}
}
