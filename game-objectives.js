"use strict";

// Mission action availability, stage progression, outcome validation and scoring for all ten levels.
// Physics integration, checkpoints, input listeners, HUD/menu rendering, persistence primitives and animation scheduling stay in their owning layers.

function missionActionState(){
  if(!mission||mission.done||state!=='fly') return {visible:false};
  if(level===7&&mission.asteroidContact){
    return mission.asteroidAnchored
      ?{visible:true,icon:'🔓',label:'解除锚定',aria:'解除小行星锚定并离开表面'}
      :{visible:true,icon:'⚓',label:'锚定并翻转',aria:'锚定小行星并把火箭机头翻向表面'};
  }
  if(rocket.landed) return {visible:false};
  if(level===1&&mission.deployReady&&directSyncStatus(rocket,1).ok) return {visible:true,icon:'🛰',label:'释放卫星',aria:'释放同步卫星'};
  if(level===2&&!rocket.chute){
    const dx=rocket.x-EARTH.x,dy=rocket.y-EARTH.y,d=Math.hypot(dx,dy),alt=d-EARTH.r;
    const rvx=rocket.vx-(EARTH.vx||0),rvy=rocket.vy-(EARTH.vy||0),vOut=(rvx*dx+rvy*dy)/Math.max(1,d);
    if(alt>0&&alt<=CHUTE_ALT&&vOut<0) return {visible:true,icon:'🪂',label:'打开降落伞',aria:'打开返回舱降落伞'};
  }
  if((level===3||level===8)&&mission.dockReady) return {visible:true,icon:'🧩',label:'执行对接',aria:'执行空间站对接'};
  return {visible:false};
}
function handleTouchdownOutcome(b,dx,dy,vRel){
      if(level===2 && b===EARTH){
        let ang = Math.atan2(dy,dx) - landAngle();
        while(ang>Math.PI)ang-=TAU; while(ang<-Math.PI)ang+=TAU;
        const inZone = Math.abs(ang) <= LAND_HALF;
        state='win'; mission.done = true;
        const starResult=evaluateStars([
          {ok:!mission.usedChute,label:'全程不使用降落伞'},
          {ok:inZone,label:'精确落入绿色着陆区'}
        ]);
        const result=saveLevelResult(2,performanceScore(),starResult.stars);
        showMsg(inZone?'🌟':'🎉',
          inZone?'完美着陆！精准落入着陆区':'着陆成功！',
          resultLine(result)+`载人返回舱安全着陆<br>` +
          `相对速度·地表 ${vRel.toFixed(1)} u/s · ${performanceDetail()}<br>`+
          `${starBreakdownHtml(starResult)}<br><span style="color:#888">不开伞难度很高，但挑战燃料已为全程动力减速留出余量。</span>`);
        return;
      }
      if(level===4 && b===MOON){
        const touchdownAngle=Math.atan2(dy,dx);
        rocket.landLocalAngle=normalizeAngle(touchdownAngle-moonAngle);
        const farSide=Math.abs(rocket.landLocalAngle)<Math.PI/2;
        const perfect=Math.abs(rocket.landLocalAngle)<=MOON_TARGET_HALF;
        if(farSide){
          state='win'; mission.done=true;
          const remaining=challengeRemainingFuel(),starResult=evaluateStars([
            {ok:perfect,label:'精确落入绿色月背中央区'},
            {ok:remaining>=CHALLENGE_CONFIG[4].fuelStar,label:`燃料剩余至少 ${CHALLENGE_CONFIG[4].fuelStar}%`}
          ]);
          const result=saveLevelResult(4,performanceScore(),starResult.stars);
          showMsg(perfect?'🌟':'🌘',perfect?'月背中央精准着陆！':'月背着陆成功！',
            resultLine(result)+`无降落伞动力着陆完成<br>`+
            `相对速度·月面 ${vRel.toFixed(1)} u/s · ${performanceDetail()}<br>`+
            `${starBreakdownHtml(starResult)}<br><span style="color:#888">月球公转一圈时，也恰好自转一圈。</span>`);
        }else{
          mission.toast='🌍 这里仍朝向地球｜请重新起飞绕到绿色月背'; mission.toastT=5;
          // 挑战模式不补发燃料，避免反复落在近侧刷回推进剂；教学模式本来就是无限燃料。
        }
        return;
      }
      if(b===MARS){
        state='win';
        const s = calcScore();
        showMsg(rocket.crewDead?'🛬':'🎉',
          rocket.crewDead ? '抵达火星（无人生还）' : `登陆火星成功！评级 ${s.grade}`,
          `评分 <b style="font-size:24px">${s.score}</b>（${s.grade}）<br>耗时 ${s.time}s · 剩余燃料 ${s.fuel}% · 峰值过载 ${s.maxG}G<br><span style="color:#888">${s.note}</span>`);
      }else{
        // 教学模式可无压力重新起飞；挑战模式绝不通过着陆补回燃料。
        if(mission.assistMode) rocket.fuel=Math.min(100,rocket.fuel+(b===EARTH?100:20));
      }
}

function finishDocking(){
  if((level!==3&&level!==8)||!station||mission.done) return;
  const metrics=stationMetrics();
  station.docked=true; mission.done=true; state='complete';
  if(typeof SG_AUDIO!=='undefined') SG_AUDIO.sfx('dock');
  rocket.x=station.x; rocket.y=station.y; rocket.vx=station.vx; rocket.vy=station.vy; rocket.a=station.a;
  if(level===8){
    const remaining=challengeRemainingFuel(),starResult=evaluateStars([
      {ok:!mission.binaryHeatViolated,label:'全程避开两颗恒星的高温区'},
      {ok:remaining>=CHALLENGE_CONFIG[8].fuelStar,label:`燃料剩余至少 ${CHALLENGE_CONFIG[8].fuelStar}%`}
    ]);
    const result=saveLevelResult(8,performanceScore(),starResult.stars),bm=binaryMetrics();
    syncUI();
    showMsg('☀️','双星摆渡成功！',
      resultLine(result)+`已穿越双星引力通道并被暮光星 B 捕获<br>`+
      `最终对接距离 ${metrics.distance.toFixed(1)} u · 相对速度·暮光站 ${metrics.relSpeed.toFixed(1)} u/s<br>`+
      `目标星轨道能量 ${bm.targetEnergy.toFixed(0)} u²/s² · ${performanceDetail()}<br>${starBreakdownHtml(starResult)}<br>`+
      `<span style="color:#888">两颗恒星始终共同绕质心运动；你不是飞向一个静止目标，而是在两个移动引力势阱之间完成摆渡。</span>`);
    return;
  }
  const remaining=challengeRemainingFuel(),starResult=evaluateStars([
    {ok:true,label:'重载货运火箭完成对接：挑战奖励星'},
    {ok:remaining>=CHALLENGE_CONFIG[3].fuelStar,label:`燃料剩余至少 ${CHALLENGE_CONFIG[3].fuelStar}%`}
  ]);
  const result=saveLevelResult(3,performanceScore(),starResult.stars);
  syncUI();
  showMsg('🧩',challengeMode?'重载货运对接成功！':'空间站对接成功！',
    resultLine(result)+`捕获距离 ${metrics.distance.toFixed(1)} u · 相对速度·空间站 ${metrics.relSpeed.toFixed(1)} u/s<br>`+
    `${performanceDetail()}<br>${starBreakdownHtml(starResult)}<br><span style="color:#888">挑战火箭装载更多物资，质量为普通火箭的 1.2 倍；推力不变，因此加速和转向都更慢。</span>`);
}

