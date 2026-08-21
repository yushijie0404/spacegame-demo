"use strict";

// Core rocket dynamics, assists, fuel use, overload, parachute, surface contact and collisions.
// World clocks, mission progression, scoring/UI, persistence and animation scheduling stay in the main runtime.

function chuteCanopyAngle(flowX,flowY,outX,outY){
  const speed=Math.hypot(flowX,flowY);
  const outwardAngle=Math.atan2(outY,outX);
  if(speed<=6) return outwardAngle;
  let delta=Math.atan2(-flowY,-flowX)-outwardAngle;
  while(delta>Math.PI)delta-=TAU; while(delta<-Math.PI)delta+=TAU;
  const maxSideAngle=Math.acos(0.35);
  delta=Math.max(-maxSideAngle,Math.min(maxSideAngle,delta));
  return outwardAngle+delta;
}
function attitudeVelocity(ship=rocket){
  if(level===9)return {vx:ship.vx,vy:ship.vy};
  if(level===8&&binary){
    const dPlanet=Math.hypot(ship.x-EARTH.x,ship.y-EARTH.y),dTarget=Math.hypot(ship.x-MOON.x,ship.y-MOON.y);
    const ref=dPlanet<420?EARTH:dTarget<1500?MOON:null;
    if(ref)return {vx:ship.vx-(ref.vx||0),vy:ship.vy-(ref.vy||0)};
  }
  if(level===4&&mission&&mission.stage>=2) return {vx:ship.vx-MOON.vx,vy:ship.vy-MOON.vy};
  // 地球发射锁定结束后，随速模式直接跟踪正常地心速度；发射初段由垂直锁定负责。
  if(ship._launchCompleted) return {vx:ship.vx,vy:ship.vy};
  const dx=ship.x-EARTH.x,dy=ship.y-EARTH.y,d=Math.hypot(dx,dy);
  if(d<EARTH.r+350){
    const groundR=EARTH.r+1, sv=surfaceVelocity(EARTH,dx/d*groundR,dy/d*groundR);
    return {vx:ship.vx-sv.vx,vy:ship.vy-sv.vy};
  }
  return {vx:ship.vx,vy:ship.vy};
}
function surfaceVelocity(body,dx,dy){
  const omega=body===EARTH?EARTH_OMEGA:body===MOON&&(typeof level==='undefined'||level!==8)?MOON_OMEGA:(body.spin||0);
  return SG_ORBIT.surfaceVelocity(body,dx,dy,omega);
}
function applyDockingAssist(dt){
  if((level!==3&&level!==8)||!station||!mission.assistMode||mission.stage<2||mission.done) return;
  const m=stationMetrics();
  if(m.distance>220||m.distance<1) return;
  const ux=m.dx/m.distance, uy=m.dy/m.distance;
  const desiredApproach=mission.stage===3?Math.min(4,m.distance*.08):Math.min(8,m.distance*.06);
  const targetVx=station.vx+ux*desiredApproach, targetVy=station.vy+uy*desiredApproach;
  const blend=1-Math.exp(-(mission.stage===3?.8:.35)*dt);
  rocket.vx+=(targetVx-rocket.vx)*blend; rocket.vy+=(targetVy-rocket.vy)*blend;
}
function applyLagrangeAssist(dt){
  if(level!==6||!mission||!mission.assistMode||mission.stage<2||mission.done) return;
  const m=nearestLagrangeMetrics();
  mission.lagrangeTarget=m.point.id;
  if(m.distance>480||m.distance<1) return;
  // 教学模式只在最后几百单位轻柔消除速度差，仍需玩家亲自进入目标环并按部署。
  const blend=1-Math.exp(-.42*dt);
  rocket.vx+=(m.point.vx-rocket.vx)*blend; rocket.vy+=(m.point.vy-rocket.vy)*blend;
}
function killCrew(reason){
  if(rocket.crewDead) return;
  rocket.crewDead = true; rocket.deadReason = reason;
}


