// SpaceGame HUD canvas renderer.
// Owns screen-space navigation, telemetry, radar, guidance and HUD effects.
(function(global){
"use strict";

function drawLagrangeScreenCue(){
  if(level!==6||!mission||mission.done) return;
  const p=lagrangePoint(),sx=(p.x-cam.x)*cam.zoom+W/2,sy=(p.y-cam.y)*cam.zoom+H/2,margin=70;
  if(sx>margin&&sx<W-margin&&sy>95&&sy<H-185) return;
  const cx=W/2,cy=H/2,dx=sx-cx,dy=sy-cy,ang=Math.atan2(dy,dx);
  const rx=Math.max(40,Math.min(W-40,cx+Math.cos(ang)*(W/2-55))),ry=Math.max(100,Math.min(H-190,cy+Math.sin(ang)*(H/2-115)));
  ctx.save();ctx.translate(rx,ry);ctx.rotate(ang);ctx.fillStyle=p.color;ctx.beginPath();ctx.moveTo(18,0);ctx.lineTo(-9,-9);ctx.lineTo(-5,0);ctx.lineTo(-9,9);ctx.closePath();ctx.fill();ctx.restore();
  ctx.fillStyle=p.color;ctx.font='900 13px "Microsoft YaHei",sans-serif';ctx.textAlign='center';ctx.fillText(`L${p.id} · ${lagrangeMetrics().distance.toFixed(0)} u`,rx,ry+25);ctx.textAlign='left';
}
function drawBinaryScreenCue(){
  if(level!==8||!binary||mission.done||mission.stage===0)return;
  const target=mission.stage===1?binaryGatePoint():station,label=mission.stage===1?'引力通道':'暮光站';
  const sx=(target.x-cam.x)*cam.zoom+W/2,sy=(target.y-cam.y)*cam.zoom+H/2,margin=68;
  if(sx>margin&&sx<W-margin&&sy>90&&sy<H-180)return;
  const cx=W/2,cy=H/2,ang=Math.atan2(sy-cy,sx-cx),rx=Math.max(42,Math.min(W-42,cx+Math.cos(ang)*(W/2-56))),ry=Math.max(94,Math.min(H-184,cy+Math.sin(ang)*(H/2-112)));
  ctx.save();ctx.translate(rx,ry);ctx.rotate(ang);ctx.fillStyle=mission.stage===1?'#4cf0dd':'#5fd068';ctx.beginPath();ctx.moveTo(18,0);ctx.lineTo(-9,-9);ctx.lineTo(-5,0);ctx.lineTo(-9,9);ctx.closePath();ctx.fill();ctx.restore();
  ctx.fillStyle=mission.stage===1?'#4cf0dd':'#5fd068';ctx.font='900 13px "Microsoft YaHei",sans-serif';ctx.textAlign='center';
  const dist=Math.hypot(target.x-rocket.x,target.y-rocket.y);ctx.fillText(`${label} · ${dist.toFixed(0)} u`,rx,ry+25);ctx.textAlign='left';
}
function drawThreeBodyScreenCue(){
  if(level!==10||!threeBody||mission.done||mission.stage>=2)return;
  const rescue=nearestUnrescuedThreeBodyShip();if(!rescue)return;
  const target=rescue.gate,sx=(target.x-cam.x)*cam.zoom+W/2,sy=(target.y-cam.y)*cam.zoom+H/2,margin=68;
  if(sx>margin&&sx<W-margin&&sy>92&&sy<H-185)return;
  const cx=W/2,cy=H/2,ang=Math.atan2(sy-cy,sx-cx),rx=Math.max(42,Math.min(W-42,cx+Math.cos(ang)*(W/2-56))),ry=Math.max(98,Math.min(H-188,cy+Math.sin(ang)*(H/2-116)));
  const color=rescue.index===0?'#4cf0dd':'#ffd166';
  ctx.save();ctx.translate(rx,ry);ctx.rotate(ang);ctx.fillStyle=color;ctx.beginPath();ctx.moveTo(18,0);ctx.lineTo(-9,-9);ctx.lineTo(-5,0);ctx.lineTo(-9,9);ctx.closePath();ctx.fill();ctx.restore();
  ctx.fillStyle=color;ctx.font='900 13px "Microsoft YaHei",sans-serif';ctx.textAlign='center';ctx.fillText(`最近：求救飞船 ${rescue.index?'B':'A'} · ${rescue.distance.toFixed(0)} u`,rx,ry+25);ctx.textAlign='left';
}
function objectiveVisualTarget(){
  if(!mission||mission.done)return null;
  const outwardPoint=(cx,cy,r)=>{const dx=rocket.x-cx,dy=rocket.y-cy,d=Math.max(1,Math.hypot(dx,dy));return{x:cx+dx/d*r,y:cy+dy/d*r,r:28};};
  if(level===1){const a=padAngle();return{x:EARTH.x+Math.cos(a)*R_GEO,y:EARTH.y+Math.sin(a)*R_GEO,r:GEO_BAND,label:'同步带目标',color:'#5fd068'};}
  if(level===2){const a=landAngle();return{x:EARTH.x+Math.cos(a)*EARTH.r,y:EARTH.y+Math.sin(a)*EARTH.r,r:70,label:'着陆区',color:'#5fd068'};}
  if(level===3&&station&&!station.shattered)return{x:station.x,y:station.y,r:38,label:'空间站',color:'#5fd068'};
  if(level===4)return{x:MOON.x,y:MOON.y,r:MOON.r,label:'月球',color:'#dce3e8'};
  if(level===5){if(mission.stage<3)return{x:MOON.x,y:MOON.y,r:MOON.r,label:'月球借力',color:'#dce3e8'};const p=outwardPoint(EARTH.x,EARTH.y,SLING_EXIT_R);return{...p,label:'地球逃逸门',color:'#5fd068'};}
  if(level===6){const lm=nearestLagrangeMetrics(),p=lm.point;return{x:p.x,y:p.y,r:220,label:`最近 L${p.id}`,color:p.color};}
  if(level===7&&asteroid?.alive)return{x:asteroid.x,y:asteroid.y,r:asteroid.r,label:'目标小行星',color:'#d8a16f'};
  if(level===8&&binary){if(mission.stage===0)return{x:0,y:0,r:60,label:'双星通道',color:'#4cf0dd'};if(station?.shattered)return null;const p=mission.stage===1?binaryGatePoint():station;return{x:p.x,y:p.y,r:mission.stage===1?30:38,label:mission.stage===1?'引力通道':'暮光站',color:mission.stage===1?'#4cf0dd':'#5fd068'};}
  if(level===9&&blackHole){if(mission.stage<2)return{x:0,y:0,r:BH_PHOTON_RING,label:'黑洞近点',color:'#d9a6ff'};const p=outwardPoint(0,0,BH_ESCAPE_R);return{...p,label:'远方救援门',color:'#5fd068'};}
  if(level===10&&threeBody){if(mission.stage<2){const rescue=nearestUnrescuedThreeBodyShip();if(rescue){const p=rescue.gate;return{x:p.x,y:p.y,r:THREE_GATE_R,label:`最近：求救飞船 ${rescue.index?'B':'A'}`,color:rescue.index?'#ffd166':'#4cf0dd'};}}const c=threeBodyBarycenter(),p=outwardPoint(c.x,c.y,THREE_ESCAPE_R);return{...p,label:'安全边界',color:'#5fd068'};}
  return null;
}
function drawObjectiveScreenCue(){
  if(!hudInfo.targets)return;
  const target=objectiveVisualTarget();if(!target)return;
  const sx=(target.x-cam.x)*cam.zoom+W/2,sy=(target.y-cam.y)*cam.zoom+H/2,screenR=Math.abs((target.r||0)*cam.zoom);
  const landscape=H<=520;
  const safe={left:landscape?112:42,right:landscape?W-112:W-42,top:landscape?68:94,bottom:H-(landscape?80:188)};
  const centerVisible=sx>safe.left&&sx<safe.right&&sy>safe.top&&sy<safe.bottom;
  const distance=Math.hypot(target.x-rocket.x,target.y-rocket.y),distanceText=distance>=10000?(distance/1000).toFixed(1)+'k':distance.toFixed(0);
  ctx.save();ctx.strokeStyle=target.color;ctx.fillStyle=target.color;ctx.lineWidth=2;
  if(centerVisible&&screenR>=15){ctx.restore();return;}
  if(centerVisible){
    const rr=15+2*Math.sin((mission.flightTime||0)*4);ctx.globalAlpha=.92;ctx.beginPath();ctx.arc(sx,sy,rr,0,TAU);ctx.stroke();ctx.beginPath();ctx.moveTo(sx-rr-5,sy);ctx.lineTo(sx-rr+3,sy);ctx.moveTo(sx+rr-3,sy);ctx.lineTo(sx+rr+5,sy);ctx.moveTo(sx,sy-rr-5);ctx.lineTo(sx,sy-rr+3);ctx.moveTo(sx,sy+rr-3);ctx.lineTo(sx,sy+rr+5);ctx.stroke();
    ctx.font='900 11px "Microsoft YaHei",sans-serif';ctx.textAlign='center';ctx.fillText(`${target.label} · ${distanceText} u`,sx,sy-rr-9);ctx.restore();ctx.textAlign='left';return;
  }
  const cx=W/2,cy=(safe.top+safe.bottom)/2,dx=sx-cx,dy=sy-cy,halfW=Math.max(20,(safe.right-safe.left)/2),halfH=Math.max(20,(safe.bottom-safe.top)/2),edgeScale=Math.min(halfW/Math.max(1,Math.abs(dx)),halfH/Math.max(1,Math.abs(dy)));
  const ex=cx+dx*edgeScale,ey=cy+dy*edgeScale,ang=Math.atan2(dy,dx);
  ctx.globalAlpha=.94;ctx.beginPath();ctx.arc(ex,ey,17,0,TAU);ctx.fill();ctx.fillStyle='rgba(7,13,34,.94)';ctx.beginPath();ctx.arc(ex,ey,12,0,TAU);ctx.fill();ctx.translate(ex,ey);ctx.rotate(ang);ctx.fillStyle=target.color;ctx.beginPath();ctx.moveTo(12,0);ctx.lineTo(-5,-6);ctx.lineTo(-2,0);ctx.lineTo(-5,6);ctx.closePath();ctx.fill();ctx.rotate(-ang);ctx.translate(-ex,-ey);
  ctx.fillStyle=target.color;ctx.font='900 11px "Microsoft YaHei",sans-serif';ctx.textAlign='center';const labelY=ey>safe.bottom-30?ey-24:ey+29,labelX=Math.max(60,Math.min(W-60,ex));fitText(`${target.label} · ${distanceText} u`,labelX,labelY,112,9);ctx.restore();ctx.textAlign='left';
}
// 任务区域渲染：第一关=同步带；第二关=着陆区；第三关=空间站；第四关=月背；第五关=弹弓；第六关=五个平衡点

function radarLayout(){
  const landscape=H<=520,portrait=W<760&&!landscape,shortPortrait=portrait&&H<720;
  const ultraShort=landscape&&H<360,RS=landscape?(ultraShort?70:82):portrait?(shortPortrait?92:116):130;
  const cx=landscape?W-RS-14:(portrait&&shortPortrait&&telemetryExpanded?12:W-RS-(portrait?12:14)),cy=landscape?(ultraShort?Math.max(98,(H-RS)/2):Math.max(156,(H-RS)/2)):portrait?Math.max(176,H-220-RS-12):H-RS-14;
  return {landscape,portrait,shortPortrait,RS,cx,cy};
}
function drawBinaryRadar(){
  const {landscape,portrait,shortPortrait,RS,cx,cy}=radarLayout();
  radarHitBox={x:cx-10,y:cy-10,w:RS+20,h:RS+20};
  const mx=cx+RS/2,my=cy+RS/2+3,centerX=radarMode===0?0:rocket.x,centerY=radarMode===0?0:rocket.y,range=radarMode===0?5600:12000,scale=RS*.42/range;
  const mapX=x=>mx+(x-centerX)*scale,mapY=y=>my+(y-centerY)*scale;
  ctx.save();ctx.fillStyle='rgba(8,14,38,.86)';roundRect(cx-8,cy-8,RS+16,RS+16,15);ctx.fill();
  ctx.strokeStyle=radarMode===0?'rgba(76,201,240,.75)':'rgba(255,209,102,.7)';ctx.lineWidth=1.5;roundRect(cx-8,cy-8,RS+16,RS+16,15);ctx.stroke();
  ctx.beginPath();ctx.rect(cx,cy+16,RS,RS-31);ctx.clip();
  const gate=binaryGatePoint();
  ctx.strokeStyle='rgba(255,255,255,.18)';ctx.lineWidth=1;ctx.setLineDash([2,3]);ctx.beginPath();ctx.arc(mapX(0),mapY(0),BINARY_A_R*scale,0,TAU);ctx.stroke();ctx.beginPath();ctx.arc(mapX(0),mapY(0),BINARY_B_R*scale,0,TAU);ctx.stroke();ctx.setLineDash([]);
  if(showPred&&!rocket.landed){const p=getPredictedPath();ctx.strokeStyle='rgba(255,209,102,.75)';ctx.lineWidth=1;ctx.setLineDash([2,2]);ctx.beginPath();for(let i=0;i<p.pts.length;i++){const q=p.pts[i];i?ctx.lineTo(mapX(q.x),mapY(q.y)):ctx.moveTo(mapX(q.x),mapY(q.y));}ctx.stroke();ctx.setLineDash([]);}
  for(const b of [MARS,MOON,EARTH]){const r=Math.max(b.isStar?4:2.5,b.r*scale);ctx.fillStyle=b===MARS?'#ffad3d':b===MOON?'#b9e4ff':'#4cc9f0';ctx.beginPath();ctx.arc(mapX(b.x),mapY(b.y),r,0,TAU);ctx.fill();}
  ctx.fillStyle='#4cf0dd';ctx.beginPath();ctx.arc(mapX(gate.x),mapY(gate.y),3,0,TAU);ctx.fill();
  if(!station.shattered){ctx.fillStyle='#5fd068';ctx.beginPath();ctx.arc(mapX(station.x),mapY(station.y),3,0,TAU);ctx.fill();}
  ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(mapX(rocket.x),mapY(rocket.y),3.5,0,TAU);ctx.fill();
  if(radarMode===1){const vw=Math.max(8,W/cam.zoom*scale),vh=Math.max(8,H/cam.zoom*scale);ctx.strokeStyle='#4cc9f0';ctx.setLineDash([3,2]);ctx.strokeRect(mapX(cam.x)-vw/2,mapY(cam.y)-vh/2,vw,vh);ctx.setLineDash([]);}
  ctx.restore();ctx.fillStyle='#fff';ctx.font=`800 ${portrait?8:9}px sans-serif`;ctx.textAlign='left';ctx.fillText(RS<100?(radarMode===0?'双星 · 点按':'全局 · 点按'):(radarMode===0?'双星雷达 · 点击切换':'全局导航 · 点击切换'),cx+5,cy+11);
  ctx.fillStyle='rgba(255,255,255,.65)';ctx.font=`700 ${portrait?7:8}px sans-serif`;ctx.fillText(RS<100?'白船 · 青门':'白船 · 青门 · 绿站',cx+5,cy+RS-5);
}
function drawBlackHoleRadar(){
  const {landscape,portrait,shortPortrait,RS,cx,cy}=radarLayout();
  radarHitBox={x:cx-10,y:cy-10,w:RS+20,h:RS+20};const mx=cx+RS/2,my=cy+RS/2+3,centerX=radarMode===0?0:rocket.x,centerY=radarMode===0?0:rocket.y,range=radarMode===0?2800:5200,scale=RS*.42/range;
  const mapX=x=>mx+(x-centerX)*scale,mapY=y=>my+(y-centerY)*scale;
  ctx.save();ctx.fillStyle='rgba(8,4,20,.9)';roundRect(cx-8,cy-8,RS+16,RS+16,15);ctx.fill();ctx.strokeStyle=radarMode===0?'rgba(190,113,255,.78)':'rgba(95,208,104,.72)';ctx.lineWidth=1.5;roundRect(cx-8,cy-8,RS+16,RS+16,15);ctx.stroke();
  ctx.beginPath();ctx.rect(cx,cy+16,RS,RS-31);ctx.clip();
  ctx.strokeStyle='rgba(174,104,255,.55)';ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(mapX(0),mapY(0),BH_BURN_R*scale,0,TAU);ctx.stroke();
  ctx.strokeStyle=mission.blackHoleInvalidExitT>0?'rgba(239,71,111,.9)':'rgba(95,208,104,.7)';ctx.setLineDash([3,3]);ctx.beginPath();ctx.arc(mapX(0),mapY(0),BH_ESCAPE_R*scale,0,TAU);ctx.stroke();ctx.setLineDash([]);
  if(showPred){const p=getPredictedPath();ctx.strokeStyle='rgba(255,209,102,.8)';ctx.lineWidth=1;ctx.setLineDash([2,3]);ctx.beginPath();for(let i=0;i<p.pts.length;i++){const q=p.pts[i];i?ctx.lineTo(mapX(q.x),mapY(q.y)):ctx.moveTo(mapX(q.x),mapY(q.y));}ctx.stroke();ctx.setLineDash([]);}
  ctx.fillStyle='#000';ctx.strokeStyle='#ffb26b';ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(mapX(0),mapY(0),Math.max(4,BH_HORIZON*scale),0,TAU);ctx.fill();ctx.stroke();
  const bx=Math.cos(blackHole.beaconAngle)*BH_BEACON_R,by=Math.sin(blackHole.beaconAngle)*BH_BEACON_R;ctx.fillStyle='#7de3ff';ctx.beginPath();ctx.arc(mapX(bx),mapY(by),2.5,0,TAU);ctx.fill();
  ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(mapX(rocket.x),mapY(rocket.y),3.5,0,TAU);ctx.fill();
  if(radarMode===1){const vw=Math.max(8,W/cam.zoom*scale),vh=Math.max(8,H/cam.zoom*scale);ctx.strokeStyle='#4cc9f0';ctx.setLineDash([3,2]);ctx.strokeRect(mapX(cam.x)-vw/2,mapY(cam.y)-vh/2,vw,vh);ctx.setLineDash([]);}
  ctx.restore();ctx.fillStyle='#fff';ctx.font=`800 ${portrait?8:9}px sans-serif`;ctx.textAlign='left';ctx.fillText(RS<100?(radarMode===0?'深渊 · 点按':'全局 · 点按'):(radarMode===0?'深渊雷达 · 点击切换':'全局导航 · 点击切换'),cx+5,cy+11);
  ctx.fillStyle='rgba(255,255,255,.65)';ctx.font=`700 ${portrait?7:8}px sans-serif`;ctx.fillText(RS<100?'紫点火 · 绿逃逸':'黑视界 · 紫点火 · 绿救援',cx+5,cy+RS-5);
}
function drawThreeBodyRadar(){
  const {landscape,portrait,shortPortrait,RS,cx,cy}=radarLayout();
  radarHitBox={x:cx-10,y:cy-10,w:RS+20,h:RS+20};
  const bary=threeBodyBarycenter(),mx=cx+RS/2,my=cy+RS/2+3,centerX=radarMode===0?bary.x:rocket.x,centerY=radarMode===0?bary.y:rocket.y,range=radarMode===0?4600:8500,scale=RS*.42/range;
  const mapX=x=>mx+(x-centerX)*scale,mapY=y=>my+(y-centerY)*scale;
  ctx.save();ctx.fillStyle='rgba(7,9,30,.9)';roundRect(cx-8,cy-8,RS+16,RS+16,15);ctx.fill();ctx.strokeStyle=radarMode===0?'rgba(190,113,255,.78)':'rgba(76,201,240,.74)';ctx.lineWidth=1.5;roundRect(cx-8,cy-8,RS+16,RS+16,15);ctx.stroke();
  ctx.beginPath();ctx.rect(cx,cy+16,RS,RS-31);ctx.clip();
  ctx.strokeStyle='rgba(190,113,255,.45)';ctx.lineWidth=1;ctx.setLineDash([2,3]);ctx.beginPath();ctx.arc(mapX(bary.x),mapY(bary.y),THREE_CHAOS_R*scale,0,TAU);ctx.stroke();
  ctx.strokeStyle='rgba(95,208,104,.7)';ctx.beginPath();ctx.arc(mapX(bary.x),mapY(bary.y),THREE_ESCAPE_R*scale,0,TAU);ctx.stroke();ctx.setLineDash([]);
  if(showPred&&!mission.hintsHidden){
    const timelines=getThreeBodyTimelines(),left=timelines.branches.find(branch=>branch.id==='left'),right=timelines.branches.find(branch=>branch.id==='right'),count=left&&right?Math.min(left.pts.length,right.pts.length):0;
    if(count>1){
      const gradient=ctx.createLinearGradient(mapX(left.pts[0].x),mapY(left.pts[0].y),mapX((left.pts[count-1].x+right.pts[count-1].x)/2),mapY((left.pts[count-1].y+right.pts[count-1].y)/2));gradient.addColorStop(0,'rgba(255,209,102,.03)');gradient.addColorStop(1,'rgba(255,209,102,.2)');ctx.fillStyle=gradient;
      ctx.beginPath();ctx.moveTo(mapX(left.pts[0].x),mapY(left.pts[0].y));for(let i=2;i<count;i+=2)ctx.lineTo(mapX(left.pts[i].x),mapY(left.pts[i].y));for(let i=count-1;i>=0;i-=2)ctx.lineTo(mapX(right.pts[i].x),mapY(right.pts[i].y));ctx.closePath();ctx.fill();
      if(colorAssistEnabled){ctx.strokeStyle='rgba(255,255,255,.24)';ctx.lineWidth=.8;ctx.setLineDash([]);for(let i=8;i<count;i+=16){ctx.beginPath();ctx.moveTo(mapX(left.pts[i].x),mapY(left.pts[i].y));ctx.lineTo(mapX(right.pts[i].x),mapY(right.pts[i].y));ctx.stroke();}}
      for(const branch of [left,right]){ctx.strokeStyle='rgba(255,209,102,.9)';ctx.lineWidth=1.1;ctx.setLineDash([4,2]);ctx.beginPath();for(let i=0;i<count;i+=2){const p=branch.pts[i];i?ctx.lineTo(mapX(p.x),mapY(p.y)):ctx.moveTo(mapX(p.x),mapY(p.y));}ctx.stroke();}
    }
    ctx.setLineDash([]);
  }
  for(let i=0;i<2;i++){const gate=threeBodyGate(i),gx=mapX(gate.x),gy=mapY(gate.y),visited=isThreeBodyShipRescued(i),destroyed=isThreeBodyShipDestroyed(i),active=!visited&&!destroyed;ctx.strokeStyle=destroyed?'rgba(239,71,111,.72)':active?(i?'#ffd166':'#4cf0dd'):'rgba(95,208,104,.45)';ctx.lineWidth=active?1.8:1;ctx.beginPath();ctx.arc(gx,gy,Math.max(2.5,THREE_GATE_R*scale),0,TAU);ctx.stroke();if(destroyed){ctx.beginPath();ctx.moveTo(gx-4,gy-4);ctx.lineTo(gx+4,gy+4);ctx.moveTo(gx+4,gy-4);ctx.lineTo(gx-4,gy+4);ctx.stroke();}else{ctx.fillStyle=active?'#ef476f':'#5fd068';ctx.fillRect(gx-4,gy-2.5,8,5);ctx.fillStyle=i?'#ffd166':'#4cf0dd';ctx.beginPath();ctx.arc(gx+5,gy-5,2,0,TAU);ctx.fill();}}
  for(const b of BODIES){const qx=mapX(b.x),qy=mapY(b.y),danger=(b.r+THREE_DANGER_PAD)*scale;ctx.fillStyle='rgba(239,71,111,.12)';ctx.beginPath();ctx.arc(qx,qy,Math.max(4,danger),0,TAU);ctx.fill();ctx.fillStyle=b.col;ctx.beginPath();ctx.arc(qx,qy,Math.max(3,b.r*scale),0,TAU);ctx.fill();}
  ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(mapX(rocket.x),mapY(rocket.y),3.5,0,TAU);ctx.fill();
  if(radarMode===1){const vw=Math.max(8,W/cam.zoom*scale),vh=Math.max(8,H/cam.zoom*scale);ctx.strokeStyle='#4cc9f0';ctx.setLineDash([3,2]);ctx.strokeRect(mapX(cam.x)-vw/2,mapY(cam.y)-vh/2,vw,vh);ctx.setLineDash([]);}
  ctx.restore();ctx.fillStyle='#fff';ctx.font=`800 ${portrait?8:9}px sans-serif`;ctx.textAlign='left';ctx.fillText(RS<100?(radarMode===0?'混沌 · 点按':'全局 · 点按'):(radarMode===0?'混沌雷达 · 点击切换':'全局导航 · 点击切换'),cx+5,cy+11);
  ctx.fillStyle='rgba(255,255,255,.65)';ctx.font=`700 ${portrait?7:8}px sans-serif`;ctx.fillText(RS<100?'预测区 · 求救':'预测走廊 · 求救飞船',cx+5,cy+RS-5);
}
function drawRadar(){
  if(!hudInfo.radar){radarHitBox=null;return;}
  if(level===10){drawThreeBodyRadar();return;}
  if(level===9){drawBlackHoleRadar();return;}
  if(level===8){drawBinaryRadar();return;}
  const {landscape,portrait,shortPortrait,RS,cx,cy}=radarLayout(),desktop=!portrait&&!landscape;
  if(!portrait&&!landscape&&!desktop){ radarHitBox=null; return; }
  radarHitBox={x:cx-10,y:cy-10,w:RS+20,h:RS+20};
  const mx=cx+RS/2, my=cy+RS/2+3;
  ctx.save();
  ctx.fillStyle='rgba(8,14,38,.82)'; roundRect(cx-8,cy-8,RS+16,RS+16,15); ctx.fill();
  ctx.strokeStyle=radarMode===0?'rgba(76,201,240,.75)':'rgba(255,209,102,.65)';
  ctx.lineWidth=1.5; roundRect(cx-8,cy-8,RS+16,RS+16,15); ctx.stroke();
  ctx.beginPath(); ctx.rect(cx,cy+16,RS,RS-31); ctx.clip();

  if(radarMode===0){
    const ap=orbitApsis();
    const outer=ap.bound&&Number.isFinite(ap.ra)?Math.max(R_GEO+GEO_BAND,Math.min(ap.ra,12000)):R_GEO*1.6;
    const range=Math.max(level>=4?MOON_ORBIT_R*(level===6?1.42:1.18):R_GEO*1.25,level===5?SLING_EXIT_R*1.08:0,level===7?10500:0,outer*1.12), scale=RS*0.39/range;
    const mapX=wx=>mx+(wx-EARTH.x)*scale, mapY=wy=>my+(wy-EARTH.y)*scale;
    const er=Math.max(4,EARTH.r*scale), geoR=R_GEO*scale;
    ctx.fillStyle=EARTH.col; ctx.beginPath(); ctx.arc(mx,my,er,0,TAU); ctx.fill();
    ctx.strokeStyle=level>=4?'rgba(207,216,220,.45)':'rgba(255,209,102,.65)'; ctx.lineWidth=1;
    ctx.beginPath(); ctx.arc(mx,my,level>=4?MOON_ORBIT_R*scale:geoR,0,TAU); ctx.stroke();
    if(level===5){
      ctx.strokeStyle='rgba(95,208,104,.75)'; ctx.setLineDash([3,3]);
      ctx.beginPath(); ctx.arc(mx,my,SLING_EXIT_R*scale,0,TAU); ctx.stroke(); ctx.setLineDash([]);
    }
    if(level===6){
      for(const p of lagrangePoints()){
        const active=p.id===mission.lagrangeTarget,qx=mapX(p.x),qy=mapY(p.y);
        ctx.fillStyle=p.color;ctx.globalAlpha=active?1:.48;ctx.beginPath();ctx.arc(qx,qy,active?5:3,0,TAU);ctx.fill();
        if(active){ctx.strokeStyle=p.color;ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(qx,qy,8,0,TAU);ctx.stroke();}
      }
      ctx.globalAlpha=1;
    }
    ctx.strokeStyle='#5fd068'; ctx.lineWidth=3;
    if(level===1||level===2){
      const targetAng=level===1?padAngle():landAngle(), targetR=(level===1?R_GEO:EARTH.r)*scale;
      const targetHalf=level===1?SLOT_HALF:LAND_HALF;
      ctx.beginPath(); ctx.arc(mx,my,targetR,targetAng-targetHalf,targetAng+targetHalf); ctx.stroke();
    }else if(level===3){
      ctx.beginPath(); ctx.arc(mx,my,STATION_R*scale,0,TAU); ctx.stroke();
    }else{
      const mqx=mapX(MOON.x), mqy=mapY(MOON.y), mr=Math.max(3,MOON.r*scale);
      ctx.fillStyle=MOON.col; ctx.beginPath(); ctx.arc(mqx,mqy,mr,0,TAU); ctx.fill();
      ctx.strokeStyle='#5fd068'; ctx.lineWidth=2.5;
      if(level===4){ ctx.beginPath(); ctx.arc(mqx,mqy,mr,moonAngle-MOON_TARGET_HALF,moonAngle+MOON_TARGET_HALF); ctx.stroke(); }
      else{ ctx.strokeStyle='rgba(207,216,220,.55)'; ctx.beginPath(); ctx.arc(mqx,mqy,mr+3,0,TAU); ctx.stroke(); }
    }

    if(level===7&&asteroid?.alive){
      const f=getAsteroidForecast(),ax=mapX(asteroid.x),ay=mapY(asteroid.y);
      if(showPred&&f.pts.length>1){ctx.strokeStyle=f.safe?'rgba(95,208,104,.78)':'rgba(239,71,111,.82)';ctx.lineWidth=1.4;ctx.setLineDash([3,3]);ctx.beginPath();ctx.moveTo(ax,ay);for(const p of f.pts){ctx.lineTo(mapX(p.x),mapY(p.y));}ctx.stroke();ctx.setLineDash([]);}
      ctx.fillStyle='#c98f61';ctx.beginPath();ctx.arc(ax,ay,Math.max(3,asteroid.r*scale),0,TAU);ctx.fill();
    }

    if(showPred&&state==='fly'&&!rocket.landed){
      const pred=getPredictedPath();
      if(pred.pts.length>1){
        ctx.strokeStyle='rgba(255,209,102,.7)'; ctx.lineWidth=1; ctx.setLineDash([2,3]);
        ctx.beginPath();
        for(let i=0;i<pred.pts.length;i++){
          const p=pred.pts[i], qx=mapX(p.x), qy=mapY(p.y);
          i?ctx.lineTo(qx,qy):ctx.moveTo(qx,qy);
        }
        ctx.stroke(); ctx.setLineDash([]);
      }
      ctx.font=`800 ${portrait?7:8}px sans-serif`; ctx.textAlign='center';
      for(const marker of pred.markers){
        const qx=mapX(marker.x), qy=mapY(marker.y), col=marker.apo?'#ffb142':'#4cc9f0';
        ctx.fillStyle=col; ctx.beginPath(); ctx.arc(qx,qy,portrait?3:3.5,0,TAU); ctx.fill();
        ctx.fillText(marker.apo?'远':'近',qx,qy-5);
      }
      if(pred.impact){
        const qx=mapX(pred.impact.x),qy=mapY(pred.impact.y),s=portrait?3:4;
        ctx.strokeStyle='#ef476f';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(qx-s,qy-s);ctx.lineTo(qx+s,qy+s);ctx.moveTo(qx+s,qy-s);ctx.lineTo(qx-s,qy+s);ctx.stroke();
      }else if(level===5&&pred.moonApproach&&pred.moonApproach.altitude<1800){
        const qx=mapX(pred.moonApproach.x),qy=mapY(pred.moonApproach.y);
        ctx.fillStyle=pred.moonApproach.altitude<80?'#ef476f':'#ffd166';ctx.beginPath();ctx.arc(qx,qy,portrait?3:4,0,TAU);ctx.fill();
      }
    }
    const rqx=mapX(rocket.x), rqy=mapY(rocket.y);
    ctx.fillStyle='#fff'; ctx.beginPath(); ctx.arc(rqx,rqy,portrait?3.5:4,0,TAU); ctx.fill();
    ctx.strokeStyle='#ef476f'; ctx.lineWidth=2;
    ctx.beginPath(); ctx.moveTo(rqx,rqy); ctx.lineTo(rqx+Math.cos(rocket.a)*9,rqy+Math.sin(rocket.a)*9); ctx.stroke();
    if(ghostShip&&guideGhostVisible()){
      ctx.strokeStyle='rgba(219,231,255,.38)'; ctx.lineWidth=1; ctx.setLineDash([]);
      if(ghostTrail.length>1){
        const start=speedTrailStartIndex(ghostTrail,Math.hypot(ghostShip.vx,ghostShip.vy));ctx.beginPath();let first=true;
        for(let i=start;i<ghostTrail.length;i+=3){ const p=ghostTrail[i],qx=mapX(p.x),qy=mapY(p.y); first?ctx.moveTo(qx,qy):ctx.lineTo(qx,qy);first=false; }
        ctx.stroke();
      }
      ctx.setLineDash([]);
      ctx.fillStyle='rgba(219,231,255,.45)'; ctx.beginPath(); ctx.arc(mapX(ghostShip.x),mapY(ghostShip.y),3,0,TAU); ctx.fill();
    }
    if(level===3&&station&&!station.shattered){
      const sqx=mapX(station.x), sqy=mapY(station.y);
      ctx.strokeStyle='rgba(95,208,104,.65)'; ctx.lineWidth=1; ctx.beginPath(); ctx.moveTo(rqx,rqy); ctx.lineTo(sqx,sqy); ctx.stroke();
      ctx.fillStyle='#5fd068'; ctx.beginPath(); ctx.arc(sqx,sqy,4,0,TAU); ctx.fill();
    }
    if(level>=4){
      const mqx=mapX(MOON.x), mqy=mapY(MOON.y);
      ctx.strokeStyle='rgba(207,216,220,.55)'; ctx.lineWidth=1; ctx.beginPath(); ctx.moveTo(rqx,rqy); ctx.lineTo(mqx,mqy); ctx.stroke();
    }
    if(mission.satellite){ const sqx=mapX(mission.satellite.x), sqy=mapY(mission.satellite.y); ctx.fillStyle='#5fd068'; ctx.fillRect(sqx-2,sqy-2,4,4); }
  }else{
    const range=45000, scale=RS*0.42/range;
    const mapX=wx=>mx+(wx-rocket.x)*scale, mapY=wy=>my+(wy-rocket.y)*scale;
    ctx.font=`700 ${portrait?7:8}px sans-serif`; ctx.textAlign='center';
    for(const body of BODIES){
      const qx=mapX(body.x), qy=mapY(body.y), r=Math.max(3,body.r*scale);
      ctx.fillStyle=body.col; ctx.beginPath(); ctx.arc(qx,qy,r,0,TAU); ctx.fill();
      ctx.fillStyle='rgba(255,255,255,.85)'; ctx.fillText(body.name,qx,qy-r-3);
    }
    if(level===6){
      for(const p of lagrangePoints()){
        const qx=mapX(p.x),qy=mapY(p.y),active=p.id===mission.lagrangeTarget;
        ctx.fillStyle=p.color;ctx.globalAlpha=active?1:.5;ctx.beginPath();ctx.arc(qx,qy,active?4:2.5,0,TAU);ctx.fill();
        if(active){ctx.fillStyle='#fff';ctx.fillText(`L${p.id}`,qx,qy-7);}
      }
      ctx.globalAlpha=1;
    }
    if(level===7&&asteroid?.alive){
      const qx=mapX(asteroid.x),qy=mapY(asteroid.y);ctx.fillStyle='#c98f61';ctx.beginPath();ctx.arc(qx,qy,3.5,0,TAU);ctx.fill();ctx.fillStyle='#ffd1a8';ctx.fillText('小行星',qx,qy-7);
    }
    // 全局导航专属视角框：显示主画面当前观察区域；轨道雷达保持简洁，不绘制此框。
    const viewCenterX=mapX(cam.x), viewCenterY=mapY(cam.y), minViewBox=portrait?9:12;
    const viewW=Math.max(minViewBox,W/cam.zoom*scale), viewH=Math.max(minViewBox,H/cam.zoom*scale);
    ctx.strokeStyle='#4cc9f0'; ctx.lineWidth=1.25; ctx.setLineDash([3,2]);
    ctx.strokeRect(viewCenterX-viewW/2,viewCenterY-viewH/2,viewW,viewH);
    ctx.setLineDash([]);
    ctx.fillStyle='#fff'; ctx.beginPath(); ctx.arc(mx,my,3.5,0,TAU); ctx.fill();
  }
  ctx.restore();
  ctx.fillStyle='#fff'; ctx.font=`800 ${portrait?8:9}px sans-serif`; ctx.textAlign='left';
  const radarTitle=RS<100?(radarMode===0?'轨道 · 点按':'全局 · 点按'):(radarMode===0?'轨道雷达 · 点击切换':'全局导航 · 点击切换');
  ctx.fillText(radarTitle,cx+5,cy+11);
  ctx.fillStyle='rgba(255,255,255,.65)'; ctx.font=`700 ${portrait?7:8}px sans-serif`;
  const radarLegend=RS<100?(radarMode===0?'白船 · 目标':'青框 = 视野'):(radarMode===0?(level===3?'白船 · 绿站 · 青轨道':level===4?'白船 · 灰月 · 绿月背':level===5?'白船 · 黄预测 · 绿逃逸门':level===6?'彩色点 = L1～L5':level===7?'棕目标 · 红危险 / 绿安全':'蓝近 · 橙远 · 绿目标'):'青框 = 当前视野');
  ctx.fillText(radarLegend,cx+5,cy+RS-5);
  ctx.textAlign='left';
}

function fitText(text,x,y,maxWidth,minSize=10){
  const baseFont=ctx.font,sizeMatch=baseFont.match(/(\d+(?:\.\d+)?)px/);
  let size=sizeMatch?Number(sizeMatch[1]):12.5,width=ctx.measureText(text).width;
  // parseFloat('800 15px ...') 会把字重 800 当成字号，在 iOS 上造成每行上千次 measureText。
  // 按宽度比例一次缩放，仍放不下时用二分截断，把每行测量压到 O(log n)。
  if(width>maxWidth&&size>minSize){
    size=Math.max(minSize,Math.floor(size*maxWidth/width*2)/2);
    ctx.font=baseFont.replace(/\d+(?:\.\d+)?px/,size+'px');
    width=ctx.measureText(text).width;
  }
  if(width<=maxWidth){ctx.fillText(text,x,y);return;}
  let low=0,high=text.length;
  while(low<high){
    const mid=Math.ceil((low+high)/2),candidate=text.slice(0,mid)+'…';
    if(ctx.measureText(candidate).width<=maxWidth)low=mid;else high=mid-1;
  }
  ctx.fillText(text.slice(0,low)+'…',x,y);
}

function telemetryRiskColor(value,safeMax,warningMax){
  return value<=safeMax?'#5fd068':value<=warningMax?'#ffd166':'#ef476f';
}

function drawThreeBodyExamChecklist(){
  if(level!==10||!mission||mission.done){threeBodyExamHitBox=null;return;}
  const exam=threeBodyExamState(),compact=W<760,landscape=H<=520;
  const width=landscape?Math.min(380,Math.max(250,W-430)):compact?Math.max(280,W-24):420;
  const height=threeBodyExamExpanded?(compact?134:146):38,x=(W-width)/2;
  const y=landscape?8:compact?(threeBodyExamExpanded?Math.min(310,Math.max(286,H-height-220)):207):14;
  threeBodyExamHitBox={x,y,w:width,h:height};
  ctx.save();ctx.fillStyle='rgba(9,15,39,.88)';roundRect(x,y,width,height,13);ctx.fill();
  ctx.strokeStyle='rgba(197,177,255,.78)';ctx.lineWidth=1.5;roundRect(x,y,width,height,13);ctx.stroke();
  ctx.textAlign='left';ctx.fillStyle='#eee8ff';ctx.font='900 13px "Microsoft YaHei",sans-serif';
  const header=`🎓 ${SG_I18N.t('最终考核')} · ${SG_I18N.t('营救')} ${exam.rescuedCount}/2 · ${SG_I18N.t(threeBodyExamExpanded?'点击收起':'点击展开')} ${threeBodyExamExpanded?'▴':'▾'}`;
  fitText(header,x+13,y+24,width-26,10);
  if(threeBodyExamExpanded){
    const rows=[
      {label:'① '+SG_I18N.t('交会接近'),status:exam.approach?'pass':'pending',detail:SG_I18N.t(exam.approach?'已达成':'待完成')},
      {label:'② '+SG_I18N.t('船员转移'),status:exam.rescuedCount===2?'pass':exam.rescuedCount?'pending':'pending',detail:`A ${exam.rescued[0]?'✓':'○'}   B ${exam.rescued[1]?'✓':'○'}`},
      {label:'③ '+SG_I18N.t('危险规避'),status:exam.avoidance==='failed'?'fail':exam.avoidance==='passed'?'pass':'pending',detail:SG_I18N.t(exam.avoidance==='failed'?'未达成':exam.avoidance==='passed'?'已达成':'待结算')},
      {label:'④ '+SG_I18N.t('成功逃逸'),status:exam.escaped?'pass':'pending',detail:SG_I18N.t(exam.escaped?'已达成':'待完成')}
    ];
    rows.forEach((row,index)=>{
      const rowY=y+(compact?47:51)+index*(compact?21:24),mark=row.status==='pass'?'✓':row.status==='fail'?'×':'○';
      ctx.fillStyle=row.status==='pass'?'#5fd068':row.status==='fail'?'#ef476f':'#ffd166';ctx.font='950 14px sans-serif';ctx.fillText(mark,x+14,rowY);
      ctx.fillStyle='rgba(255,255,255,.9)';ctx.font='800 12px "Microsoft YaHei",sans-serif';ctx.fillText(row.label,x+38,rowY);
      ctx.fillStyle=row.status==='pass'?'#7de895':row.status==='fail'?'#ff7d98':'#ffd166';ctx.textAlign='right';ctx.fillText(row.detail,x+width-14,rowY);ctx.textAlign='left';
    });
  }
  const status=document.getElementById('threeBodyExamStatus');
  if(status){
    const accessible=`${SG_I18N.t('最终考核')}：${SG_I18N.t('交会接近')} ${SG_I18N.t(exam.approach?'已达成':'待完成')}；${SG_I18N.t('船员转移')} A ${exam.rescued[0]?'✓':'○'} B ${exam.rescued[1]?'✓':'○'}；${SG_I18N.t('危险规避')} ${SG_I18N.t(exam.avoidance==='failed'?'未达成':exam.avoidance==='passed'?'已达成':'待结算')}；${SG_I18N.t('成功逃逸')} ${SG_I18N.t(exam.escaped?'已达成':'待完成')}`;
    if(status.textContent!==accessible)status.textContent=accessible;
  }
  ctx.restore();
}

function drawHUDOverlay(worldDrawStarted){
  const hudNow=performance.now(),hudInterval=lowPowerMode?(mobileEconomy?1000/24:1000/30):0;
  SG_PERF.sample('world',hudNow-worldDrawStarted);
  if(hudInterval&&hudNow-lastHudDrawAt<hudInterval)return;
  const hudDrawStarted=performance.now();
  lastHudDrawAt=hudNow;ctx=hudCtx;ctx.setTransform(HUD_DPR,0,0,HUD_DPR,0,0);ctx.clearRect(0,0,W,H);
  drawObjectiveScreenCue();

  if(level===9&&blackHole){
    const bhx=(EARTH.x-cam.x)*cam.zoom+W/2,bhy=(EARTH.y-cam.y)*cam.zoom+H/2,z=Math.max(0,blackHole.redshift);
    ctx.save();
    if(lowPowerMode){ctx.fillStyle=`rgba(72,4,18,${z*.08})`;ctx.fillRect(0,0,W,H);}
    else{
      const vg=ctx.createRadialGradient(bhx,bhy,Math.max(35,BH_HORIZON*cam.zoom),bhx,bhy,Math.max(W,H)*.78);
      // 让吸积盘和光子环保持白炽；红移主要落在画面边缘与飞船本体上。
      vg.addColorStop(0,'rgba(0,0,0,0)');vg.addColorStop(.36,`rgba(70,4,18,${z*.035})`);vg.addColorStop(1,`rgba(16,0,8,${z*.42})`);ctx.fillStyle=vg;ctx.fillRect(0,0,W,H);
      ctx.strokeStyle=`rgba(255,255,255,${z*.15})`;ctx.lineWidth=1.2;for(let i=0;i<3;i++){ctx.beginPath();ctx.arc(bhx,bhy,(BH_PHOTON_RING*cam.zoom)+(i-1)*4,0,TAU);ctx.stroke();}
    }
    if(blackHole.frozen){ctx.fillStyle='rgba(5,0,9,.42)';ctx.fillRect(0,0,W,H);}
    ctx.restore();
  }

  // ---- HUD 仪表 ----
  const speed = Math.hypot(rocket.vx, rocket.vy);
  const statW=W<760?140:200, statInner=statW-6;
  const portraitHUD=lowPowerMode&&H>650,touchLandscapeHUD=lowPowerMode&&H<=650;
  // 触屏竖屏及 iPad 横屏把燃料/生命放到姿态表下方；矮横屏放在中部，避开底部左右分置的控制键。
  const fuelBarY=portraitHUD?282:touchLandscapeHUD?Math.max(172,Math.min(224,H-96)):H-40;
  // 燃料条
  ctx.fillStyle='rgba(255,255,255,.14)';
  roundRect(16, fuelBarY, statW, 22, 11); ctx.fill();
  ctx.fillStyle=telemetryRiskColor(100-rocket.fuel,50,80);
  roundRect(19, fuelBarY+3, statInner*rocket.fuel/100, 16, 8); ctx.fill();
  ctx.fillStyle='#fff'; ctx.font='800 13px "Baloo 2",sans-serif';
  const infFuel = mission.assistMode && !mission.done;
  ctx.fillText(infFuel ? '⛽ 燃料 ∞（教学关）' : '⛽ 燃料 ' + rocket.fuel.toFixed(0) + '%', 26, fuelBarY+16);
  // 姿态模式指示
  const showSurvival=challengeLifeEnabled();
  ctx.fillStyle='rgba(255,255,255,.6)'; ctx.font='700 11px "Baloo 2",sans-serif';
  const attitudeModeY=portraitHUD ? fuelBarY+38 : H-(showSurvival?94:54);
  ctx.fillText(level===7&&mission.asteroidAnchored?'🔩 控制：喷口铰链':'🎛 姿态：' + ATT_MODES[attMode], 26, attitudeModeY);
  // 生命维持倒计时条（燃料条上方）
  const lifePct = rocket.life/Math.max(1,mission.lifeLimit);
  const lm = Math.floor(rocket.life/60), ls = Math.floor(rocket.life%60);
  const lifeEnabled = challengeLifeEnabled();
  if(showSurvival){
  const lifeBarY=fuelBarY-30;
  ctx.fillStyle='rgba(255,255,255,.14)';
  roundRect(16, lifeBarY, statW, 22, 11); ctx.fill();
  if(lifeEnabled){
    ctx.fillStyle=rocket.crewDead?'#555':lifePct>.5?'#5fd068':lifePct>.2?'#ffd166':'#ef476f';
    roundRect(19, lifeBarY+3, statInner*lifePct, 16, 8); ctx.fill();
  }else{
    ctx.fillStyle='rgba(120,120,120,.4)';
    roundRect(19, lifeBarY+3, statInner, 16, 8); ctx.fill();
  }
  ctx.fillStyle='#fff';
  ctx.fillText(
    !lifeEnabled ? '🫀 生命维持 · 未启用（教学关）'
    : mission.lifeExpired ? '⚠️ 生命维持耗尽 · 结算 −1 星'
    : (launched ? `🫀 生命维持 ${lm}:${String(ls).padStart(2,'0')}` : '🫀 生命维持 待机'),
    26, lifeBarY+16);
  // G 值指示（生命条上方）
  const gDisp = rocket.lastG/G_REF;
  if(hudInfo.gravity){
    ctx.fillStyle=telemetryRiskColor(gDisp,5,8);
    ctx.fillText(`G ${gDisp.toFixed(1)}  峰值 ${(rocket.maxG/G_REF).toFixed(1)}G（耐受5G·解体8G）`,26,lifeBarY-10);
  }
  }
  // 速度显示：绝对速度 + 带参照系后缀的关键相对速度（靠近哪个显示哪个）
  const earthAlt = Math.hypot(rocket.x-EARTH.x, rocket.y-EARTH.y) - EARTH.r;
  const binaryM=level===8?binaryMetrics():null;
  const blackM=level===9?blackHoleMetrics():null;
  const threeM=level===10?threeBodyMetrics():null;
  const dominantGravity=level>=8&&level<=10?SG_ORBIT.dominantGravityAt(rocket.x,rocket.y,BODIES):null;
  const dominantGravityMixed=!!dominantGravity&&dominantGravity.share<.5;
  const dominantGravityName=dominantGravity?(dominantGravityMixed?'多方拉扯':dominantGravity.source?.name||'多方拉扯'):'';
  const lunarM=level>=4&&level<8?moonMetrics():null, nearMoon=!!(lunarM&&lunarM.distance<2600);
  const nearDeparture=level===8&&earthAlt<600;
  const alt=level===10?threeM.r:level===9?blackM.alt:level===8?(nearDeparture?earthAlt:binaryM.distB-MOON.r):(nearMoon?lunarM.distance-MOON.r:earthAlt);
  // 相对地球表面（扣自转）
  const dxE=rocket.x-EARTH.x, dyE=rocket.y-EARTH.y, dE=Math.hypot(dxE,dyE);
  const saE=Math.atan2(dyE,dxE);
  const relEvx=rocket.vx-((EARTH.vx||0)-Math.sin(saE)*EARTH_OMEGA*dE), relEvy=rocket.vy-((EARTH.vy||0)+Math.cos(saE)*EARTH_OMEGA*dE);
  const vRelEarth=Math.hypot(relEvx,relEvy);
  const landscapeHUD=H<=520,ultraShortHUD=landscapeHUD&&H<360,teleCompact=W<760||landscapeHUD,mobileTele=W<760&&!landscapeHUD,teleDetailed=(!mobileTele||telemetryExpanded)&&!ultraShortHUD;
  const teleX=teleCompact?W-190:W-222, teleY=landscapeHUD?8:teleCompact?278:14, teleW=teleCompact?174:206;
  const teleH=teleDetailed?((level===9||level===10)?166:level===8?146:(level===5||level===7)?126:level===1?86:(level===3||level===4||level===6)?106:66):dominantGravity?106:86;
  if(hudInfo.telemetry){
  telemetryHitBox=mobileTele?{x:teleX-5,y:teleY-5,w:teleW+10,h:teleH+10}:null;
  ctx.fillStyle='rgba(8,14,38,.68)'; roundRect(teleX,teleY,teleW,teleH,14); ctx.fill();
  ctx.strokeStyle='rgba(255,255,255,.14)'; ctx.lineWidth=1; roundRect(teleX,teleY,teleW,teleH,14); ctx.stroke();
  ctx.textAlign='right';
  ctx.font=`800 ${teleCompact?11.5:13}px "Baloo 2",sans-serif`;
  ctx.fillStyle='#fff';
  ctx.fillText(level===9?`远方观测速 ${blackM.apparentSpeed.toFixed(1)} u/s`:`绝对速度 ${speed.toFixed(1)} u/s`, W-20, teleY+16);
  // 相对速度：靠近谁显示谁（标签始终写明参照系）
  ctx.fillStyle='#5fd068';
  if(level===10){
    ctx.fillStyle=threeM.clearance>THREE_DANGER_PAD?'#5fd068':threeM.clearance>0?'#ffd166':'#ef476f';
    ctx.fillText(`最近恒星 ${threeM.nearest.name.slice(-1)} · 净空 ${threeM.clearance.toFixed(0)} u`,W-20,teleY+36);
  }else if(level===7&&asteroid?.alive){
    const am=asteroidMetrics();ctx.fillStyle=telemetryRiskColor(am.relSpeed,22,60);ctx.fillText(`相对速度·小行星 ${am.relSpeed.toFixed(1)} u/s`,W-20,teleY+36);
  }else if(level===9){
    ctx.fillText(`本地速度 ${blackM.speed.toFixed(1)} · 运动 ×${blackM.coordinateFactor.toFixed(2)}`,W-20,teleY+36);
  }else if(level===8){
    const sm=stationMetrics(),relative=mission.stage>=2?sm.relSpeed:binaryM.targetRel;ctx.fillStyle=telemetryRiskColor(relative,12,40);ctx.fillText(mission.stage>=2?`相对速度·暮光站 ${sm.relSpeed.toFixed(1)} u/s`:`相对速度·暮光星 ${binaryM.targetRel.toFixed(1)} u/s`,W-20,teleY+36);
  }else if(nearMoon){
    ctx.fillStyle=telemetryRiskColor(lunarM.relSpeed,15,55);
    ctx.fillText(`相对速度·月球 ${lunarM.relSpeed.toFixed(1)} u/s`, W-20, teleY+36);
  }else if(alt < 1200){ // 近地/着陆：显示相对地表
    ctx.fillStyle=telemetryRiskColor(vRelEarth,10,45);
    ctx.fillText(`相对速度·地表 ${vRelEarth.toFixed(1)} u/s`, W-20, teleY+36);
  }else{ // 高空/轨道：显示相对地球（轨道速度）
    ctx.fillText(`轨道速度 ${speed.toFixed(1)} u/s`, W-20, teleY+36);
  }
  ctx.fillStyle='rgba(255,255,255,.85)';
  ctx.fillText(`${level===10?'距系统质心':level===9?'距时间视界':level===8?(nearDeparture?'离晨曦星':'离暮光星'):nearMoon?'月面':'高度'} ${alt.toFixed(0)} u`, W-20, teleY+56);
  if(dominantGravity&&hudInfo.gravity){
    const gravityText=`当前主导引力：${dominantGravityName}`;
    ctx.fillStyle=dominantGravityMixed?'#d9c6ff':dominantGravity.source?.col||'#d9c6ff';
    fitText(gravityText,W-20,teleY+76,teleW-16,9.5);
    const gravityStatus=document.getElementById('gravityStatus'),accessibleText=SG_I18N.t(gravityText);
    if(gravityStatus&&gravityStatus.textContent!==accessibleText)gravityStatus.textContent=accessibleText;
  }
  ctx.fillStyle='rgba(255,209,102,.9)';
  if(teleDetailed){
  if(level===1) ctx.fillText(`同步带高度 ${(R_GEO-EARTH.r-GEO_BAND).toFixed(0)}~${(R_GEO-EARTH.r+GEO_BAND).toFixed(0)}`, W-20, teleY+76);
  if(level===3&&station&&!station.shattered){
    const m=stationMetrics();
    ctx.fillStyle='#5fd068'; ctx.fillText(`空间站距离 ${m.distance.toFixed(0)} u`,W-20,teleY+76);
    ctx.fillStyle=telemetryRiskColor(m.relSpeed,8,22); ctx.fillText(`相对速度·空间站 ${m.relSpeed.toFixed(1)} u/s`,W-20,teleY+96);
  }
  if(level===4&&lunarM){
    const lunarG=MOON.mu/(lunarM.distance*lunarM.distance);
    const earthDistance=Math.hypot(rocket.x-EARTH.x,rocket.y-EARTH.y),earthG=EARTH.mu/(earthDistance*earthDistance);
    if(hudInfo.gravity){ctx.fillStyle='#5fd068';ctx.fillText(`月g ${lunarG.toFixed(2)} · 地g ${earthG.toFixed(2)}`,W-20,teleY+76);}
    ctx.fillStyle=Math.abs(lunarM.farDelta)<Math.PI/2?'#5fd068':'#ffd166';
    ctx.fillText(Math.abs(lunarM.farDelta)<Math.PI/2?'位于月背半球':'位于地球可见侧',W-20,teleY+96);
  }
  if(level===5&&lunarM){
    const energy=earthSpecificEnergy(),vInf=energy>0?Math.sqrt(2*energy):0;
    const radialA=Math.atan2(rocket.y-EARTH.y,rocket.x-EARTH.x),velocityA=Math.atan2(rocket.vy,rocket.vx);
    const exitA=Math.abs(normalizeAngle(velocityA-radialA))*180/Math.PI;
    ctx.fillStyle='#cfd8dc'; ctx.fillText(`距月 ${lunarM.distance.toFixed(0)} u`,W-20,teleY+76);
    ctx.fillStyle=energy>0?'#5fd068':energy>-300?'#ffd166':'#ef476f'; ctx.fillText(`逃逸余速 v∞ ${vInf.toFixed(1)} u/s`,W-20,teleY+96);
    ctx.fillStyle=exitA<=CHALLENGE_CONFIG[5].exitAngleStar?'#5fd068':'#ffd166';ctx.fillText(`出圈方向偏差 ${exitA.toFixed(1)}°`,W-20,teleY+116);
  }
  if(level===6){
    const lm=nearestLagrangeMetrics();
    ctx.fillStyle=telemetryRiskColor(lm.distance,mission.assistMode?220:140,1000);ctx.fillText(`距 L${lm.point.id} ${lm.distance.toFixed(0)} u`,W-20,teleY+76);
    ctx.fillStyle=telemetryRiskColor(lm.relSpeed,mission.assistMode?16:10,35);ctx.fillText(`相对速度·目标点 ${lm.relSpeed.toFixed(1)} u/s`,W-20,teleY+96);
  }
  if(level===7&&asteroid?.alive){
    const am=asteroidMetrics(),f=getAsteroidForecast();
    ctx.fillStyle='#d8a16f';ctx.fillText(`距小行星 ${am.distance.toFixed(0)} u`,W-20,teleY+76);
    ctx.fillStyle=f.safe?'#5fd068':'#ef476f';ctx.fillText(f.safe?'预测：地月均安全':`预测：${f.impact?'将撞'+f.impact.body:'距离仍危险'}`,W-20,teleY+96);
    const asteroidG=asteroid.mu/Math.max(asteroid.r*asteroid.r,am.distance*am.distance);
    ctx.fillStyle='#ffd166';ctx.fillText(hudInfo.gravity?(mission.asteroidAnchored?`铰链 ${(mission.hingeAngle*180/Math.PI).toFixed(0)}° · 小行星 g ${asteroidG.toFixed(2)}`:`小行星 g ${asteroidG.toFixed(2)} · 自转 ${(asteroid.av*180/Math.PI).toFixed(1)}°/s`):(mission.asteroidAnchored?`铰链 ${(mission.hingeAngle*180/Math.PI).toFixed(0)}°`:`自转 ${(asteroid.av*180/Math.PI).toFixed(1)}°/s`),W-20,teleY+116);
  }
  if(level===8&&binaryM){
    const sm=stationMetrics();
    ctx.fillStyle=mission.binaryGateCrossed?'#5fd068':'#4cf0dd';ctx.fillText(`引力通道 ${binaryM.gateDistance.toFixed(0)} u`,W-20,teleY+96);
    ctx.fillStyle=binaryM.targetEnergy<0?'#5fd068':'#ffd166';ctx.fillText(binaryM.targetEnergy<0?'已被暮光星捕获':`捕获能量 +${binaryM.targetEnergy.toFixed(0)}`,W-20,teleY+116);
    ctx.fillStyle=mission.binaryHeatViolated?'#ef476f':'#5fd068';ctx.fillText(`空间站 ${sm.distance.toFixed(0)} u · ${mission.binaryHeatViolated?'曾进高温区':'热区安全'}`,W-20,teleY+136);
  }
  if(level===9&&blackM){
    ctx.fillStyle='#cbb5ff';ctx.fillText(`飞船 τ ${blackHole.properTime.toFixed(1)}s · 远方 ×${blackM.worldRate.toFixed(1)}`,W-20,teleY+96);
    ctx.fillStyle=blackM.energy>0?'#5fd068':'#ffd166';ctx.fillText(`逃逸能量 ${blackM.energy>0?'+':''}${blackM.energy.toFixed(0)}`,W-20,teleY+116);
    ctx.fillStyle=telemetryRiskColor(blackM.tidal,10,18);ctx.fillText(`首尾潮汐差 ${blackM.tidal.toFixed(1)} u/s²`,W-20,teleY+136);
    ctx.fillStyle=`rgba(255,${Math.round(210-blackHole.redshift*120)},${Math.round(190-blackHole.redshift*150)},.95)`;ctx.fillText(`引力红移 ${(blackHole.redshift*100).toFixed(0)}%`,W-20,teleY+156);
  }
  if(level===10&&threeBody){
    const rescue=mission.stage<2?nearestUnrescuedThreeBodyShip():null,split=timelineCache?.result?.divergence;
    ctx.fillStyle=rescue?.index===1?'#ffd166':'#4cf0dd';ctx.fillText(rescue?`最近求救 ${rescue.index?'B':'A'} · ${rescue.distance.toFixed(0)} u`:`距安全边界 ${Math.max(0,THREE_ESCAPE_R-threeM.r).toFixed(0)} u`,W-20,teleY+96);
    ctx.fillStyle=mission.threeDangerViolated?'#ef476f':'#ffd166';ctx.fillText(`混沌指数 ${threeM.chaos.toFixed(2)} · ${mission.threeDangerViolated?'已闯红区':'净空安全'}`,W-20,teleY+116);
    ctx.fillStyle='#d9c6ff';ctx.fillText(`预测区域宽度 ${Number.isFinite(split)?split.toFixed(0):'等待观测'} u`,W-20,teleY+136);
    ctx.fillStyle='rgba(255,255,255,.72)';ctx.fillText(`宇宙种子 #${threeBody.seed.toString(16).toUpperCase().padStart(8,'0')}`,W-20,teleY+156);
  }
  }else{
    let critical='任务导航正常',criticalColor='#ffd166';
    if(level===1){const s=directSyncStatus();critical=s.inBand?`同步差 ${s.residual.toFixed(3)} rad/s`:'目标：进入同步带';criticalColor=s.inBand?'#5fd068':'#ffd166';}
    else if(level===2)critical=mission.stage>=2?'目标：对准绿色着陆区':'目标：返回地表';
    else if(level===3&&station&&!station.shattered){const m=stationMetrics();critical=`空间站 ${m.distance.toFixed(0)} u · 相对速度·空间站 ${m.relSpeed.toFixed(1)}`;criticalColor=m.distance<300?'#5fd068':'#ffd166';}
    else if(level===4&&lunarM){critical=Math.abs(lunarM.farDelta)<Math.PI/2?'已到月背 · 准备着陆':'目标：月球背面';criticalColor=Math.abs(lunarM.farDelta)<Math.PI/2?'#5fd068':'#ffd166';}
    else if(level===5){const e=earthSpecificEnergy(),v=e>0?Math.sqrt(2*e):0;critical=`逃逸余速 v∞ ${v.toFixed(1)} u/s`;criticalColor=e>0?'#5fd068':'#ffd166';}
    else if(level===6){const lm=nearestLagrangeMetrics();critical=`L${lm.point.id} ${lm.distance.toFixed(0)} u · 相对速度·目标点 ${lm.relSpeed.toFixed(1)}`;criticalColor=lm.point.color;}
    else if(level===7&&asteroid){const f=getAsteroidForecast();critical=asteroid.shattered?'小行星已碎裂':f.safe?'预测：地月均安全':'预测：仍有撞击危险';criticalColor=f.safe?'#5fd068':'#ef476f';}
    else if(level===8&&binaryM){const sm=stationMetrics();critical=mission.stage>=2?`暮光站 ${sm.distance.toFixed(0)} u`:`引力通道 ${binaryM.gateDistance.toFixed(0)} u`;criticalColor=mission.stage>=2?'#5fd068':'#4cf0dd';}
    else if(level===9&&blackM){critical=`逃逸能量 ${blackM.energy>0?'+':''}${blackM.energy.toFixed(0)}`;criticalColor=blackM.energy>0?'#5fd068':'#ffd166';}
    else if(level===10&&threeBody){const rescue=mission.stage<2?nearestUnrescuedThreeBodyShip():null;critical=rescue?`最近求救 ${rescue.index?'B':'A'} ${rescue.distance.toFixed(0)} u`:`安全边界 ${Math.max(0,THREE_ESCAPE_R-threeM.r).toFixed(0)} u`;criticalColor=rescue?.index===1?'#ffd166':'#4cf0dd';}
    ctx.fillStyle=criticalColor;ctx.fillText(critical,W-20,teleY+(dominantGravity?96:76));
    ctx.fillStyle='rgba(255,255,255,.45)';ctx.font='900 11px sans-serif';ctx.textAlign='left';ctx.fillText('＋',teleX+8,teleY+17);ctx.textAlign='right';
  }
  ctx.fillStyle='#fff';
  ctx.textAlign='left';
  }else telemetryHitBox=null;

  // 姿态指示器（左上）：三种显示模式（V 切换）
  // dialMode: 0=世界固定（机头随 rocket.a 转） 1=速度向上（表盘转到速度朝上） 2=机头向上（表盘转到机头朝上）
  const attCompact=W<760||H<520, attX=attCompact?62:90, attY=attCompact?(H<360?132:156):160, attR=attCompact?44:54;
  attitudeHitBox={x:attX-attR-8,y:attY-attR-8,w:(attR+8)*2,h:(attR+8)*2+22};
  const attitudeV=attitudeVelocity(), speed2=Math.hypot(attitudeV.vx,attitudeV.vy);
  const vAng=Math.atan2(attitudeV.vy,attitudeV.vx);
  // 表盘旋转角（让参考对象转到"向上"，即屏幕 -y）
  let dialRot = 0;
  if(dialMode===1 && speed2>3) dialRot = -vAng - Math.PI/2;      // 速度方向 → 上
  if(dialMode===2) dialRot = -rocket.a - Math.PI/2;               // 机头 → 上
  ctx.fillStyle='rgba(10,14,35,.6)';
  ctx.beginPath(); ctx.arc(attX,attY,attR,0,TAU); ctx.fill();
  ctx.strokeStyle='rgba(255,255,255,.25)'; ctx.lineWidth=2; ctx.stroke();
  // 表盘内容（随 dialRot 旋转）
  ctx.save();
  ctx.translate(attX,attY); ctx.rotate(dialRot);
  // 速度方向刻度（青色短线 + 箭头）
  if(speed2>3){
    ctx.strokeStyle='#4cc9f0'; ctx.lineWidth=3;
    ctx.beginPath();
    ctx.moveTo(Math.cos(vAng)*(attR-14), Math.sin(vAng)*(attR-14));
    ctx.lineTo(Math.cos(vAng)*(attR-2),  Math.sin(vAng)*(attR-2));
    ctx.stroke();
  }
  // 小火箭（机头沿 -y，rotate 时 +PI/2 对齐 rocket.a）
  ctx.save();
  ctx.rotate(rocket.a+Math.PI/2);
  ctx.fillStyle='#ef476f';
  ctx.beginPath(); ctx.moveTo(-4,4); ctx.lineTo(-8,11); ctx.lineTo(-4,9); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(4,4); ctx.lineTo(8,11); ctx.lineTo(4,9); ctx.closePath(); ctx.fill();
  ctx.fillStyle='#f8f9fa'; ctx.strokeStyle='#222'; ctx.lineWidth=1.6;
  ctx.beginPath(); ctx.moveTo(0,-14);
  ctx.quadraticCurveTo(5,-6,4.5,4); ctx.lineTo(4.5,9); ctx.lineTo(-4.5,9); ctx.lineTo(-4.5,4);
  ctx.quadraticCurveTo(-5,-6,0,-14); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle='#4cc9f0'; ctx.beginPath(); ctx.arc(0,-2.5,2.6,0,TAU); ctx.fill();
  ctx.restore();
  ctx.restore();
  // 顶部"上"方向标记（不随表盘转，指示屏幕上方）
  ctx.fillStyle='rgba(255,255,255,.5)'; ctx.font='800 11px "Baloo 2",sans-serif'; ctx.textAlign='center';
  ctx.fillText('▲', attX, attY-attR+12);
  ctx.fillStyle='rgba(255,255,255,.75)'; ctx.font='700 11px "Baloo 2",sans-serif';
  const dialNames=['世界固定','速度向上','机头向上'];
  const offsetDeg=Math.round(velOffset*180/Math.PI), offsetText=(offsetDeg>=0?'+':'')+offsetDeg+'°';
  ctx.fillText(dialNames[dialMode]+' · 点击切换', attX, attY+attR+16);
  ctx.textAlign='left';
  drawRadar();
  drawThreeBodyExamChecklist();

  // 子弹时间视觉：暗角 + 提示
  if(bulletT>0){
    ctx.fillStyle=bulletGradient; ctx.fillRect(0,0,W,H);
    ctx.fillStyle='#ffd166'; ctx.font='800 20px "Baloo 2",sans-serif'; ctx.textAlign='center';
    ctx.fillText('🕐 子弹时间 —— 从容操作', W/2, W<760?390:135);
    ctx.textAlign='left';
  }
  // 飞离地球太远：四周变暗 + 提示重置（不强制）
  if(rocket._tooFar && mission.assistMode && !mission.done){
    ctx.fillStyle=farGradient; ctx.fillRect(0,0,W,H);
    ctx.fillStyle='#ffb142'; ctx.font='800 19px "Baloo 2",sans-serif'; ctx.textAlign='center';
    const slingEnergy=level===5?earthSpecificEnergy():0;
    ctx.fillText(level===5?(slingEnergy>0?'继续向外飞出绿色大圈':'⚠️ 这条路线还会掉回地球'):level===6?'⚠️ 已飞过平衡点目标':'⚠️ 已飞离目标空域', W/2, H*0.4);
    ctx.fillStyle='rgba(255,255,255,.9)'; ctx.font='600 15px "Baloo 2",sans-serif';
    ctx.fillText(level===5?(slingEnergy>0?'右上角逃逸余速已大于 0，不会再掉回来':'飞得远不等于逃走：右上角逃逸余速还必须大于 0'):level===6?'查看右上角“相对速度·目标点”，掉头减小读数':'任务在近地 / 同步轨道，可从暂停菜单重试当前阶段', W/2, H*0.4+30);
    ctx.fillText(level===5?(slingEnergy>0?'保持向外飞行即可通关':'借月球再加速，或点击“阶段回退”重试'):level===6?'五个点都可通关，或点击“阶段回退”重新接近':'（燃料无限，可随时重来）', W/2, H*0.4+54);
    ctx.textAlign='left';
  }
  // 状态提示：8倍速 / 辅助线 / 船员死亡
  ctx.font='800 14px "Baloo 2",sans-serif';
  if(keys['Space']){
    ctx.fillStyle='#ffd166'; ctx.textAlign='center';
    ctx.fillText('⏩ 8倍速', W/2, 30); ctx.textAlign='left';
  }
  if(rocket.crewDead){
    ctx.fillStyle='rgba(239,71,111,.9)'; ctx.textAlign='center';
    ctx.font='800 16px "Baloo 2",sans-serif';
    ctx.fillText('⚰️ 飞船上已无生命迹象 · ' + rocket.deadReason, W/2, 52);
    ctx.textAlign='left';
  }

  // 教学指引面板（顶部居中）
  if(mission && hudInfo.guidance && !mission.hintsHidden && !mission.done){
    const landscapeCompact=H<=520,ultraShort=landscapeCompact&&H<360,compact=W<760||landscapeCompact;
    const bw=landscapeCompact?Math.min(360,Math.max(250,W-330)):Math.min(560,W-24), bx=W/2-bw/2, bh=ultraShort?54:(landscapeCompact?60:(compact?80:76)), by=landscapeCompact?H-(ultraShort?62:72):H-(compact?204:140);
    const echo=licenseEchoStatus();
    if(echo.text){
      const eh=landscapeCompact?28:32,ey=by-eh-7;
      ctx.globalAlpha=echo.alpha;ctx.fillStyle='rgba(8,25,53,.9)';roundRect(bx,ey,bw,eh,11);ctx.fill();
      ctx.strokeStyle='rgba(76,201,240,.72)';ctx.lineWidth=1.5;roundRect(bx,ey,bw,eh,11);ctx.stroke();
      ctx.fillStyle='#9fe8ff';ctx.font=`850 ${landscapeCompact?11.5:13}px "Baloo 2",sans-serif`;ctx.textAlign='left';
      fitText(`${SG_I18N.t('📡 执照回响：')}${SG_I18N.t(echo.text)}`,bx+12,ey+(landscapeCompact?19:22),bw-24,10);ctx.globalAlpha=1;
    }
    ctx.fillStyle='rgba(10,14,35,.72)';
    roundRect(bx, by, bw, bh, 14); ctx.fill();
    ctx.strokeStyle='rgba(255,209,102,.6)'; ctx.lineWidth=2; roundRect(bx, by, bw, bh, 14); ctx.stroke();
    ctx.textAlign='left';
    ctx.fillStyle='#ffd166'; ctx.font='800 15px "Baloo 2",sans-serif';
    ctx.fillText('任务 ' + stageInfo()[mission.stage].name, bx+16, by+(ultraShort?18:landscapeCompact?20:23));
    ctx.fillStyle='rgba(255,255,255,.85)'; ctx.font='600 12.5px "Baloo 2",sans-serif';
    fitText(landscapeCompact&&mission.dynHint?'▸ '+mission.dynHint:stageInfo()[mission.stage].hint, bx+16, by+(ultraShort?38:landscapeCompact?42:44), bw-32, landscapeCompact?9:(compact?10:11));
    // 动态实时反馈（必成功线路）
    if(mission.dynHint&&!landscapeCompact){
      ctx.fillStyle='#4cc9f0'; ctx.font='700 12.5px "Baloo 2",sans-serif';
      fitText('▸ ' + mission.dynHint, bx+16, by+(compact?65:63), compact?bw-32:bw-132, 10);
    }
    // 阶段进度点
    const stages=stageInfo(), dotStart=bx+bw-18-(stages.length-1)*(landscapeCompact?15:18);
    for(let i=0;i<stages.length;i++){
      ctx.fillStyle = i<mission.stage ? '#5fd068' : (i===mission.stage ? '#ffd166' : 'rgba(255,255,255,.25)');
      ctx.beginPath(); ctx.arc(dotStart+i*(landscapeCompact?15:18), by+(landscapeCompact?15:18), landscapeCompact?4:5, 0, TAU); ctx.fill();
    }
    if(!compact){
      ctx.fillStyle='rgba(255,255,255,.4)'; ctx.font='600 11px "Baloo 2",sans-serif';
      ctx.textAlign='right'; ctx.fillText('暂停菜单可隐藏指引', bx+bw-14, by+bh-10); ctx.textAlign='left';
    }
  }
  // 提示 toast：手机放在任务指引上方；小地图在右时靠左，展开遥测后小地图换左、提示随之靠右。
  if(mission && mission.toastT>0){
    ctx.globalAlpha = Math.min(1, mission.toastT);
    if(W<760&&H>650){
      const toastW=Math.min(186,W-20),toastX=telemetryExpanded?W-toastW-10:10,toastY=Math.max(310,H-244);
      ctx.fillStyle='rgba(8,14,38,.82)'; roundRect(toastX,toastY,toastW,32,12); ctx.fill();
      ctx.strokeStyle='rgba(76,201,240,.55)'; ctx.lineWidth=1; roundRect(toastX,toastY,toastW,32,12); ctx.stroke();
      ctx.fillStyle='#fff'; ctx.font='800 14px "Baloo 2",sans-serif'; ctx.textAlign='left';
      fitText(mission.toast,toastX+10,toastY+21,toastW-20,10);
    }else{
      ctx.fillStyle='#fff'; ctx.font='800 18px "Baloo 2",sans-serif'; ctx.textAlign='center';
      ctx.fillText(mission.toast, W/2, H<520?82:110);
    }
    ctx.textAlign='left'; ctx.globalAlpha = 1;
  }
  SG_PERF.sample('hud',performance.now()-hudDrawStarted);
}

global.SpaceGameHUD=Object.freeze({draw:drawHUDOverlay});
})(globalThis);
