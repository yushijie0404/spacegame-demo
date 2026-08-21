"use strict";

// Moving special-level worlds and every forward-orbit predictor live here.
// Functions intentionally remain classic-script globals so the existing runtime,
// art and HUD layers can call them without proxy allocations in hot paths.

function configureBinaryWorld(){
  Object.assign(MARS,{r:285,mu:BINARY_MU_A,col:'#ff9f43',landMax:0,name:'曙光星 A',isStar:true});
  Object.assign(MOON,{r:250,mu:BINARY_MU_B,col:'#dbe9ff',landMax:0,name:'暮光星 B',isStar:true});
  Object.assign(EARTH,{r:118,mu:3.0e5,col:'#4cc9f0',landMax:15,name:'晨曦星',isStar:false});
  binary={angle:0,planetAngle:.18,gateCrossed:false,heatRadiusA:MARS.r+175,heatRadiusB:MOON.r+165};
  updateBinaryWorld(0);
}
function configureBlackHoleWorld(){
  Object.assign(EARTH,{x:0,y:0,vx:0,vy:0,r:BH_HORIZON,mu:BH_MU,col:'#05030b',landMax:0,name:'卡戎深渊',isStar:false,isBlackHole:true});
  Object.assign(MARS,{x:70000,y:70000,vx:0,vy:0,r:1,mu:0,col:'#000',landMax:0,name:'远方',isStar:false});
  Object.assign(MOON,{x:-70000,y:-70000,vx:0,vy:0,r:1,mu:0,col:'#000',landMax:0,name:'远方',isStar:false});
  blackHole={properTime:0,farTime:0,factor:1,coordinateFactor:1,minRadius:BH_START_R,beaconAngle:-.75,frozen:false,redshift:0};
}
function blackHoleMetrics(ship=rocket){
  const dx=ship.x-EARTH.x,dy=ship.y-EARTH.y,r=Math.max(BH_HORIZON+1e-3,Math.hypot(dx,dy));
  const v2=ship.vx*ship.vx+ship.vy*ship.vy,energy=.5*v2-BH_MU/r;
  const radial=(ship.vx*dx+ship.vy*dy)/r;
  const lapse=Math.max(0,1-BH_HORIZON/r);
  const properFactor=Math.max(.025,Math.min(1,Math.sqrt(lapse)));
  // 远方视角的坐标运动要比飞船钟更明显地趋近静止；在关卡起点归一化，避免开局就显得迟钝。
  const startLapse=1-BH_HORIZON/BH_START_R;
  const coordinateFactor=Math.max(.004,Math.min(1,Math.pow(lapse/startLapse,1.25)));
  const tidal=2*BH_MU*34/Math.pow(r,3);
  const speed=Math.sqrt(v2);
  return {dx,dy,r,alt:r-BH_HORIZON,speed,energy,radial,factor:properFactor,properFactor,coordinateFactor,
    apparentSpeed:speed*coordinateFactor,worldRate:Math.min(80,1/coordinateFactor),tidal};
}
function seededRandom(seed){
  return SG_ORBIT.seededRandom(seed);
}
function nextThreeBodySeed(){
  threeBodyResetCounter=(threeBodyResetCounter+1)>>>0;
  const now=Date.now()>>>0,perf=Math.floor((typeof performance!=='undefined'?performance.now():0)*1000)>>>0;
  return (now^perf^Math.imul(threeBodyResetCounter,0x9E3779B1))>>>0||1;
}
function chooseThreeBodyRestartSeed(mode,currentSeed=0,pinnedSeed=0,nextSeed=nextThreeBodySeed){
  if(mode==='fixed')return (pinnedSeed||currentSeed)>>>0||nextSeed();
  return nextSeed();
}
function formatThreeBodySeed(seed=threeBody?.seed||threeBodyPinnedSeed||0){
  return '#'+(seed>>>0).toString(16).toUpperCase().padStart(8,'0');
}
function threeBodyBarycenter(bodies=BODIES){
  return SG_ORBIT.barycenter(bodies,THREE_MU);
}
function configureThreeBodyWorld(seed=nextThreeBodySeed()){
  const rnd=seededRandom(seed),rot=rnd()*TAU,cr=Math.cos(rot),sr=Math.sin(rot),vScale=Math.sqrt(THREE_MU/THREE_SCALE);
  const baseP=[[-.97000436,.24308753],[.97000436,-.24308753],[0,0]];
  const baseV=[[.466203685,.43236573],[.466203685,.43236573],[-.93240737,-.86473146]];
  const states=[];
  for(let i=0;i<3;i++){
    const px=(baseP[i][0]+(rnd()-.5)*.045)*THREE_SCALE,py=(baseP[i][1]+(rnd()-.5)*.045)*THREE_SCALE;
    const vx=(baseV[i][0]+(rnd()-.5)*.035)*vScale,vy=(baseV[i][1]+(rnd()-.5)*.035)*vScale;
    states.push({x:px*cr-py*sr,y:px*sr+py*cr,vx:vx*cr-vy*sr,vy:vx*sr+vy*cr});
  }
  const mean={x:states.reduce((s,p)=>s+p.x,0)/3,y:states.reduce((s,p)=>s+p.y,0)/3,vx:states.reduce((s,p)=>s+p.vx,0)/3,vy:states.reduce((s,p)=>s+p.vy,0)/3};
  const colors=['#fff0a8','#bfe8ff','#ffd0d9'],names=['赫利俄斯 A','塞勒涅 B','厄瑞玻斯 C'];
  for(let i=0;i<3;i++)Object.assign(BODIES[i],{x:states[i].x-mean.x,y:states[i].y-mean.y,vx:states[i].vx-mean.vx,vy:states[i].vy-mean.vy,r:THREE_STAR_R,mu:THREE_MU,col:colors[i],landMax:0,name:names[i],isStar:true,isBlackHole:false});
  const order=[0,1,2];
  for(let i=2;i>0;i--){const j=Math.floor(rnd()*(i+1));[order[i],order[j]]=[order[j],order[i]];}
  const pairs=[[order[0],order[1]],[order[1],order[2]]],sides=[];
  for(const pair of pairs){
    const third=[0,1,2].find(i=>i!==pair[0]&&i!==pair[1]),a=BODIES[pair[0]],b=BODIES[pair[1]],dx=b.x-a.x,dy=b.y-a.y,d=Math.max(1,Math.hypot(dx,dy)),nx=-dy/d,ny=dx/d,mx=(a.x+b.x)/2,my=(a.y+b.y)/2;
    const plus=Math.hypot(mx+nx*THREE_GATE_OFFSET-BODIES[third].x,my+ny*THREE_GATE_OFFSET-BODIES[third].y),minus=Math.hypot(mx-nx*THREE_GATE_OFFSET-BODIES[third].x,my-ny*THREE_GATE_OFFSET-BODIES[third].y);
    sides.push(Math.abs(plus-minus)<120?(rnd()<.5?1:-1):(plus>minus?1:-1));
  }
  threeBody={seed,time:0,pairs,sides,rescueShips:[],starTrails:[[],[],[]],trailT:0,maxSplit:0};
  threeBody.rescueShips=[0,1].map(index=>{
    const g=threeBodyGateGeometry(index),center=threeBodyBarycenter(),dx=g.x-center.x,dy=g.y-center.y,d=Math.max(1,Math.hypot(dx,dy)),ux=dx/d,uy=dy/d;
    const radius=THREE_RESCUE_ORBIT_R+(rnd()-.5)*80,sign=index?1:-1,orbitV=Math.sqrt(THREE_MU*3/radius)*THREE_RESCUE_SPEED_FACTOR,drift=(rnd()-.5)*2;
    return {...g,x:center.x+ux*radius,y:center.y+uy*radius,vx:center.vx-uy*orbitV*sign+ux*drift,vy:center.vy+ux*orbitV*sign+uy*drift,alive:true,rescued:false,destroyed:false,crashStar:'',trail:[],index};
  });
  timelineCache=null;
}
function threeBodyGateGeometry(index,bodies=BODIES){
  if(!threeBody)return {x:0,y:0,vx:0,vy:0,index};
  const pair=threeBody.pairs[Math.max(0,Math.min(1,index))],a=bodies[pair[0]],b=bodies[pair[1]],side=threeBody.sides[Math.max(0,Math.min(1,index))];
  const dx=b.x-a.x,dy=b.y-a.y,d=Math.max(1,Math.hypot(dx,dy)),nx=-dy/d*side,ny=dx/d*side;
  return {x:(a.x+b.x)/2+nx*THREE_GATE_OFFSET,y:(a.y+b.y)/2+ny*THREE_GATE_OFFSET,vx:((a.vx||0)+(b.vx||0))/2,vy:((a.vy||0)+(b.vy||0))/2,index,pair};
}
function threeBodyGate(index){
  return threeBody?.rescueShips?.[Math.max(0,Math.min(1,index))]||threeBodyGateGeometry(index);
}
function threeBodyRescueMetrics(index,ship=rocket){
  const gate=threeBodyGate(index),dx=ship.x-gate.x,dy=ship.y-gate.y;
  return {index,gate,distance:Math.hypot(dx,dy),relSpeed:Math.hypot(ship.vx-gate.vx,ship.vy-gate.vy)};
}
function isThreeBodyShipRescued(index){
  return !!(mission&&Array.isArray(mission.threeRescued)&&mission.threeRescued[index]);
}
function isThreeBodyShipDestroyed(index){
  return !!(threeBody?.rescueShips?.[index]?.destroyed||(mission&&Array.isArray(mission.threeDestroyed)&&mission.threeDestroyed[index]));
}
function threeBodyExamState(source=mission){
  const rescued=Array.isArray(source?.threeRescued)?source.threeRescued.slice(0,2):[false,false];
  while(rescued.length<2)rescued.push(false);
  const approach=!!source?.threeApproachMade||rescued.some(Boolean),dangerViolated=!!source?.threeDangerViolated;
  const escaped=!!source?.done&&Number(source?.threeEscapeT||0)>=1.2;
  return {approach,rescued,rescuedCount:rescued.filter(Boolean).length,dangerViolated,
    avoidance:dangerViolated?'failed':escaped?'passed':'pending',escaped};
}
function nearestUnrescuedThreeBodyShip(ship=rocket){
  let nearest=null;
  for(let index=0;index<2;index++){
    if(isThreeBodyShipRescued(index)||isThreeBodyShipDestroyed(index))continue;
    const metrics=threeBodyRescueMetrics(index,ship);
    if(!nearest||metrics.distance<nearest.distance)nearest=metrics;
  }
  return nearest;
}
function threeBodyMetrics(ship=rocket){
  const center=threeBodyBarycenter(),dx=ship.x-center.x,dy=ship.y-center.y,r=Math.max(1,Math.hypot(dx,dy));
  let nearest=null,nearestDistance=Infinity,tidal=0;
  for(const b of BODIES){const d=Math.max(1,Math.hypot(ship.x-b.x,ship.y-b.y));if(d<nearestDistance){nearestDistance=d;nearest=b;}tidal+=b.mu/(d*d*d);}
  const radial=((ship.vx-center.vx)*dx+(ship.vy-center.vy)*dy)/r;
  return {center,dx,dy,r,radial,nearest,nearestDistance,clearance:nearestDistance-(nearest?.r||0),chaos:Math.min(9.99,tidal*75)};
}
function updateThreeBodyWorld(dt){
  if(!threeBody||dt<=0)return;
  const acc=BODIES.map(()=>({x:0,y:0}));
  for(let i=0;i<3;i++)for(let j=i+1;j<3;j++){
    const dx=BODIES[j].x-BODIES[i].x,dy=BODIES[j].y-BODIES[i].y,d2=dx*dx+dy*dy+900,d=Math.sqrt(d2),inv3=1/(d2*d);
    acc[i].x+=dx*BODIES[j].mu*inv3;acc[i].y+=dy*BODIES[j].mu*inv3;
    acc[j].x-=dx*BODIES[i].mu*inv3;acc[j].y-=dy*BODIES[i].mu*inv3;
  }
  for(let i=0;i<3;i++){const b=BODIES[i];b.vx+=acc[i].x*dt;b.vy+=acc[i].y*dt;b.x+=b.vx*dt;b.y+=b.vy*dt;}
  // 两艘失事飞船拥有独立惯性。合成主引力负责把轨道束缚在系统内，局部潮汐扰动让它们仍可能被某颗移动恒星捕获。
  for(const ship of threeBody.rescueShips||[]){
    if(!ship.alive||ship.rescued||ship.destroyed)continue;
    const center=threeBodyBarycenter(),rx=center.x-ship.x,ry=center.y-ship.y,rd2=rx*rx+ry*ry+625,rd=Math.sqrt(rd2),centerInv3=1/(rd2*rd);
    const centerAx=rx*(THREE_MU*3)*centerInv3,centerAy=ry*(THREE_MU*3)*centerInv3;
    let exactAx=0,exactAy=0;
    for(const star of BODIES){
      const dx=star.x-ship.x,dy=star.y-ship.y,d2=dx*dx+dy*dy+625,d=Math.sqrt(d2),inv3=1/(d2*d);
      exactAx+=dx*star.mu*inv3;exactAy+=dy*star.mu*inv3;
    }
    const ax=centerAx+(exactAx-centerAx)*THREE_RESCUE_TIDE_MIX,ay=centerAy+(exactAy-centerAy)*THREE_RESCUE_TIDE_MIX;
    ship.vx+=ax*dt;ship.vy+=ay*dt;ship.x+=ship.vx*dt;ship.y+=ship.vy*dt;
    for(const star of BODIES){
      if(Math.hypot(ship.x-star.x,ship.y-star.y)<=star.r+THREE_RESCUE_SHIP_R){ship.alive=false;ship.destroyed=true;ship.crashStar=star.name;break;}
    }
  }
  threeBody.time+=dt;threeBody.trailT+=dt;
  if(threeBody.trailT>=(lowPowerMode?.18:.1)){
    for(let i=0;i<3;i++){const tr=threeBody.starTrails[i];tr.push({x:BODIES[i].x,y:BODIES[i].y});if(tr.length>(lowPowerMode?80:190))tr.shift();}
    for(const ship of threeBody.rescueShips||[]){if(!ship.destroyed){ship.trail=ship.trail||[];ship.trail.push({x:ship.x,y:ship.y});if(ship.trail.length>(lowPowerMode?55:120))ship.trail.shift();}}
    threeBody.trailT=0;
  }
}
function updateBinaryWorld(dt){
  if(!binary)return;
  binary.angle=normalizeAngle(binary.angle+BINARY_OMEGA*dt);
  const c=Math.cos(binary.angle),s=Math.sin(binary.angle);
  MARS.x=-c*BINARY_A_R;MARS.y=-s*BINARY_A_R;MARS.vx=s*BINARY_OMEGA*BINARY_A_R;MARS.vy=-c*BINARY_OMEGA*BINARY_A_R;
  MOON.x=c*BINARY_B_R;MOON.y=s*BINARY_B_R;MOON.vx=-s*BINARY_OMEGA*BINARY_B_R;MOON.vy=c*BINARY_OMEGA*BINARY_B_R;
  binary.planetAngle=normalizeAngle(binary.planetAngle+BINARY_PLANET_OMEGA*dt);
  const pc=Math.cos(binary.planetAngle),ps=Math.sin(binary.planetAngle),pv=BINARY_PLANET_OMEGA*BINARY_PLANET_R;
  EARTH.x=MARS.x+pc*BINARY_PLANET_R;EARTH.y=MARS.y+ps*BINARY_PLANET_R;
  EARTH.vx=MARS.vx-ps*pv;EARTH.vy=MARS.vy+pc*pv;
}
function binaryGatePoint(){
  if(!binary)return {x:0,y:0,vx:0,vy:0};
  const dx=MOON.x-MARS.x,dy=MOON.y-MARS.y,d=Math.max(1,Math.hypot(dx,dy)),ux=dx/d,uy=dy/d;
  const ratio=Math.sqrt(MARS.mu)/(Math.sqrt(MARS.mu)+Math.sqrt(MOON.mu));
  const x=MARS.x+dx*ratio,y=MARS.y+dy*ratio;
  return {x,y,vx:-BINARY_OMEGA*y,vy:BINARY_OMEGA*x,ux,uy};
}
function specificEnergyAround(body,ship=rocket){
  return SG_ORBIT.specificEnergy(body,ship);
}
function binaryMetrics(ship=rocket){
  if(!binary)return {distA:Infinity,distB:Infinity,targetRel:Infinity,targetEnergy:Infinity,gateDistance:Infinity};
  const ax=ship.x-MARS.x,ay=ship.y-MARS.y,bx=ship.x-MOON.x,by=ship.y-MOON.y;
  const gate=binaryGatePoint(),gvx=ship.vx-gate.vx,gvy=ship.vy-gate.vy;
  return {distA:Math.hypot(ax,ay),distB:Math.hypot(bx,by),targetRel:Math.hypot(ship.vx-MOON.vx,ship.vy-MOON.vy),
    targetEnergy:specificEnergyAround(MOON,ship),gate,gateDistance:Math.hypot(ship.x-gate.x,ship.y-gate.y),gateRel:Math.hypot(gvx,gvy)};
}