function boom(x,y){
  for(let i=0;i<50;i++){
    const a=Math.random()*TAU, s=Math.random()*160+30;
    particles.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,life:Math.random()*0.8+0.4,
      c:['#ff5252','#ffb142','#fff3b0','#ff8f66'][i%4]});
  }
  shake = 14;
  if(typeof SG_AUDIO!=='undefined') SG_AUDIO.sfx('explosion');
}
function asteroidContactCheck(){
  if(level!==7||!asteroid||!asteroid.alive||mission.asteroidContact||rocket.asteroidGrace>0)return false;
  const dx=rocket.x-asteroid.x,dy=rocket.y-asteroid.y,d=Math.max(1,Math.hypot(dx,dy));
  if(d>asteroid.r+RING_OUT)return false;
  const ux=dx/d,uy=dy/d,rvx=rocket.vx-asteroid.vx,rvy=rocket.vy-asteroid.vy;
  const relSpeed=Math.hypot(rvx,rvy),approach=rvx*ux+rvy*uy;
  if(approach>=0&&d>asteroid.r+4)return false;
  mission.asteroidChanged=true;
  mission.asteroidMountAngle=Math.atan2(dy,dx);
  mission.asteroidMountLocal=normalizeAngle(mission.asteroidMountAngle-asteroid.angle);
  if(relSpeed<=ASTEROID_SOFT_SPEED){
    mission.asteroidContact=true;mission.asteroidSoftContact=true;mission.asteroidAnchored=false;mission.hingeAngle=0;
    rocket.landed=true;rocket.body=asteroid;rocket.vx=asteroid.vx;rocket.vy=asteroid.vy;rocket.av=0;
    rocket.x=asteroid.x+ux*(asteroid.r+17);rocket.y=asteroid.y+uy*(asteroid.r+17);
    if(mission.stage<2)unlockFinalStage(2,'✅ 已在小行星表面软着陆！可以锚定，也可以直接推');
    else{mission.toast='✅ 软着陆成功｜点击“锚定并翻转”提高传力效率';mission.toastT=4;}
    return true;
  }
  // 高速接触按动能撞击处理：质心获得冲量，偏心撞击同时改变自转。
  const impactMass=6*Math.max(1,rocket.mass||1),impulseRatio=impactMass/(asteroid.mass+impactMass);
  const dvx=rvx*impulseRatio,dvy=rvy*impulseRatio;
  asteroid.vx+=dvx;asteroid.vy+=dvy;
  asteroid.av+=2*(ux*dvy-uy*dvx)/asteroid.r;
  mission.asteroidImpact=true;mission.asteroidSafeT=0;mission.stage=3;mission.asteroidForecast=null;
  rocket.alive=false;rocket.thrusting=false;boom(rocket.x,rocket.y);
  mission.toast=`💥 动能撞击完成｜速度传递 ${Math.hypot(dvx,dvy).toFixed(1)} u/s，正在评估新轨道`;
  mission.toastT=6;
  return true;
}
function updateMountedAsteroidRocket(dt,dtReal){
  if(!asteroid||!mission.asteroidContact)return;
  const left=keys['ArrowLeft']||keys['KeyA'],right=keys['ArrowRight']||keys['KeyD'];
  if(mission.asteroidAnchored){
    if(left)mission.hingeAngle-=ROT*Math.min(dtReal,.02);
    if(right)mission.hingeAngle+=ROT*Math.min(dtReal,.02);
    mission.hingeAngle=Math.max(-ASTEROID_HINGE_LIMIT,Math.min(ASTEROID_HINGE_LIMIT,mission.hingeAngle));
  }else{
    if(left)rocket.a-=ROT*Math.min(dtReal,.02);
    if(right)rocket.a+=ROT*Math.min(dtReal,.02);
  }
  const mount=asteroid.angle+(mission.asteroidMountLocal||0);
  mission.asteroidMountAngle=mount;
  if(mission.asteroidAnchored)rocket.a=mount+Math.PI+mission.hingeAngle;
  const fx=Math.cos(rocket.a),fy=Math.sin(rocket.a),infiniteFuel=mission.assistMode&&!mission.done;
  rocket.braking=false;rocket.accelerating=(keys['ArrowUp']||keys['KeyW'])&&(infiniteFuel||rocket.fuel>0);rocket.thrusting=rocket.accelerating;
  rocket.thrustPower=rocket.thrusting?1:0;
  if(rocket.thrusting){
    const fuelRate=9*SG_UPGRADES.fuelMultiplier(challengeMode);
    const poweredDt=infiniteFuel?Math.min(dt,.02):Math.min(dt,.02,rocket.fuel/fuelRate);
    const accel=(mission.asteroidAnchored?ASTEROID_PUSH_FORCE:ASTEROID_CONTACT_FORCE)/asteroid.mass;
    const dvx=fx*accel*poweredDt,dvy=fy*accel*poweredDt;
    asteroid.vx+=dvx;asteroid.vy+=dvy;
    const ux=Math.cos(mount),uy=Math.sin(mount);
    asteroid.av+=2*(ux*dvy-uy*dvx)/asteroid.r;
    mission.asteroidChanged=true;mission.asteroidSafeT=0;
    if(!infiniteFuel){const spent=fuelRate*poweredDt;rocket.fuel=Math.max(0,rocket.fuel-spent);mission.fuelUsed+=spent;}
    exhaustAccumulator=Math.min(3,exhaustAccumulator+dtReal*(lowPowerMode?32:58));
    const count=Math.floor(exhaustAccumulator);exhaustAccumulator-=count;
    for(let i=0;i<count&&particles.length<(lowPowerMode?(mobileEconomy?45:70):150);i++)particles.push({
      x:rocket.x-fx*14,y:rocket.y-fy*14,vx:asteroid.vx-fx*(55+Math.random()*30),vy:asteroid.vy-fy*(55+Math.random()*30),
      life:.2+Math.random()*.25,c:i%2?'#ff7043':'#ffd166'});
    if(mission.assistMode)bulletT=.24;
  }else exhaustAccumulator=0;
  const ux=Math.cos(mount),uy=Math.sin(mount);
  rocket.x=asteroid.x+ux*(asteroid.r+17);rocket.y=asteroid.y+uy*(asteroid.r+17);
  rocket.vx=asteroid.vx-uy*asteroid.av*(asteroid.r+17);
  rocket.vy=asteroid.vy+ux*asteroid.av*(asteroid.r+17);
  if(bulletT>0)bulletT=Math.max(0,bulletT-dtReal);
}