function tryDeploy(){
  if(level!==1 || !mission || mission.done || !mission.deployReady || state!=='fly' || rocket.landed) return;
  const releaseStatus=directSyncStatus(rocket,1);
  if(!releaseStatus.ok){
    mission.toast=releaseStatus.inBand?'⚠️ 仍在同步带内，但速度或升降率还不稳定':'⚠️ 已离开绿色同步带，返回带内稳定后再释放';
    mission.toastT=3; mission.deployReady=false; syncUI(); return;
  }
  const d = Math.hypot(rocket.x-EARTH.x, rocket.y-EARTH.y);
  let ang = Math.atan2(rocket.y-EARTH.y, rocket.x-EARTH.x) - padAngle();
  while(ang>Math.PI) ang-=TAU; while(ang<-Math.PI) ang+=TAU;
  const sync=syncOrbitStatus(rocket,mission.assistMode?1.6:1);
  const inSlot = Math.abs(ang)<=SLOT_HALF;
  mission.satReleased = true; mission.done = true;
  mission.satellite={x:rocket.x,y:rocket.y,vx:rocket.vx,vy:rocket.vy,releaseAngle:Math.atan2(rocket.y-EARTH.y,rocket.x-EARTH.x)};
  state='complete';
  if(typeof SG_AUDIO!=='undefined') SG_AUDIO.sfx('deploy');
  syncUI();
  const remaining=challengeRemainingFuel(),starResult=evaluateStars([
    {ok:inSlot,label:'在绿色目标经度内释放'},
    {ok:remaining>=CHALLENGE_CONFIG[1].fuelStar,label:`燃料剩余至少 ${CHALLENGE_CONFIG[1].fuelStar}%`}
  ]);
  const result=saveLevelResult(1,performanceScore(),starResult.stars);
  showMsg(inSlot?'🛰️':'🎉',
    inSlot?'目标经度部署成功！':'地球静止轨道部署成功！',
    resultLine(result)+`已形成顺行同步轨道（缩比高度 ${(d-EARTH.r).toFixed(0)} u）<br>` +
    `当前同步残差 ${sync.residual.toFixed(4)} rad/s · ${performanceDetail()}<br>`+
    `${starBreakdownHtml(starResult)}<br><span style="color:#888">R 从头再来 · L 下一关</span>`);
}
function tryOpenChute(){
  if(level!==2||!mission||mission.done||state!=='fly'||rocket.landed||rocket.chute) return;
  const dx=rocket.x-EARTH.x,dy=rocket.y-EARTH.y,d=Math.hypot(dx,dy),alt=d-EARTH.r;
  const centerVx=rocket.vx-(EARTH.vx||0),centerVy=rocket.vy-(EARTH.vy||0),vOut=(centerVx*dx+centerVy*dy)/Math.max(1,d);
  if(alt>CHUTE_ALT||alt<=0||vOut>=0){ mission.toast=alt>CHUTE_ALT?'🪂 高度还太高，继续下降':'🪂 需要处于下降状态才能开伞'; mission.toastT=2; return; }
  const surfaceV=surfaceVelocity(EARTH,dx,dy),groundVx=rocket.vx-surfaceV.vx,groundVy=rocket.vy-surfaceV.vy;
  mission.usedChute=true;
  rocket.chute=true; rocket.chuteFlowX=groundVx; rocket.chuteFlowY=groundVy;
  if(typeof SG_AUDIO!=='undefined') SG_AUDIO.sfx('chute');
  if(typeof unlockAchievement==='function')unlockAchievement('silk_wings');
  rocket.chuteAngle=chuteCanopyAngle(groundVx,groundVy,dx/d,dy/d);
  if(mission.stage<2) unlockFinalStage(2,'🪂 降落伞已打开！控制姿态并准备缓冲');
  else{ mission.toast='🪂 降落伞已打开！'; mission.toastT=2.5; syncUI(); }
}
function tryDock(){
  if((level!==3&&level!==8)||!mission||mission.done||state!=='fly'||!mission.dockReady) return;
  if(level===8){
    const m=stationMetrics(),distanceLimit=mission.assistMode?46:36,speedLimit=mission.assistMode?13:9;
    if(m.distance>=distanceLimit||m.relSpeed>=speedLimit){
      const dockingFrame=level===8?'暮光站':'空间站';
      mission.dockReady=false;mission.toast=`对接口已错开｜先靠近并降低相对速度·${dockingFrame}`;mission.toastT=3;syncUI();return;
    }
  }
  finishDocking();
}
function toggleAsteroidAnchor(){
  if(level!==7||!asteroid||!mission.asteroidContact||mission.done||state!=='fly')return;
  const wasAnchored=mission.asteroidAnchored;
  const ux=Math.cos(mission.asteroidMountAngle),uy=Math.sin(mission.asteroidMountAngle);
  if(mission.asteroidAnchored){
    mission.asteroidAnchored=false;mission.asteroidContact=false;
    rocket.landed=false;rocket.body=null;rocket.asteroidGrace=.8;
    rocket.x=asteroid.x+ux*(asteroid.r+36);rocket.y=asteroid.y+uy*(asteroid.r+36);
    const releaseSpeed=Math.sqrt(2*asteroid.mu/asteroid.r)+4;
    rocket.vx=asteroid.vx+ux*releaseSpeed;rocket.vy=asteroid.vy+uy*releaseSpeed;rocket.av=0;
    mission.toast='🔓 已解除锚定｜左右键恢复飞船转向，可换位置再次靠近';mission.toastT=4;
  }else{
    mission.asteroidAnchored=true;mission.hingeAngle=0;rocket.av=0;
    rocket.a=mission.asteroidMountAngle+Math.PI;
    if(mission.stage<3)unlockFinalStage(3,'⚓ 已锚定并翻转！左右调铰链，推进改变小行星轨道');
    else{mission.toast='⚓ 已锚定｜机头向下，发动机向外';mission.toastT=3;}
  }
  if(typeof SG_AUDIO!=='undefined') SG_AUDIO.sfx(wasAnchored?'release':'anchor');
  syncUI();
}
function finishLagrange(m=nearestLagrangeMetrics()){
  if(level!==6||!mission||mission.done||state!=='fly'||rocket.landed) return;
  const distanceLimit=mission.assistMode?220:140,speedLimit=mission.assistMode?16:10;
  if(m.distance>=distanceLimit||m.relSpeed>=speedLimit) return;
  const id=m.point.id,meta=LAGRANGE_META[id];
  mission.lagrangeTarget=id;
  mission.done=true; mission.satReleased=true; state='complete';
  mission.satellite={x:rocket.x,y:rocket.y,vx:rocket.vx,vy:rocket.vy,lagrange:id};
  const starResult=evaluateStars([{ok:true,label:`实际抵达 L${id}：${'★'.repeat(meta.stars)}`}],meta.stars);
  const result=saveLevelResult(6,performanceScore(),starResult.stars);
  syncUI();
  showMsg('⚖️',`L${id} 平衡点部署成功！`,
    resultLine(result)+`目标难度 ${'★'.repeat(meta.stars)}${'☆'.repeat(3-meta.stars)} · ${meta.label}<br>`+
    `部署距离误差 ${m.distance.toFixed(1)} u · 相对速度·目标点 ${m.relSpeed.toFixed(1)} u/s<br>`+
    `${performanceDetail()}<br>${starBreakdownHtml(starResult)}<br>`+
    `<span style="color:#888">挑战模式只由实际抵达点决定星级；时间和燃料仅计算分数。L2/L3 的 100% 燃料预算包含充足修正余量。</span>`);
}
function tryMissionAction(){
  if(level===1) tryDeploy();
  else if(level===2) tryOpenChute();
  else if(level===3) tryDock();
  else if(level===7) toggleAsteroidAnchor();
  else if(level===8) tryDock();
}

