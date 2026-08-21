"use strict";

// World-space scene renderer: mission zones, environment effects and draw orchestration.
// Frame scheduling, physics, input, persistence and mission completion stay in their owning modules.

function drawZoneEncoding(cx,cy,r,kind,start=0,end=TAU,innerR=null){
  if(!colorAssistEnabled||(kind!=='danger'&&kind!=='target')||!Number.isFinite(r)||r<=0)return;
  // 标记位置完全使用世界坐标；叉号和圆点尺寸使用固定屏幕像素。
  const span=Math.max(.05,Math.abs(end-start)),hasInner=Number.isFinite(innerR);
  const outer=hasInner?innerR+(r-innerR)*.82:r*.88;
  const inner=Math.min(outer,Math.max(0,hasInner?innerR+(r-innerR)*.2:r*.55));
  const radialSpan=Math.max(outer-inner,1e-6),rows=radialSpan>r*.3?2:1;
  const markerPx=5.8,dotPx=3.2,marker=markerPx/Math.max(.001,cam.zoom),dot=dotPx/Math.max(.001,cam.zoom),linePx=1.35;
  ctx.save();ctx.strokeStyle='rgba(255,255,255,.6)';ctx.fillStyle='rgba(255,255,255,.6)';ctx.lineWidth=linePx/Math.max(.001,cam.zoom);ctx.setLineDash([]);
  for(let row=0;row<rows;row++){
    const rr=inner+radialSpan*(row+.55)/rows,count=Math.max(3,Math.min(16,Math.round(span*rr/Math.max(64,r*.3)))),stagger=(row%2)*.5;
    for(let i=0;i<count;i++){
      const a=start+(end-start)*(i+.5+stagger)/count,x=cx+Math.cos(a)*rr,y=cy+Math.sin(a)*rr;ctx.save();ctx.translate(x,y);ctx.rotate(a);
      ctx.beginPath();
      if(kind==='danger'){ctx.moveTo(-marker,-marker);ctx.lineTo(marker,marker);ctx.moveTo(marker,-marker);ctx.lineTo(-marker,marker);ctx.stroke();}
      else{ctx.arc(0,0,dot,0,TAU);ctx.fill();}
      ctx.restore();
    }
  }
  ctx.restore();
}

