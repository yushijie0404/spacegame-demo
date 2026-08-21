"use strict";

// Optional beginner demonstrations: recorded routes and the fair level-5 physics ghost.
// Classic-script globals keep the hot update loop allocation-free and preserve existing call sites.

function guideGhostVisible(){
  return !!(mission&&mission.assistMode&&!mission.hintsHidden&&!mission.done);
}

const GUIDE_DEMOS={
  1:{duration:38,budget:32,burnRate:2.0},
  2:{duration:38,budget:14,burnRate:1.75},
  3:{duration:46,budget:35,burnRate:1.25},
  4:{duration:74,budget:44,burnRate:1.6},
  8:{duration:82,budget:42,burnRate:.75}
};
const LICENSE_ECHO_MAP=Object.freeze({
  '3:2':'第一关技能：稳定绕行','3:3':'第一关技能：稳定绕行',
  '4:1':'第一关技能：近地点顺向点火','4:3':'第二关技能：控制接地速度',
  '5:2':'第四关技能：相对月球减速捕获','8:3':'第三关技能：先消速度差再对接',
  '9:1':'第一关技能：在最近点顺向点火','10:0':'第三关技能：相对速度匹配','10:1':'第三关技能：相对速度匹配'
});
const licenseEchoSessionSeen=new Set();
let licenseEchoStageKey='',licenseEchoText='',licenseEchoRemaining=0;
function updateLicenseEcho(dtReal=0){
  if(!mission){licenseEchoStageKey='';licenseEchoText='';licenseEchoRemaining=0;return;}
  const key=`${level}:${mission.stage}`;
  if(key!==licenseEchoStageKey){
    licenseEchoStageKey=key;licenseEchoText='';licenseEchoRemaining=0;
    const text=LICENSE_ECHO_MAP[key];
    if(text&&!licenseEchoSessionSeen.has(key)){licenseEchoSessionSeen.add(key);licenseEchoText=text;licenseEchoRemaining=3.8;}
  }else if(licenseEchoRemaining>0)licenseEchoRemaining=Math.max(0,licenseEchoRemaining-Math.max(0,dtReal));
}
function licenseEchoStatus(){
  return {text:licenseEchoRemaining>0?licenseEchoText:'',remaining:licenseEchoRemaining,alpha:Math.min(1,licenseEchoRemaining/.45)};
}
function smooth01(v){ v=Math.max(0,Math.min(1,v)); return v*v*(3-2*v); }
function createRecordedGuide(levelId){
  const cfg=GUIDE_DEMOS[levelId];
  if(!cfg) return null;
  const startAngle=Math.atan2(rocket.y-EARTH.y,rocket.x-EARTH.x);
  return {mode:'recorded',level:levelId,x:rocket.x,y:rocket.y,vx:rocket.vx,vy:rocket.vy,a:rocket.a,
    fuel:cfg.budget,fuelMax:cfg.budget,burnRate:cfg.burnRate,duration:cfg.duration,time:0,trailT:0,
    startAngle,startMoonAngle:moonAngle,startStationAngle:station?.angle,
    started:false,active:true,complete:false,thrusting:false,chute:false,label:'等待首次推进 · 世界暂停'};
}
function guideDemoPosition(g,t){
  const a0=g.startAngle;
  if(g.level===1){
    if(t<8){ const u=smooth01(t/8),a=a0+1.2*u,r=EARTH.r+1+249*u; return {x:EARTH.x+Math.cos(a)*r,y:EARTH.y+Math.sin(a)*r,thrust:true,label:'起飞后逐渐向右转'}; }
    if(t<26){ const u=smooth01((t-8)/18),a=a0+1.2+Math.PI*u,r=850+(R_GEO-850)*u; return {x:EARTH.x+Math.cos(a)*r,y:EARTH.y+Math.sin(a)*r,thrust:t<11,label:'滑向远地点'}; }
    const a=a0+1.2+Math.PI+(t-26)*.08; return {x:EARTH.x+Math.cos(a)*R_GEO,y:EARTH.y+Math.sin(a)*R_GEO,thrust:t<30,label:t<30?'远地点加速':'同步轨道完成'};
  }
  if(g.level===2){
    if(t<5){ const a=a0+EARTH_OMEGA*t; return {x:EARTH.x+Math.cos(a)*R_GEO,y:EARTH.y+Math.sin(a)*R_GEO,heading:a-Math.PI/2,thrust:true,label:'机头朝后 · 反向点火降轨'}; }
    if(t<34){
      const u=smooth01((t-5)/29),a=a0+EARTH_OMEGA*5+Math.PI*1.12*u,r=R_GEO-(R_GEO-EARTH.r-1)*u;
      const chute=t>25,thrust=t>31,heading=chute?a:a-Math.PI/2;
      return {x:EARTH.x+Math.cos(a)*r,y:EARTH.y+Math.sin(a)*r,heading,thrust,chute,label:thrust?'机头朝上 · 反推缓冲':chute?'打开降落伞':'保持反向姿态滑向地球'};
    }
    const a=a0+EARTH_OMEGA*5+Math.PI*1.12; return {x:EARTH.x+Math.cos(a)*(EARTH.r+1),y:EARTH.y+Math.sin(a)*(EARTH.r+1),heading:a,thrust:false,chute:true,label:'安全着陆'};
  }
  if(g.level===3){
    if(t<8){ const u=smooth01(t/8),a=a0+1.25*u,r=EARTH.r+1+299*u; return {x:EARTH.x+Math.cos(a)*r,y:EARTH.y+Math.sin(a)*r,thrust:true,label:'发射入轨'}; }
    if(t<29){
      const u=smooth01((t-8)/21),startA=a0+1.25,arrivalA=g.startStationAngle+STATION_OMEGA*29;
      const sx=EARTH.x+Math.cos(arrivalA)*STATION_R,sy=EARTH.y+Math.sin(arrivalA)*STATION_R;
      const tx=-Math.cos(arrivalA+Math.PI/2),ty=-Math.sin(arrivalA+Math.PI/2);
      const targetX=sx+tx*260,targetY=sy+ty*260,targetA=Math.atan2(targetY-EARTH.y,targetX-EARTH.x),targetR=Math.hypot(targetX-EARTH.x,targetY-EARTH.y);
      const a=startA+normalizeAngle(targetA-startA)*u,r=900+(targetR-900)*u;
      return {x:EARTH.x+Math.cos(a)*r,y:EARTH.y+Math.sin(a)*r,thrust:t<12,label:'从低轨追赶'};
    }
    const u=smooth01((t-29)/17),sv=Math.max(1,Math.hypot(station?.vx||0,station?.vy||0)),tx=-(station?.vx||0)/sv,ty=-(station?.vy||0)/sv,offset=260*(1-u);
    const x=(station?.x||0)+tx*offset,y=(station?.y||0)+ty*offset;
    const heading=t<36?Math.atan2(station?.vy||0,station?.vx||0):t<43?Math.atan2(-(station?.vy||0),-(station?.vx||0)):Math.atan2((station?.y||0)-y,(station?.x||0)-x);
    return {x,y,heading,thrust:t<43,label:t<36?'顺向点火完成追赶':t<43?'反向点火匹配速度':u>.94?'低速对接':'关机漂移靠近'};
  }
  if(g.level===4){
    if(t<8){ const u=smooth01(t/8),a=a0+1.2*u,r=EARTH.r+1+299*u; return {x:EARTH.x+Math.cos(a)*r,y:EARTH.y+Math.sin(a)*r,thrust:true,label:'发射入轨'}; }
    // 预先按共同起跑钟计算月球抵达位置：转移轨道在远地点与月球相遇。
    const arrivalMoonA=g.startMoonAngle+MOON_OMEGA*58,entryA=arrivalMoonA-1.15;
    const arrivalMoonX=EARTH.x+Math.cos(arrivalMoonA)*MOON_ORBIT_R,arrivalMoonY=EARTH.y+Math.sin(arrivalMoonA)*MOON_ORBIT_R;
    const tx=arrivalMoonX+Math.cos(entryA)*900,ty=arrivalMoonY+Math.sin(entryA)*900;
    const targetA=Math.atan2(ty-EARTH.y,tx-EARTH.x),targetR=Math.hypot(tx-EARTH.x,ty-EARTH.y);
    const perigeeA=targetA-Math.PI;
    if(t<14){
      const u=smooth01((t-8)/6),a=a0+1.2+normalizeAngle(perigeeA-(a0+1.2))*u;
      return {x:EARTH.x+Math.cos(a)*900,y:EARTH.y+Math.sin(a)*900,thrust:t<10,label:t<10?'建立近地停泊轨道':'滑向近地点'};
    }
    if(t<18){
      const u=smooth01((t-14)/4),a=perigeeA+.04*u,r=900+30*u;
      return {x:EARTH.x+Math.cos(a)*r,y:EARTH.y+Math.sin(a)*r,thrust:true,label:'近地点顺向点火 · 抬高远地点'};
    }
    if(t<58){
      // 近地点加速后沿椭圆无动力滑行：rp≈930，ra=月球进近点；不是直线飞向月球。
      const u=(t-18)/40,nu=(Math.PI-.04)*(1-Math.pow(1-u,1.7))+.04;
      const rp=930,ra=targetR,e=(ra-rp)/(ra+rp),p=rp*(1+e),r=p/(1+e*Math.cos(nu));
      const a=perigeeA+nu;
      return {x:EARTH.x+Math.cos(a)*r,y:EARTH.y+Math.sin(a)*r,thrust:false,label:'发动机关机 · 沿转移椭圆滑行'};
    }
    const u=smooth01((t-58)/16),a=moonAngle-1.15*(1-u),r=900-(900-MOON.r-1)*u;
    return {x:MOON.x+Math.cos(a)*r,y:MOON.y+Math.sin(a)*r,heading:a,thrust:t>62,chute:false,label:u>.96?'月背安全着陆':'月球反推捕获并下降'};
  }
  if(g.level===8){
    const gate=binaryGatePoint(),toGate=Math.atan2(gate.y-EARTH.y,gate.x-EARTH.x);
    if(t<10){
      const u=smooth01(t/10),startA=a0+EARTH_OMEGA*t,sx=EARTH.x+Math.cos(startA)*(EARTH.r+1),sy=EARTH.y+Math.sin(startA)*(EARTH.r+1);
      const ex=EARTH.x+Math.cos(toGate)*620,ey=EARTH.y+Math.sin(toGate)*620;
      return {x:sx+(ex-sx)*u,y:sy+(ey-sy)*u,heading:toGate,thrust:true,label:'离开发射星 · 对准两星之间'};
    }
    if(t<43){
      const u=smooth01((t-10)/33),sx=EARTH.x+Math.cos(toGate)*620,sy=EARTH.y+Math.sin(toGate)*620;
      return {x:sx+(gate.x-sx)*u,y:sy+(gate.y-sy)*u,heading:toGate,thrust:t<17||t>38,label:t>38?'修正穿门':'关机滑向移动通道'};
    }
    const stationSpeed=Math.max(1,Math.hypot(station.vx,station.vy)),backX=-station.vx/stationSpeed,backY=-station.vy/stationSpeed;
    if(t<68){
      const u=smooth01((t-43)/25),tx=station.x+backX*520,ty=station.y+backY*520;
      return {x:gate.x+(tx-gate.x)*u,y:gate.y+(ty-gate.y)*u,heading:t<58?Math.atan2(ty-gate.y,tx-gate.x):Math.atan2(-station.vy,-station.vx),thrust:t>56,label:t>56?'反推进入目标星轨道':'借目标星引力转弯'};
    }
    const u=smooth01((t-68)/14),offset=520*(1-u),x=station.x+backX*offset,y=station.y+backY*offset;
    return {x,y,heading:t<77?Math.atan2(-station.vy,-station.vx):Math.atan2(station.y-y,station.x-x),thrust:t<78,label:u>.95?'暮光站低速对接':'匹配空间站速度'};
  }
  return {x:g.x,y:g.y,thrust:false,label:'示范完成'};
}
function updateRecordedGuide(dt){
  if(!ghostShip||ghostShip.mode!=='recorded'||!ghostShip.active) return;
  if(!ghostShip.started){
    if(!(keys['ArrowUp']||keys['KeyW'])) return;
    ghostShip.started=true;
  }
  const previous={x:ghostShip.x,y:ghostShip.y};
  ghostShip.time=Math.min(ghostShip.duration,ghostShip.time+dt);
  const sample=guideDemoPosition(ghostShip,ghostShip.time),next=guideDemoPosition(ghostShip,Math.min(ghostShip.duration,ghostShip.time+.05));
  ghostShip.x=sample.x;ghostShip.y=sample.y;ghostShip.vx=(sample.x-previous.x)/Math.max(dt,.001);ghostShip.vy=(sample.y-previous.y)/Math.max(dt,.001);
  ghostShip.a=Number.isFinite(sample.heading)?sample.heading:Math.atan2(next.y-sample.y,next.x-sample.x);
  ghostShip.thrusting=!!sample.thrust&&ghostShip.fuel>0;ghostShip.chute=!!sample.chute;ghostShip.label=sample.label;
  if(ghostShip.thrusting)ghostShip.fuel=Math.max(0,ghostShip.fuel-ghostShip.burnRate*dt);
  ghostShip.trailT+=dt;
  if(ghostTrail.length===0||ghostShip.trailT>=(lowPowerMode?.18:.1)){ghostTrail.push({x:ghostShip.x,y:ghostShip.y});ghostShip.trailT=0;if(ghostTrail.length>(lowPowerMode?260:700))ghostTrail.shift();}
  if(ghostShip.time>=ghostShip.duration){ghostShip.complete=true;ghostShip.thrusting=false;}
}
function updateSlingshotGhost(dt,dtReal=dt){
  if(level!==5||!ghostShip||!ghostShip.active) return;
  // 等玩家第一次按下推进再同步起跑；新手可以先认清按钮，固定的月球窗口不会偷偷溜走。
  if(!ghostShip.started){
    if(!(keys['ArrowUp']||keys['KeyW'])) return;
    ghostShip.started=true;
  }
  ghostShip.time=(ghostShip.time||0)+dt;
  ghostShip.thrusting=ghostShip.fuel>0;
  if(ghostShip.thrusting){
    const localUp=Math.atan2(ghostShip.y-EARTH.y,ghostShip.x-EARTH.x);
    const desired=localUp+SLING_GHOST_PITCH;
    const delta=normalizeAngle(desired-ghostShip.a);
    const rotScale=bulletT>0 ? .58 : 1;
    const maxTurn=ROT*Math.min(dtReal,.02)*rotScale;
    const turn=Math.max(-maxTurn,Math.min(maxTurn,delta));
    ghostShip.a+=turn;
    ghostShip.turning=Math.abs(delta)>.025;
    const burnDt=Math.min(dt,ghostShip.fuel/9);
    ghostShip.vx+=Math.cos(ghostShip.a)*THRUST*burnDt;
    ghostShip.vy+=Math.sin(ghostShip.a)*THRUST*burnDt;
    ghostShip.fuel=Math.max(0,ghostShip.fuel-9*burnDt);
    if(ghostShip.fuel===0) ghostShip.burnedOut=true;
  }else{ ghostShip.turning=false; ghostShip.a=Math.atan2(ghostShip.vy,ghostShip.vx); }
  // 完美示范影子使用与玩家完全相同的地球、月球、火星叠加引力。
  let ax=0,ay=0;
  for(const b of BODIES){
    const dx=b.x-ghostShip.x,dy=b.y-ghostShip.y,d2=dx*dx+dy*dy,d=Math.sqrt(d2),g=b.mu/d2;
    ax+=dx/d*g; ay+=dy/d*g;
  }
  ghostShip.vx+=ax*dt; ghostShip.vy+=ay*dt;
  ghostShip.x+=ghostShip.vx*dt; ghostShip.y+=ghostShip.vy*dt;
  ghostShip.energy=earthSpecificEnergy(ghostShip);
  ghostShip.trailT+=dt;
  if(ghostTrail.length===0||ghostShip.trailT>=(lowPowerMode?.16:.08)){
    ghostTrail.push({x:ghostShip.x,y:ghostShip.y}); ghostShip.trailT=0;
    if(ghostTrail.length>(lowPowerMode?300:900)) ghostTrail.shift();
  }
  const earthR=Math.hypot(ghostShip.x-EARTH.x,ghostShip.y-EARTH.y);
  if(earthR>=SLING_EXIT_R&&ghostShip.energy>0) ghostShip.complete=true;
  for(const b of BODIES){ if(Math.hypot(ghostShip.x-b.x,ghostShip.y-b.y)<b.r){ ghostShip.active=false; break; } }
  if(earthR>14500) ghostShip.active=false;
}
