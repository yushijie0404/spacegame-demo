"use strict";

// Keyboard, touch controls, menu dispatch, catalogue dragging and camera gestures.
// The module installs after the main runtime has declared its live state.
(function createSpaceGameInput(global){
  let installed=false,clearImpl=()=>{},resetCameraImpl=()=>{};

  function install(){
    if(installed)return;
    installed=true;
  addEventListener('keydown', e=>{
    if(document.getElementById('campaignSummary')?.classList.contains('is-visible')){if(e.code==='Escape'||e.code==='Enter'||e.code==='Space')closeCampaignSummary();e.preventDefault();return;}
    if(campaignLogOpen){if(e.code==='Escape')closeCampaignLog();e.preventDefault();return;}
    if(achievementCollectionOpen){if(e.code==='Escape'){closeAchievementDetail();closeAchievementCollection();}e.preventDefault();return;}
    keys[e.code]=true;
    if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(e.code)) e.preventDefault();
    if(e.repeat && ['KeyR','KeyT','KeyK','KeyB','KeyV','KeyH','KeyM','KeyN','KeyL','KeyC','KeyP','KeyF'].includes(e.code)) return;
    if(!e.repeat&&(e.code==='KeyA'||e.code==='KeyD'||e.code==='ArrowLeft'||e.code==='ArrowRight')) SG_AUDIO.sfx('turn');
    if(e.code==='KeyR') restartCurrent(e.shiftKey);
    if(e.code==='KeyT') setPrediction();
    if(e.code==='KeyK') toggleCameraMode();
    if(e.code==='KeyB') cycleRadar();
    if(e.code==='KeyV') cycleDial();
    if(e.code==='KeyH') toggleGuide();
    if(e.code==='KeyM') toggleAssist();
    if(e.code==='KeyN') toggleSound();
    if(e.code==='KeyE') tryMissionAction();
    if(e.code==='KeyF') tryShipSkill();
    if(e.code==='KeyL') mission&&mission.done?nextLevel():openLevelSelect();
    if(e.code==='KeyC') cycleAttitude();
    if(e.code==='KeyP') togglePause();
  });
  addEventListener('keyup', e=> keys[e.code]=false);
  const holdResetters=[];
  function clearFlightInputs(){
    keys['Space']=keys['KeyA']=keys['KeyD']=keys['KeyW']=keys['ArrowUp']=keys['ArrowLeft']=keys['ArrowRight']=false;
    holdResetters.forEach(reset=>reset());
    if(typeof SG_AUDIO!=='undefined') SG_AUDIO.stopAll();
  }
  addEventListener('blur',clearFlightInputs);
  document.addEventListener('visibilitychange',()=>{ if(document.hidden) clearFlightInputs(); });
  addEventListener('wheel', e=>{ cam.zoom = Math.min(6, Math.max(0.02, cam.zoom * (e.deltaY>0?0.9:1.12))); }, {passive:true});

  const ACTION_HANDLERS={
    prediction:()=>setPrediction(),colorassist:()=>toggleColorAssist(),hudtelemetry:()=>toggleHudInfo('telemetry'),hudgravity:()=>toggleHudInfo('gravity'),hudradar:()=>toggleHudInfo('radar'),hudguidance:()=>toggleHudInfo('guidance'),hudtargets:()=>toggleHudInfo('targets'),camera:()=>toggleCameraMode(),radar:()=>cycleRadar(),attitude:()=>cycleAttitude(),
    dial:()=>cycleDial(),guide:()=>toggleGuide(),briefing:()=>openBriefing(),science:()=>openSciencePage(false),concept:()=>reviewConceptCard(),conceptcards:()=>toggleConceptCards(),campaignlog:()=>openCampaignLog(),assist:()=>toggleAssist(),sound:()=>toggleSound(),orientation:()=>cycleScreenOrientation(),language:()=>globalThis.SpaceGameI18n?.cycle?.(),
    level:()=>openLevelSelect(),rewind:()=>rewindStage(),restart:()=>resetGame(),pause:()=>togglePause(),skill:()=>tryShipSkill(),
    mission:()=>tryMissionAction(),threeseed:()=>toggleThreeBodySeedMode(),copyseed:()=>copyThreeBodySeed(),copyperf:()=>copyPerformanceReport()
  };
  function dispatchAction(action,fromMenu=false){
    if(fromMenu&&action==='resume')togglePause();
    else if(fromMenu&&action==='restart'){paused=false;resetGame();}
    else{const handler=ACTION_HANDLERS[action];if(handler)handler();}
    if(fromMenu)syncUI();
  }
  document.querySelectorAll('[data-action]').forEach(btn=>btn.addEventListener('click',()=>dispatchAction(btn.dataset.action)));
  document.querySelectorAll('[data-menu-action]').forEach(btn=>btn.addEventListener('click',()=>dispatchAction(btn.dataset.menuAction,true)));
  document.getElementById('pauseMenu').addEventListener('click',e=>{
    if(e.target===e.currentTarget&&paused) togglePause();
  });
  document.getElementById('sciencePage').addEventListener('click',e=>{
    if(e.target===e.currentTarget)closeSciencePage();
  });
  document.querySelectorAll('[data-level-card]').forEach(card=>{
    const launch=()=>startLevel(card.dataset.levelCard);
    card.addEventListener('keydown',e=>{ if(e.target===card&&(e.key==='Enter'||e.key===' ')){ e.preventDefault(); launch(); } });
  });
  // 任务目录：触屏使用原生滑动；鼠标按住拖动，竖屏走纵向、横屏走横向。
  const levelGrid=document.querySelector('.level-grid');
  let levelDrag=null, suppressLevelClick=false;
  levelGrid.addEventListener('pointerdown',e=>{
    if(e.pointerType!=='mouse'||e.button!==0) return;
    const vertical=matchMedia('(orientation: portrait)').matches;
    levelDrag={id:e.pointerId,x:e.clientX,y:e.clientY,scrollLeft:levelGrid.scrollLeft,scrollTop:levelGrid.scrollTop,vertical,moved:false};
    levelGrid.setPointerCapture(e.pointerId);
  });
  levelGrid.addEventListener('pointermove',e=>{
    if(!levelDrag||e.pointerId!==levelDrag.id) return;
    const dx=e.clientX-levelDrag.x,dy=e.clientY-levelDrag.y,delta=levelDrag.vertical?dy:dx;
    if(!levelDrag.moved&&Math.abs(delta)>6){ levelDrag.moved=true; levelGrid.classList.add('is-dragging'); }
    if(levelDrag.moved){ e.preventDefault(); if(levelDrag.vertical)levelGrid.scrollTop=levelDrag.scrollTop-dy;else levelGrid.scrollLeft=levelDrag.scrollLeft-dx; }
  });
  function endLevelDrag(e){
    if(!levelDrag||e.pointerId!==levelDrag.id) return;
    if(levelDrag.moved){
      suppressLevelClick=true;
      requestAnimationFrame(()=>{ suppressLevelClick=false; });
    }
    levelDrag=null; levelGrid.classList.remove('is-dragging');
  }
  levelGrid.addEventListener('pointerup',endLevelDrag);
  levelGrid.addEventListener('pointercancel',endLevelDrag);
  levelGrid.addEventListener('lostpointercapture',endLevelDrag);
  levelGrid.addEventListener('click',e=>{
    if(suppressLevelClick){ e.preventDefault(); e.stopImmediatePropagation(); }
  },true);
  // 指针被目录捕获后 click 的目标可能变成 levelGrid，因此用坐标重新确认玩家点中的卡片。
  levelGrid.addEventListener('click',e=>{
    if(suppressLevelClick) return;
    if(document.getElementById('levelSelect')?.dataset.catalogMode==='novice')return;
    const direct=e.target.closest&&e.target.closest('[data-level-card]');
    const hit=document.elementFromPoint(e.clientX,e.clientY);
    const card=direct||(hit&&hit.closest&&hit.closest('[data-level-card]'));
    if(card) startLevel(card.dataset.levelCard);
  });
  const freeTaskGrid=document.getElementById('freeTaskGrid');
  if(freeTaskGrid)freeTaskGrid.addEventListener('click',e=>{
    const card=e.target.closest&&e.target.closest('[data-level-card]');
    if(card)startLevel(card.dataset.levelCard);
  });
  document.getElementById('achievementDetail').addEventListener('click',e=>{if(e.target===e.currentTarget)closeAchievementDetail();});
  document.getElementById('achievementCollection').addEventListener('click',e=>{if(e.target===e.currentTarget)closeAchievementCollection();});
  document.querySelectorAll('[data-hold]').forEach(btn=>{
    const code=btn.dataset.hold;
    const activePointers=new Set();
    const release=e=>{
      activePointers.delete(e.pointerId);
      keys[code]=activePointers.size>0;
      btn.classList.toggle('is-pressed',activePointers.size>0);
    };
    btn.addEventListener('pointerdown',e=>{
      e.preventDefault(); e.stopPropagation();
      activePointers.add(e.pointerId); btn.setPointerCapture(e.pointerId);
      keys[code]=true; btn.classList.add('is-pressed');
      if(code==='KeyA'||code==='KeyD') SG_AUDIO.sfx('turn');
    });
    btn.addEventListener('pointerup',release); btn.addEventListener('pointercancel',release); btn.addEventListener('lostpointercapture',release);
    // 捕获阶段先释放输入，避免繁重 Canvas 帧让按钮自己的 pointerup 排到下一次推进之后。
    addEventListener('pointerup',release,true); addEventListener('pointercancel',release,true);
    holdResetters.push(()=>{ activePointers.clear(); keys[code]=false; btn.classList.remove('is-pressed'); });
  });
  cam = {x:0,y:0,zoom:1.2,dragging:false,pointerId:null,startX:0,startY:0,startCamX:0,startCamY:0};
  const cameraPointers=new Map();
  let pinchState=null;
  function setCameraDragging(active){
    cam.dragging=active;
    cv.classList.toggle('is-panning',active);
  }
  function beginSingleCameraPan(point){
    pinchState=null; setCameraDragging(true);
    cam.startX=point.x; cam.startY=point.y; cam.startCamX=cam.x; cam.startCamY=cam.y;
  }
  function beginCameraPinch(){
    const pts=[...cameraPointers.values()].slice(0,2);
    if(pts.length<2) return;
    const midX=(pts[0].x+pts[1].x)/2, midY=(pts[0].y+pts[1].y)/2;
    pinchState={
      distance:Math.max(8,Math.hypot(pts[1].x-pts[0].x,pts[1].y-pts[0].y)),
      zoom:cam.zoom,
      worldX:cam.x+(midX-W/2)/cam.zoom,
      worldY:cam.y+(midY-H/2)/cam.zoom
    };
    setCameraDragging(true);
  }
  cv.addEventListener('pointerdown',e=>{
    if(e.pointerType==='mouse' && e.button!==0) return;
    e.preventDefault();
    const point={x:e.clientX,y:e.clientY};
    const inBox=box=>box&&point.x>=box.x&&point.x<=box.x+box.w&&point.y>=box.y&&point.y<=box.y+box.h;
    if(!paused&&inBox(threeBodyExamHitBox)){threeBodyExamExpanded=!threeBodyExamExpanded;return;}
    if(!paused&&inBox(attitudeHitBox)){ cycleDial(); return; }
    if(!paused&&inBox(radarHitBox)){ cycleRadar(); return; }
    if(!paused&&inBox(telemetryHitBox)){telemetryExpanded=!telemetryExpanded;if(mission){mission.toast=telemetryExpanded?'遥测已展开':'遥测已精简';mission.toastT=1.25;}return;}
    cameraPointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
    cv.setPointerCapture(e.pointerId);
    if(cameraPointers.size===1) beginSingleCameraPan(cameraPointers.get(e.pointerId));
    else if(cameraPointers.size===2) beginCameraPinch();
  });
  cv.addEventListener('pointermove',e=>{
    if(!cameraPointers.has(e.pointerId)) return;
    cameraPointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
    if(cameraPointers.size>=2 && pinchState){
      const pts=[...cameraPointers.values()].slice(0,2);
      const midX=(pts[0].x+pts[1].x)/2, midY=(pts[0].y+pts[1].y)/2;
      const distance=Math.max(8,Math.hypot(pts[1].x-pts[0].x,pts[1].y-pts[0].y));
      cam.zoom=Math.min(6,Math.max(0.02,pinchState.zoom*distance/pinchState.distance));
      cam.x=pinchState.worldX-(midX-W/2)/cam.zoom;
      cam.y=pinchState.worldY-(midY-H/2)/cam.zoom;
    }else if(cameraPointers.size===1){
      cam.x=cam.startCamX-(e.clientX-cam.startX)/cam.zoom;
      cam.y=cam.startCamY-(e.clientY-cam.startY)/cam.zoom;
    }
  });
  function endCameraPointer(e){
    if(!cameraPointers.has(e.pointerId)) return;
    cameraPointers.delete(e.pointerId);
    if(cameraPointers.size>=2) beginCameraPinch();
    else if(cameraPointers.size===1) beginSingleCameraPan([...cameraPointers.values()][0]);
    else{ pinchState=null; setCameraDragging(false); }
  }
  cv.addEventListener('pointerup',endCameraPointer);
  cv.addEventListener('pointercancel',endCameraPointer);
  cv.addEventListener('lostpointercapture',endCameraPointer);

    clearImpl=clearFlightInputs;
    resetCameraImpl=()=>{
      cameraPointers.clear();pinchState=null;
      if(typeof cam!=='undefined'&&cam){cam.dragging=false;cam.pointerId=null;}
      if(typeof cv!=='undefined')cv.classList.remove('is-panning');
    };
  }

  const api={
    install,
    clear(){clearImpl();},
    resetCameraGestures(){resetCameraImpl();},
    isInstalled(){return installed;}
  };
  global.SpaceGameInput=Object.freeze(api);
})(globalThis);