function updateFlightPhysics(dt,dtReal,observationDt){
  if(state!=='fly') return;
  if(level===7&&!rocket.alive){if(bulletT>0)bulletT=Math.max(0,bulletT-dtReal);return;} // 动能撞击后继续模拟并评估小行星，飞船不再参与物理。
  if(level===7&&mission.asteroidContact){
    updateMountedAsteroidRocket(dt,dtReal);
    return;
  }

  const earthDx=rocket.x-EARTH.x,earthDy=rocket.y-EARTH.y,earthDistance=Math.hypot(earthDx,earthDy);
  const earthLocalUp=Math.atan2(earthDy,earthDx),launchAlt=earthDistance-EARTH.r;
  // 发射锁定只属于随速新手模式；手动/惯性模式从离架起完全自由。
  if(rocket._launchAssistActive&&!rocket.landed&&attMode!==0){
    rocket._launchAssistActive=false; rocket._launchCompleted=true; rocket._launchFrameActive=false;
  }
  // 随速模式达到安全高度后一次性交还控制权。
  if(rocket._launchAssistActive&&!rocket.landed&&attMode===0&&launchAlt>=LAUNCH_LOCK_ALT){
    rocket._launchAssistActive=false; rocket._launchCompleted=true; rocket._launchFrameActive=false; rocket.av=0;
    if(attMode===0){
      velOffset=normalizeAngle(rocket.a-Math.atan2(rocket.vy,rocket.vx));
    }
    mission.toast='✅ 已脱离发射区｜转向控制已交给你'; mission.toastT=3;
  }

  // 转向：三种姿态模式（C 切换）。← = 逆时针。
  // 子弹时间方案1：旋转用实时 dtReal（不减速），仅灵敏度降低（rotScale），操作精细不超调
  const rotScale = bulletT>0 ? 0.58 : 1;
  // 卡顿恢复帧不得把几十毫秒的转向一次性结算，避免松手后姿态突然超调。
  const rdt = Math.min(dtReal,.02) * rotScale;
  const turnRateScale=1/Math.max(1,rocket.mass||1);
  const launchLocked=attMode===0&&rocket._launchAssistActive&&!rocket.landed&&rocket.body!==MOON;
  if(launchLocked){
    rocket.a=earthLocalUp; rocket.av=0; velOffset=0;
  }else if(attMode===0){
    // 随速偏转：机头 = 速度方向 + velOffset；←→ 直接调夹角（无惯性）
    if(keys['ArrowLeft']||keys['KeyA'])  velOffset -= ROT*rdt*turnRateScale;
    if(keys['ArrowRight']||keys['KeyD']) velOffset += ROT*rdt*turnRateScale;
    velOffset=normalizeAngle(velOffset);
    rocket.av=0;
    const localUpA=Math.atan2(rocket.y-EARTH.y,rocket.x-EARTH.x);
    // 第二关低速返回时以当前位置的“当地向上”为基准，不能沿用第一关发射台经度。
    const padA = level===2 || (rocket.landed && rocket.body===EARTH && rocket._clearedPad) ? localUpA : padAngle();
    if(rocket.landed){
      velOffset = 0;
      // 月面起降保留玩家自己的姿态；第四关没有“自动扶正”。
      if(!(level===4&&rocket.body===MOON)) rocket.a = padA;
    }else if(level===2 && mission.stage===2 && rocket.chute){
      // 最终开伞阶段固定使用当地向上，避免高速下降方向把机头重新吸向地面。
      rocket.a = localUpA + velOffset;
    }else if(level===4 && mission.stage>=2){
      // 月球附近按“相对月球速度”跟随，绝不吸附到当地垂直方向；玩家仍可自由调夹角。
      const ref=attitudeVelocity();
      if(Math.hypot(ref.vx,ref.vy)>1) rocket.a=Math.atan2(ref.vy,ref.vx)+velOffset;
    }else{
      // 低空跟踪相对地面的速度，高空跟踪轨道速度；不再混合当地垂直角，避免速度增长时缓慢漂移。
      const ref=attitudeVelocity(), refSpeed=Math.hypot(ref.vx,ref.vy);
      rocket.a=(refSpeed>1?Math.atan2(ref.vy,ref.vx):padA)+velOffset;
    }
  }else if(attMode===1){
    // 手动转向（v0.1 经典）：直接改角度，无惯性
    if(keys['ArrowLeft']||keys['KeyA'])  rocket.a -= ROT*rdt*turnRateScale;
    if(keys['ArrowRight']||keys['KeyD']) rocket.a += ROT*rdt*turnRateScale;
    rocket.av=0;
  }else{
    // 纯惯性：无阻尼，松手保持自旋。子弹时间内：角加速度降灵敏度（不累积惯量、不超调、退出不飘）
    if(keys['ArrowLeft']||keys['KeyA'])  rocket.av -= ROT_ACC*rdt*turnRateScale;
    if(keys['ArrowRight']||keys['KeyD']) rocket.av += ROT_ACC*rdt*turnRateScale;
    rocket.a += rocket.av*dtReal; // 自旋本身保持实时（不随子弹时间变慢）
  }

  const fx = Math.cos(rocket.a), fy = Math.sin(rocket.a);
  // 推进（辅助模式 = 无限燃料；第一关低空带防逃逸节流）
  const infiniteFuel = mission.assistMode && !mission.done;
  const waterdropBrakeControl=globalThis.SpaceGameShipSkins?.current?.()==='waterdrop';
  const forwardInput=!!(keys['ArrowUp']||keys['KeyW']),speedBeforeThrust=Math.hypot(rocket.vx,rocket.vy);
  rocket.braking=waterdropBrakeControl&&!!keys['KeyF']&&!rocket.landed&&speedBeforeThrust>1e-7&&(infiniteFuel||rocket.fuel>0);
  rocket.accelerating=forwardInput&&!rocket.braking&&(infiniteFuel||rocket.fuel>0);
  rocket.thrusting=rocket.accelerating||rocket.braking;
  rocket.thrustPower = 0;
  if(rocket.thrusting){
    if(rocket.accelerating)unlockAchievement('first_flame');
    if(level===9){const bm=blackHoleMetrics();if(bm.r<=270&&bm.r>BH_HORIZON+12)mission.blackHoleDeepBurn=true;}
    if(rocket.landed){ rocket.landed=false; rocket.body=null; launched=true; rocket.launchGrace=1.2; } // 起飞离地宽限
    let thrustPower=1;
    if(mission.assistMode && (level===1||level===3||level===4) && mission.stage===0){
      const rr=Math.hypot(rocket.x-EARTH.x,rocket.y-EARTH.y), alt=rr-EARTH.r;
      if(alt<140){
        const speedNow=Math.hypot(rocket.vx,rocket.vy), safeSpeed=0.78*Math.sqrt(2*EARTH.mu/rr);
        thrustPower=Math.max(0,Math.min(1,(safeSpeed-speedNow)/30));
        if(thrustPower<0.05){ thrustPower=0; mission.dynHint='辅助限速｜按住 D 逐渐向右转'; }
      }
    }
    rocket.thrustPower=thrustPower;
    // 推进属于玩家输入，单帧最多结算 20ms；掉帧时丢弃多余控制冲量，不在恢复后“补喷”。
    const thrustDt=Math.min(dt,.02);
    const fuelRate=(level===9?BH_FUEL_RATE:9)*SG_UPGRADES.fuelMultiplier(challengeMode);
    const poweredDt=infiniteFuel?thrustDt:Math.min(thrustDt,rocket.fuel/Math.max(.001,fuelRate*thrustPower));
    const thrustAccel=THRUST/Math.max(1,rocket.mass||1);
    if(rocket.braking){
      const brake=globalThis.SpaceGameShipSkills?.resolveWaterdropBrake?.({vx:rocket.vx,vy:rocket.vy,acceleration:thrustAccel*thrustPower,dt:poweredDt});
      if(brake?.ok){rocket.vx=brake.vx;rocket.vy=brake.vy;}
    }else{rocket.vx += fx*thrustAccel*thrustPower*poweredDt;rocket.vy += fy*thrustAccel*thrustPower*poweredDt;}
    if(!infiniteFuel){
      const fuelSpent=fuelRate*thrustPower*poweredDt;
      rocket.fuel=Math.max(0,rocket.fuel-fuelSpent); mission.fuelUsed+=fuelSpent;
    }
    // 固定“每秒”生成量，避免 8 倍速子步或低帧率时一帧生成几十个粒子。
    const visibleExhaust=rocket.accelerating&&!waterdropBrakeControl;
    exhaustAccumulator=visibleExhaust?Math.min(3,exhaustAccumulator+dtReal*(lowPowerMode?42:78)*thrustPower):0;
    const spawnCount=Math.floor(exhaustAccumulator),particleCap=lowPowerMode?(mobileEconomy?52:80):180;
    exhaustAccumulator-=spawnCount;
    for(let i=0;i<spawnCount&&particles.length<particleCap;i++) particles.push({
      x:rocket.x-fx*14+(Math.random()-.5)*5,y:rocket.y-fy*14+(Math.random()-.5)*5,
      vx:-fx*(60+Math.random()*40)+(Math.random()-.5)*25,vy:-fy*(60+Math.random()*40)+(Math.random()-.5)*25,
      life:Math.random()*.35+.15,c:['#ffb142','#ff7043','#fff3b0'][i%3]});
  }else{
    exhaustAccumulator=0;
  }

  // 引力（所有天体叠加）
  const gravity=SG_ORBIT.gravityAt(rocket.x,rocket.y,BODIES,0,gravityScratch);
  let ax=gravity.ax,ay=gravity.ay;
  if(level===7&&asteroid&&asteroid.alive&&!mission.asteroidContact){
    const dx=asteroid.x-rocket.x,dy=asteroid.y-rocket.y,d2=Math.max(1,dx*dx+dy*dy),d=Math.sqrt(d2),g=asteroid.mu/d2;
    ax+=dx/d*g;ay+=dy/d*g;
  }
  rocket.vx += ax*dt; rocket.vy += ay*dt;
  applyDockingAssist(dt);
  applyLagrangeAssist(dt);

  // 过载监测：点火时的推进加速度（点火期间重力被发动机抵消，不计入体感过载）
  const skillImpulseG=Math.max(0,Number(rocket.skillImpulseG)||0);
  const gNow = Math.max(rocket.thrusting ? THRUST/Math.max(1,rocket.mass||1)*rocket.thrustPower : 0,skillImpulseG);
  rocket.skillImpulseG=0;
  if(!rocket.landed) rocket.lastG = gNow; // 着陆时保留冲击读数
  rocket.maxG = Math.max(rocket.maxG, gNow);
  if(gNow >= G_BREAK){
    state='dead'; rocket.alive=false; boom(rocket.x, rocket.y);
    showMsg('💥','飞船解体！',`过载 ${(gNow/G_REF).toFixed(1)}G 超过结构极限 ${(G_BREAK/G_REF).toFixed(0)}G，船体撕裂`);
    return;
  }
  if(!rocket.crewDead){
    if(gNow > G_KILL){
      rocket.overT += dt;
      if(rocket.overT >= G_KILL_TIME) killCrew(`持续 ${(gNow/G_REF).toFixed(1)}G 过载（极限 ${(G_KILL/G_REF).toFixed(0)}G），船员失去生命迹象`);
    }else rocket.overT = 0;
  }

  // 着陆状态：随地球自转携带当地线速度（修复起飞"向后漂移"）
  if(rocket.landed){
    if(rocket.body===EARTH){
      const rr=EARTH.r+1;
      if(rocket._clearedPad&&!Number.isFinite(rocket.landLocalAngle)){
        rocket.landLocalAngle=normalizeAngle(Math.atan2(rocket.y-EARTH.y,rocket.x-EARTH.x)-earthAngle);
      }
      const groundAng=rocket._clearedPad?earthAngle+rocket.landLocalAngle:padAngle();
      rocket.x=EARTH.x+Math.cos(groundAng)*rr; rocket.y=EARTH.y+Math.sin(groundAng)*rr;
      rocket.vx=(EARTH.vx||0)-Math.sin(groundAng)*EARTH_OMEGA*rr;
      rocket.vy=(EARTH.vy||0)+Math.cos(groundAng)*EARTH_OMEGA*rr;
      rocket.launchBaseVx=rocket.vx; rocket.launchBaseVy=rocket.vy; rocket._launchFrameActive=true;
      rocket._launchAssistActive=true; rocket._launchCompleted=false;
    }else if(rocket.body===MOON){
      const groundAng=moonAngle+(rocket.landLocalAngle||0), rr=MOON.r+1;
      const dx=Math.cos(groundAng)*rr, dy=Math.sin(groundAng)*rr, sv=surfaceVelocity(MOON,dx,dy);
      rocket.x=MOON.x+dx; rocket.y=MOON.y+dy; rocket.vx=sv.vx; rocket.vy=sv.vy;
    }else{ rocket.vx=0; rocket.vy=0; }
    return;
  }
  if(rocket.launchGrace>0) rocket.launchGrace -= dt;
  if(rocket.asteroidGrace>0)rocket.asteroidGrace-=dt;
  rocket.x += rocket.vx*dt; rocket.y += rocket.vy*dt;
  // 黑洞关按远方观察者的真实取样节奏留下轨迹；运动越慢，轨迹点越密，冻结不只体现在数字上。
  trailSampleT+=level===9?observationDt:dt;
  const trailInterval=lowPowerMode?.075:.032;
  if(trail.length===0||trailSampleT>=trailInterval){ trail.push({x:rocket.x,y:rocket.y}); trailSampleT=0; }

  // 教学模式下，推进键就是精细机动键；发射锁定结束后，按住推进持续进入适度子弹时间。
  if(mission.assistMode && !mission.done && launched && state==='fly'){
    if(level!==9){
      if(rocket.thrusting&&!launchLocked) bulletT=.24;
    }
  }
  if(bulletT>0) bulletT=Math.max(0,bulletT-dtReal);
  if(trail.length>(lowPowerMode?(mobileEconomy?130:180):600)) trail.shift();

  // 第七关小行星接触：软着陆进入表面操作；高速接触则按动能撞击传递线动量与角动量。
  if(asteroidContactCheck())return;

  // 第九关没有“撞进黑洞”的爆炸画面：远方观察坐标中，最后信号冻结在视界之外。
  if(level===9){
    const m=blackHoleMetrics();
    if(m.r<=BH_HORIZON+8){freezeAtHorizon();return;}
    rocket._tooFar=false;return;
  }

  // 碰撞检测（起飞宽限期内跳过，避免点火瞬间误判）
  for(const b of BODIES){
    if(rocket.launchGrace>0 && b===EARTH) continue;
    const dx=rocket.x-b.x, dy=rocket.y-b.y, d=Math.hypot(dx,dy);
    const centerVx=rocket.vx-(b.vx||0), centerVy=rocket.vy-(b.vy||0);
    const vOut=(centerVx*dx+centerVy*dy)/d; // 相对天体质心的径向速度（正=远离）
    const v = Math.hypot(rocket.vx, rocket.vy);
    const alt = d - b.r;
    // 着陆判定使用相对地表速度：扣除天体公转、以及当地自转/潮汐锁定的线速度。
    const surfaceV=surfaceVelocity(b,dx,dy);
    let groundVx = rocket.vx-surfaceV.vx, groundVy = rocket.vy-surfaceV.vy;
    const vRel = Math.hypot(groundVx, groundVy);
    const hullLandingMultiplier=globalThis.SpaceGameShipSkills?.landingMultiplier?.()||1;
    const landingLimit=b.landMax*SG_UPGRADES.landingMultiplier(challengeMode)*hullLandingMultiplier;

    // 恒星不是可着陆天体：进入光球表面立即判定烧毁，避免低速时被通用着陆逻辑“停”在太阳上。
    if((level===8||level===10)&&b.isStar&&alt<=RING_OUT){
      state='dead';rocket.alive=false;boom(rocket.x,rocket.y);
      if(mission.assistMode)retryTimer=setTimeout(()=>retryFromStage('进入恒星表面'),1000);
      else showMsg('☀️','飞船被恒星吞没！',`距离${b.name}太近。${level===10?'本局时间线在这里终止。':'按 R 重来'}`);
      return;
    }

    // ---- 降落伞（仅第二关、由玩家在低空窗口点击任务按钮打开）----
    if(rocket.chute && b===EARTH && !rocket.landed){
      const target = alt > 120 ? CHUTE_FAST_V : CHUTE_SLOW_V;
      if(vRel > target){
        // 阻力沿"相对空气速度"的反方向施加（空气随地球自转）
        const k = vRel > CHUTE_FAST_V ? 3.2 : 1.4;
        const dec = Math.min(vRel - target, k*vRel*dt + 40*dt);
        const dragAx = -groundVx/vRel * dec/dt; // 减速度方向 = 相对速度反方向
        const dragAy = -groundVy/vRel * dec/dt;
        rocket.vx += dragAx*dt; rocket.vy += dragAy*dt;
      }
      // 伞只抑制自旋，不再强行扭转机头；反推与姿态控制不会互相打架。
      rocket.av *= Math.max(0,1-1.8*dt);
      // 相对气流先低通滤波，再限速转动伞面，避免反推时速度过零造成 180° 翻转。
      const flowBlend=1-Math.exp(-2.4*dt);
      rocket.chuteFlowX+=(groundVx-rocket.chuteFlowX)*flowBlend;
      rocket.chuteFlowY+=(groundVy-rocket.chuteFlowY)*flowBlend;
      const desired=chuteCanopyAngle(rocket.chuteFlowX,rocket.chuteFlowY,dx/d,dy/d);
      if(!Number.isFinite(rocket.chuteAngle)) rocket.chuteAngle=desired;
      let chuteDelta=desired-rocket.chuteAngle;
      while(chuteDelta>Math.PI)chuteDelta-=TAU; while(chuteDelta<-Math.PI)chuteDelta+=TAU;
      const maxChuteTurn=1.25*dt;
      rocket.chuteAngle+=Math.max(-maxChuteTurn,Math.min(maxChuteTurn,chuteDelta*flowBlend));
    }

    // ---- 细环形着陆判定（用相对速度 vRel）----
    const inRing = alt <= RING_OUT && alt >= -RING_IN; // 环形带内
    // 冲到内圈 = 撞地失败
    if(alt < -RING_IN && vOut <= 0){
      const gImpact = vRel / 0.25;
      rocket.maxG = Math.max(rocket.maxG, gImpact); rocket.lastG = gImpact;
      state='dead'; rocket.alive=false; boom(rocket.x, rocket.y);
      if(!mission.assistMode){
        showMsg('💥','撞击解体！',`撞击速度 ${vRel.toFixed(1)} u/s。按 R 重来`);
      }else{
        retryTimer=setTimeout(()=>retryFromStage('撞到地面'), 1000);
      }
      return;
    }
    // 环形带内且相对速度足够低 = 着陆成功（触地停住）
    // 防护：起飞后必须先飞离低空（_clearedPad）才允许判定着陆，避免起飞爬升/回落误判打断
    if(alt > 60) rocket._clearedPad = true;
    if(inRing && vOut <= 0 && vRel <= landingLimit && rocket._clearedPad){
      const gImpact = vRel / 0.25;
      rocket.maxG = Math.max(rocket.maxG, gImpact); rocket.lastG = gImpact;
      if(gImpact > G_KILL) killCrew(`着陆冲击 ${(gImpact/G_REF).toFixed(1)}G 过载，船员失去生命迹象`);
      // 把火箭放到地表
      rocket.landed=true; rocket.body=b;
      rocket.x = b.x + dx/d*(b.r+1); rocket.y = b.y + dy/d*(b.r+1);
      rocket.vx=surfaceV.vx; rocket.vy=surfaceV.vy;
      if(!(level===4&&b===MOON)) rocket.a = Math.atan2(dy,dx);
      if(b===EARTH) rocket.landLocalAngle=normalizeAngle(Math.atan2(dy,dx)-earthAngle);
      rocket.chute = false;
      handleTouchdownOutcome(b,dx,dy,vRel);
      return;
    }
    // 环形带内但速度仍高：给提示（不判定），等它减速或冲内圈
    if(inRing && vOut <= 0 && vRel > landingLimit && !rocket.landed){
      if(mission.assistMode && !mission.done){
        const landingFrame=b===MOON?'月面':b===EARTH&&level===8?'晨曦星地表':'地表';
        mission.toast=`⚠️ 相对速度·${landingFrame}过快！继续减速`; mission.toastT=0.6;
      }
    }
  }
  // 飞出太远：新手模式只提醒（画面变暗+提示），不强制重置；跳过指引才判死
  const systemCenter=level===10?threeBodyBarycenter():null;
  const distEarth = level===10?Math.hypot(rocket.x-systemCenter.x,rocket.y-systemCenter.y):level===8?Math.hypot(rocket.x,rocket.y):Math.hypot(rocket.x-EARTH.x, rocket.y-EARTH.y);
  rocket._tooFar = distEarth > (level===10?6500:level===8?10000:12000); // 双星/三体关以系统质心为参考
  if(distEarth > (level===10?30000:level===8?80000:150000)){
    if(!mission.assistMode || mission.done){ state='dead'; showMsg('🛰️','迷失深空…','飞得太远了，按 R 重来'); }
  }
}