function freezeAtHorizon(){
  if(level!==9||!blackHole||blackHole.frozen)return;
  blackHole.frozen=true;mission.blackHoleFrozen=true;state='horizon';SG_INPUT.clear();
  const m=blackHoleMetrics(),d=Math.max(1,Math.hypot(m.dx,m.dy));rocket.x=EARTH.x+m.dx/d*(BH_HORIZON+4);rocket.y=EARTH.y+m.dy/d*(BH_HORIZON+4);
  mission.toast='';syncUI();
  showMsg('⌛','最后一束光停在了视界上',
    `<b style="font-size:20px">飞船没有坠毁，但是你等不到它出来的那一天了。</b><br><br>`+
    `远方任务时间 ${blackHole.farTime.toFixed(1)} s · 飞船固有时间 ${blackHole.properTime.toFixed(1)} s<br>`+
    `<span style="color:#888">从远方看，信号间隔被无限拉长、颜色不断红移，飞船的最后影像像被冻结；对飞船自己而言，它会在有限固有时间内越过视界。按 R 回到本阶段，再早一点顺向点火。</span>`);
}
function finishBlackHoleEscape(m=blackHoleMetrics()){
  if(level!==9||mission.done)return;
  mission.done=true;state='complete';
  const remaining=challengeRemainingFuel(),deep=mission.blackHoleDeepBurn&&mission.blackHoleMinR<=270&&mission.blackHoleMinR>BH_HORIZON+12;
  const starResult=evaluateStars([
    {ok:deep,label:'在半径 270 u 内完成深渊点火'},
    {ok:remaining>=CHALLENGE_CONFIG[9].fuelStar,label:`燃料剩余至少 ${CHALLENGE_CONFIG[9].fuelStar}%`}
  ]);
  const result=saveLevelResult(9,performanceScore(),starResult.stars),vInf=Math.sqrt(Math.max(0,2*m.energy));
  syncUI();showMsg('🌌','已从黑洞深渊返回！',
    resultLine(result)+`向外穿过绿色救援门 · 逃逸余速 v∞ ${vInf.toFixed(1)} u/s<br>`+
    `最近半径 ${mission.blackHoleMinR.toFixed(0)} u · 飞船时间 ${blackHole.properTime.toFixed(1)} s · 远方时间 ${blackHole.farTime.toFixed(1)} s<br>`+
    `${performanceDetail()}<br>${starBreakdownHtml(starResult)}<br>`+
    `<span style="color:#888">你利用的是近点高速下的奥伯特效应。双时钟之差表现引力时间膨胀；视界冻结则采用远方观察者的坐标图景。</span>`);
}
function failBlackHoleEscape(m=blackHoleMetrics()){
  if(level!==9||mission.done||mission.blackHoleExitFailed)return;
  mission.blackHoleExitFailed=true;state='failed';SG_INPUT.clear();syncUI();
  const deficit=Math.abs(Math.min(0,m.energy)),apo=m.energy<0?-BH_MU/m.energy:Infinity;
  showMsg('↩️','穿过救援圈，但还会掉回来',
    `<b style="font-size:19px">飞船到了绿色圈外，却没有获得真正的逃逸能量。</b><br><br>`+
    `当前逃逸能量 ${m.energy.toFixed(0)} · 束缚轨道尺度 ${Number.isFinite(apo)?apo.toFixed(0):'未知'} u<br>`+
    `<span style="color:#888">距离并不等于逃逸：能量仍差 ${deficit.toFixed(0)}，轨道最终会转头落回黑洞。按 R 回到近点点火阶段，尽量在紫色区域顺着速度方向推进。</span>`);
}
function updateMissionL9(dt){
  if(!blackHole)return;
  const m=blackHoleMetrics();mission.blackHoleMinR=Math.min(mission.blackHoleMinR,m.r);blackHole.minRadius=Math.min(blackHole.minRadius,m.r);
  const crossedOut=m.r>=BH_ESCAPE_R&&m.radial>0;
  if(crossedOut&&m.energy>0){finishBlackHoleEscape(m);return;}
  if(crossedOut){
    mission.blackHoleInvalidExitT+=dt;
    mission.dynHint=`还会掉回来｜逃逸能量 ${m.energy.toFixed(0)}`;
    if(mission.blackHoleInvalidExitT>=1)failBlackHoleEscape(m);
    return;
  }
  mission.blackHoleInvalidExitT=0;
  if(mission.stage===0){
    mission.dynHint=`停火下潜｜距视界 ${m.alt.toFixed(0)}`;
    if(m.r<BH_BURN_R+90){advanceStage();return;}
  }else if(mission.stage===1){
    const burnCue=m.r<=270?'现在顺向点火':'继续关机下潜';
    mission.dynHint=`${burnCue}｜逃逸能量 ${m.energy.toFixed(0)}`;
    if(m.energy>0){mission.blackHoleEscaping=true;advanceStage();return;}
  }else mission.dynHint=`飞向绿色救援圈｜还差 ${Math.max(0,BH_ESCAPE_R-m.r).toFixed(0)}`;
}
function finishThreeBodyCrossing(m=threeBodyMetrics()){
  if(level!==10||mission.done)return;
  mission.done=true;state='complete';
  const remaining=challengeRemainingFuel(),safe=!mission.threeDangerViolated,rescuedCount=(mission.threeRescued||[]).filter(Boolean).length,destroyedCount=(mission.threeDestroyed||[]).filter(Boolean).length;
  const starResult=evaluateStars([
    {ok:safe,label:'全程没有进入红色潮汐危险圈'},
    {ok:remaining>=CHALLENGE_CONFIG[10].fuelStar,label:`燃料剩余至少 ${CHALLENGE_CONFIG[10].fuelStar}%`}
  ]);
  const result=saveLevelResult(10,performanceScore(),starResult.stars,{saveScore:threeBodySeedMode==='random'}),seed=formatThreeBodySeed(mission.threeSeed);
  const restartNote=threeBodySeedMode==='fixed'?'固定种子练习：整关重来保持同一宇宙；本局星级正常结算，分数不计入最高分。':'随机种子模式：整关重来会扰动三颗恒星的初始条件，本局成绩可计入最高分。';
  syncUI();showMsg(destroyedCount?'🚀':'🆘',destroyedCount?'幸存者撤离完成！':'三体救援成功！',
    resultLine(result)+`成功营救 ${rescuedCount} 艘 · 损失 ${destroyedCount} 艘 · 本局种子 <b>${seed}</b><br>最近恒星净空 ${mission.threeMinClearance.toFixed(0)} u<br>`+
    `${performanceDetail()}<br>${starBreakdownHtml(starResult)}<br>`+
    `<span style="color:#888">${restartNote}</span>`);
}
function failThreeBodyRescue(){
  if(level!==10||mission.done||state==='dead')return;
  state='dead';mission.failed=true;syncUI();
  showMsg('☀️','两艘求救飞船均已坠毁',`三颗恒星的引力吞没了最后的求救信号。<br><span style="color:#888">按 R 回到本阶段，或在暂停菜单重新开始整关。</span>`);
}
function beginThreeBodyEscapePhase(message){
  if(mission.stage<2){mission.stage=2;saveCheckpoint();}
  mission.toast=message;mission.toastT=4;
}
function updateMissionL10(dt){
  if(!threeBody)return;
  const m=threeBodyMetrics();
  mission.threeMinClearance=Math.min(mission.threeMinClearance,m.clearance);
  if(m.clearance<THREE_DANGER_PAD)mission.threeDangerViolated=true;
  if(!Array.isArray(mission.threeDestroyed))mission.threeDestroyed=[false,false];
  for(let index=0;index<2;index++){
    const lost=isThreeBodyShipDestroyed(index);
    if(lost&&!mission.threeDestroyed[index]){
      mission.threeDestroyed[index]=true;
      mission.toast=`☀️ 求救飞船 ${index?'B':'A'} 已坠入恒星｜另一艘仍可营救`;mission.toastT=5;
    }
  }
  const destroyedCount=mission.threeDestroyed.filter(Boolean).length,rescuedCount=(mission.threeRescued||[]).filter(Boolean).length;
  if(destroyedCount>=2){failThreeBodyRescue();return;}
  if(mission.stage<2){
    if(!Array.isArray(mission.threeRescued))mission.threeRescued=[false,false];
    if(!Array.isArray(mission.threeRescueOrder))mission.threeRescueOrder=[];
    const candidates=[0,1].filter(index=>!mission.threeRescued[index]&&!mission.threeDestroyed[index]).map(index=>threeBodyRescueMetrics(index));
    const target=candidates.slice().sort((a,b)=>a.distance-b.distance)[0];
    if(!target){if(rescuedCount>0)beginThreeBodyEscapePhase('✅ 已救出幸存船员｜现在带他们逃出去');return;}
    const shipName=target.index===0?'A':'B',choiceText=mission.stage===0?'任选一艘｜':'';
    mission.dynHint=target.distance<=THREE_GATE_R&&target.relSpeed>THREE_RESCUE_SPEED
      ? `${choiceText}已靠近 ${shipName}｜轻点反推，相对速度·求救飞船 ${target.relSpeed.toFixed(0)}/${THREE_RESCUE_SPEED}`
      : `${choiceText}最近是 ${shipName}｜距离 ${target.distance.toFixed(0)}｜相对速度·求救飞船 ${target.relSpeed.toFixed(0)}`;
    const rescued=candidates.filter(item=>item.distance<=THREE_GATE_R&&item.relSpeed<=THREE_RESCUE_SPEED).sort((a,b)=>a.distance-b.distance)[0];
    if(rescued){
      mission.threeRescued[rescued.index]=true;
      const rescuedShip=threeBody.rescueShips?.[rescued.index];if(rescuedShip){rescuedShip.rescued=true;rescuedShip.alive=false;}
      mission.threeRescueOrder.push(rescued.index);
      mission.threeGateIndex=mission.threeRescueOrder.length;
      advanceStage();
      const rescuedName=rescued.index===0?'A':'B',remainingName=rescued.index===0?'B':'A';
      const unresolved=[0,1].filter(index=>!mission.threeRescued[index]&&!mission.threeDestroyed[index]);
      if(!unresolved.length)beginThreeBodyEscapePhase(mission.threeDestroyed.some(Boolean)?'✅ 幸存船员已获救｜现在带他们逃出去':'✅ 两批船员都已获救｜现在带他们逃出去');
      else mission.toast=`✅ 求救飞船 ${rescuedName} 的船员已获救｜接着去 ${remainingName}`;
      mission.toastT=4;
    }
    return;
  }
  const outward=m.r>=THREE_ESCAPE_R&&m.radial>12;
  mission.threeEscapeT=outward?mission.threeEscapeT+dt:0;
  mission.dynHint=`飞出绿色圈｜还差 ${Math.max(0,THREE_ESCAPE_R-m.r).toFixed(0)}｜稳定 ${mission.threeEscapeT.toFixed(1)}/1.2s`;
  if(mission.threeEscapeT>=1.2)finishThreeBodyCrossing(m);
}