function createAsteroid(){
  const mass=70;
  return {x:9000,y:-2600,vx:-55,vy:0,r:ASTEROID_R,mass,mu:mass*ASTEROID_MU_PER_MASS,angle:.35,av:.018,
    inertia:.5*70*ASTEROID_R*ASTEROID_R,name:'小行星 2026-Q7',col:'#a97850',alive:true};
}

function asteroidMetrics(ship=rocket){
  if(!asteroid) return {distance:Infinity,relSpeed:Infinity,closing:0};
  return SG_ORBIT.relativeNavigation(asteroid,ship);
}
function asteroidGravityAt(x,y,t=0){
  let ax=0,ay=0;
  for(const b of BODIES){
    let bx=b.x,by=b.y;
    if(b===MOON){const a=moonAngle+MOON_OMEGA*t;bx=EARTH.x+Math.cos(a)*MOON_ORBIT_R;by=EARTH.y+Math.sin(a)*MOON_ORBIT_R;}
    const dx=bx-x,dy=by-y,d2=Math.max(1,dx*dx+dy*dy),d=Math.sqrt(d2),g=b.mu/d2;
    ax+=dx/d*g;ay+=dy/d*g;
  }
  return {ax,ay};
}
function updateAsteroid(dt){
  if(level!==7||!asteroid||!asteroid.alive||mission.done) return;
  const g=asteroidGravityAt(asteroid.x,asteroid.y);
  asteroid.vx+=g.ax*dt;asteroid.vy+=g.ay*dt;
  asteroid.x+=asteroid.vx*dt;asteroid.y+=asteroid.vy*dt;
  asteroid.angle=normalizeAngle(asteroid.angle+asteroid.av*dt);
  if(!lowPowerMode||asteroidTrail.length===0||flightT%0.14<dt){
    asteroidTrail.push({x:asteroid.x,y:asteroid.y});
    if(asteroidTrail.length>(lowPowerMode?180:500)) asteroidTrail.shift();
  }
  for(const b of [EARTH,MOON]){
    if(Math.hypot(asteroid.x-b.x,asteroid.y-b.y)<=asteroid.r+b.r){
      asteroid.alive=false;state='dead';
      showMsg('☄️',`${b.name}遭到撞击！`,`偏转量还不够，小行星撞上了${b.name}。<br><span style="color:#888">按 R 回到拦截阶段，或从暂停菜单重新开始整关。</span>`);
      return;
    }
  }
}
function predictAsteroidPath(){
  if(!asteroid) return {pts:[],safe:false,minEarth:Infinity,minMoon:Infinity,impact:null};
  let x=asteroid.x,y=asteroid.y,vx=asteroid.vx,vy=asteroid.vy,minEarth=Infinity,minMoon=Infinity,impact=null;
  const horizon=190,steps=lowPowerMode?150:300,dt=horizon/steps,pts=[];
  for(let i=0;i<steps;i++){
    const t=i*dt,g=asteroidGravityAt(x,y,t);
    vx+=g.ax*dt;vy+=g.ay*dt;x+=vx*dt;y+=vy*dt;
    if(i%2===0)pts.push({x,y});
    const ma=moonAngle+MOON_OMEGA*t,mx=EARTH.x+Math.cos(ma)*MOON_ORBIT_R,my=EARTH.y+Math.sin(ma)*MOON_ORBIT_R;
    const de=Math.hypot(x-EARTH.x,y-EARTH.y),dm=Math.hypot(x-mx,y-my);
    minEarth=Math.min(minEarth,de);minMoon=Math.min(minMoon,dm);
    if(!impact&&de<=EARTH.r+asteroid.r)impact={x,y,body:'地球',time:t};
    if(!impact&&dm<=MOON.r+asteroid.r)impact={x,y,body:'月球',time:t};
  }
  const safe=!impact&&minEarth>ASTEROID_SAFE_EARTH&&minMoon>ASTEROID_SAFE_MOON;
  return {pts,safe,minEarth,minMoon,impact,horizon};
}
function getAsteroidForecast(force=false){
  if(!mission||!asteroid)return predictAsteroidPath();
  const now=performance.now(),c=mission.asteroidForecast,cacheMs=lowPowerMode?650:220;
  if(!force&&c&&now-c._t<cacheMs&&Math.hypot(asteroid.vx-c._vx,asteroid.vy-c._vy)<.7)return c;
  const result=predictAsteroidPath();
  result._t=now;result._vx=asteroid.vx;result._vy=asteroid.vy;
  mission.asteroidForecast=result;return result;
}