function runPhysicsSelfChecks(){
  const v=EARTH_OMEGA*R_GEO;
  const prograde={x:EARTH.x+R_GEO,y:EARTH.y,vx:0,vy:v};
  const retrograde={x:EARTH.x+R_GEO,y:EARTH.y,vx:0,vy:-v};
  const wrongSpeed={x:EARTH.x+R_GEO,y:EARTH.y,vx:0,vy:v*0.78};
  const pro=syncOrbitStatus(prograde), retro=syncOrbitStatus(retrograde), wrong=syncOrbitStatus(wrongSpeed);
  const period=TAU/EARTH_OMEGA, horizon=predictPath(prograde).horizon;
  const pinch={startZoom:1.2,startDistance:100,distance:200,worldX:340,worldY:-80,midX:240,midY:360,width:390,height:844};
  const pinchZoom=pinch.startZoom*pinch.distance/pinch.startDistance;
  const pinchCamX=pinch.worldX-(pinch.midX-pinch.width/2)/pinchZoom;
  const pinchCamY=pinch.worldY-(pinch.midY-pinch.height/2)/pinchZoom;
  const anchorScreenX=(pinch.worldX-pinchCamX)*pinchZoom+pinch.width/2;
  const anchorScreenY=(pinch.worldY-pinchCamY)*pinchZoom+pinch.height/2;
  const canopyAngle=chuteCanopyAngle(40,0,1,0);
  const canopyOutwardDot=Math.cos(canopyAngle);
  return {progradeAccepted:pro.ok,retrogradeRejected:!retro.ok,wrongSpeedRejected:!wrong.ok,
    predictionCoversOrbit:horizon>=period,pinchZoomScales:Math.abs(pinchZoom-2.4)<1e-9,
    pinchAnchorStable:Math.hypot(anchorScreenX-pinch.midX,anchorScreenY-pinch.midY)<1e-9,
    chuteRemainsOutward:canopyOutwardDot>=0.35,period,horizon};
}
