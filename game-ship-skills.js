"use strict";

// Shared one-use/passive spacecraft skill lifecycle. Individual ship effects
// register here one ship at a time; this module owns state, snapshots and UI.
(function createShipSkillSystem(global){
  const INTRO_KEY='spacegame-ship-skill-intros-v1';
  const SPACE_WARP_DISTANCE=150,SPACE_WARP_CLEARANCE=5,SPACE_WARP_MAX_USES=3,SPACE_WARP_FUEL_COST=5,SPACE_WARP_COOLDOWN=5,SPACE_WARP_CHARGE_DURATION=.1;
  const YAMATO_RANGE=2000,YAMATO_CHARGE_DURATION=.9,YAMATO_BEAM_DURATION=1.55,YAMATO_IMPACT_DURATION=1.35,YAMATO_RESCUE_CORRIDOR=480;
  const SHARP_TURN_DV=15,SHARP_TURN_IMPULSE_WINDOW=.25,SHARP_TURN_FX_DURATION=.95,SHARP_TURN_COOLDOWN=.2,SHARP_TURN_FUEL_COST=1,SHARP_TURN_MIN_ANGLE=.012;
  const planned=new Map([
    ['rocket',{shipId:'rocket',id:'buffer_fork',icon:'🛬',name:'缓冲货叉',kind:'passive',summary:'安全着陆速度上限提高 15%。',specialty:'擅长：返回与着陆任务',available:false}],
    ['swordwing',{shipId:'swordwing',id:'space_warp',icon:'✦',name:'空间折跃',kind:'active',holdToCharge:true,maxUses:SPACE_WARP_MAX_USES,cooldown:SPACE_WARP_COOLDOWN,fuelCost:SPACE_WARP_FUEL_COST,summary:'按住聚能 0.1 秒后沿机头折跃 150u，松手取消；每关 3 次，挑战模式每次消耗 5% 燃料，冷却 5 秒。',specialty:'擅长：连续交会与路径修正',available:false}],
    ['hyperion',{shipId:'hyperion',id:'yamato_cannon',icon:'☄',name:'大和炮',kind:'active',holdToCharge:true,summary:'按住聚能 0.9 秒后发射，松手取消；小行星、友方空间站和求救飞船都会被击毁。',specialty:'擅长：小行星防御 · 每关一次',available:false}],
    ['waterdrop',{shipId:'waterdrop',id:'sharp_angle_maneuver',icon:'⌁',name:'锐角机动',kind:'passive',summary:'转向时自动将速度矢量拉向机头，速率不变；冷却 0.2 秒，挑战模式每次消耗 1% 燃料。',specialty:'擅长：连续锐角变轨 · 被动',available:false}]
  ]);
  function normalizeSignedAngle(value){
    let angle=Number(value)||0;while(angle>Math.PI)angle-=Math.PI*2;while(angle<-Math.PI)angle+=Math.PI*2;return angle;
  }
  function resolveSharpAngleManeuver(input={}){
    const vx=Number(input.vx)||0,vy=Number(input.vy)||0,heading=Number(input.heading)||0,speed=Math.hypot(vx,vy);
    if(speed<=1e-7)return {ok:false,reason:'stationary',speed,vx,vy,maxAngle:0,turnAngle:0,deltaV:0};
    const beforeAngle=Math.atan2(vy,vx),maxAngle=2*Math.asin(Math.min(1,SHARP_TURN_DV/(2*speed))),requestedAngle=normalizeSignedAngle(heading-beforeAngle);
    const turnAngle=Math.max(-maxAngle,Math.min(maxAngle,requestedAngle)),afterAngle=beforeAngle+turnAngle;
    const nextVx=Math.cos(afterAngle)*speed,nextVy=Math.sin(afterAngle)*speed,deltaV=Math.hypot(nextVx-vx,nextVy-vy);
    return {ok:true,speed,vx:nextVx,vy:nextVy,beforeAngle,afterAngle,maxAngle,requestedAngle,turnAngle,deltaV};
  }
  function resolveWarpPath(input={}){
    const start={x:Number(input.x)||0,y:Number(input.y)||0},heading=Number(input.heading)||0;
    const dir={x:Math.cos(heading),y:Math.sin(heading)};
    const requested=Math.max(0,Number(input.distance)||SPACE_WARP_DISTANCE);
    const ringOut=Math.max(0,Number(input.ringOut)||0),clearance=Math.max(0,Number(input.clearance) || SPACE_WARP_CLEARANCE);
    let distance=requested,reason='clear',bodyName='';
    for(const body of Array.isArray(input.bodies)?input.bodies:[]){
      const bx=Number(body?.x),by=Number(body?.y),radius=Math.max(0,Number(body?.r)||0)+ringOut+clearance;
      if(!Number.isFinite(bx)||!Number.isFinite(by)||radius<=0)continue;
      const rx=start.x-bx,ry=start.y-by,dot=rx*dir.x+ry*dir.y,startRadius=Math.hypot(rx,ry);
      if(startRadius<radius-1e-7){
        if(dot<=0&&distance>0){distance=0;reason='body';bodyName=body.name||'';}
        continue;
      }
      const discriminant=dot*dot-(rx*rx+ry*ry-radius*radius);
      if(discriminant<0)continue;
      const entry=-dot-Math.sqrt(Math.max(0,discriminant));
      if(entry>=-1e-7&&entry<=distance+1e-7){distance=Math.max(0,entry);reason='body';bodyName=body.name||'';}
    }
    const bounds=input.worldBounds;
    if(bounds&&Number.isFinite(Number(bounds.radius))&&Number(bounds.radius)>0){
      const cx=Number(bounds.x)||0,cy=Number(bounds.y)||0,radius=Number(bounds.radius);
      const ex=start.x+dir.x*distance,ey=start.y+dir.y*distance;
      if(Math.hypot(ex-cx,ey-cy)>radius+1e-7){
        const rx=start.x-cx,ry=start.y-cy,dot=rx*dir.x+ry*dir.y;
        const discriminant=dot*dot-(rx*rx+ry*ry-radius*radius);
        const exit=discriminant>=0?-dot+Math.sqrt(Math.max(0,discriminant)):0;
        if(exit<distance){distance=Math.max(0,exit);reason='boundary';bodyName='';}
      }
    }
    return {start,end:{x:start.x+dir.x*distance,y:start.y+dir.y*distance},heading,
      requestedDistance:requested,distance,reason,bodyName,clearance:ringOut+clearance};
  }
  function yamatoCircleEntry(start,dir,target,maxRange){
    const bx=Number(target?.x),by=Number(target?.y),radius=Math.max(0,Number(target?.r)||0);
    if(!Number.isFinite(bx)||!Number.isFinite(by)||radius<=0)return null;
    const rx=start.x-bx,ry=start.y-by,dot=rx*dir.x+ry*dir.y,startRadius=Math.hypot(rx,ry);
    if(startRadius<=radius+1e-7&&dot>=0)return null;
    if(startRadius<radius-1e-7)return 0;
    const discriminant=dot*dot-(rx*rx+ry*ry-radius*radius);
    if(discriminant<0)return null;
    const entry=-dot-Math.sqrt(Math.max(0,discriminant));
    return entry>=-1e-7&&entry<=maxRange+1e-7?Math.max(0,entry):null;
  }
  function resolveYamatoShot(input={}){
    const start={x:Number(input.x)||0,y:Number(input.y)||0},heading=Number(input.heading)||0;
    const dir={x:Math.cos(heading),y:Math.sin(heading)},range=Math.max(0,Number(input.range)||YAMATO_RANGE);
    let hit=null,distance=range;
    for(const entry of Array.isArray(input.targets)?input.targets:[]){
      const target=entry?.ref||entry,collider=entry?.ref?entry:target;
      const candidate=yamatoCircleEntry(start,dir,collider,range);
      if(candidate===null||candidate>distance+1e-7)continue;
      distance=candidate;hit={target,kind:entry?.kind||target?.yamatoKind||'body',name:entry?.name||target?.name||'',collider};
    }
    const end={x:start.x+dir.x*distance,y:start.y+dir.y*distance};
    return {start,end,impact:{...end},heading,dir,range,distance,hit:!!hit,target:hit?.target||null,targetKind:hit?.kind||'',targetName:hit?.name||'',
      targetX:Number(hit?.collider?.x),targetY:Number(hit?.collider?.y),targetRadius:Math.max(0,Number(hit?.collider?.r)||0)};
  }
  function resolveYamatoRescueCollateral(input={}){
    const start={x:Number(input.x)||0,y:Number(input.y)||0},heading=Number(input.heading)||0;
    const dir=input.dir&&Number.isFinite(Number(input.dir.x))&&Number.isFinite(Number(input.dir.y))?input.dir:{x:Math.cos(heading),y:Math.sin(heading)};
    const length=Math.hypot(dir.x,dir.y)||1,ux=dir.x/length,uy=dir.y/length,range=Math.max(0,Number(input.range)||YAMATO_RANGE),corridor=Math.max(0,Number(input.corridor)||YAMATO_RESCUE_CORRIDOR);
    const hits=[];
    for(const entry of Array.isArray(input.targets)?input.targets:[]){
      const target=entry?.ref||entry;if((entry?.kind||target?.yamatoKind)!=='rescue'||!target||target.destroyed||target.rescued||target.alive===false)continue;
      const x=Number(entry?.x??target.x),y=Number(entry?.y??target.y),radius=Math.max(0,Number(entry?.r??target.r)||0);if(!Number.isFinite(x)||!Number.isFinite(y))continue;
      const dx=x-start.x,dy=y-start.y,along=dx*ux+dy*uy;if(along<-radius||along>range+radius)continue;
      const perpendicular=Math.abs(dx*uy-dy*ux);if(perpendicular<=corridor+radius)hits.push({target,along,perpendicular});
    }
    return hits.sort((a,b)=>a.along-b.along).map(hit=>hit.target);
  }
  const installed=new Map([
    ['rocket',{...planned.get('rocket'),available:true,landingMultiplier:1.15}],
    ['swordwing',{...planned.get('swordwing'),available:true,activate({rocket,challengeMode}){
      if(!rocket||rocket.alive===false)return {ok:false,reason:'inactive',message:t('飞船状态不允许折跃')};
      if(challengeMode&&Number(rocket.fuel)<SPACE_WARP_FUEL_COST)return {ok:false,reason:'fuel',message:t('燃料不足，无法折跃')};
      return {ok:true,deferConsume:true,sound:'space_warp_charge',message:t('空间折跃聚能 · 按住 0.1 秒'),payload:{warpChargeFx:{remaining:SPACE_WARP_CHARGE_DURATION,duration:SPACE_WARP_CHARGE_DURATION}}};
    },update({state,dtReal,rocket,mission,challengeMode,bodies,worldBounds,ringOut,trail,onWarp}){
      const charge=state.payload?.warpChargeFx;
      if(charge){
        if(!rocket||rocket.alive===false||(challengeMode&&Number(rocket.fuel)<SPACE_WARP_FUEL_COST)){delete state.payload.warpChargeFx;sync();return;}
        charge.remaining=Math.max(0,charge.remaining-Math.max(0,Number(dtReal)||0));
        if(charge.remaining>0)return;
        delete state.payload.warpChargeFx;
      const warp=resolveWarpPath({x:rocket.x,y:rocket.y,heading:rocket.a,distance:SPACE_WARP_DISTANCE,bodies,worldBounds,ringOut});
      rocket.x=warp.end.x;rocket.y=warp.end.y;rocket.landed=false;rocket.body=null;rocket.launchGrace=Math.max(.35,Number(rocket.launchGrace)||0);
      if(challengeMode){rocket.fuel=Math.max(0,Number(rocket.fuel)-SPACE_WARP_FUEL_COST);if(mission)mission.fuelUsed=(Number(mission.fuelUsed)||0)+SPACE_WARP_FUEL_COST;}
      if(Array.isArray(trail)){trail.push({...warp.start,warpStart:true});trail.push({...warp.end,warpEnd:true});}
      const message=warp.reason==='body'?`${t('折跃路径被天体安全截断')}${warp.bodyName?` · ${t(warp.bodyName)}`:''}`:
        warp.reason==='boundary'?t('折跃抵达世界边界'):`${t('空间折跃完成')} · ${warp.distance.toFixed(0)}u`;
        state.uses=Math.min(state.maxUses,state.uses+1);state.used=state.uses>=state.maxUses;state.cooldown=SPACE_WARP_COOLDOWN;
        state.payload.warpFx={...warp,remaining:.78,duration:.78};
        global.SpaceGameAudio?.sfx?.('space_warp');if(typeof onWarp==='function')onWarp(warp,message);sync();
      }
      const fx=state.payload?.warpFx;if(!fx)return;
      fx.remaining=Math.max(0,fx.remaining-Math.max(0,Number(dtReal)||0));
      if(fx.remaining===0)delete state.payload.warpFx;
    },cancel({state}){
      if(!state.payload?.warpChargeFx)return {ok:false,reason:'not-charging'};
      delete state.payload.warpChargeFx;
      return {ok:true,cancelled:true,message:t('已取消空间折跃聚能')};
    }}],
    ['hyperion',{...planned.get('hyperion'),available:true,activate({rocket,yamatoTargets}){
      if(!rocket||rocket.alive===false)return {ok:false,reason:'inactive',message:t('飞船状态不允许开炮')};
      const preview=resolveYamatoShot({x:rocket.x,y:rocket.y,heading:rocket.a,range:YAMATO_RANGE,targets:yamatoTargets});
      const fx={phase:'charging',start:preview.start,end:preview.end,impact:preview.impact,heading:preview.heading,hit:preview.hit,targetKind:preview.targetKind,targetName:preview.targetName,
        targetX:preview.targetX,targetY:preview.targetY,targetRadius:preview.targetRadius,
        chargeRemaining:YAMATO_CHARGE_DURATION,chargeDuration:YAMATO_CHARGE_DURATION,remaining:YAMATO_CHARGE_DURATION,beamDuration:YAMATO_BEAM_DURATION,impactDuration:YAMATO_IMPACT_DURATION};
      return {ok:true,deferConsume:true,sound:'yamato_charge',message:t('大和炮开始聚能 · 按住并保持瞄准'),preview,payload:{yamatoFx:fx}};
    },update({state,dtReal,rocket,yamatoTargets,asteroid,station,onYamatoFire,onYamatoAsteroidHit,onYamatoStationHit,onYamatoRescueHit}){
      const fx=state.payload?.yamatoFx;if(!fx)return;
      const step=Math.max(0,Number(dtReal)||0);
      if(fx.phase==='charging'){
        if(!rocket||rocket.alive===false){delete state.payload.yamatoFx;return;}
        const shot=resolveYamatoShot({x:rocket.x,y:rocket.y,heading:rocket.a,range:YAMATO_RANGE,targets:yamatoTargets});
        Object.assign(fx,{start:shot.start,end:shot.end,impact:shot.impact,heading:shot.heading,hit:shot.hit,targetKind:shot.targetKind,targetName:shot.targetName,
          targetX:shot.targetX,targetY:shot.targetY,targetRadius:shot.targetRadius});
        const chargeTick=Math.ceil(fx.chargeRemaining*10);fx.chargeRemaining=Math.max(0,fx.chargeRemaining-step);fx.remaining=fx.chargeRemaining;
        if(Math.ceil(fx.chargeRemaining*10)!==chargeTick)sync();
        if(fx.chargeRemaining>0)return;
        state.uses=Math.min(state.maxUses,state.uses+1);state.used=state.uses>=state.maxUses;
        let destruction=null;
        if(asteroid&&shot.hit&&shot.target===asteroid&&typeof onYamatoAsteroidHit==='function')destruction=onYamatoAsteroidHit(shot)||null;
        else if(station&&shot.hit&&shot.target===station&&typeof onYamatoStationHit==='function')destruction=onYamatoStationHit(shot)||null;
        else if(shot.hit&&shot.targetKind==='rescue'&&typeof onYamatoRescueHit==='function'){
          const rescueHits=resolveYamatoRescueCollateral({x:shot.start.x,y:shot.start.y,dir:shot.dir,range:shot.range,targets:yamatoTargets});
          destruction=onYamatoRescueHit(shot,rescueHits)||null;
        }
        const effectDuration=shot.targetKind==='body'?2.7:shot.targetKind==='black-hole'?2.25:destruction?.double?2.6:shot.targetKind==='rescue'?2.1:YAMATO_BEAM_DURATION;
        const planetDebris=shot.hit&&shot.targetKind==='body'?[{side:-.72,speed:35,size:8,spin:-2.4},{side:.54,speed:27,size:6,spin:1.9}]:[];
        Object.assign(fx,{phase:'beam',remaining:effectDuration,effectDuration,beamElapsed:0,hit:shot.hit,targetKind:shot.targetKind,targetName:shot.targetName,planetDebris});
        if(typeof onYamatoFire==='function')onYamatoFire({...shot,destruction});
        global.SpaceGameAudio?.sfx?.('yamato_cannon');sync();return;
      }
      fx.beamElapsed=(Number(fx.beamElapsed)||0)+step;
      fx.remaining=Math.max(0,fx.remaining-step);
      if(fx.remaining===0)delete state.payload.yamatoFx;
    },cancel({state}){
      if(state.payload?.yamatoFx?.phase!=='charging')return {ok:false,reason:'not-charging'};
      delete state.payload.yamatoFx;
      return {ok:true,cancelled:true,message:t('已取消大和炮聚能')};
    }}],
    ['waterdrop',{...planned.get('waterdrop'),available:true,cooldown:SHARP_TURN_COOLDOWN,fuelCost:SHARP_TURN_FUEL_COST,update({state,dtReal,rocket,mission,challengeMode,turnInput,trail,onSharpTurn}){
      const step=Math.max(0,Number(dtReal)||0),fx=state.payload?.sharpTurnFx;
      if(fx){fx.remaining=Math.max(0,fx.remaining-step);if(fx.remaining===0)delete state.payload.sharpTurnFx;}
      if(!rocket||rocket.alive===false||rocket.landed||!Number(turnInput)){state.passiveState='ready';return;}
      if(state.cooldown>0){state.passiveState='cooldown';return;}
      if(challengeMode&&Number(rocket.fuel)<SHARP_TURN_FUEL_COST){state.passiveState='fuel';return;}
      const maneuver=resolveSharpAngleManeuver({vx:rocket.vx,vy:rocket.vy,heading:rocket.a});
      if(!maneuver.ok||Math.abs(maneuver.turnAngle)<SHARP_TURN_MIN_ANGLE){state.passiveState='ready';return;}
      const origin={x:Number(rocket.x)||0,y:Number(rocket.y)||0};
      rocket.vx=maneuver.vx;rocket.vy=maneuver.vy;rocket.launchGrace=Math.max(.25,Number(rocket.launchGrace)||0);
      rocket.skillImpulseG=Math.max(Number(rocket.skillImpulseG)||0,maneuver.deltaV/SHARP_TURN_IMPULSE_WINDOW);
      if(challengeMode){rocket.fuel=Math.max(0,Number(rocket.fuel)-SHARP_TURN_FUEL_COST);if(mission)mission.fuelUsed=(Number(mission.fuelUsed)||0)+SHARP_TURN_FUEL_COST;}
      if(Array.isArray(trail))trail.push({...origin,sharpTurn:true,beforeAngle:maneuver.beforeAngle,afterAngle:maneuver.afterAngle});
      state.cooldown=SHARP_TURN_COOLDOWN;state.passiveState='cooldown';state.payload.sharpTurnCount=(Number(state.payload.sharpTurnCount)||0)+1;
      state.payload.sharpTurnFx={...origin,beforeAngle:maneuver.beforeAngle,afterAngle:maneuver.afterAngle,turnAngle:maneuver.turnAngle,maxAngle:maneuver.maxAngle,deltaV:maneuver.deltaV,remaining:SHARP_TURN_FX_DURATION,duration:SHARP_TURN_FX_DURATION};
      if(typeof onSharpTurn==='function')onSharpTurn(maneuver,challengeMode?SHARP_TURN_FUEL_COST:0);
      global.SpaceGameAudio?.sfx?.('sharp_angle_maneuver');
    }}]
  ]);
  let state=null;

  const clone=value=>value==null?value:JSON.parse(JSON.stringify(value));
  const t=value=>global.SpaceGameI18n?.t?.(value)||value;
  function selectedShip(){return global.SpaceGameShipSkins?.current?.()||'rocket';}
  function definition(shipId=selectedShip()){return installed.get(shipId)||planned.get(shipId)||null;}
  function landingMultiplier(shipId=selectedShip()){
    const def=definition(shipId),value=Number(def?.landingMultiplier);
    return def?.available&&def?.kind==='passive'&&Number.isFinite(value)&&value>=1?value:1;
  }
  function initialState(shipId=selectedShip()){
    const def=definition(shipId);
    const maxUses=Math.max(1,Math.floor(Number(def?.maxUses)||1));
    return {shipId,skillId:def?.id||'none',kind:def?.kind||'none',available:!!def?.available,
      used:false,uses:0,maxUses,cooldown:0,active:false,remaining:0,mode:0,passiveState:def?.kind==='passive'?'ready':'none',payload:{}};
  }
  function ensure(){if(!state||state.shipId!==selectedShip())state=initialState();return state;}
  function register(input){
    if(!input||!input.shipId||!input.id)throw new Error('ship skill requires shipId and id');
    const def={kind:'active',icon:'✦',summary:'',specialty:'',available:true,...input};
    installed.set(def.shipId,def);
    if(state?.shipId===def.shipId)state=initialState(def.shipId);
    sync();return def;
  }
  function beginMission(shipId=selectedShip(),options={}){
    state=initialState(shipId);sync();if(options.showIntro!==false)showIntroOnce();return snapshot();
  }
  function snapshot(){return clone(ensure());}
  function restore(saved){
    const fresh=initialState();
    state=saved&&saved.shipId===fresh.shipId&&saved.skillId===fresh.skillId?{...fresh,...clone(saved),payload:clone(saved.payload||{})}:fresh;
    state.maxUses=Math.max(1,Math.floor(Number(state.maxUses)||fresh.maxUses));
    state.uses=Math.max(0,Math.min(state.maxUses,Number.isFinite(Number(state.uses))?Math.floor(Number(state.uses)):(state.used?state.maxUses:0)));
    state.used=state.uses>=state.maxUses;state.cooldown=Math.max(0,Number(state.cooldown)||0);
    sync();return snapshot();
  }
  function context(extra={}){return {state:ensure(),definition:definition(),...extra};}
  function use(extra={}){
    const current=ensure(),def=definition(current.shipId);
    if(!def||!def.available)return {ok:false,reason:'unavailable',message:t('技能尚未安装')};
    if(def.kind!=='active')return {ok:false,reason:'passive',message:t('被动技能会自动生效')};
    if(current.payload?.yamatoFx?.phase==='charging'||current.payload?.warpChargeFx)return {ok:false,reason:'charging',message:t('技能正在聚能')};
    if(current.active&&typeof def.cycle==='function'){
      const result=def.cycle(context(extra))||{};sync();return {ok:result.ok!==false,cycled:true,...result};
    }
    if(current.cooldown>0)return {ok:false,reason:'cooldown',message:`${t('技能冷却中')} · ${current.cooldown.toFixed(1)}s`};
    if(current.used||current.uses>=current.maxUses)return {ok:false,reason:'used',message:t('本关技能次数已用完')};
    const result=typeof def.activate==='function'?(def.activate(context(extra))||{}):{ok:true};
    if(result.ok===false){sync();return result;}
    if(!result.deferConsume){current.uses=Math.min(current.maxUses,current.uses+1);current.used=current.uses>=current.maxUses;current.cooldown=Math.max(0,Number(result.cooldown??def.cooldown)||0);}
    current.active=!!result.active;
    current.remaining=Math.max(0,Number(result.duration)||0);
    if(result.payload)current.payload={...current.payload,...clone(result.payload)};
    global.SpaceGameAudio?.sfx?.(result.sound||'skill');sync();
    return {ok:true,consumed:!result.deferConsume,uses:current.uses,remainingUses:current.maxUses-current.uses,...result};
  }
  function release(extra={}){
    const current=ensure(),def=definition(current.shipId);
    if(!def?.available||typeof def.cancel!=='function')return {ok:false,reason:'not-cancellable'};
    const result=def.cancel(context(extra))||{ok:false};sync();return result;
  }
  function update(dt,dtReal=dt,extra={}){
    const current=ensure(),def=definition(current.shipId);if(!def?.available)return;
    const cooldownTick=Math.ceil(current.cooldown*10);
    current.cooldown=Math.max(0,current.cooldown-Math.max(0,Number(dtReal)||0));
    if(typeof def.update==='function')def.update(context({dt,dtReal,...extra}));
    if(current.active&&current.remaining>0){
      current.remaining=Math.max(0,current.remaining+(def.durationClock==='real'?-dtReal:-dt));
      if(current.remaining===0){current.active=false;if(typeof def.deactivate==='function')def.deactivate(context(extra));sync();}
    }
    if(Math.ceil(current.cooldown*10)!==cooldownTick)sync();
  }
  function statusLabel(current=ensure()){
    if(!current.available)return t('待安装');
    if(current.kind==='passive'){
      if(current.shipId==='waterdrop'&&current.passiveState==='fuel')return `${t('被动')} · ${t('燃料不足')}`;
      if(current.shipId==='waterdrop'&&current.cooldown>0)return `${t('被动')} · ${t('冷却')} ${current.cooldown.toFixed(1)}s`;
      return t(current.passiveState==='broken'?'已碎裂':'被动');
    }
    if(current.payload?.yamatoFx?.phase==='charging')return `${t('聚能')} ${Math.max(0,current.payload.yamatoFx.chargeRemaining).toFixed(1)}s`;
    if(current.payload?.warpChargeFx)return `${t('折跃聚能')} ${Math.max(0,current.payload.warpChargeFx.remaining).toFixed(1)}s`;
    if(current.payload?.yamatoFx?.phase==='beam')return t('发射中');
    if(current.active&&current.remaining>0)return `${t('生效中')} ${current.remaining.toFixed(1)}s`;
    if(current.used)return current.maxUses>1?`${t('已用')} ${current.uses}/${current.maxUses}`:t('已用');
    if(current.cooldown>0)return `${t('冷却')} ${current.cooldown.toFixed(1)}s · ${current.maxUses-current.uses}/${current.maxUses}`;
    return current.maxUses>1?`${t('就绪')} ${current.maxUses-current.uses}/${current.maxUses}`:t('就绪');
  }
  function resultText(){
    const current=ensure(),def=definition(current.shipId);if(!def?.available)return '';
    if(def.kind==='passive')return `${t('技能')}：${t(def.name)} · ${statusLabel(current)}`;
    return current.maxUses>1?`${t('技能')}：${t(def.name)} · ${t('已使用')} ${current.uses}/${current.maxUses}`:`${t('技能')}：${t(def.name)} · ${t(current.used?'已使用':'未使用')}`;
  }
  function syncCard(card){
    const def=definition(card.dataset.shipSkin);if(!def)return;
    const set=(key,value)=>{const node=card.querySelector(`[data-ship-skill-${key}]`);if(node)node.textContent=value;};
    set('icon',def.icon);set('name',t(def.name));set('summary',t(def.summary));set('specialty',t(def.specialty));
    set('kind',t(!def.available?'待安装':def.kind==='passive'?'被动':Number(def.maxUses)>1?'每关三次':'每关一次'));
  }
  function sync(){
    if(typeof document==='undefined')return;
    document.querySelectorAll?.('[data-ship-skin]')?.forEach(syncCard);
    const current=ensure(),def=definition(current.shipId),visible=!!def?.available;
    const hud=document.getElementById?.('shipSkillHud'),button=document.getElementById?.('shipSkillButton');
    if(hud){hud.hidden=!visible;if(visible){hud.querySelector('[data-skill-icon]').textContent=def.icon;hud.querySelector('[data-skill-name]').textContent=t(def.name);hud.querySelector('[data-skill-status]').textContent=statusLabel(current);}}
    if(button){const usable=visible&&def.kind==='active',cyclable=current.active&&typeof def?.cycle==='function',yamatoPhase=current.payload?.yamatoFx?.phase,charging=yamatoPhase==='charging'||!!current.payload?.warpChargeFx,effectBusy=!!yamatoPhase||!!current.payload?.warpChargeFx;button.hidden=!usable;button.disabled=!usable||current.cooldown>0||(effectBusy&&!charging)||(current.active&&!cyclable)||(current.used&&!current.active&&!effectBusy);button.classList.toggle('is-ready',usable&&!current.used&&current.cooldown<=0&&!effectBusy);button.classList.toggle('is-used',current.used&&!current.active&&!effectBusy);button.classList.toggle('is-pressed',charging);button.setAttribute('aria-pressed',charging?'true':'false');button.setAttribute('aria-label',`${def?.holdToCharge?t('按住使用技能'):t('使用技能')}：${t(def?.name||'')}`);button.querySelector('.ico').textContent=def?.icon||'✦';button.querySelector('.lbl').textContent=statusLabel(current);}
  }
  function introState(){try{return JSON.parse(localStorage.getItem(INTRO_KEY)||'{}')||{};}catch(_){return{};}}
  function saveIntroState(value){try{localStorage.setItem(INTRO_KEY,JSON.stringify(value));}catch(_){}}
  function showIntroOnce(){
    if(typeof document==='undefined')return;const def=definition(),seen=introState();if(!def?.available||seen[def.shipId])return;
    seen[def.shipId]=true;saveIntroState(seen);const card=document.getElementById('shipSkillIntro');if(!card)return;
    card.querySelector('[data-skill-intro-icon]').textContent=def.icon;card.querySelector('[data-skill-intro-name]').textContent=t(def.name);card.querySelector('[data-skill-intro-summary]').textContent=t(def.summary);card.querySelector('[data-skill-intro-kind]').textContent=t(def.kind==='passive'?'被动技能自动生效':def.holdToCharge?'按住 F 或技能按钮聚能 · 松开取消':Number(def.maxUses)>1?'按 F 或技能按钮使用 · 每关三次':'按 F 或技能按钮使用 · 每关一次');card.hidden=false;
  }
  function closeIntro(){const card=typeof document!=='undefined'?document.getElementById('shipSkillIntro'):null;if(card)card.hidden=true;}
  function disableIntro(){const def=definition();if(def){const seen=introState();seen[def.shipId]=true;saveIntroState(seen);}closeIntro();}
  function plannedList(){return [...new Set([...planned.keys(),...installed.keys()])].map(id=>clone(definition(id)));}
  function visualState(){return clone(ensure().payload||{});}

  global.SpaceGameShipSkills={register,definition,plannedList,landingMultiplier,resolveWarpPath,resolveYamatoShot,resolveYamatoRescueCollateral,resolveSharpAngleManeuver,visualState,beginMission,snapshot,restore,use,release,update,sync,status:()=>clone(ensure()),statusLabel,resultText,closeIntro,disableIntro};
  global.useShipSkill=()=>global.SpaceGameShipSkills.use();
  global.closeShipSkillIntro=closeIntro;global.disableShipSkillIntro=disableIntro;
})(globalThis);
