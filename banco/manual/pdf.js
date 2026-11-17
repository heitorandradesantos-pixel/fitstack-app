const {chromium}=require('playwright');const M='/home/claude/fitstack-app/manual';
const L=[['recepcao','manual-recepcao-colaboradores','Recepção e colaboradores'],['gerente','manual-gerente','Gerente'],['dono-socios','manual-dono-socios','Dono e sócios']];
(async()=>{const b=await chromium.launch();const p=await b.newPage();
for(const [h,pdf,t] of L){await p.goto('file://'+M+'/'+h+'.html');await p.waitForLoadState('networkidle');
 await p.emulateMedia({media:'print'});
 await p.pdf({path:M+'/'+pdf+'.pdf',format:'A4',printBackground:true,displayHeaderFooter:true,headerTemplate:'<span></span>',
  footerTemplate:'<div style="font-size:8px;width:100%;padding:0 12mm;color:#888;display:flex;justify-content:space-between;font-family:Inter,Arial"><span>FitStack · Manual '+t+'</span><span>Página <span class="pageNumber"></span> de <span class="totalPages"></span></span></div>',
  margin:{top:'13mm',bottom:'16mm',left:'12mm',right:'12mm'}});
 await p.emulateMedia({media:'screen'});
 await p.setViewportSize({width:390,height:844});await p.screenshot({path:h+'-cel.png'});await p.setViewportSize({width:1100,height:800});}
await b.close();})();
