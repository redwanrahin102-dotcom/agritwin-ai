/* =====================================================================
   logo.js — THE LOGO FALLBACK CHAIN
   ---------------------------------------------------------------------
   The brand mark degrades local file → CDN → inline SVG, and the favicon
   uses the same chain. This runs from <head> because the navbar <img>
   fires onerror as soon as the first source 404s — before the app
   modules at the end of <body> have been parsed.
   Depends on: nothing. Never: reads or writes app state.
   ===================================================================== */
const LOGO_CDN='https://z-cdn-media.chatglm.cn/files/ac0f19ff-d0d4-4eed-9129-17d23c89771c.png?auth_key=1889575445-e25942a68da6449fb5b3dfe355721248-0-643a4d9ff27fef19523fe005d0eb5147';
const LOGO_SVG='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">'
 +'<defs><linearGradient id="lg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#5CBF60"/><stop offset="1" stop-color="#2E7D32"/></linearGradient></defs>'
 +'<circle cx="50" cy="50" r="47" fill="url(#lg)"/>'
 +'<path d="M16 68 Q50 58 84 68" stroke="#DCEDC8" stroke-opacity=".75" stroke-width="2.4" fill="none" stroke-linecap="round"/>'
 +'<path d="M21 77 Q50 68 79 77" stroke="#DCEDC8" stroke-opacity=".5" stroke-width="2.4" fill="none" stroke-linecap="round"/>'
 +'<path d="M27 85 Q50 78 73 85" stroke="#DCEDC8" stroke-opacity=".32" stroke-width="2.4" fill="none" stroke-linecap="round"/>'
 +'<path d="M50 70 C50 60 50 52 50 40" stroke="#F1F8E9" stroke-width="3.2" fill="none" stroke-linecap="round"/>'
 +'<path d="M50 46 C41 46 32.5 40 30.5 29 C42 30 49 37 50 45 Z" fill="#AED581"/>'
 +'<path d="M50 46 C59 46 67.5 40 69.5 29 C58 30 51 37 50 45 Z" fill="#C5E1A5"/>'
 +'<path d="M50 38 C50 29 54.5 21 62 17.5 C63 27 57.5 34 51 38 Z" fill="#F1F8E9"/>'
 +'<path d="M18 27 V17.5 H27.5" stroke="#FFFFFF" stroke-width="3.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/>'
 +'<path d="M82 27 V17.5 H72.5" stroke="#FFFFFF" stroke-width="3.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/>'
 +'<path d="M18 73 V82.5 H27.5" stroke="#FFFFFF" stroke-width="3.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/>'
 +'<path d="M82 73 V82.5 H72.5" stroke="#FFFFFF" stroke-width="3.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/>'
 +'<path d="M13 50 H24" stroke="#FFFFFF" stroke-opacity=".9" stroke-width="2.2" stroke-linecap="round"/>'
 +'<circle cx="27.5" cy="50" r="2.8" fill="#FFFFFF"/>'
 +'<path d="M87 50 H76" stroke="#FFFFFF" stroke-opacity=".9" stroke-width="2.2" stroke-linecap="round"/>'
 +'<circle cx="72.5" cy="50" r="2.8" fill="#FFFFFF"/>'
 +'</svg>';
const LOGO_FALLBACK='data:image/svg+xml,'+encodeURIComponent(LOGO_SVG);
function logoFail(img){
  const stage=img.dataset.lg||'local';
  if(stage==='local'){img.dataset.lg='cdn';img.src=LOGO_CDN;}
  else if(stage==='cdn'){img.dataset.lg='svg';img.src=LOGO_FALLBACK;}
}
(function(){
  const l=document.getElementById('favLink'); if(!l)return;
  const probe=(src,next)=>{const p=new Image();p.onload=()=>{l.href=src;};p.onerror=next;p.src=src;};
  probe('logo.png',()=>probe(LOGO_CDN,()=>{l.href=LOGO_FALLBACK;}));
})();