function predictBlackHolePath(ship=rocket){
  let px=ship.x,py=ship.y,pvx=ship.vx,pvy=ship.vy;
  const coarse=lowPowerMode||W<760||(typeof matchMedia==='function'&&matchMedia('(pointer:coarse)').matches);
  const horizon=95,steps=coarse?150:460,dt=horizon/steps,pts=[],source=[{x:0,y:0,mu:BH_MU}],gravity={ax:0,ay:0};let impact=null,closest=null,closestR=Infinity;
  for(let i=0;i<steps;i++){
    SG_ORBIT.gravityAt(px,py,source,0,gravity);
    pvx+=gravity.ax*dt;pvy+=gravity.ay*dt;px+=pvx*dt;py+=pvy*dt;
    if(i%2===0)pts.push({x:px,y:py});
    const r=Math.hypot(px,py);if(r<closestR){closestR=r;closest={x:px,y:py,r};}
    if(r<=BH_HORIZON+8){impact={x:px,y:py,body:'时间视界'};break;}
  }
  return {pts,markers:closest?[{x:closest.x,y:closest.y,apo:false,blackHole:true,r:closest.r}]:[],horizon,steps,impact,moonApproach:null};
}
function predictBinaryPath(ship=rocket){
  let px=ship.x,py=ship.y,pvx=ship.vx,pvy=ship.vy;
  const coarse=lowPowerMode||W<760||(typeof matchMedia==='function'&&matchMedia('(pointer:coarse)').matches);
  const horizon=150,steps=coarse?150:460,dt=horizon/steps,pts=[];
  let impact=null;
  for(let i=0;i<steps;i++){
    const t=(i+1)*dt,starA=binary.angle+BINARY_OMEGA*t;
    const axA=-Math.cos(starA)*BINARY_A_R,ayA=-Math.sin(starA)*BINARY_A_R;
    const bx=Math.cos(starA)*BINARY_B_R,by=Math.sin(starA)*BINARY_B_R;
    const planetA=binary.planetAngle+BINARY_PLANET_OMEGA*t;
    const ex=axA+Math.cos(planetA)*BINARY_PLANET_R,ey=ayA+Math.sin(planetA)*BINARY_PLANET_R;
    let gx=0,gy=0;
    for(const b of [{x:axA,y:ayA,mu:BINARY_MU_A,r:MARS.r,name:MARS.name},{x:bx,y:by,mu:BINARY_MU_B,r:MOON.r,name:MOON.name},{x:ex,y:ey,mu:EARTH.mu,r:EARTH.r,name:EARTH.name}]){
      const dx=b.x-px,dy=b.y-py,d2=Math.max(1,dx*dx+dy*dy),d=Math.sqrt(d2),g=b.mu/d2;
      gx+=dx/d*g;gy+=dy/d*g;
    }
    pvx+=gx*dt;pvy+=gy*dt;px+=pvx*dt;py+=pvy*dt;
    if(i%2===0)pts.push({x:px,y:py});
    for(const b of [{x:axA,y:ayA,r:MARS.r,name:MARS.name},{x:bx,y:by,r:MOON.r,name:MOON.name},{x:ex,y:ey,r:EARTH.r,name:EARTH.name}]){
      if(Math.hypot(px-b.x,py-b.y)<b.r){impact={x:px,y:py,body:b.name};return {pts,markers:[],horizon,steps,impact,moonApproach:null};}
    }
  }
  return {pts,markers:[],horizon,steps,impact,moonApproach:null};
}
function simulateThreeBodyTimelines(ship=rocket){
  const bodies=BODIES.map(b=>({x:b.x,y:b.y,vx:b.vx,vy:b.vy,mu:b.mu,r:b.r,name:b.name}));
  const center=threeBodyBarycenter(bodies),relVx=ship.vx-center.vx,relVy=ship.vy-center.vy;
  const baseAngle=Math.hypot(relVx,relVy)>2?Math.atan2(relVy,relVx):ship.a;
  const branchDefs=[
    {id:'left',label:'左修正',offset:-.34,color:'rgba(76,240,221,.62)'},
    {id:'coast',label:'继续滑行',offset:0,color:'rgba(235,244,255,.48)'},
    {id:'right',label:'右修正',offset:.34,color:'rgba(255,126,174,.58)'}
  ];
  const branches=branchDefs.map(def=>({...def,x:ship.x,y:ship.y,vx:ship.vx,vy:ship.vy,pts:[{x:ship.x,y:ship.y}],impact:null}));
  const coarse=lowPowerMode||W<760||(typeof matchMedia==='function'&&matchMedia('(pointer:coarse)').matches),steps=coarse?(mobileEconomy?64:92):230,dt=.12;
  for(let step=0;step<steps;step++){
    const acc=bodies.map(()=>({x:0,y:0}));
    for(let i=0;i<3;i++)for(let j=i+1;j<3;j++){
      const dx=bodies[j].x-bodies[i].x,dy=bodies[j].y-bodies[i].y,d2=dx*dx+dy*dy+900,d=Math.sqrt(d2),inv3=1/(d2*d);
      acc[i].x+=dx*bodies[j].mu*inv3;acc[i].y+=dy*bodies[j].mu*inv3;acc[j].x-=dx*bodies[i].mu*inv3;acc[j].y-=dy*bodies[i].mu*inv3;
    }
    for(let i=0;i<3;i++){bodies[i].vx+=acc[i].x*dt;bodies[i].vy+=acc[i].y*dt;bodies[i].x+=bodies[i].vx*dt;bodies[i].y+=bodies[i].vy*dt;}
    for(const branch of branches){
      if(branch.impact)continue;
      let ax=0,ay=0;
      for(const b of bodies){const dx=b.x-branch.x,dy=b.y-branch.y,d2=dx*dx+dy*dy+400,d=Math.sqrt(d2),g=b.mu/d2;ax+=dx/d*g;ay+=dy/d*g;}
      if(branch.offset&&step*dt<.9){const a=baseAngle+branch.offset;ax+=Math.cos(a)*12;ay+=Math.sin(a)*12;}
      branch.vx+=ax*dt;branch.vy+=ay*dt;branch.x+=branch.vx*dt;branch.y+=branch.vy*dt;
      if(step%2===0)branch.pts.push({x:branch.x,y:branch.y});
      for(const b of bodies)if(Math.hypot(branch.x-b.x,branch.y-b.y)<=b.r+8){branch.impact={x:branch.x,y:branch.y,body:b.name};break;}
    }
  }
  let divergence=0;
  for(let i=0;i<branches.length;i++)for(let j=i+1;j<branches.length;j++)divergence=Math.max(divergence,Math.hypot(branches[i].x-branches[j].x,branches[i].y-branches[j].y));
  if(threeBody)threeBody.maxSplit=Math.max(threeBody.maxSplit||0,divergence);
  return {branches,divergence,horizon:steps*dt,steps};
}
function getThreeBodyTimelines(){
  const now=performance.now(),cacheMs=lowPowerMode?(mobileEconomy?850:650):220;
  if(timelineCache&&now-timelineCache.t<cacheMs)return timelineCache.result;
  const result=simulateThreeBodyTimelines();timelineCache={t:now,result};return result;
}
function predictThreeBodyPath(ship=rocket){
  const result=ship===rocket?getThreeBodyTimelines():simulateThreeBodyTimelines(ship),coast=result.branches.find(b=>b.id==='coast')||result.branches[1];
  return {pts:coast.pts,markers:[],horizon:result.horizon,steps:result.steps,impact:coast.impact,moonApproach:null};
}
function predictPath(ship=rocket){
  if(level===10&&threeBody)return predictThreeBodyPath(ship);
  if(level===9&&blackHole)return predictBlackHolePath(ship);
  if(level===8&&binary)return predictBinaryPath(ship);
  let px=ship.x, py=ship.y, pvx=ship.vx, pvy=ship.vy;
  const dx0=px-EARTH.x, dy0=py-EARTH.y, r0=Math.hypot(dx0,dy0), v20=pvx*pvx+pvy*pvy;
  const energy=v20/2-EARTH.mu/r0;
  const lunarMission=level>=4;
  let horizon=lunarMission?110:72;
  if(energy<0){
    const period=SG_ORBIT.periodFromEnergy(EARTH.mu,energy);
    horizon=Math.min(lunarMission?280:180,Math.max(lunarMission?70:40,period*1.1));
  }
  const coarse=lowPowerMode||W<760||(typeof matchMedia==='function'&&matchMedia('(pointer:coarse)').matches);
  const steps=coarse?(mobileEconomy?110:150):520, dt=horizon/steps, pts=[];
  let vrPrev=null, markers=[],impact=null,moonApproach=null,closestMoon=Infinity;
  for(let i=0;i<steps;i++){
    let ax=0, ay=0;
    for(const b of BODIES){
      let bx=b.x, by=b.y;
      if(b===MOON){ const pa=moonAngle+MOON_OMEGA*i*dt; bx=EARTH.x+Math.cos(pa)*MOON_ORBIT_R; by=EARTH.y+Math.sin(pa)*MOON_ORBIT_R; }
      const dx=bx-px, dy=by-py, d2=dx*dx+dy*dy, d=Math.sqrt(d2);
      const g=b.mu/d2; ax+=dx/d*g; ay+=dy/d*g;
    }
    if(level===7&&asteroid&&asteroid.alive){
      // 接近预测中，小行星按当前惯性前进；微弱引力会把黄色航线自然弯向表面。
      const bx=asteroid.x+asteroid.vx*i*dt,by=asteroid.y+asteroid.vy*i*dt;
      const adx=bx-px,ady=by-py,ad2=Math.max(1,adx*adx+ady*ady),ad=Math.sqrt(ad2),ag=asteroid.mu/ad2;
      ax+=adx/ad*ag;ay+=ady/ad*ag;
    }
    pvx+=ax*dt; pvy+=ay*dt; px+=pvx*dt; py+=pvy*dt;
    if(i%2===0) pts.push({x:px,y:py});
    // 近/远地点检测（相对地球的径向速度过零点）
    const dx=px-EARTH.x, dy=py-EARTH.y, d=Math.hypot(dx,dy);
    const vr=(pvx*dx+pvy*dy)/d;
    if(vrPrev!==null && vrPrev!==0 && vr*vrPrev<0 && d>EARTH.r+50 && markers.length<2){
      markers.push({x:px, y:py, apo: vr<0}); // vr 由正转负=远地点(远离→靠近)，由负转正=近地点
    }
    vrPrev=vr;
    for(const b of BODIES){
      let bx=b.x, by=b.y;
      if(b===MOON){ const pa=moonAngle+MOON_OMEGA*i*dt; bx=EARTH.x+Math.cos(pa)*MOON_ORBIT_R; by=EARTH.y+Math.sin(pa)*MOON_ORBIT_R; }
      const bodyDistance=Math.hypot(px-bx,py-by);
      if(b===MOON&&bodyDistance<closestMoon){
        closestMoon=bodyDistance;
        moonApproach={x:px,y:py,bodyX:bx,bodyY:by,distance:bodyDistance,altitude:bodyDistance-b.r};
      }
      if(bodyDistance<b.r){
        impact={x:px,y:py,body:b.name};
        return {pts,markers,horizon,steps,impact,moonApproach};
      }
    }
    if(level===7&&asteroid){
      const bx=asteroid.x+asteroid.vx*i*dt,by=asteroid.y+asteroid.vy*i*dt;
      if(Math.hypot(px-bx,py-by)<asteroid.r){
        impact={x:px,y:py,body:'小行星'};
        return {pts,markers,horizon,steps,impact,moonApproach};
      }
    }
  }
  return {pts,markers,horizon,steps,impact,moonApproach};
}
function getPredictedPath(){
  const now=performance.now();
  if(predictionCache){
    const moved=Math.hypot(rocket.x-predictionCache.x,rocket.y-predictionCache.y);
    const dv=Math.hypot(rocket.vx-predictionCache.vx,rocket.vy-predictionCache.vy);
    const age=now-predictionCache.t, cacheMs=lowPowerMode?520:120;
    // 手机端必须至少复用到缓存期限；否则起飞时重力与推力带来的 dv 会让预测几乎每几帧重算。
    const worldMoved=level===8?Math.abs(normalizeAngle((binary?.angle||0)-(predictionCache.binaryAngle||0))):Math.abs(moonAngle-predictionCache.moonAngle);
    if((lowPowerMode&&age<cacheMs)||(!lowPowerMode&&age<cacheMs&&moved<30&&dv<15&&worldMoved<.004)) return predictionCache.result;
  }
  const predictionStarted=performance.now(),result=predictPath();
  SG_PERF.sample('prediction',performance.now()-predictionStarted);
  predictionCache={t:now,x:rocket.x,y:rocket.y,vx:rocket.vx,vy:rocket.vy,moonAngle,binaryAngle:binary?.angle||0,result};
  return result;
}