// 任务阶段推进（每帧调用）
function updateMission(dt){
  if(!mission || mission.done || state!=='fly' || !launched) return;
  if(level===10){ updateMissionL10(dt); return; }
  if(level===2){ updateMissionL2(dt); return; }
  if(level===3){ updateMissionL3(dt); return; }
  if(level===4){ updateMissionL4(dt); return; }
  if(level===5){ updateMissionL5(dt); return; }
  if(level===6){ updateMissionL6(dt); return; }
  if(level===7){ updateMissionL7(dt); return; }
  if(level===8){ updateMissionL8(dt); return; }
  if(level===9){ updateMissionL9(dt); return; }
  if(rocket.landed) return;
  const direct=directSyncStatus(rocket,1);
  if(mission.stage<3){
    mission.finalHoldT=direct.ok?mission.finalHoldT+dt:0;
    if(mission.finalHoldT>=1.5){
      mission.deployReady=true;
      unlockFinalStage(3,'✅ 已直接抵达同步带！现在可以释放卫星');
      return;
    }
  }
  const ap = orbitApsis();
  const need = [1.3, 0, 1.3][mission.stage];
  let ok = false;
  let dyn = '';
  if(mission.stage===0){ // ① 顺行稳定近圆轨道
    const alt = ap.r - EARTH.r;
    const speed=Math.hypot(rocket.vx,rocket.vy), escapeSpeed=Math.sqrt(2*EARTH.mu/ap.r);
    const dx=rocket.x-EARTH.x, dy=rocket.y-EARTH.y, vRad=(rocket.vx*dx+rocket.vy*dy)/ap.r;
    const omega=orbitalAngularRate();
    ok = ap.bound && omega>0 && ap.rp>EARTH.r+25 && ap.ra<R_GEO+GEO_BAND && (ap.ra-ap.rp)/ap.rp<0.40;
    if(rocket._launchAssistActive&&attMode===0) dyn=`随速垂直锁定｜${Math.max(0,alt).toFixed(0)} / ${LAUNCH_LOCK_ALT} u`;
    else if(speed>0.85*escapeSpeed) dyn='太快｜松开推进，向右转';
    else if(alt<35) dyn='按住发光的推进键';
    else if(omega<=0) dyn='方向反了｜向右转';
    else if(vRad>35) dyn='起飞后逐渐向右转';
    else if((ap.ra-ap.rp)/ap.rp >= 0.40) dyn='机头朝飞行方向，轻点推进';
    else if(!ok) dyn='先停火滑行｜等待完整绕地球一圈';
  }else if(mission.stage===1){
    ok = ap.bound && orbitalAngularRate()>0 && ap.ra > R_GEO - GEO_BAND*(mission.assistMode?1.4:1);
    if(ok){ advanceStage(); return; }
    dyn=ap.bound?'预计最高点 '+(ap.ra-EARTH.r).toFixed(0)+'｜继续朝前加速':'速度过高｜掉头点火减速';
  }else if(mission.stage===2){
    const direct=directSyncStatus(rocket,1),sync=direct.sync;
    ok=direct.ok;
    if(!sync.directionOk) dyn='方向反了｜改为顺行';
    else if(!direct.inBand) dyn='当前高度不在绿色同步带内';
    else if(!sync.radiusOk&&!direct.ok) dyn='蓝 '+(sync.ap.rp-EARTH.r).toFixed(0)+'｜橙 '+(sync.ap.ra-EARTH.r).toFixed(0)+'｜目标金带';
    else dyn='保持 '+Math.max(0,need-mission.holdT).toFixed(1)+' 秒';
  }else if(mission.stage===3){
    const direct=directSyncStatus(rocket,1);
    if(!direct.ok){
      if(mission.deployReady){ mission.deployReady=false; mission.finalHoldT=0; syncUI(); }
      mission.dynHint=direct.inBand?'带内但速度未稳定':'返回绿色同步带内';
    }else if(!mission.deployReady){
      mission.finalHoldT+=dt;
      mission.dynHint='重新稳定 '+Math.max(0,1.5-mission.finalHoldT).toFixed(1)+' 秒';
      if(mission.finalHoldT>=1.5){ mission.deployReady=true; mission.toast='✅ 同步轨道重新稳定！可以释放卫星'; mission.toastT=3; syncUI(); }
    }else mission.dynHint='同步稳定｜点击释放卫星';
    return;
  }
  mission.dynHint = dyn;
  if(ok){
    mission.holdT += dt;
    if(mission.holdT >= need){ advanceStage(); }
  }else{
    if(mission.holdT > 0) { mission.toast='偏离目标，重新保持…'; mission.toastT=1.5; }
    mission.holdT = 0;
  }
}