function drawSlingshotZones(){
  // 明确的最终目标：只有有效飞越后，向外穿过这道门且地心能量为正才通关。
  ctx.strokeStyle=mission.slingFlybyValid?'rgba(95,208,104,.9)':'rgba(95,208,104,.4)';
  ctx.lineWidth=4/cam.zoom; ctx.setLineDash([18/cam.zoom,14/cam.zoom]);
  ctx.beginPath(); ctx.arc(EARTH.x,EARTH.y,SLING_EXIT_R,0,TAU); ctx.stroke(); ctx.setLineDash([]);
  ctx.fillStyle='rgba(95,208,104,.9)'; ctx.font=`800 ${15/cam.zoom}px "Microsoft YaHei",sans-serif`; ctx.textAlign='center';
  ctx.fillText('地球逃逸门',EARTH.x,EARTH.y-SLING_EXIT_R-16/cam.zoom);

  const mv=Math.max(1,Math.hypot(MOON.vx,MOON.vy)),ux=MOON.vx/mv,uy=MOON.vy/mv,arrow=520;
  ctx.strokeStyle='rgba(207,216,220,.85)'; ctx.lineWidth=4/cam.zoom;
  ctx.beginPath(); ctx.moveTo(MOON.x,MOON.y); ctx.lineTo(MOON.x+ux*arrow,MOON.y+uy*arrow); ctx.stroke();
  const tipX=MOON.x+ux*arrow,tipY=MOON.y+uy*arrow;
  ctx.fillStyle='rgba(207,216,220,.9)'; ctx.beginPath();
  ctx.moveTo(tipX,tipY); ctx.lineTo(tipX-ux*55-uy*28,tipY-uy*55+ux*28); ctx.lineTo(tipX-ux*55+uy*28,tipY-uy*55-ux*28); ctx.closePath(); ctx.fill();
  ctx.fillText('月球运动',MOON.x+ux*(arrow+100),MOON.y+uy*(arrow+100));
  ctx.textAlign='left';
}
function lagrangeMarkerLayout(active,r){
  // 圆环属于世界空间；文字与十字线随镜头柔和缩放，并保留最低可读尺寸。
  // 标签间距从圆环边缘计算，缩放时不会与目标区域忽远忽近。
  const visualScale=Math.max(.62,Math.min(1.65,Math.pow(cam.zoom/.12,.32)));
  const fontPx=(active?18:14)*visualScale,detailPx=11*visualScale;
  const crossPx=(active?22:15)*visualScale,gapPx=(active?12:9)*visualScale;
  return {
    fontWorld:fontPx/cam.zoom,detailWorld:detailPx/cam.zoom,crossWorld:crossPx/cam.zoom,
    topY:-r-gapPx/cam.zoom,bottomY:r+(gapPx+detailPx*.82)/cam.zoom
  };
}
function drawLagrangeZones(){
  const points=lagrangePoints(),selected=mission.lagrangeTarget||1,targetRadius=mission.assistMode?220:140;
  ctx.strokeStyle='rgba(207,216,220,.2)';ctx.lineWidth=2/cam.zoom;ctx.setLineDash([10/cam.zoom,12/cam.zoom]);
  ctx.beginPath();ctx.arc(EARTH.x,EARTH.y,MOON_ORBIT_R,0,TAU);ctx.stroke();ctx.setLineDash([]);
  const p4=points[3],p5=points[4];
  ctx.strokeStyle='rgba(125,227,255,.2)';ctx.lineWidth=1.5/cam.zoom;ctx.setLineDash([5/cam.zoom,7/cam.zoom]);
  ctx.beginPath();ctx.moveTo(EARTH.x,EARTH.y);ctx.lineTo(MOON.x,MOON.y);ctx.lineTo(p4.x,p4.y);ctx.closePath();ctx.stroke();
  ctx.beginPath();ctx.moveTo(EARTH.x,EARTH.y);ctx.lineTo(MOON.x,MOON.y);ctx.lineTo(p5.x,p5.y);ctx.closePath();ctx.stroke();ctx.setLineDash([]);
  for(const p of points){
    const active=p.id===selected,r=targetRadius,col=p.color,zoneCol='#5fd068';
    const marker=lagrangeMarkerLayout(active,r);
    ctx.globalAlpha=active?1:.48;ctx.strokeStyle=zoneCol;ctx.fillStyle=active?'rgba(95,208,104,.14)':'rgba(95,208,104,.07)';ctx.lineWidth=(active?4:2)/cam.zoom;
    ctx.beginPath();ctx.arc(p.x,p.y,r,0,TAU);ctx.fill();ctx.stroke();
    drawZoneEncoding(p.x,p.y,r,'target');
    ctx.beginPath();ctx.moveTo(p.x-marker.crossWorld,p.y);ctx.lineTo(p.x+marker.crossWorld,p.y);ctx.moveTo(p.x,p.y-marker.crossWorld);ctx.lineTo(p.x,p.y+marker.crossWorld);ctx.stroke();
    ctx.fillStyle=col;ctx.font=`900 ${marker.fontWorld}px "Microsoft YaHei",sans-serif`;ctx.textAlign='center';
    ctx.fillText(`L${p.id} ${'★'.repeat(p.stars)}`,p.x,p.y+marker.topY);
    if(active){ctx.font=`700 ${marker.detailWorld}px "Microsoft YaHei",sans-serif`;ctx.fillText(p.label,p.x,p.y+marker.bottomY);}
  }
  ctx.globalAlpha=1;ctx.textAlign='left';
  const target=points[selected-1];
  if(mission.stage>=1){ctx.strokeStyle='rgba(95,208,104,.5)';ctx.lineWidth=2/cam.zoom;ctx.setLineDash([6/cam.zoom,8/cam.zoom]);ctx.beginPath();ctx.moveTo(rocket.x,rocket.y);ctx.lineTo(target.x,target.y);ctx.stroke();ctx.setLineDash([]);}
  if(mission.satellite){ctx.fillStyle='#ffd166';ctx.strokeStyle='#17213c';ctx.lineWidth=2/cam.zoom;ctx.beginPath();ctx.arc(mission.satellite.x,mission.satellite.y,10/cam.zoom,0,TAU);ctx.fill();ctx.stroke();}
}
function drawAsteroidDefenseZones(){
  if(!asteroid||asteroid.shattered)return;
  const f=getAsteroidForecast();
  if(asteroidTrail.length>1){
    drawSpeedTrail(asteroidTrail,Math.hypot(asteroid.vx,asteroid.vy),'rgba(206,151,103,.5)',2/cam.zoom,lowPowerMode?2:1);
  }
  if(showPred&&f.pts.length>1){
    ctx.strokeStyle='rgba(255,209,102,.92)';ctx.lineWidth=4/cam.zoom;ctx.setLineDash([15/cam.zoom,11/cam.zoom]);
    ctx.beginPath();ctx.moveTo(asteroid.x,asteroid.y);for(const p of f.pts)ctx.lineTo(p.x,p.y);ctx.stroke();ctx.setLineDash([]);
    if(f.impact){
      const p=f.impact,s=18/cam.zoom;ctx.strokeStyle='#ff5d7d';ctx.lineWidth=4/cam.zoom;
      ctx.beginPath();ctx.moveTo(p.x-s,p.y-s);ctx.lineTo(p.x+s,p.y+s);ctx.moveTo(p.x+s,p.y-s);ctx.lineTo(p.x-s,p.y+s);ctx.stroke();
      ctx.fillStyle='#ff8aa4';ctx.font=`900 ${14/cam.zoom}px "Microsoft YaHei",sans-serif`;ctx.textAlign='center';
      ctx.fillText(`预计撞击${p.body} · 概率 99.9999%`,p.x,p.y-26/cam.zoom);ctx.textAlign='left';
    }
  }
}
function drawBinaryZones(){
  if(!binary)return;
  ctx.lineWidth=1.6/cam.zoom;ctx.setLineDash([9/cam.zoom,11/cam.zoom]);
  ctx.strokeStyle='rgba(255,255,255,.13)';
  ctx.beginPath();ctx.arc(0,0,BINARY_A_R,0,TAU);ctx.stroke();ctx.beginPath();ctx.arc(0,0,BINARY_B_R,0,TAU);ctx.stroke();
  ctx.strokeStyle='rgba(76,201,240,.22)';ctx.beginPath();ctx.arc(MARS.x,MARS.y,BINARY_PLANET_R,0,TAU);ctx.stroke();
  ctx.strokeStyle='rgba(166,222,255,.3)';ctx.beginPath();ctx.arc(MOON.x,MOON.y,BINARY_STATION_R,0,TAU);ctx.stroke();ctx.setLineDash([]);
  for(const s of [MARS,MOON]){
    const hr=s===MARS?binary.heatRadiusA:binary.heatRadiusB;
    ctx.strokeStyle='rgba(255,91,71,.42)';ctx.lineWidth=4/cam.zoom;ctx.setLineDash([14/cam.zoom,10/cam.zoom]);
    ctx.beginPath();ctx.arc(s.x,s.y,hr,0,TAU);ctx.stroke();ctx.setLineDash([]);
    drawZoneEncoding(s.x,s.y,hr,'danger',0,TAU,s.r);
  }
  const g=binaryGatePoint(),dx=MOON.x-MARS.x,dy=MOON.y-MARS.y,d=Math.max(1,Math.hypot(dx,dy)),nx=-dy/d,ny=dx/d,gw=260;
  ctx.strokeStyle='rgba(95,208,104,.9)';ctx.lineWidth=5/cam.zoom;
  ctx.beginPath();ctx.moveTo(g.x-nx*gw,g.y-ny*gw);ctx.lineTo(g.x+nx*gw,g.y+ny*gw);ctx.stroke();
  if(colorAssistEnabled){const gateDotPx=3.2,gateDot=gateDotPx/Math.max(.001,cam.zoom);ctx.fillStyle='rgba(255,255,255,.78)';for(let i=-3;i<=3;i++){const q=i*gw/3.4;ctx.beginPath();ctx.arc(g.x+nx*q,g.y+ny*q,gateDot,0,TAU);ctx.fill();}}
  ctx.fillStyle='#5fd068';ctx.beginPath();ctx.arc(g.x,g.y,14/cam.zoom,0,TAU);ctx.fill();
  ctx.font=`900 ${14/cam.zoom}px "Microsoft YaHei",sans-serif`;ctx.textAlign='center';ctx.fillText('移动引力通道',g.x,g.y-24/cam.zoom);
  if(mission.stage>=2&&station&&!station.shattered){
    const sr=mission.stage===3?42:120;
    ctx.fillStyle='rgba(95,208,104,.12)';ctx.strokeStyle='rgba(95,208,104,.92)';ctx.lineWidth=(mission.stage===3?4:3)/cam.zoom;ctx.setLineDash([]);
    ctx.beginPath();ctx.arc(station.x,station.y,sr,0,TAU);ctx.fill();ctx.stroke();
    drawZoneEncoding(station.x,station.y,sr,'target');
  }
  ctx.strokeStyle='rgba(255,255,255,.5)';ctx.lineWidth=2/cam.zoom;ctx.beginPath();ctx.moveTo(-13/cam.zoom,0);ctx.lineTo(13/cam.zoom,0);ctx.moveTo(0,-13/cam.zoom);ctx.lineTo(0,13/cam.zoom);ctx.stroke();
  ctx.fillStyle='rgba(255,255,255,.65)';ctx.font=`800 ${11/cam.zoom}px "Microsoft YaHei",sans-serif`;ctx.fillText('共同质心',0,-20/cam.zoom);
  if(mission.stage>=1&&!mission.done&&!station?.shattered){
    const tx=mission.stage===1?g.x:station.x,ty=mission.stage===1?g.y:station.y;
    ctx.strokeStyle='rgba(255,209,102,.45)';ctx.lineWidth=1.6/cam.zoom;ctx.setLineDash([5/cam.zoom,8/cam.zoom]);ctx.beginPath();ctx.moveTo(rocket.x,rocket.y);ctx.lineTo(tx,ty);ctx.stroke();ctx.setLineDash([]);
  }
  ctx.textAlign='left';
}
function drawRescueSolarPanel(x,y,w,h,s,accent,damaged=false){
  ctx.fillStyle='#102b54';ctx.strokeStyle=accent;ctx.lineWidth=1.2*s;
  ctx.beginPath();ctx.rect(x*s,y*s,w*s,h*s);ctx.fill();ctx.stroke();
  ctx.strokeStyle='rgba(147,213,255,.52)';ctx.lineWidth=.65*s;
  for(let i=1;i<4;i++){ctx.beginPath();ctx.moveTo((x+w*i/4)*s,y*s);ctx.lineTo((x+w*i/4)*s,(y+h)*s);ctx.stroke();}
  ctx.beginPath();ctx.moveTo(x*s,(y+h/2)*s);ctx.lineTo((x+w)*s,(y+h/2)*s);ctx.stroke();
  if(damaged){ctx.strokeStyle='#ef476f';ctx.lineWidth=1.5*s;ctx.beginPath();ctx.moveTo((x+w*.25)*s,(y+1)*s);ctx.lineTo((x+w*.6)*s,(y+h-1)*s);ctx.lineTo((x+w*.82)*s,(y+2)*s);ctx.stroke();}
}
function drawStrandedRescueShip(g,index,active,visited,destroyed,pulse){
  // 使用世界尺度而不是固定屏幕像素：远景中约为玩家火箭的 2～3 倍，不再和恒星一样醒目。
  const s=1.9,angle=Math.atan2(g.vy||0,g.vx||0),accent=index===0?'#4cc9f0':'#ffd166';
  ctx.save();ctx.translate(g.x,g.y);ctx.rotate(angle);ctx.globalAlpha=visited?.42:1;
  if(!lowPowerMode&&!visited){ctx.shadowColor=accent;ctx.shadowBlur=10;}

  if(destroyed){
    ctx.shadowColor='#ef476f';ctx.shadowBlur=8;ctx.strokeStyle='#ef476f';ctx.fillStyle='#5c3240';ctx.lineWidth=1.5/cam.zoom;
    for(const piece of [[-12,-8,8,4],[3,-5,11,5],[-5,7,9,4]]){ctx.save();ctx.rotate((piece[0]+piece[1])*.08);ctx.fillRect(piece[0]*s,piece[1]*s,piece[2]*s,piece[3]*s);ctx.strokeRect(piece[0]*s,piece[1]*s,piece[2]*s,piece[3]*s);ctx.restore();}
    ctx.beginPath();ctx.moveTo(-12*s,-12*s);ctx.lineTo(12*s,12*s);ctx.moveTo(12*s,-12*s);ctx.lineTo(-12*s,12*s);ctx.stroke();ctx.restore();return;
  }

  if(index===0){
    // A：细长的深空救生艇，双侧太阳翼、驾驶舱和发动机组清晰可辨。
    ctx.strokeStyle='#7185a8';ctx.lineWidth=2*s;ctx.beginPath();ctx.moveTo(-8*s,-8*s);ctx.lineTo(-8*s,-14*s);ctx.moveTo(-8*s,8*s);ctx.lineTo(-8*s,14*s);ctx.stroke();
    drawRescueSolarPanel(-19,-23,24,8,s,accent);drawRescueSolarPanel(-19,15,24,8,s,accent);
    ctx.fillStyle='#dceaf4';ctx.strokeStyle='#17213c';ctx.lineWidth=1.8*s;ctx.beginPath();ctx.moveTo(25*s,0);ctx.lineTo(12*s,-9*s);ctx.lineTo(-17*s,-8*s);ctx.lineTo(-25*s,-4*s);ctx.lineTo(-25*s,4*s);ctx.lineTo(-17*s,8*s);ctx.lineTo(12*s,9*s);ctx.closePath();ctx.fill();ctx.stroke();
    ctx.fillStyle='#233553';ctx.beginPath();ctx.rect(-27*s,-7*s,8*s,5*s);ctx.rect(-27*s,2*s,8*s,5*s);ctx.fill();ctx.stroke();
    ctx.fillStyle='#69d9ff';ctx.beginPath();ctx.ellipse(12*s,0,9*s,5.8*s,0,0,TAU);ctx.fill();ctx.stroke();
    ctx.strokeStyle='rgba(23,33,60,.55)';ctx.lineWidth=1*s;ctx.beginPath();ctx.moveTo(-11*s,-7*s);ctx.lineTo(-11*s,7*s);ctx.moveTo(1*s,-8*s);ctx.lineTo(1*s,8*s);ctx.stroke();
  }else{
    // B：宽体工程穿梭机，货舱、折叠翼和受损太阳翼让轮廓与 A 明显不同。
    ctx.strokeStyle='#7185a8';ctx.lineWidth=2*s;ctx.beginPath();ctx.moveTo(-4*s,-10*s);ctx.lineTo(-4*s,-16*s);ctx.moveTo(-4*s,10*s);ctx.lineTo(-4*s,16*s);ctx.stroke();
    drawRescueSolarPanel(-16,-25,25,9,s,'#ffb45f',true);drawRescueSolarPanel(-16,16,25,9,s,'#ffb45f');
    ctx.fillStyle='#ead9b8';ctx.strokeStyle='#2c2540';ctx.lineWidth=1.8*s;ctx.beginPath();ctx.moveTo(24*s,0);ctx.lineTo(13*s,-10*s);ctx.lineTo(-16*s,-11*s);ctx.lineTo(-26*s,-5*s);ctx.lineTo(-26*s,5*s);ctx.lineTo(-16*s,11*s);ctx.lineTo(13*s,10*s);ctx.closePath();ctx.fill();ctx.stroke();
    ctx.fillStyle='#39445f';ctx.beginPath();ctx.rect(-29*s,-8*s,9*s,6*s);ctx.rect(-29*s,2*s,9*s,6*s);ctx.fill();ctx.stroke();
    ctx.fillStyle='#ffad55';ctx.beginPath();ctx.ellipse(13*s,0,8*s,6.5*s,0,0,TAU);ctx.fill();ctx.stroke();
    ctx.fillStyle='#85745b';roundRect(-13*s,-7*s,13*s,14*s,3*s);ctx.fill();ctx.stroke();
    ctx.strokeStyle='#ffd99a';ctx.lineWidth=1.2*s;ctx.beginPath();ctx.moveTo(-7*s,-6*s);ctx.lineTo(-7*s,6*s);ctx.stroke();
  }

  ctx.shadowBlur=0;ctx.fillStyle='#17213c';ctx.font=`900 ${8*s}px sans-serif`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(index===0?'A':'B',-4*s,0);
  ctx.fillStyle=visited?'#5fd068':'#ef476f';ctx.beginPath();ctx.arc(-7*s,-13*s,3.2*s,0,TAU);ctx.fill();
  if(active&&!visited){ctx.strokeStyle=`rgba(239,71,111,${.36+.36*pulse})`;ctx.lineWidth=1.5*s;for(let r=9;r<=18;r+=9){ctx.beginPath();ctx.arc(-7*s,-13*s,r*s,-2.7,-.45);ctx.stroke();}}
  if(visited){ctx.strokeStyle='#5fd068';ctx.lineWidth=2*s;ctx.beginPath();ctx.arc(0,0,31*s,0,TAU);ctx.stroke();ctx.beginPath();ctx.moveTo(-7*s,0);ctx.lineTo(-2*s,5*s);ctx.lineTo(8*s,-6*s);ctx.stroke();}
  ctx.restore();
}
function drawThreeBodyZones(){
  if(!threeBody)return;
  const center=threeBodyBarycenter(),pulse=.72+.2*Math.sin(threeBody.time*2.1);
  // 三颗恒星的近期轨迹与瞬时引力三角形。
  for(let i=0;i<3;i++){
    const tr=threeBody.starTrails[i];
    if(tr.length>1){const b=BODIES[i];drawSpeedTrail(tr,Math.hypot(b.vx,b.vy),i===0?'rgba(255,240,168,.3)':i===1?'rgba(191,232,255,.28)':'rgba(255,208,217,.28)',1.4/cam.zoom);}
  }
  ctx.strokeStyle='rgba(207,224,255,.16)';ctx.lineWidth=1.2/cam.zoom;ctx.setLineDash([6/cam.zoom,9/cam.zoom]);ctx.beginPath();ctx.moveTo(EARTH.x,EARTH.y);ctx.lineTo(MARS.x,MARS.y);ctx.lineTo(MOON.x,MOON.y);ctx.closePath();ctx.stroke();ctx.setLineDash([]);
  // 红圈只表示危险潮汐区，不是硬碰撞边界。
  for(const b of BODIES){ctx.fillStyle='rgba(239,71,111,.055)';ctx.strokeStyle='rgba(239,71,111,.42)';ctx.lineWidth=2/cam.zoom;ctx.beginPath();ctx.arc(b.x,b.y,b.r+THREE_DANGER_PAD,0,TAU);ctx.fill();ctx.stroke();drawZoneEncoding(b.x,b.y,b.r+THREE_DANGER_PAD,'danger',0,TAU,b.r);}
  ctx.strokeStyle='rgba(201,156,255,.25)';ctx.lineWidth=3/cam.zoom;ctx.setLineDash([12/cam.zoom,14/cam.zoom]);ctx.beginPath();ctx.arc(center.x,center.y,THREE_CHAOS_R,0,TAU);ctx.stroke();ctx.setLineDash([]);
  ctx.strokeStyle=mission.stage>=2?'rgba(95,208,104,.9)':'rgba(95,208,104,.34)';ctx.lineWidth=5/cam.zoom;ctx.setLineDash([18/cam.zoom,13/cam.zoom]);ctx.beginPath();ctx.arc(center.x,center.y,THREE_ESCAPE_R,0,TAU);ctx.stroke();ctx.setLineDash([]);
  if(W>=760){ctx.fillStyle='rgba(95,208,104,.88)';ctx.font=`900 ${14/cam.zoom}px "Microsoft YaHei",sans-serif`;ctx.textAlign='center';ctx.fillText('混沌逃逸边界',center.x,center.y-THREE_ESCAPE_R-17/cam.zoom);}
  // 受困飞船的短轨迹让合成引力造成的弯曲肉眼可见。
  for(let i=0;i<2;i++){
    const ship=threeBody.rescueShips?.[i],tr=ship?.trail||[];if(tr.length<2)continue;
    drawSpeedTrail(tr,Math.hypot(ship.vx,ship.vy),i===0?'rgba(76,201,240,.42)':'rgba(255,209,102,.4)',1.5/cam.zoom);
  }
  const nearestRescue=nearestUnrescuedThreeBodyShip();
  for(let i=0;i<2;i++){
    const g=threeBodyGate(i),visited=isThreeBodyShipRescued(i),destroyed=isThreeBodyShipDestroyed(i),active=!visited&&!destroyed,col=i===0?'76,201,240':'255,209,102',recommended=nearestRescue?.index===i;
    ctx.fillStyle=destroyed?'rgba(239,71,111,.035)':`rgba(95,208,104,${active ? .10 : .035})`;ctx.strokeStyle=destroyed?'rgba(239,71,111,.55)':`rgba(95,208,104,${active ? pulse : .24})`;ctx.lineWidth=(recommended?4:active?3:2)/cam.zoom;
    ctx.setLineDash([10/cam.zoom,8/cam.zoom]);ctx.beginPath();ctx.arc(g.x,g.y,THREE_GATE_R,0,TAU);ctx.fill();ctx.stroke();ctx.setLineDash([]);
    if(active)drawZoneEncoding(g.x,g.y,THREE_GATE_R,'target');
    drawStrandedRescueShip(g,i,active,visited,destroyed,pulse);
    ctx.fillStyle=destroyed?'#ef476f':`rgba(${col},${active?1:.58})`;ctx.font=`900 ${(recommended?15:13)/cam.zoom}px "Microsoft YaHei",sans-serif`;ctx.textAlign='center';ctx.fillText(`求救飞船 ${i?'B':'A'}${destroyed?' · 已坠毁':visited?' · 已营救':recommended?' · 最近':''}`,g.x,g.y-THREE_GATE_R-14/cam.zoom);
    if(active){ctx.strokeStyle=`rgba(95,208,104,${recommended ? .28 : .16})`;ctx.lineWidth=(recommended?1.6:1.1)/cam.zoom;ctx.setLineDash([5/cam.zoom,8/cam.zoom]);ctx.beginPath();ctx.moveTo(rocket.x,rocket.y);ctx.lineTo(g.x,g.y);ctx.stroke();ctx.setLineDash([]);}
  }
  ctx.fillStyle='rgba(255,255,255,.62)';ctx.beginPath();ctx.arc(center.x,center.y,5/cam.zoom,0,TAU);ctx.fill();ctx.textAlign='left';
}
function drawBlackHoleZones(){
  if(!blackHole)return;
  const m=blackHoleMetrics(),spin=blackHole.farTime*.42;
  // 绿色救援门与紫色深渊点火带：玩法信息保持比特效更清楚。
  const invalidExit=mission.blackHoleInvalidExitT>0;
  ctx.strokeStyle=invalidExit?'rgba(239,71,111,.92)':m.energy>0?'rgba(95,208,104,.92)':'rgba(95,208,104,.36)';ctx.lineWidth=5/cam.zoom;ctx.setLineDash([17/cam.zoom,12/cam.zoom]);
  ctx.beginPath();ctx.arc(0,0,BH_ESCAPE_R,0,TAU);ctx.stroke();ctx.setLineDash([]);
  if(invalidExit)drawZoneEncoding(0,0,BH_ESCAPE_R,'danger');
  ctx.fillStyle=invalidExit?'rgba(255,120,145,.96)':'rgba(95,208,104,.9)';ctx.font=`900 ${15/cam.zoom}px "Microsoft YaHei",sans-serif`;ctx.textAlign='center';ctx.fillText(invalidExit?'能量不足 · 仍会返回':'远方救援门 · 需正逃逸能量',0,-BH_ESCAPE_R-18/cam.zoom);
  ctx.strokeStyle='rgba(95,208,104,.18)';ctx.lineWidth=BH_BURN_R-BH_BURN_IN;ctx.beginPath();ctx.arc(0,0,(BH_BURN_R+BH_BURN_IN)/2,0,TAU);ctx.stroke();
  ctx.strokeStyle='rgba(95,208,104,.82)';ctx.lineWidth=2.5/cam.zoom;ctx.beginPath();ctx.arc(0,0,BH_BURN_R,0,TAU);ctx.stroke();
  drawZoneEncoding(0,0,BH_BURN_R,'target',0,TAU,BH_BURN_IN);
  if(W>=760){ctx.fillStyle='#5fd068';ctx.font=`800 ${13/cam.zoom}px "Microsoft YaHei",sans-serif`;ctx.fillText('深渊点火区',0,-BH_BURN_R-14/cam.zoom);}

  // 极轴喷流保持很淡，只给黑洞增加层次，不抢占炽白吸积盘的视觉中心。
  if(!lowPowerMode){
    const jet=ctx.createLinearGradient(0,-BH_PHOTON_RING*3.2,0,BH_PHOTON_RING*3.2);jet.addColorStop(0,'rgba(214,241,255,0)');jet.addColorStop(.38,'rgba(225,246,255,.1)');jet.addColorStop(.5,'rgba(255,255,255,.28)');jet.addColorStop(.62,'rgba(225,246,255,.1)');jet.addColorStop(1,'rgba(214,241,255,0)');ctx.fillStyle=jet;
    ctx.beginPath();ctx.moveTo(-10,-BH_PHOTON_RING*.7);ctx.lineTo(-42,-BH_PHOTON_RING*3.1);ctx.lineTo(42,-BH_PHOTON_RING*3.1);ctx.lineTo(10,-BH_PHOTON_RING*.7);ctx.closePath();ctx.fill();
    ctx.beginPath();ctx.moveTo(-10,BH_PHOTON_RING*.7);ctx.lineTo(-42,BH_PHOTON_RING*3.1);ctx.lineTo(42,BH_PHOTON_RING*3.1);ctx.lineTo(10,BH_PHOTON_RING*.7);ctx.closePath();ctx.fill();
  }
  // 炽白吸积盘：先画被黑洞遮住的后半盘，再画透镜抬升的上下弧像、光子环与前半盘。
  const diskTilt=.22,diskAngle=.14;
  ctx.save();ctx.rotate(diskAngle);ctx.scale(1,diskTilt);
  if(!lowPowerMode){ctx.shadowColor='rgba(244,250,255,.94)';ctx.shadowBlur=28*cam.zoom;}
  for(let i=0;i<4;i++){
    const rr=BH_HORIZON+100+i*52,pulse=.42+.18*Math.sin(spin+i*1.9);
    ctx.strokeStyle=`rgba(248,252,255,${pulse})`;ctx.lineWidth=(19-i*3)/cam.zoom;
    ctx.beginPath();ctx.arc(0,0,rr,Math.PI,TAU);ctx.stroke();
  }
  ctx.restore();
  // 后方盘面被强引力弯折到黑洞上、下两侧，形成两条白色弧像。
  ctx.save();if(!lowPowerMode){ctx.shadowColor='rgba(255,255,255,.92)';ctx.shadowBlur=17*cam.zoom;}
  ctx.strokeStyle='rgba(250,253,255,.82)';ctx.lineWidth=5.5/cam.zoom;
  ctx.beginPath();ctx.arc(0,0,BH_PHOTON_RING+25,Math.PI*1.08,Math.PI*1.92);ctx.stroke();
  ctx.strokeStyle='rgba(224,237,247,.48)';ctx.lineWidth=3/cam.zoom;
  ctx.beginPath();ctx.arc(0,0,BH_PHOTON_RING+38,.08*Math.PI,.92*Math.PI);ctx.stroke();ctx.restore();
  if(!lowPowerMode){const halo=ctx.createRadialGradient(0,0,BH_HORIZON*.9,0,0,BH_PHOTON_RING*1.65);halo.addColorStop(0,'rgba(0,0,0,1)');halo.addColorStop(.52,'rgba(0,0,0,1)');halo.addColorStop(.7,'rgba(235,246,255,.11)');halo.addColorStop(1,'rgba(235,246,255,0)');ctx.fillStyle=halo;ctx.beginPath();ctx.arc(0,0,BH_PHOTON_RING*1.65,0,TAU);ctx.fill();}
  ctx.fillStyle='#000';ctx.beginPath();ctx.arc(0,0,BH_HORIZON,0,TAU);ctx.fill();
  ctx.save();if(!lowPowerMode){ctx.shadowColor='rgba(255,255,255,.96)';ctx.shadowBlur=21*cam.zoom;}
  ctx.strokeStyle='rgba(255,255,255,.96)';ctx.lineWidth=7/cam.zoom;ctx.beginPath();ctx.arc(0,0,BH_PHOTON_RING,0,TAU);ctx.stroke();ctx.restore();
  ctx.strokeStyle='rgba(213,232,244,.34)';ctx.lineWidth=1.5/cam.zoom;ctx.beginPath();ctx.arc(0,0,BH_PHOTON_RING-12/cam.zoom,0,TAU);ctx.stroke();ctx.beginPath();ctx.arc(0,0,BH_PHOTON_RING+13/cam.zoom,0,TAU);ctx.stroke();
  ctx.strokeStyle='rgba(255,255,255,.98)';ctx.lineWidth=3.5/cam.zoom;ctx.beginPath();ctx.arc(0,0,BH_PHOTON_RING,spin*.16,spin*.16+.42);ctx.stroke();
  ctx.strokeStyle='rgba(255,255,255,.3)';ctx.lineWidth=2/cam.zoom;ctx.beginPath();ctx.arc(0,0,BH_HORIZON+5/cam.zoom,0,TAU);ctx.stroke();
  ctx.save();ctx.rotate(diskAngle);ctx.scale(1,diskTilt);
  if(!lowPowerMode){ctx.shadowColor='rgba(255,255,255,.9)';ctx.shadowBlur=24*cam.zoom;}
  for(let i=3;i>=0;i--){const rr=BH_HORIZON+100+i*52,pulse=.5+.22*Math.sin(spin+i*1.9);ctx.strokeStyle=`rgba(255,255,255,${pulse})`;ctx.lineWidth=(17-i*2.5)/cam.zoom;ctx.beginPath();ctx.arc(0,0,rr,0,Math.PI);ctx.stroke();}
  // 少量沿盘旋转的高亮物质结，不使用彩色条带。
  if(!lowPowerMode){ctx.strokeStyle='rgba(255,255,255,.95)';ctx.lineWidth=5/cam.zoom;for(let i=0;i<3;i++){const rr=BH_HORIZON+118+i*66,a=normalizeAngle(spin*.12+i*2.1);ctx.beginPath();ctx.arc(0,0,rr,a,a+.22);ctx.stroke();}}
  ctx.restore();
  ctx.fillStyle='rgba(235,244,250,.82)';ctx.font=`900 ${13/cam.zoom}px "Microsoft YaHei",sans-serif`;ctx.fillText('时间视界',0,8/cam.zoom);

  // 远方信标每走一圈代表远方世界时间；越接近视界，它相对飞船转得越快。
  const bx=Math.cos(blackHole.beaconAngle)*BH_BEACON_R,by=Math.sin(blackHole.beaconAngle)*BH_BEACON_R;
  ctx.strokeStyle='rgba(76,201,240,.22)';ctx.lineWidth=1.5/cam.zoom;ctx.setLineDash([8/cam.zoom,11/cam.zoom]);ctx.beginPath();ctx.arc(0,0,BH_BEACON_R,0,TAU);ctx.stroke();ctx.setLineDash([]);
  ctx.fillStyle='#7de3ff';ctx.strokeStyle='#fff';ctx.lineWidth=1.5/cam.zoom;ctx.beginPath();ctx.arc(bx,by,9/cam.zoom,0,TAU);ctx.fill();ctx.stroke();
  if(W>=760){ctx.fillStyle='#aeeeff';ctx.font=`800 ${12/cam.zoom}px "Microsoft YaHei",sans-serif`;ctx.fillText(`远方时钟 ${blackHole.farTime.toFixed(0)} s`,bx,by-17/cam.zoom);}ctx.textAlign='left';
}
function drawMissionZones(){
  if(level===10){ drawThreeBodyZones(); return; }
  if(level===2){ drawLandingZone(); return; }
  if(level===3){ drawStationOrbitZone(); return; }
  if(level===4){ drawLunarFarSideZone(); return; }
  if(level===5){ drawSlingshotZones(); return; }
  if(level===6){ drawLagrangeZones(); return; }
  if(level===7){ drawAsteroidDefenseZones(); return; }
  if(level===8){ drawBinaryZones(); return; }
  if(level===9){ drawBlackHoleZones(); return; }
  const slot = padAngle();
  // 绿色表示安全区与任务区；黄色只用于未来预测轨迹。
  ctx.strokeStyle='rgba(95,208,104,.25)'; ctx.lineWidth=GEO_BAND*2;
  ctx.beginPath(); ctx.arc(EARTH.x, EARTH.y, R_GEO, 0, TAU); ctx.stroke();
  ctx.strokeStyle='rgba(95,208,104,.82)'; ctx.lineWidth=2.5/cam.zoom;
  ctx.beginPath(); ctx.arc(EARTH.x, EARTH.y, R_GEO-GEO_BAND, 0, TAU); ctx.stroke();
  ctx.beginPath(); ctx.arc(EARTH.x, EARTH.y, R_GEO+GEO_BAND, 0, TAU); ctx.stroke();
  // 定点扇形（绿色，随地球自转）
  ctx.fillStyle='rgba(95,208,104,.28)';
  ctx.beginPath();
  ctx.moveTo(EARTH.x + Math.cos(slot-SLOT_HALF)*(R_GEO-GEO_BAND), EARTH.y + Math.sin(slot-SLOT_HALF)*(R_GEO-GEO_BAND));
  ctx.arc(EARTH.x, EARTH.y, R_GEO-GEO_BAND, slot-SLOT_HALF, slot+SLOT_HALF);
  ctx.arc(EARTH.x, EARTH.y, R_GEO+GEO_BAND, slot+SLOT_HALF, slot-SLOT_HALF, true);
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle='rgba(95,208,104,.9)'; ctx.lineWidth=2.5/cam.zoom;
  ctx.beginPath(); ctx.arc(EARTH.x, EARTH.y, R_GEO, slot-SLOT_HALF, slot+SLOT_HALF); ctx.stroke();
  drawZoneEncoding(EARTH.x,EARTH.y,R_GEO+GEO_BAND,'target',slot-SLOT_HALF,slot+SLOT_HALF,R_GEO-GEO_BAND);
  ctx.strokeStyle='rgba(95,208,104,.4)'; ctx.lineWidth=1.5/cam.zoom; ctx.setLineDash([4,6]);
  ctx.beginPath();
  ctx.moveTo(EARTH.x + Math.cos(slot)*EARTH.r, EARTH.y + Math.sin(slot)*EARTH.r);
  ctx.lineTo(EARTH.x + Math.cos(slot)*(R_GEO-GEO_BAND), EARTH.y + Math.sin(slot)*(R_GEO-GEO_BAND));
  ctx.stroke(); ctx.setLineDash([]);
  if(mission.satReleased){
    const sat=mission.satellite, sx=sat?sat.x:rocket.x, sy=sat?sat.y:rocket.y;
    ctx.fillStyle='#ffd166'; ctx.strokeStyle='#222'; ctx.lineWidth=1.5/cam.zoom;
    ctx.beginPath(); ctx.arc(sx, sy, 8, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.strokeStyle='#4cc9f0'; ctx.lineWidth=3/cam.zoom;
    ctx.beginPath(); ctx.moveTo(sx-16,sy); ctx.lineTo(sx-8,sy); ctx.moveTo(sx+8,sy); ctx.lineTo(sx+16,sy); ctx.stroke();
  }
}
function drawLunarFarSideZone(){
  // 月球公转路径仅作导航，不代表火箭目标轨道。
  ctx.strokeStyle='rgba(207,216,220,.22)'; ctx.lineWidth=2/cam.zoom; ctx.setLineDash([10/cam.zoom,12/cam.zoom]);
  ctx.beginPath(); ctx.arc(EARTH.x,EARTH.y,MOON_ORBIT_R,0,TAU); ctx.stroke(); ctx.setLineDash([]);
  if(!worldCircleVisible(MOON,900)) return;
  const a=moonAngle, r=MOON.r;
  // 背向地球的整半球为基础通关区；中央亮绿色弧为精准着陆区。
  ctx.strokeStyle='rgba(95,208,104,.48)'; ctx.lineWidth=13/cam.zoom;
  ctx.beginPath(); ctx.arc(MOON.x,MOON.y,r,a-Math.PI/2,a+Math.PI/2); ctx.stroke();
  ctx.strokeStyle='rgba(95,208,104,.98)'; ctx.lineWidth=17/cam.zoom;
  ctx.beginPath(); ctx.arc(MOON.x,MOON.y,r,a-MOON_TARGET_HALF,a+MOON_TARGET_HALF); ctx.stroke();
  const grad=ctx.createLinearGradient(MOON.x+Math.cos(a)*r,MOON.y+Math.sin(a)*r,MOON.x+Math.cos(a)*(r+800),MOON.y+Math.sin(a)*(r+800));
  grad.addColorStop(0,'rgba(95,208,104,.42)'); grad.addColorStop(1,'rgba(95,208,104,0)'); ctx.fillStyle=grad;
  ctx.beginPath();
  ctx.moveTo(MOON.x+Math.cos(a-MOON_TARGET_HALF)*r,MOON.y+Math.sin(a-MOON_TARGET_HALF)*r);
  ctx.arc(MOON.x,MOON.y,r,a-MOON_TARGET_HALF,a+MOON_TARGET_HALF);
  ctx.lineTo(MOON.x+Math.cos(a+MOON_TARGET_HALF*.45)*(r+800),MOON.y+Math.sin(a+MOON_TARGET_HALF*.45)*(r+800));
  ctx.lineTo(MOON.x+Math.cos(a-MOON_TARGET_HALF*.45)*(r+800),MOON.y+Math.sin(a-MOON_TARGET_HALF*.45)*(r+800));
  ctx.closePath(); ctx.fill();
  drawZoneEncoding(MOON.x,MOON.y,r+800,'target',a-MOON_TARGET_HALF,a+MOON_TARGET_HALF,r);
  if(mission.stage>=2){
    ctx.strokeStyle='rgba(207,216,220,.45)'; ctx.lineWidth=1.5/cam.zoom; ctx.setLineDash([5/cam.zoom,7/cam.zoom]);
    ctx.beginPath(); ctx.moveTo(rocket.x,rocket.y); ctx.lineTo(MOON.x,MOON.y); ctx.stroke(); ctx.setLineDash([]);
  }
}
function drawStationOrbitZone(){
  if(!station||station.shattered) return;
  ctx.strokeStyle='rgba(76,201,240,.32)'; ctx.lineWidth=3/cam.zoom; ctx.setLineDash([9/cam.zoom,10/cam.zoom]);
  ctx.beginPath(); ctx.arc(EARTH.x,EARTH.y,STATION_R,0,TAU); ctx.stroke(); ctx.setLineDash([]);
  const m=stationMetrics();
  if(mission.stage>=1){
    ctx.strokeStyle='rgba(95,208,104,.52)'; ctx.lineWidth=1.8/cam.zoom; ctx.setLineDash([5/cam.zoom,7/cam.zoom]);
    ctx.beginPath(); ctx.moveTo(rocket.x,rocket.y); ctx.lineTo(station.x,station.y); ctx.stroke(); ctx.setLineDash([]);
    ctx.strokeStyle='rgba(95,208,104,.78)'; ctx.lineWidth=2/cam.zoom;
    ctx.beginPath(); ctx.arc(station.x,station.y,mission.stage===3?42:120,0,TAU); ctx.stroke();
    drawZoneEncoding(station.x,station.y,mission.stage===3?42:120,'target');
  }
}
// 第二关：着陆区（绿色地表弧段，随地球自转）
function drawLandingZone(){
  const lz = landAngle();
  // 地表绿色弧段
  ctx.strokeStyle='rgba(95,208,104,.9)'; ctx.lineWidth=14;
  ctx.beginPath(); ctx.arc(EARTH.x, EARTH.y, EARTH.r, lz-LAND_HALF, lz+LAND_HALF); ctx.stroke();
  // 引导光柱（从地表向上延伸，便于远处看到）
  const grad = ctx.createLinearGradient(
    EARTH.x+Math.cos(lz)*EARTH.r, EARTH.y+Math.sin(lz)*EARTH.r,
    EARTH.x+Math.cos(lz)*(EARTH.r+900), EARTH.y+Math.sin(lz)*(EARTH.r+900));
  grad.addColorStop(0,'rgba(95,208,104,.5)'); grad.addColorStop(1,'rgba(95,208,104,0)');
  ctx.fillStyle=grad;
  ctx.beginPath();
  ctx.moveTo(EARTH.x+Math.cos(lz-LAND_HALF)*EARTH.r, EARTH.y+Math.sin(lz-LAND_HALF)*EARTH.r);
  ctx.arc(EARTH.x, EARTH.y, EARTH.r, lz-LAND_HALF, lz+LAND_HALF);
  ctx.lineTo(EARTH.x+Math.cos(lz+LAND_HALF*0.4)*(EARTH.r+900), EARTH.y+Math.sin(lz+LAND_HALF*0.4)*(EARTH.r+900));
  ctx.lineTo(EARTH.x+Math.cos(lz-LAND_HALF*0.4)*(EARTH.r+900), EARTH.y+Math.sin(lz-LAND_HALF*0.4)*(EARTH.r+900));
  ctx.closePath(); ctx.fill();
  // 着陆区旗帜标记
  const fx=EARTH.x+Math.cos(lz)*EARTH.r, fy=EARTH.y+Math.sin(lz)*EARTH.r;
  ctx.fillStyle='#5fd068';
  ctx.beginPath(); ctx.arc(fx, fy, 7, 0, TAU); ctx.fill();
}
// 细环形地面厚度（伪3D）：外圈地表外延 → 内圈地表内缩
function worldCircleVisible(body,padding=80){
  const r=(body.r||0)+padding/Math.max(.02,cam.zoom);
  return Math.abs(body.x-cam.x)<=W/(2*Math.max(.02,cam.zoom))+r&&Math.abs(body.y-cam.y)<=H/(2*Math.max(.02,cam.zoom))+r;
}
function drawGroundRing(b){
  ctx.strokeStyle='rgba(255,255,255,.10)';
  ctx.lineWidth = RING_OUT + RING_IN;
  ctx.beginPath(); ctx.arc(b.x, b.y, b.r + (RING_OUT-RING_IN)/2, 0, TAU); ctx.stroke();
}

function drawSpaceWarpEffect(){
  const payload=globalThis.SpaceGameShipSkills?.visualState?.()||{},charge=payload.warpChargeFx,fx=payload.warpFx;
  if(charge&&rocket?.alive){
    const duration=Math.max(.001,Number(charge.duration)||.1),p=Math.max(0,Math.min(1,1-charge.remaining/duration));
    const nose={x:rocket.x+Math.cos(rocket.a)*34,y:rocket.y+Math.sin(rocket.a)*34},side=rocket.a+Math.PI/2;
    ctx.save();ctx.strokeStyle='#a9f7ff';ctx.fillStyle='#efffff';ctx.lineCap='round';
    if(!lowPowerMode){ctx.shadowColor='#66e8ff';ctx.shadowBlur=18/cam.zoom;}
    for(let i=0;i<3;i++){
      const distance=(44-i*11)*(1-p*.72)/cam.zoom,half=(18+i*5)*(1-p*.28)/cam.zoom,cx=nose.x+Math.cos(rocket.a)*distance,cy=nose.y+Math.sin(rocket.a)*distance;
      ctx.globalAlpha=.28+i*.19+.22*p;ctx.lineWidth=(1.8+i*.45)/cam.zoom;ctx.beginPath();ctx.moveTo(cx+Math.cos(side)*half,cy+Math.sin(side)*half);ctx.lineTo(cx-Math.cos(side)*half,cy-Math.sin(side)*half);ctx.stroke();
    }
    ctx.globalAlpha=.82+.18*p;ctx.beginPath();ctx.arc(nose.x,nose.y,(4+7*p)/cam.zoom,0,TAU);ctx.fill();ctx.restore();
  }
  if(!fx||fx.remaining<=0||!fx.start||!fx.end)return;
  const life=Math.max(0,Math.min(1,fx.remaining/Math.max(.001,fx.duration||.78)));
  ctx.save();ctx.globalAlpha=.3+.65*life;ctx.strokeStyle='#a9f7ff';ctx.lineWidth=(lowPowerMode?2.2:3.2)/cam.zoom;
  if(!lowPowerMode){ctx.shadowColor='#66e8ff';ctx.shadowBlur=15/cam.zoom;ctx.setLineDash([14/cam.zoom,5/cam.zoom,3/cam.zoom,5/cam.zoom]);}
  ctx.beginPath();ctx.moveTo(fx.start.x,fx.start.y);ctx.lineTo(fx.end.x,fx.end.y);ctx.stroke();ctx.setLineDash([]);
  if(!lowPowerMode){
    const dx=fx.end.x-fx.start.x,dy=fx.end.y-fx.start.y;
    ctx.shadowBlur=0;
    for(let i=0;i<3;i++){
      const mix=.7+i*.1;
      ctx.save();ctx.translate(fx.start.x+dx*mix,fx.start.y+dy*mix);ctx.rotate(fx.heading+Math.PI/2);ctx.scale(.88,.88);
      ctx.globalAlpha=life*(.12+i*.07);if(typeof drawSwordwingSkin==='function')drawSwordwingSkin(0,false);ctx.restore();
    }
    ctx.globalAlpha=.25+.55*life;ctx.strokeStyle='#e8fdff';ctx.lineWidth=2/cam.zoom;
    for(const radius of [12,22]){ctx.beginPath();ctx.arc(fx.end.x,fx.end.y,radius*(1.25-life*.25)/cam.zoom,0,TAU);ctx.stroke();}
  }
  ctx.restore();
}

function drawYamatoAimGuide(){
  const fx=globalThis.SpaceGameShipSkills?.visualState?.()?.yamatoFx;
  if(!rocket?.alive||fx?.phase!=='charging')return;
  const shot=fx;
  if(!shot?.start||!shot?.end)return;
  const nose={x:shot.start.x+Math.cos(shot.heading)*38,y:shot.start.y+Math.sin(shot.heading)*38},color=shot.hit?'#7df6ff':'#72b8d8';
  ctx.save();ctx.lineCap='round';ctx.globalAlpha=.9;ctx.strokeStyle=color;ctx.lineWidth=3.5/cam.zoom;ctx.setLineDash([10/cam.zoom,5/cam.zoom]);
  ctx.beginPath();ctx.moveTo(nose.x,nose.y);ctx.lineTo(shot.end.x,shot.end.y);ctx.stroke();ctx.setLineDash([]);
  const radius=(shot.hit?13:8)/cam.zoom;ctx.globalAlpha=1;ctx.lineWidth=2/cam.zoom;ctx.beginPath();ctx.arc(shot.end.x,shot.end.y,radius,0,TAU);ctx.stroke();
  if(shot.hit){ctx.beginPath();ctx.moveTo(shot.end.x-radius*1.45,shot.end.y);ctx.lineTo(shot.end.x+radius*1.45,shot.end.y);ctx.moveTo(shot.end.x,shot.end.y-radius*1.45);ctx.lineTo(shot.end.x,shot.end.y+radius*1.45);ctx.stroke();}
  ctx.fillStyle=color;ctx.font=`900 ${11/cam.zoom}px "Microsoft YaHei",sans-serif`;ctx.textAlign='center';ctx.fillText(shot.hit?`聚能锁定：${shot.targetName||'目标'}`:'大和炮聚能瞄准线',shot.end.x,shot.end.y-18/cam.zoom);ctx.restore();ctx.textAlign='left';
}

function drawYamatoEffect(){
  const fx=globalThis.SpaceGameShipSkills?.visualState?.()?.yamatoFx;
  if(!fx||fx.remaining<=0||!fx.start||!fx.end)return;
  const nose={x:fx.start.x+Math.cos(fx.heading)*38,y:fx.start.y+Math.sin(fx.heading)*38};
  ctx.save();ctx.lineCap='round';
  if(fx.phase==='charging'){
    const charge=Math.max(.001,Number(fx.chargeDuration)||.9),p=Math.max(0,Math.min(1,1-fx.chargeRemaining/charge)),pulse=.82+.18*Math.sin(p*38),radius=(6+p*15)*pulse/cam.zoom;
    ctx.globalAlpha=.62+.38*p;ctx.fillStyle='#efffff';if(!lowPowerMode){ctx.shadowColor='#69eaff';ctx.shadowBlur=(14+24*p)/cam.zoom;}
    ctx.beginPath();ctx.arc(nose.x,nose.y,radius*.55,0,TAU);ctx.fill();ctx.shadowBlur=0;ctx.strokeStyle='#77efff';ctx.lineWidth=(2.4+2*p)/cam.zoom;
    for(let ring=0;ring<3;ring++){const rr=radius*(2.5-ring*.52)*(1-p*.34);ctx.globalAlpha=.28+.2*ring+.28*p;ctx.beginPath();ctx.arc(nose.x,nose.y,rr,0,TAU);ctx.stroke();}
    ctx.globalAlpha=.35+.55*p;ctx.lineWidth=2/cam.zoom;for(let i=0;i<(lowPowerMode?6:10);i++){const a=i*TAU/(lowPowerMode?6:10)+p*1.8,outer=radius*(3.8+(i%2)*.45),inner=radius*.72;ctx.beginPath();ctx.moveTo(nose.x+Math.cos(a)*outer,nose.y+Math.sin(a)*outer);ctx.lineTo(nose.x+Math.cos(a)*inner,nose.y+Math.sin(a)*inner);ctx.stroke();}
    ctx.globalAlpha=.95;ctx.fillStyle='#dffcff';ctx.font=`900 ${12/cam.zoom}px "Microsoft YaHei",sans-serif`;ctx.textAlign='center';ctx.fillText(`聚能 ${Math.round(p*100)}%`,nose.x,nose.y-34/cam.zoom);
  }else{
    const beamDuration=Math.max(.001,Number(fx.beamDuration)||1.55),beamLife=Math.max(0,Math.min(1,fx.remaining/beamDuration));
    ctx.globalAlpha=.78+.22*beamLife;ctx.strokeStyle=lowPowerMode?'#5ee7ff':'#31d9ff';ctx.lineWidth=(lowPowerMode?18:22)/cam.zoom;if(!lowPowerMode){ctx.shadowColor='#42dfff';ctx.shadowBlur=22/cam.zoom;}
    ctx.beginPath();ctx.moveTo(nose.x,nose.y);ctx.lineTo(fx.end.x,fx.end.y);ctx.stroke();ctx.shadowBlur=0;ctx.globalAlpha=.94+.06*beamLife;ctx.strokeStyle='#f5ffff';ctx.lineWidth=(lowPowerMode?5.5:6.5)/cam.zoom;ctx.beginPath();ctx.moveTo(nose.x,nose.y);ctx.lineTo(fx.end.x,fx.end.y);ctx.stroke();
    ctx.globalAlpha=.9;ctx.fillStyle='#ffffff';ctx.beginPath();ctx.arc(nose.x,nose.y,(lowPowerMode?7:9)/cam.zoom,0,TAU);ctx.fill();
    if(fx.hit){
      const impactDuration=Math.max(.001,Number(fx.impactDuration)||1.35),impactLife=Math.max(0,Math.min(1,fx.remaining/impactDuration)),bodyScale=fx.targetKind==='body'||fx.targetKind==='star'||fx.targetKind==='black-hole'?1.45:fx.targetKind==='asteroid'?1.25:1,radius=(26+62*(1-impactLife))*bodyScale/cam.zoom;
      ctx.globalAlpha=.5+.5*impactLife;ctx.fillStyle='#f7ffff';ctx.strokeStyle='#69eaff';ctx.lineWidth=3.5/cam.zoom;ctx.beginPath();ctx.arc(fx.impact.x,fx.impact.y,Math.max(5,radius*.24),0,TAU);ctx.fill();
      for(const scale of [1,.62]){ctx.globalAlpha=(.3+.68*impactLife)*scale;ctx.beginPath();ctx.arc(fx.impact.x,fx.impact.y,radius*(2-scale),0,TAU);ctx.stroke();}
      if(!lowPowerMode){ctx.strokeStyle='#eaffff';ctx.lineWidth=2.2/cam.zoom;ctx.globalAlpha=.4+.6*impactLife;for(let i=0;i<12;i++){const a=i*TAU/12+(beamDuration-fx.remaining)*.8,inner=radius*.3,outer=radius*(1.08+(i%2)*.34);ctx.beginPath();ctx.moveTo(fx.impact.x+Math.cos(a)*inner,fx.impact.y+Math.sin(a)*inner);ctx.lineTo(fx.impact.x+Math.cos(a)*outer,fx.impact.y+Math.sin(a)*outer);ctx.stroke();}}
    }
  }
  ctx.restore();ctx.textAlign='left';
}

function drawBlackHoleStarfield(t){
  const cx=(EARTH.x-cam.x)*cam.zoom+W/2,cy=(EARTH.y-cam.y)*cam.zoom+H/2,einstein=Math.max(42,BH_PHOTON_RING*cam.zoom*1.08);
  const step=lowPowerMode?(mobileEconomy?3:2):1;
  for(let i=0;i<stars.length;i+=step){
    const s=stars[i],px=s.x-cam.x*.35,py=s.y-cam.y*.35,wx=((px%W)+W)%W,wy=((py%H)+H)%H;
    const dx=wx-cx,dy=wy-cy,r=Math.max(8,Math.hypot(dx,dy)),bend=einstein*einstein/(r+einstein*.28)*.34,wr=r+bend;
    const qx=cx+dx/r*wr,qy=cy+dy/r*wr,nearRing=Math.abs(wr-einstein)<einstein*.18;
    ctx.globalAlpha=lowPowerMode?.65:.45+.4*Math.sin(t*2+s.tw);ctx.fillStyle=nearRing?'#f7fbff':s.c;
    if(lowPowerMode)ctx.fillRect(qx,qy,Math.max(1,s.r),Math.max(1,s.r));else{ctx.beginPath();ctx.arc(qx,qy,s.r*(nearRing?1.45:1),0,TAU);ctx.fill();}
    if(!lowPowerMode&&nearRing){ctx.globalAlpha*=.28;ctx.beginPath();ctx.arc(cx-dx/r*(einstein*.92),cy-dy/r*(einstein*.92),s.r*.8,0,TAU);ctx.fill();}
  }
  ctx.globalAlpha=1;
}

function draw(){
  const worldDrawStarted=performance.now();
  if(typeof SG_AUDIO!=='undefined') SG_AUDIO.setEngine(!paused&&state==='fly'&&rocket&&rocket.alive&&rocket.thrusting,rocket&&rocket.thrustPower);
  if(typeof SG_AUDIO!=='undefined') SG_AUDIO.setTurn(!paused&&state==='fly'&&rocket&&rocket.alive&&!!(keys['ArrowLeft']||keys['KeyA']||keys['ArrowRight']||keys['KeyD']));
  ctx=worldCtx;
  ctx.setTransform(DPR,0,0,DPR,0,0);
  updateActionCue();
  // 摄像机
  if(camInit){
    if(level===10){cam.zoom=W<760?.16:.3;cam.x=rocket.x;cam.y=rocket.y+((W<760&&H>650)?(H/2-235)/cam.zoom:0);}
    else if(level===9){cam.zoom=W<760?.17:.48;cam.x=rocket.x;cam.y=rocket.y+((W<760&&H>650)?(H/2-235)/cam.zoom:0);}
    else{cam.zoom=1.1;cam.x=rocket.x;cam.y=rocket.y;}
    SG_INPUT.resetCameraGestures();
    camInit=false;
  }
  const sx = shake? (Math.random()-0.5)*shake : 0, sy = shake? (Math.random()-0.5)*shake : 0;
  if(cameraMode===0 && !cam.dragging){
    const focus=level===7&&!rocket.alive&&asteroid?asteroid:rocket;
    // 跟随模式必须以飞船本身为锚点。第九、十关原先取“飞船与目标的中点”，会把飞船推到屏幕边缘甚至画外。
    const focusX=focus.x;
    const focusY=focus.y+(((level===9||level===10)&&W<760&&H>650)?(H/2-235)/cam.zoom:0);
    cam.x += (focusX - cam.x)*0.12; cam.y += (focusY - cam.y)*0.12;
  }
  const cameraNow=performance.now();
  if(!lowPowerMode&&cameraNow-cameraDebugAt>500){
    cameraDebugAt=cameraNow;
    document.documentElement.dataset.cameraState=JSON.stringify({mode:cameraModeName(),x:cam.x,y:cam.y,rocketX:rocket.x,rocketY:rocket.y,dragging:cam.dragging});
  }

  // 背景
  ctx.fillStyle=bgGradient||'#0b1026'; ctx.fillRect(0,0,W,H);

  // 星星（视差）
  const t = performance.now()/1000;
  if(level===9)drawBlackHoleStarfield(blackHole?blackHole.farTime:t);
  else for(const s of stars){
      const px = s.x - cam.x*0.35, py = s.y - cam.y*0.35;
      const wx = ((px % W)+W)%W, wy = ((py % H)+H)%H;
      // iOS 不逐星计算闪烁正弦，也不为微小星点建立圆弧路径。
      ctx.globalAlpha = lowPowerMode?.72:0.5 + 0.5*Math.sin(t*2 + s.tw);
      ctx.fillStyle = s.c;
      if(lowPowerMode) ctx.fillRect(wx,wy,Math.max(1,s.r),Math.max(1,s.r));
      else{ ctx.beginPath(); ctx.arc(wx, wy, s.r, 0, TAU); ctx.fill(); }
    }
  ctx.globalAlpha = 1;

  ctx.save();
  ctx.translate(W/2 + sx, H/2 + sy);
  ctx.scale(cam.zoom, cam.zoom);
  ctx.translate(-cam.x, -cam.y);

  // 航线轨迹
  if(trail.length>1){
    const trailStep=trail.length>450?2:1;
    drawSpeedTrail(trail,Math.hypot(rocket.vx,rocket.vy),'rgba(120,200,255,.62)',1.6/cam.zoom,trailStep);
  }
  drawSpaceWarpEffect();

  if(level===9||level===10)drawMissionZones();
  if(level===10)drawThreeBodyTimelines();

  // 未来轨迹辅助线（T 开关）+ 近/远地点标注
  if(showPred && state==='fly' && !rocket.landed && level!==10){
    const pred = getPredictedPath();
    const pts = pred.pts, markers = pred.markers;
    if(pts.length>1){
      ctx.strokeStyle='rgba(255,209,102,.85)'; ctx.lineWidth=1.8/cam.zoom; ctx.setLineDash([3,7]);
      ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y);
      for(const p of pts) ctx.lineTo(p.x, p.y);
      ctx.stroke(); ctx.setLineDash([]);
    }
    // 近/远地点标记（子弹时间发生处）
    const fs = 13/cam.zoom;
    ctx.font='800 '+fs+'px "Baloo 2",sans-serif'; ctx.textAlign='center';
    for(const mk of markers){
      const col = mk.apo ? '#ffb142' : '#4cc9f0';
      ctx.strokeStyle=col; ctx.lineWidth=2.2/cam.zoom;
      ctx.beginPath(); ctx.arc(mk.x, mk.y, 10/cam.zoom, 0, TAU); ctx.stroke();
      ctx.beginPath(); ctx.arc(mk.x, mk.y, 4/cam.zoom, 0, TAU); ctx.stroke();
      if(!(mk.blackHole&&W<760)){
        ctx.fillStyle=col;
        ctx.fillText(mk.blackHole?`预计最近点 ${mk.r.toFixed(0)} u`:(mk.apo?'远地点':'近地点'), mk.x, mk.y - 16/cam.zoom);
        ctx.fillStyle='rgba(255,255,255,.7)';
        ctx.font='600 '+(10/cam.zoom)+'px "Baloo 2",sans-serif';
        ctx.fillText(mk.blackHole?'深渊点火': '点火', mk.x, mk.y + 26/cam.zoom);
      }
      ctx.font='800 '+fs+'px "Baloo 2",sans-serif';
    }
    if(pred.impact){
      const p=pred.impact,s=13/cam.zoom;
      ctx.strokeStyle='#ef476f'; ctx.fillStyle='#ef476f'; ctx.lineWidth=3/cam.zoom;
      ctx.beginPath(); ctx.arc(p.x,p.y,s,0,TAU); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(p.x-s*.65,p.y-s*.65); ctx.lineTo(p.x+s*.65,p.y+s*.65);
      ctx.moveTo(p.x+s*.65,p.y-s*.65); ctx.lineTo(p.x-s*.65,p.y+s*.65); ctx.stroke();
      ctx.font=`900 ${13/cam.zoom}px "Microsoft YaHei",sans-serif`;
      ctx.fillText(level===9?'预计冻结于时间视界':`预计撞击${p.body}`,p.x,p.y-21/cam.zoom);
      ctx.font=`800 ${11/cam.zoom}px "Microsoft YaHei",sans-serif`;
      ctx.fillStyle='rgba(255,138,164,.96)';
      ctx.fillText(level===9?'远方信号将无限红移':'导航电脑 · 预计碰撞概率 99.9999%',p.x,p.y-6/cam.zoom);
    }else if(level===5&&pred.moonApproach&&pred.moonApproach.altitude<1800){
      const p=pred.moonApproach,col=p.altitude<80?'#ef476f':p.altitude<350?'#ffd166':'#4cc9f0';
      ctx.strokeStyle=col; ctx.fillStyle=col; ctx.lineWidth=2.5/cam.zoom; ctx.setLineDash([4/cam.zoom,5/cam.zoom]);
      ctx.beginPath(); ctx.arc(p.x,p.y,12/cam.zoom,0,TAU); ctx.stroke(); ctx.setLineDash([]);
      ctx.font=`900 ${13/cam.zoom}px "Microsoft YaHei",sans-serif`;
      ctx.fillText(`预计近月 ${Math.max(0,p.altitude).toFixed(0)} u`,p.x,p.y-20/cam.zoom);
    }
    ctx.textAlign='left';
  }

  if(level!==9&&level!==10)drawMissionZones();
  for(const b of BODIES){
    if(!worldCircleVisible(b,120))continue;
    if(level===9)continue;
    else if(level===10)drawThreeBodyStar(b);
    else if(level===8){if(!b.isStar)drawGroundRing(b);drawBinaryBody(b);}
    else{drawGroundRing(b);drawBody(b);}
  }
  drawAsteroid();
  drawStation();
  drawGuideGhost();

  // 粒子
  for(const p of particles){
    ctx.globalAlpha = Math.min(1, p.life*2.5);
    ctx.fillStyle = p.c;
    ctx.beginPath(); ctx.arc(p.x, p.y, 3.2, 0, TAU); ctx.fill();
  }
  ctx.globalAlpha = 1;

  drawYamatoAimGuide();
  drawRocket();
  drawYamatoEffect();
  ctx.restore();
  SG_HUD.draw(worldDrawStarted);
}

let last = performance.now(), renderInterval=1000/60, renderAccumulator=0, measuredFps=60, fpsWindowStart=last, fpsWindowFrames=0,lastPerfUiAt=0;
