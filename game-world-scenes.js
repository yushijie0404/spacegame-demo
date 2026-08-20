"use strict";

// World-space scene renderer: mission zones, environment effects and draw orchestration.
// Frame scheduling, physics, input, persistence and mission completion stay in their owning modules.

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
    const active=p.id===selected,r=targetRadius,col=p.color;
    const marker=lagrangeMarkerLayout(active,r);
    ctx.globalAlpha=active?1:.48;ctx.strokeStyle=col;ctx.fillStyle=active?`${col}24`:`${col}12`;ctx.lineWidth=(active?4:2)/cam.zoom;
    ctx.beginPath();ctx.arc(p.x,p.y,r,0,TAU);ctx.fill();ctx.stroke();
    ctx.beginPath();ctx.moveTo(p.x-marker.crossWorld,p.y);ctx.lineTo(p.x+marker.crossWorld,p.y);ctx.moveTo(p.x,p.y-marker.crossWorld);ctx.lineTo(p.x,p.y+marker.crossWorld);ctx.stroke();
    ctx.fillStyle=col;ctx.font=`900 ${marker.fontWorld}px "Microsoft YaHei",sans-serif`;ctx.textAlign='center';
    ctx.fillText(`L${p.id} ${'★'.repeat(p.stars)}`,p.x,p.y+marker.topY);
    if(active){ctx.font=`700 ${marker.detailWorld}px "Microsoft YaHei",sans-serif`;ctx.fillText(p.label,p.x,p.y+marker.bottomY);}
  }
  ctx.globalAlpha=1;ctx.textAlign='left';
  const target=points[selected-1];
  if(mission.stage>=1){ctx.strokeStyle='rgba(255,209,102,.5)';ctx.lineWidth=2/cam.zoom;ctx.setLineDash([6/cam.zoom,8/cam.zoom]);ctx.beginPath();ctx.moveTo(rocket.x,rocket.y);ctx.lineTo(target.x,target.y);ctx.stroke();ctx.setLineDash([]);}
  if(mission.satellite){ctx.fillStyle='#ffd166';ctx.strokeStyle='#17213c';ctx.lineWidth=2/cam.zoom;ctx.beginPath();ctx.arc(mission.satellite.x,mission.satellite.y,10/cam.zoom,0,TAU);ctx.fill();ctx.stroke();}
}
function drawAsteroidDefenseZones(){
  if(!asteroid)return;
  const f=getAsteroidForecast();
  if(asteroidTrail.length>1){
    ctx.strokeStyle='rgba(206,151,103,.34)';ctx.lineWidth=2/cam.zoom;ctx.setLineDash([5/cam.zoom,8/cam.zoom]);
    ctx.beginPath();ctx.moveTo(asteroidTrail[0].x,asteroidTrail[0].y);
    for(let i=1;i<asteroidTrail.length;i+=lowPowerMode?2:1)ctx.lineTo(asteroidTrail[i].x,asteroidTrail[i].y);
    ctx.stroke();ctx.setLineDash([]);
  }
  if(showPred&&f.pts.length>1){
    ctx.strokeStyle=f.safe?'rgba(95,208,104,.92)':'rgba(239,71,111,.9)';ctx.lineWidth=4/cam.zoom;ctx.setLineDash([15/cam.zoom,11/cam.zoom]);
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
  }
  const g=binaryGatePoint(),dx=MOON.x-MARS.x,dy=MOON.y-MARS.y,d=Math.max(1,Math.hypot(dx,dy)),nx=-dy/d,ny=dx/d,gw=260;
  ctx.strokeStyle=mission.binaryGateCrossed?'rgba(95,208,104,.9)':'rgba(76,240,221,.9)';ctx.lineWidth=5/cam.zoom;
  ctx.beginPath();ctx.moveTo(g.x-nx*gw,g.y-ny*gw);ctx.lineTo(g.x+nx*gw,g.y+ny*gw);ctx.stroke();
  ctx.fillStyle=mission.binaryGateCrossed?'#5fd068':'#4cf0dd';ctx.beginPath();ctx.arc(g.x,g.y,14/cam.zoom,0,TAU);ctx.fill();
  ctx.font=`900 ${14/cam.zoom}px "Microsoft YaHei",sans-serif`;ctx.textAlign='center';ctx.fillText('移动引力通道',g.x,g.y-24/cam.zoom);
  ctx.strokeStyle='rgba(255,255,255,.5)';ctx.lineWidth=2/cam.zoom;ctx.beginPath();ctx.moveTo(-13/cam.zoom,0);ctx.lineTo(13/cam.zoom,0);ctx.moveTo(0,-13/cam.zoom);ctx.lineTo(0,13/cam.zoom);ctx.stroke();
  ctx.fillStyle='rgba(255,255,255,.65)';ctx.font=`800 ${11/cam.zoom}px "Microsoft YaHei",sans-serif`;ctx.fillText('共同质心',0,-20/cam.zoom);
  if(mission.stage>=1&&!mission.done){
    const tx=mission.stage===1?g.x:station.x,ty=mission.stage===1?g.y:station.y;
    ctx.strokeStyle='rgba(255,209,102,.45)';ctx.lineWidth=1.6/cam.zoom;ctx.setLineDash([5/cam.zoom,8/cam.zoom]);ctx.beginPath();ctx.moveTo(rocket.x,rocket.y);ctx.lineTo(tx,ty);ctx.stroke();ctx.setLineDash([]);
  }
  ctx.textAlign='left';
}
function drawStrandedRescueShip(g,index,active,visited,pulse){
  const s=1/cam.zoom,angle=Math.atan2(g.vy||0,g.vx||0);
  ctx.save();ctx.translate(g.x,g.y);ctx.rotate(angle);
  ctx.globalAlpha=visited?.38:1;
  // 船体采用空间拖船/太阳能帆板轮廓，和玩家的火箭形象明显区分。
  ctx.fillStyle=index===0?'#d9edf7':'#f2dfbd';ctx.strokeStyle='#17213c';ctx.lineWidth=1.8*s;
  ctx.beginPath();ctx.rect(-14*s,-7*s,28*s,14*s);ctx.fill();ctx.stroke();
  ctx.fillStyle=index===0?'#4cc9f0':'#ff9f43';ctx.beginPath();ctx.arc(9*s,0,5*s,0,TAU);ctx.fill();ctx.stroke();
  ctx.strokeStyle='#8fc4ff';ctx.lineWidth=4*s;
  if(index===0){ctx.beginPath();ctx.moveTo(-14*s,-4*s);ctx.lineTo(-30*s,-11*s);ctx.moveTo(-14*s,4*s);ctx.lineTo(-30*s,11*s);ctx.stroke();}
  else{ctx.beginPath();ctx.moveTo(-14*s,0);ctx.lineTo(-34*s,0);ctx.moveTo(-24*s,-9*s);ctx.lineTo(-24*s,9*s);ctx.stroke();ctx.strokeStyle='#ef476f';ctx.beginPath();ctx.moveTo(-29*s,-8*s);ctx.lineTo(-20*s,8*s);ctx.stroke();}
  ctx.fillStyle=active?'#ef476f':'#ffd166';ctx.beginPath();ctx.arc(-4*s,-10*s,3.2*s,0,TAU);ctx.fill();
  if(active){ctx.strokeStyle=`rgba(239,71,111,${.35+.35*pulse})`;ctx.lineWidth=1.5*s;for(let r=9;r<=17;r+=8){ctx.beginPath();ctx.arc(-4*s,-10*s,r*s,-2.7,-.45);ctx.stroke();}}
  ctx.restore();
}
function drawThreeBodyZones(){
  if(!threeBody)return;
  const center=threeBodyBarycenter(),pulse=.72+.2*Math.sin(threeBody.time*2.1);
  // 三颗恒星的近期轨迹与瞬时引力三角形。
  for(let i=0;i<3;i++){
    const tr=threeBody.starTrails[i];
    if(tr.length>1){ctx.strokeStyle=i===0?'rgba(255,240,168,.22)':i===1?'rgba(191,232,255,.2)':'rgba(255,208,217,.2)';ctx.lineWidth=1.4/cam.zoom;ctx.beginPath();ctx.moveTo(tr[0].x,tr[0].y);for(let j=1;j<tr.length;j++)ctx.lineTo(tr[j].x,tr[j].y);ctx.stroke();}
  }
  ctx.strokeStyle='rgba(207,224,255,.16)';ctx.lineWidth=1.2/cam.zoom;ctx.setLineDash([6/cam.zoom,9/cam.zoom]);ctx.beginPath();ctx.moveTo(EARTH.x,EARTH.y);ctx.lineTo(MARS.x,MARS.y);ctx.lineTo(MOON.x,MOON.y);ctx.closePath();ctx.stroke();ctx.setLineDash([]);
  // 红圈只表示危险潮汐区，不是硬碰撞边界。
  for(const b of BODIES){ctx.fillStyle='rgba(239,71,111,.055)';ctx.strokeStyle='rgba(239,71,111,.42)';ctx.lineWidth=2/cam.zoom;ctx.beginPath();ctx.arc(b.x,b.y,b.r+THREE_DANGER_PAD,0,TAU);ctx.fill();ctx.stroke();}
  ctx.strokeStyle='rgba(201,156,255,.25)';ctx.lineWidth=3/cam.zoom;ctx.setLineDash([12/cam.zoom,14/cam.zoom]);ctx.beginPath();ctx.arc(center.x,center.y,THREE_CHAOS_R,0,TAU);ctx.stroke();ctx.setLineDash([]);
  ctx.strokeStyle=mission.stage>=2?'rgba(95,208,104,.9)':'rgba(95,208,104,.34)';ctx.lineWidth=5/cam.zoom;ctx.setLineDash([18/cam.zoom,13/cam.zoom]);ctx.beginPath();ctx.arc(center.x,center.y,THREE_ESCAPE_R,0,TAU);ctx.stroke();ctx.setLineDash([]);
  if(W>=760){ctx.fillStyle='rgba(95,208,104,.88)';ctx.font=`900 ${14/cam.zoom}px "Microsoft YaHei",sans-serif`;ctx.textAlign='center';ctx.fillText('混沌逃逸边界',center.x,center.y-THREE_ESCAPE_R-17/cam.zoom);}
  for(let i=0;i<2;i++){
    const g=threeBodyGate(i),active=mission.stage===i,visited=mission.stage>i,col=i===0?'76,201,240':'255,209,102';
    ctx.fillStyle=`rgba(${col},${active ? .14 : visited ? .035 : .065})`;ctx.strokeStyle=`rgba(${col},${active ? pulse : visited ? .24 : .45})`;ctx.lineWidth=(active?5:2.5)/cam.zoom;
    ctx.setLineDash([10/cam.zoom,8/cam.zoom]);ctx.beginPath();ctx.arc(g.x,g.y,THREE_GATE_R,0,TAU);ctx.fill();ctx.stroke();ctx.setLineDash([]);
    drawStrandedRescueShip(g,i,active,visited,pulse);
    ctx.fillStyle=`rgba(${col},${active?1:.58})`;ctx.font=`900 ${(active?15:12)/cam.zoom}px "Microsoft YaHei",sans-serif`;ctx.textAlign='center';ctx.fillText(`求救飞船 ${i?'B':'A'}${visited?' · 已营救':''}`,g.x,g.y-THREE_GATE_R-14/cam.zoom);
  }
  if(mission.stage<2){const g=threeBodyGate(mission.stage);ctx.strokeStyle='rgba(255,255,255,.2)';ctx.lineWidth=1.5/cam.zoom;ctx.setLineDash([5/cam.zoom,8/cam.zoom]);ctx.beginPath();ctx.moveTo(rocket.x,rocket.y);ctx.lineTo(g.x,g.y);ctx.stroke();ctx.setLineDash([]);}
  ctx.fillStyle='rgba(255,255,255,.62)';ctx.beginPath();ctx.arc(center.x,center.y,5/cam.zoom,0,TAU);ctx.fill();ctx.textAlign='left';
}
function drawBlackHoleZones(){
  if(!blackHole)return;
  const m=blackHoleMetrics(),spin=blackHole.farTime*.42;
  // 绿色救援门与紫色深渊点火带：玩法信息保持比特效更清楚。
  const invalidExit=mission.blackHoleInvalidExitT>0;
  ctx.strokeStyle=invalidExit?'rgba(239,71,111,.92)':m.energy>0?'rgba(95,208,104,.92)':'rgba(95,208,104,.36)';ctx.lineWidth=5/cam.zoom;ctx.setLineDash([17/cam.zoom,12/cam.zoom]);
  ctx.beginPath();ctx.arc(0,0,BH_ESCAPE_R,0,TAU);ctx.stroke();ctx.setLineDash([]);
  ctx.fillStyle=invalidExit?'rgba(255,120,145,.96)':'rgba(95,208,104,.9)';ctx.font=`900 ${15/cam.zoom}px "Microsoft YaHei",sans-serif`;ctx.textAlign='center';ctx.fillText(invalidExit?'能量不足 · 仍会返回':'远方救援门 · 需正逃逸能量',0,-BH_ESCAPE_R-18/cam.zoom);
  ctx.strokeStyle='rgba(174,104,255,.22)';ctx.lineWidth=BH_BURN_R-BH_BURN_IN;ctx.beginPath();ctx.arc(0,0,(BH_BURN_R+BH_BURN_IN)/2,0,TAU);ctx.stroke();
  ctx.strokeStyle='rgba(210,157,255,.78)';ctx.lineWidth=2.5/cam.zoom;ctx.beginPath();ctx.arc(0,0,BH_BURN_R,0,TAU);ctx.stroke();
  if(W>=760){ctx.fillStyle='#d9a6ff';ctx.font=`800 ${13/cam.zoom}px "Microsoft YaHei",sans-serif`;ctx.fillText('深渊点火区',0,-BH_BURN_R-14/cam.zoom);}

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
  // 同步轨道环形带（金色）
  ctx.strokeStyle='rgba(255,209,102,.35)'; ctx.lineWidth=GEO_BAND*2;
  ctx.beginPath(); ctx.arc(EARTH.x, EARTH.y, R_GEO, 0, TAU); ctx.stroke();
  ctx.strokeStyle='rgba(255,209,102,.8)'; ctx.lineWidth=2.5/cam.zoom;
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
  if(mission.stage>=2){
    ctx.strokeStyle='rgba(207,216,220,.45)'; ctx.lineWidth=1.5/cam.zoom; ctx.setLineDash([5/cam.zoom,7/cam.zoom]);
    ctx.beginPath(); ctx.moveTo(rocket.x,rocket.y); ctx.lineTo(MOON.x,MOON.y); ctx.stroke(); ctx.setLineDash([]);
  }
}
function drawStationOrbitZone(){
  if(!station) return;
  ctx.strokeStyle='rgba(76,201,240,.32)'; ctx.lineWidth=3/cam.zoom; ctx.setLineDash([9/cam.zoom,10/cam.zoom]);
  ctx.beginPath(); ctx.arc(EARTH.x,EARTH.y,STATION_R,0,TAU); ctx.stroke(); ctx.setLineDash([]);
  const m=stationMetrics();
  if(mission.stage>=1){
    ctx.strokeStyle='rgba(95,208,104,.52)'; ctx.lineWidth=1.8/cam.zoom; ctx.setLineDash([5/cam.zoom,7/cam.zoom]);
    ctx.beginPath(); ctx.moveTo(rocket.x,rocket.y); ctx.lineTo(station.x,station.y); ctx.stroke(); ctx.setLineDash([]);
    ctx.strokeStyle=mission.stage===3?'rgba(95,208,104,.88)':'rgba(255,209,102,.52)'; ctx.lineWidth=2/cam.zoom;
    ctx.beginPath(); ctx.arc(station.x,station.y,mission.stage===3?42:120,0,TAU); ctx.stroke();
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
    ctx.strokeStyle='rgba(120,200,255,.5)'; ctx.lineWidth=1.6/cam.zoom; ctx.setLineDash([6,6]);
    const trailStep=trail.length>450?2:1;
    ctx.beginPath(); ctx.moveTo(trail[0].x, trail[0].y);
    for(let i=trailStep;i<trail.length;i+=trailStep) ctx.lineTo(trail[i].x,trail[i].y);
    ctx.stroke(); ctx.setLineDash([]);
  }

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

  drawRocket();
  ctx.restore();
  SG_HUD.draw(worldDrawStarted);
}

let last = performance.now(), renderInterval=1000/60, renderAccumulator=0, measuredFps=60, fpsWindowStart=last, fpsWindowFrames=0,lastPerfUiAt=0;