// 第二关：载人返回（同步轨道 → 反推降轨 → 再入减速 → 垂直着陆）
function updateMissionL2(dt){
  const ap = orbitApsis();
  const alt = ap.r - EARTH.r;
  const spd = Math.hypot(rocket.vx, rocket.vy);
  let dyn = '';
  if(rocket.landed) return; // 着陆由碰撞检测处理通关
  // 无论前面的再入教学是否触发，只要已经开伞进入末段，就直接切到着陆判定。
  if(rocket.chute&&mission.stage<2){ unlockFinalStage(2,'✅ 已进入最终下降，安全着陆即可通关'); return; }

  if(mission.stage===0){ // ① 反推降轨：近地点压到地表附近（轨迹扎进地球）
    const ok = ap.rp < EARTH.r + 250; // 近地点足够低，会再入
    dyn='掉头点火减速｜预计最低高度 '+Math.max(0,(ap.rp-EARTH.r)).toFixed(0)+' / 250';
    if(ok){ advanceStage(); return; }
    mission.dynHint = dyn;
    return;
  }
  if(mission.stage===1){ // ② 再入减速：开伞后进入最终着陆
    const ok = rocket.chute;
    dyn = alt>CHUTE_ALT?'等待接近地球':'短促反推｜等待开伞';
    if(ok){ advanceStage(); return; }
    mission.dynHint = dyn;
    return;
  }
  // stage===2 垂直着陆：由碰撞检测里的软着陆判定通关
  const vRad = (rocket.vx*(rocket.x-EARTH.x)+rocket.vy*(rocket.y-EARTH.y))/ap.r;
  mission.dynHint = '机头朝上，轻点推进｜高度 '+Math.max(0,alt).toFixed(0)+'｜下降 '+Math.max(0,-vRad).toFixed(1);
}
// 第三关：发射入轨 → 轨道交会 → 匹配速度 → 低速自动捕获
function updateMissionL3(dt){
  if(!station||rocket.landed) return;
  const m=stationMetrics(), ap=orbitApsis();
  mission.dockDistance=m.distance; mission.dockRelSpeed=m.relSpeed;
  // 最终对接窗口始终有效；稳定后开放按钮，但由玩家亲自执行捕获。
  const directDock=m.distance<(mission.assistMode?42:30)&&m.relSpeed<(mission.assistMode?12:8);
  if(!mission.dockReady){
    mission.finalHoldT=directDock?mission.finalHoldT+dt:0;
    if(mission.finalHoldT>=.8){
      mission.dockReady=true;
      if(mission.stage<3) unlockFinalStage(3,'✅ 对接窗口稳定！点击“执行对接”');
      else{ mission.toast='✅ 对接窗口稳定！点击“执行对接”'; mission.toastT=4; syncUI(); }
      return;
    }
  }
  if(mission.dockReady){ mission.dynHint='对接窗口已锁定｜点击“执行对接”'; return; }
  let ok=false, need=0;
  if(mission.stage===0){
    const alt=ap.r-EARTH.r;
    ok=ap.bound&&orbitalAngularRate()>0&&ap.rp>EARTH.r+90&&ap.ra>STATION_R-260&&ap.ra<STATION_R+520;
    need=1.2;
    if(rocket._launchAssistActive&&attMode===0) mission.dynHint=`随速垂直锁定｜${Math.max(0,alt).toFixed(0)} / ${LAUNCH_LOCK_ALT} u`;
    else if(!ap.bound) mission.dynHint='速度过高｜停火后掉头减速';
    else if(orbitalAngularRate()<=0) mission.dynHint='方向反了｜向右进入顺行轨道';
    else mission.dynHint=`先绕地球飞行｜预计最高点 ${(ap.ra-EARTH.r).toFixed(0)}`;
  }else if(mission.stage===1){
    ok=m.distance<(mission.assistMode?440:350); need=.45;
    mission.dynHint=`从后方追近｜距离 ${m.distance.toFixed(0)}｜${m.closing>0?'正在接近':'改用较低轨道'}`;
  }else if(mission.stage===2){
    ok=m.distance<(mission.assistMode?145:120)&&m.relSpeed<(mission.assistMode?28:22); need=.65;
    mission.dynHint=`先降低相对速度·空间站｜距离 ${m.distance.toFixed(0)}｜相对速度·空间站 ${m.relSpeed.toFixed(1)}`;
  }else{
    ok=m.distance<(mission.assistMode?42:30)&&m.relSpeed<(mission.assistMode?12:8); need=.8;
    mission.dynHint=`慢慢靠近｜距离 ${m.distance.toFixed(1)}｜相对速度·空间站 ${m.relSpeed.toFixed(1)}`;
    return;
  }
  if(ok){
    mission.holdT+=dt;
    if(mission.holdT>=need) advanceStage();
  }else mission.holdT=0;
}
// 第四关：停泊轨道 → 地月转移 → 月球捕获 → 月背无伞动力着陆
function updateMissionL4(dt){
  if(rocket.landed) return;
  const earthAp=orbitApsis(EARTH,rocket), m=moonMetrics(), moonAp=orbitApsis(MOON,rocket);
  const directCapture=moonAp.bound&&moonAp.rp>MOON.r+(mission.assistMode?8:20)&&moonAp.ra<MOON.r+(mission.assistMode?1900:1400);
  if(mission.stage<3){
    mission.finalHoldT=directCapture?mission.finalHoldT+dt:0;
    if(mission.finalHoldT>=.8){ unlockFinalStage(3,'✅ 已直接进入绕月轨道！现在前往月背着陆'); return; }
  }
  let ok=false, need=0;
  if(mission.stage===0){
    ok=earthAp.bound&&orbitalAngularRate()>0&&earthAp.rp>EARTH.r+70&&earthAp.ra<3000;
    need=1.1;
    mission.dynHint=rocket._launchAssistActive&&attMode===0?`起飞辅助｜高度 ${Math.max(0,earthAp.r-EARTH.r).toFixed(0)} / ${LAUNCH_LOCK_ALT} u`:`先完整绕地球一圈｜最低高度 ${(earthAp.rp-EARTH.r).toFixed(0)}`;
  }else if(mission.stage===1){
    ok=earthAp.bound&&earthAp.ra>MOON_ORBIT_R-900&&earthAp.ra<MOON_ORBIT_R+3500;
    need=.4;
    mission.dynHint=earthAp.bound?`预计最高点 ${(earthAp.ra-EARTH.r).toFixed(0)}｜月球轨道 ${(MOON_ORBIT_R-EARTH.r).toFixed(0)}`:'速度过高｜掉头点火减速';
  }else if(mission.stage===2){
    // 必须形成真实的月心束缚轨道，不能像空间站对接那样只靠接近和匹配速度过关。
    ok=moonAp.bound&&moonAp.rp>MOON.r+(mission.assistMode?8:20)&&moonAp.ra<MOON.r+(mission.assistMode?1900:1400);
    need=.8;
    const moonG=MOON.mu/(m.distance*m.distance),earthD=Math.hypot(rocket.x-EARTH.x,rocket.y-EARTH.y),earthG=EARTH.mu/(earthD*earthD);
    if(!moonAp.bound) mission.dynHint=`朝相对速度·月球的反方向点火｜月球引力 ${moonG.toFixed(2)}`;
    else mission.dynHint=`继续反推，先绕月球飞行｜最低高度 ${(moonAp.rp-MOON.r).toFixed(0)}`;
  }else{
    const alt=m.distance-MOON.r;
    const side=Math.abs(m.farDelta)<Math.PI/2?'月背':'近侧｜绕到绿色一面';
    mission.dynHint=`${side}｜高度 ${Math.max(0,alt).toFixed(0)}｜相对速度·月球 ${m.relSpeed.toFixed(1)}`;
    return;
  }
  if(ok){
    mission.holdT+=dt;
    if(mission.holdT>=need) advanceStage();
  }else mission.holdT=0;
}
function finishSlingshot(){
  if(level!==5||mission.done) return;
  const energy=earthSpecificEnergy(),vInf=Math.sqrt(Math.max(0,2*energy));
  const radialAngle=Math.atan2(rocket.y-EARTH.y,rocket.x-EARTH.x),velocityAngle=Math.atan2(rocket.vy,rocket.vx);
  const exitAngle=Math.abs(normalizeAngle(velocityAngle-radialAngle))*180/Math.PI;
  mission.done=true; mission.slingVInf=vInf; state='complete';
  mission.slingExitAngle=exitAngle;
  const starResult=evaluateStars([
    {ok:vInf>=CHALLENGE_CONFIG[5].vInfStar,label:`逃逸余速 v∞ 至少 ${CHALLENGE_CONFIG[5].vInfStar} u/s`},
    {ok:exitAngle<=CHALLENGE_CONFIG[5].exitAngleStar,label:`穿越绿圈方向偏差不超过 ${CHALLENGE_CONFIG[5].exitAngleStar}°`}
  ]);
  const result=saveLevelResult(5,performanceScore(),starResult.stars);
  const usedMoon=Number.isFinite(mission.slingClosestDistance)&&mission.slingClosestDistance<1400;
  const closestAlt=usedMoon?Math.max(0,mission.slingClosestDistance-MOON.r):null;
  syncUI();
  showMsg('🪃','成功飞出地球！',
    resultLine(result)+`已向外穿过地球逃逸门 · v∞ ${vInf.toFixed(1)} u/s<br>`+
    (usedMoon?`最近月面高度 ${closestAlt.toFixed(0)} u · `:'')+
    (usedMoon&&Math.abs(mission.slingGain)>1?`引力增能 ${mission.slingGain.toFixed(0)} u²/s² · `:'')+`出圈方向偏差 ${exitAngle.toFixed(1)}°<br>`+
    `${performanceDetail()}<br>${starBreakdownHtml(starResult)}<br>`+
    `<span style="color:#888">方向偏差是飞行速度与绿圈当地向外法线的夹角；越接近 0°，出圈越干净。</span>`);
}
// 第五关：地面有限燃料发射 → 月球运动后方飞越 → 正能量穿越地球逃逸门
function updateMissionL5(dt){
  if(rocket.landed) return;
  const m=moonMetrics(),energy=earthSpecificEnergy();
  const moonSpeed=Math.max(1,Math.hypot(MOON.vx,MOON.vy));
  const sx=rocket.x-MOON.x,sy=rocket.y-MOON.y;
  const trailing=(sx*MOON.vx+sy*MOON.vy)/moonSpeed;
  const rvx=rocket.vx-MOON.vx,rvy=rocket.vy-MOON.vy;
  const receding=(sx*rvx+sy*rvy)/Math.max(1,m.distance)>0;
  const ex=rocket.x-EARTH.x,ey=rocket.y-EARTH.y,earthR=Math.hypot(ex,ey);
  const radial=(rocket.vx*ex+rocket.vy*ey)/Math.max(1,earthR);

  if(m.distance<mission.slingClosestDistance){
    mission.slingClosestDistance=m.distance;
    mission.slingClosestTrailing=trailing;
  }
  if(m.distance<1400) mission.slingWasInside=true;

  // 通关只验收最终结果，不验收玩家是否照着示范路线飞。
  // 向外越过绿圈且地心能量为正，说明轨道不会掉回来，立即成功。
  if(earthR>=SLING_EXIT_R&&radial>0&&energy>0){
    mission.slingVInf=Math.sqrt(2*energy);
    finishSlingshot();
    return;
  }

  if(mission.stage===0){
    const ap=orbitApsis(EARTH,rocket),alt=ap.r-EARTH.r;
    const transferReady=ap.bound&&orbitalAngularRate()>0&&ap.rp>EARTH.r&&ap.ra>MOON_ORBIT_R-700&&ap.ra<MOON_ORBIT_R+1100;
    mission.dynHint=`把预计最高点送到月球轨道｜燃料 ${rocket.fuel.toFixed(1)}%｜最高点 ${Number.isFinite(ap.ra)?Math.max(0,ap.ra-EARTH.r).toFixed(0):'逃逸'}`;
    if(transferReady){ mission.holdT+=dt; if(mission.holdT>=.25) advanceStage(); }
    else mission.holdT=0;
    return;
  }

  if(mission.stage===1){
    mission.dynHint=`看预计近月点｜距月 ${m.distance.toFixed(0)}｜修正燃料 ${rocket.fuel.toFixed(1)}%`;
    if(m.distance<SLING_APPROACH_R){ advanceStage(); return; }
    return;
  }

  if(mission.slingWasInside&&m.distance>SLING_DEPART_R&&receding&&!mission.slingFlybyValid&&!mission.slingFailed){
    const gain=energy-mission.slingEntryEnergy;
    const escaped=energy>0;
    if(escaped){
      mission.slingFlybyValid=true; mission.slingGain=gain; mission.slingVInf=Math.sqrt(2*energy);
      if(mission.stage<3) unlockFinalStage(3,'✅ 已经甩出去了！继续飞出绿色大圈');
    }else{
      mission.slingFailed=true;
      mission.toast='速度还不够，这条路线会掉回地球｜可用阶段回退重试'; mission.toastT=4;
    }
  }

  if(mission.stage===2){
    const closestAlt=Number.isFinite(mission.slingClosestDistance)?mission.slingClosestDistance-MOON.r:m.distance-MOON.r;
    mission.dynHint=m.distance<1200
      ? `停火掠过月球｜最近高度 ${closestAlt.toFixed(0)}｜${trailing<0?'正在加速':'观察路线转弯'}`
      : `靠近月球并停火｜距月 ${m.distance.toFixed(0)}`;
    return;
  }

  const vInf=energy>0?Math.sqrt(2*energy):0;
  mission.slingVInf=vInf;
  mission.dynHint=`飞出绿色圈｜距离 ${earthR.toFixed(0)} / ${SLING_EXIT_R}｜v∞ ${vInf.toFixed(1)}`;
  if(earthR>=SLING_EXIT_R&&radial>0&&energy>0) finishSlingshot();
}
// 第六关：无需预选，实时采用最近的平衡点；进入任意目标环并匹配速度后自动部署。
function updateMissionL6(dt){
  if(rocket.landed) return;
  const m=nearestLagrangeMetrics(),ap=orbitApsis(EARTH,rocket),distanceLimit=mission.assistMode?220:140,speedLimit=mission.assistMode?16:10;
  mission.lagrangeTarget=m.point.id;
  mission.lagrangeDistance=m.distance; mission.lagrangeRelSpeed=m.relSpeed;
  const stable=m.distance<distanceLimit&&m.relSpeed<speedLimit;
  mission.finalHoldT=stable?mission.finalHoldT+dt:0;
  if(mission.finalHoldT>=1.2){
    finishLagrange(m);
    return;
  }
  let ok=false,need=0;
  if(mission.stage===0){
    ok=ap.bound&&orbitalAngularRate()>0&&ap.rp>EARTH.r+70&&ap.ra<3000; need=1.1;
    mission.dynHint=`先完整绕地球一圈｜最近 L${m.point.id} ${'★'.repeat(m.point.stars)}｜${ap.bound?'轨道已形成':'停火减速'}`;
  }else if(mission.stage===1){
    ok=m.distance<3000; need=.35;
    mission.dynHint=`距 L${mission.lagrangeTarget} ${m.distance.toFixed(0)}｜目标 <3000`;
  }else if(mission.stage===2){
    ok=m.distance<800&&m.relSpeed<45; need=.55;
    mission.dynHint=`距 L${mission.lagrangeTarget} ${m.distance.toFixed(0)}｜相对速度·目标点 ${m.relSpeed.toFixed(1)}`;
  }else{
    mission.dynHint=`进入 L${m.point.id} 并停稳｜距离 ${m.distance.toFixed(0)}/${distanceLimit}｜相对速度·目标点 ${m.relSpeed.toFixed(1)}/${speedLimit}`;
    return;
  }
  if(ok){ mission.holdT+=dt; if(mission.holdT>=need) advanceStage(); }
  else mission.holdT=0;
}
function finishAsteroidDefense(forecast=getAsteroidForecast(true)){
  if(level!==7||mission.done)return;
  mission.done=true;state='complete';rocket.thrusting=false;
  const survived=rocket.alive,remaining=challengeRemainingFuel(),starResult=evaluateStars([
    {ok:survived,label:'飞船没有在撞击中损毁'},
    {ok:remaining>=CHALLENGE_CONFIG[7].fuelStar,label:`燃料剩余至少 ${CHALLENGE_CONFIG[7].fuelStar}%`}
  ]);
  const result=saveLevelResult(7,performanceScore(),starResult.stars);
  syncUI();
  showMsg(survived?'🛡️':'💥','行星防御成功！',
    resultLine(result)+`${mission.asteroidImpact?'动能撞击':'持续推力'}已改变小行星轨道<br>`+
    `预计最近地球表面 ${Math.max(0,forecast.minEarth-EARTH.r-asteroid.r).toFixed(0)} u · 月球表面 ${Math.max(0,forecast.minMoon-MOON.r-asteroid.r).toFixed(0)} u<br>`+
    `小行星自转 ${(asteroid.av*180/Math.PI).toFixed(2)}°/s · ${performanceDetail()}<br>${starBreakdownHtml(starResult)}<br>`+
    `<span style="color:#888">无论软着陆、持续推离还是牺牲飞船撞击，只要最终轨道同时避开地球和月球就算成功。</span>`);
}
function updateMissionL7(dt){
  if(!asteroid||!asteroid.alive)return;
  const m=asteroidMetrics(),forecast=getAsteroidForecast();
  mission.asteroidMinEarth=forecast.minEarth;mission.asteroidMinMoon=forecast.minMoon;
  if(mission.asteroidChanged&&forecast.safe){
    mission.asteroidSafeT+=dt;
    if(mission.asteroidSafeT>=2.5){finishAsteroidDefense(forecast);return;}
  }else mission.asteroidSafeT=0;
  if(mission.asteroidContact){
    if(mission.asteroidAnchored)mission.dynHint=`${forecast.safe?'保持安全轨道':'继续把红线推开'}｜喷射角 ${(mission.hingeAngle*180/Math.PI).toFixed(0)}°`;
    else mission.dynHint=`点“锚定并翻转”，或直接推进`;
    return;
  }
  if(!rocket.alive){mission.dynHint=forecast.safe?'撞击有效｜等待轨道确认':'撞击偏转不足｜小行星仍有危险';return;}
  if(mission.stage===0){
    mission.dynHint=`距小行星 ${m.distance.toFixed(0)}｜相对速度·小行星 ${m.relSpeed.toFixed(1)} u/s`;
    if(m.distance<1700){advanceStage();return;}
  }else if(mission.stage===1){
    mission.dynHint=`软着陆 ≤${ASTEROID_SOFT_SPEED} u/s｜高速接触会撞击`;
  }else mission.dynHint=`距小行星 ${m.distance.toFixed(0)}｜慢速接触表面`;
}
function updateMissionL8(dt){
  if(!binary||!station)return;
  const bm=binaryMetrics(),sm=stationMetrics(),planetD=Math.hypot(rocket.x-EARTH.x,rocket.y-EARTH.y);
  mission.binaryTargetEnergy=bm.targetEnergy;
  if(bm.distA<binary.heatRadiusA||bm.distB<binary.heatRadiusB)mission.binaryHeatViolated=true;

  // 最终结果独立于教学顺序：只要真实进入对接窗口，就开放任务按钮。
  const directDock=sm.distance<(mission.assistMode?46:36)&&sm.relSpeed<(mission.assistMode?13:9);
  mission.finalHoldT=directDock?mission.finalHoldT+dt:0;
  if(!mission.dockReady&&mission.finalHoldT>=.7){
    mission.dockReady=true;
    if(mission.stage<3)unlockFinalStage(3,'✅ 已直接抵达暮光站对接窗口！点击“执行对接”');
    else{mission.toast='✅ 对接窗口稳定｜点击“执行对接”';mission.toastT=4;syncUI();}
    return;
  }
  if(mission.dockReady&&!directDock){mission.dockReady=false;syncUI();}
  if(rocket.landed)return;

  if(mission.stage===0){
    mission.dynHint=`朝青色通道飞｜离晨曦星 ${Math.max(0,planetD-EARTH.r).toFixed(0)}`;
    if(planetD>EARTH.r+300){mission.holdT+=dt;if(mission.holdT>.6)advanceStage();}
    else mission.holdT=0;
    return;
  }
  if(mission.stage===1){
    mission.dynHint=`距通道 ${bm.gateDistance.toFixed(0)}｜${bm.distB<bm.distA?'已进入暮光星一侧':'瞄准移动青门'}`;
    if(bm.gateDistance<520||bm.distB<bm.distA){mission.binaryGateCrossed=true;binary.gateCrossed=true;advanceStage();}
    return;
  }
  const captured=bm.targetEnergy<0&&bm.distB>MOON.r+75&&bm.distB<1550;
  mission.binaryCaptured=captured||mission.binaryCaptured;
  if(mission.stage===2){
    mission.dynHint=`${captured?'已捕获':'朝相对速度·暮光星的反方向点火'}｜能量 ${bm.targetEnergy.toFixed(0)}｜距站 ${sm.distance.toFixed(0)}`;
    if(captured){mission.holdT+=dt;if(mission.holdT>.7)advanceStage();}
    else mission.holdT=0;
    return;
  }
  mission.dynHint=`先减速再靠近｜距站 ${sm.distance.toFixed(0)}｜相对速度·暮光站 ${sm.relSpeed.toFixed(1)}`;
}
function advanceStage(){
  mission.stage++;
  mission.holdT = 0;
  if(level===1 && mission.stage===1 && attMode===0) velOffset=0;
  if(level===2 && mission.stage===2 && attMode===0){
    velOffset=0; rocket.a=Math.atan2(rocket.y-EARTH.y,rocket.x-EARTH.x); rocket.av=0;
  }
  if(level===5&&mission.stage===1){
    // 一级剩余推进剂随级间分离丢弃，避免玩家把发射燃料带到高空直接硬烧逃逸。
    if(challengeMode) mission.fuelUsed=Math.min(mission.fuelBudget,mission.fuelUsed+rocket.fuel);
    rocket.fuel=SLING_CORRECTION_FUEL;
    mission.slingInitialEnergy=earthSpecificEnergy(rocket); mission.slingEntryEnergy=mission.slingInitialEnergy;
    mission.slingClosestDistance=Infinity; mission.slingClosestTrailing=Infinity; mission.slingWasInside=false;
  }
  saveCheckpoint();
  mission.toast = '✅ ' + stageInfo()[mission.stage-1].name + ' 完成！';
  mission.toastT = 3;
  if(level===1 && mission.stage===3){ mission.deployReady=true; mission.toast='✅ 同步稳定！点击“释放卫星”'; mission.toastT=4; }
  if(level===2 && mission.stage===1){ mission.toast='✅ 已进入返回轨道！准备再入减速'; mission.toastT=3; }
  if(level===2 && mission.stage===2){ mission.toast='✅ 速度受控！最后垂直着陆'; mission.toastT=3; }
  if(level===3 && mission.stage===1){ mission.toast='✅ 已进入近地轨道！开始追赶空间站'; mission.toastT=3.5; }
  if(level===3 && mission.stage===2){ mission.toast='✅ 已进入交会区！先降低相对速度·空间站'; mission.toastT=3.5; }
  if(level===3 && mission.stage===3){ mission.toast='✅ 速度接近！低速靠近绿色对接口'; mission.toastT=3.5; }
  if(level===4 && mission.stage===1){ mission.toast='✅ 停泊轨道稳定！准备地月转移点火'; mission.toastT=3.5; }
  if(level===4 && mission.stage===2){ mission.toast='✅ 已进入地月转移！瞄准移动中的月球'; mission.toastT=3.5; }
  if(level===4 && mission.stage===3){ mission.toast='✅ 月球捕获！绿色半球无伞动力着陆'; mission.toastT=4; }
  if(level===5 && mission.stage===1){ mission.toast='✅ 地月转移成立！一级分离 · 修正燃料 2%'; mission.toastT=4; }
  if(level===5 && mission.stage===2){ mission.toast='✅ 已进入近月区！停火观察引力弯曲'; mission.toastT=3.5; }
  if(level===6 && mission.stage===1){ mission.toast='✅ 停泊轨道稳定！任选一个平衡点前往'; mission.toastT=3.5; }
  if(level===6 && mission.stage===2){ mission.toast=`✅ 已接近 L${mission.lagrangeTarget}！先降低相对速度·目标点`; mission.toastT=3.5; }
  if(level===6 && mission.stage===3){ mission.toast='✅ 进入任意亮环并停稳即可自动完成'; mission.toastT=3.5; }
  if(level===7 && mission.stage===1){ mission.toast='✅ 已进入拦截区｜慢速着陆或直接撞击'; mission.toastT=4; }
  if(level===7 && mission.stage===2){ mission.toast='✅ 已接触小行星｜可以锚定翻转'; mission.toastT=3.5; }
  if(level===7 && mission.stage===3){ mission.toast='⚓ 左右调铰链，推进直到危险红线变绿'; mission.toastT=4; }
  if(level===8 && mission.stage===1){ mission.toast='✅ 已离开晨曦星｜飞向青色通道'; mission.toastT=3.5; }
  if(level===8 && mission.stage===2){ mission.toast='✅ 已过通道｜靠近目标星后反推'; mission.toastT=3.5; }
  if(level===8 && mission.stage===3){ mission.toast='✅ 已被目标星捕获｜追上暮光站'; mission.toastT=3.5; }
  if(level===9 && mission.stage===1){ mission.toast='⌛ 已进入深渊点火区｜对准速度方向，短促推进'; mission.toastT=4; }
  if(level===9 && mission.stage===2){ mission.toast='✅ 逃逸能量已为正｜关机向外穿过绿色救援门'; mission.toastT=4; }
  if(level===1&&mission.stage===1)openConceptCard('periapsis',false);
  if(level===1&&mission.stage===2)openConceptCard('synchronous',false);
  syncUI();
}
function unlockFinalStage(targetStage,message){
  if(!mission||mission.stage>=targetStage) return;
  mission.stage=targetStage; mission.holdT=0; mission.finalHoldT=0;
  if(level===2&&targetStage>=2&&attMode===0){
    velOffset=0; rocket.a=Math.atan2(rocket.y-EARTH.y,rocket.x-EARTH.x); rocket.av=0;
  }
  saveCheckpoint(); mission.toast=message; mission.toastT=4; syncUI();
}
