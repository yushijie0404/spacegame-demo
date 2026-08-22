"use strict";

// Mobile HUD layout editor. DOM controls and canvas instruments share one
// orientation-aware, viewport-clamped persistence layer.
(function createSpaceGameLayout(global){
  const STORAGE_KEY='spacegame-mobile-layout-v1';
  const DOM_ITEMS=Object.freeze([
    {id:'missionHeader',label:'任务标题',selector:'.hud'},
    {id:'toolRail',label:'顶部工具栏',selector:'.tool-rail'},
    {id:'turnControls',label:'转向按键',selector:'.turn-controls'},
    {id:'thrustControl',label:'推进按键',selector:'.flight-controls .thrust'},
    {id:'skillControl',label:'技能按键',selector:'#shipSkillButton'},
    {id:'missionAction',label:'任务动作',selector:'#missionAction'}
  ]);
  const CANVAS_ITEMS=Object.freeze([
    {id:'attitude',label:'姿态仪'},
    {id:'telemetry',label:'遥测窗'},
    {id:'radar',label:'小地图'},
    {id:'exam',label:'考核清单'}
  ]);
  const ALL_ITEMS=Object.freeze([...DOM_ITEMS,...CANVAS_ITEMS]);
  let saved=readSaved(),draft=null,active=false,installed=false,drag=null,renderQueued=false;
  const canvasRects=new Map(),baseRects=new Map(),handles=new Map();
  let editor=null,statusNode=null;

  function orientation(){return global.innerWidth>=global.innerHeight?'landscape':'portrait';}
  function blankLayouts(){return {portrait:{},landscape:{}};}
  function finiteOffset(value){const x=Number(value?.x),y=Number(value?.y);return Number.isFinite(x)&&Number.isFinite(y)&&Math.abs(x)<5000&&Math.abs(y)<5000?{x,y}:{x:0,y:0};}
  function sanitize(raw){
    const clean=blankLayouts();
    for(const mode of ['portrait','landscape'])for(const item of ALL_ITEMS){
      if(raw?.[mode]?.[item.id])clean[mode][item.id]=finiteOffset(raw[mode][item.id]);
    }
    return clean;
  }
  function readSaved(){try{return sanitize(JSON.parse(global.localStorage?.getItem(STORAGE_KEY)||'{}'));}catch(_){return blankLayouts();}}
  function writeSaved(){try{global.localStorage?.setItem(STORAGE_KEY,JSON.stringify(saved));}catch(_){}}
  function cloneLayouts(value){return sanitize(JSON.parse(JSON.stringify(value||blankLayouts())));}
  function profile(){const layouts=active&&draft?draft:saved;return layouts[orientation()]||(layouts[orientation()]={});}
  function offsetFor(id){return finiteOffset(profile()[id]);}
  function setOffset(id,value){profile()[id]=finiteOffset(value);}
  function clampOffset(base,offset,margin=6){
    const vw=Math.max(1,global.innerWidth||document.documentElement.clientWidth),vh=Math.max(1,global.innerHeight||document.documentElement.clientHeight);
    const minX=margin-base.x,maxX=Math.max(minX,vw-margin-base.w-base.x),minY=margin-base.y,maxY=Math.max(minY,vh-margin-base.h-base.y);
    return {x:Math.max(minX,Math.min(maxX,offset.x)),y:Math.max(minY,Math.min(maxY,offset.y))};
  }
  function overlaps(a,b,gap=6){return a.x<b.x+b.w+gap&&a.x+a.w+gap>b.x&&a.y<b.y+b.h+gap&&a.y+a.h+gap>b.y;}
  function placedRect(base,offset){return{x:base.x+offset.x,y:base.y+offset.y,w:base.w,h:base.h};}
  function resolveCollisions(id,base,candidate){
    let offset=clampOffset(base,candidate),blocked=false;
    const others=ALL_ITEMS.filter(item=>item.id!==id).map(currentRect).filter(Boolean);
    for(let iteration=0;iteration<12;iteration++){
      const box=placedRect(base,offset),hit=others.find(other=>overlaps(box,other));if(!hit)return{offset,blocked:false};
      const choices=[
        {x:hit.x-6-base.w-base.x,y:offset.y},
        {x:hit.x+hit.w+6-base.x,y:offset.y},
        {x:offset.x,y:hit.y-6-base.h-base.y},
        {x:offset.x,y:hit.y+hit.h+6-base.y}
      ].map(value=>clampOffset(base,value)).filter(value=>!overlaps(placedRect(base,value),hit));
      if(!choices.length){blocked=true;break;}
      choices.sort((a,b)=>(a.x-offset.x)**2+(a.y-offset.y)**2-((b.x-offset.x)**2+(b.y-offset.y)**2));offset=choices[0];
    }
    blocked=blocked||others.some(other=>overlaps(placedRect(base,offset),other));return{offset,blocked};
  }
  function translateElement(element,offset){
    if(!element)return;
    element.style.translate=`${Math.round(offset.x)}px ${Math.round(offset.y)}px`;
    element.dataset.layoutOffset=`${Math.round(offset.x)},${Math.round(offset.y)}`;
  }
  function applyDom(){
    for(const item of DOM_ITEMS){
      const element=document.querySelector(item.selector);if(!element)continue;
      element.style.translate='none';
      const rect=element.getBoundingClientRect();
      if(!rect.width||!rect.height){translateElement(element,offsetFor(item.id));continue;}
      const bounded=clampOffset({x:rect.left,y:rect.top,w:rect.width,h:rect.height},offsetFor(item.id));
      setOffset(item.id,bounded);translateElement(element,bounded);
    }
    scheduleHandles();
  }
  function placeCanvas(id,rect){
    const base={x:Number(rect?.x)||0,y:Number(rect?.y)||0,w:Math.max(1,Number(rect?.w)||1),h:Math.max(1,Number(rect?.h)||1)};
    const offset=clampOffset(base,offsetFor(id));setOffset(id,offset);
    const placed={x:base.x+offset.x,y:base.y+offset.y,w:base.w,h:base.h,dx:offset.x,dy:offset.y};
    canvasRects.set(id,{base,placed});if(active)scheduleHandles();return placed;
  }
  function currentRect(item){
    if(CANVAS_ITEMS.includes(item))return canvasRects.get(item.id)?.placed||null;
    const element=document.querySelector(item.selector),rect=element?.getBoundingClientRect();
    return rect&&rect.width&&rect.height?{x:rect.left,y:rect.top,w:rect.width,h:rect.height}:null;
  }
  function baseRect(item,current){
    if(CANVAS_ITEMS.includes(item))return canvasRects.get(item.id)?.base||current;
    const offset=offsetFor(item.id);return{x:current.x-offset.x,y:current.y-offset.y,w:current.w,h:current.h};
  }
  function createHandles(){
    const layer=editor?.querySelector('.layout-editor-handles');if(!layer)return;
    for(const item of ALL_ITEMS){
      const handle=document.createElement('button');handle.type='button';handle.className='layout-drag-handle';handle.dataset.layoutId=item.id;handle.setAttribute('aria-label',`拖动${item.label}`);handle.innerHTML=`<span>${item.label}</span><i aria-hidden="true">⋮⋮</i>`;
      handle.addEventListener('pointerdown',event=>beginDrag(event,item));layer.appendChild(handle);handles.set(item.id,handle);
    }
  }
  function renderHandles(){
    renderQueued=false;if(!active)return;
    for(const item of ALL_ITEMS){
      const handle=handles.get(item.id),rect=currentRect(item);if(!handle)continue;
      if(!rect){handle.hidden=true;continue;}
      handle.hidden=false;handle.style.left=`${Math.round(rect.x)}px`;handle.style.top=`${Math.round(rect.y)}px`;handle.style.width=`${Math.round(rect.w)}px`;handle.style.height=`${Math.round(rect.h)}px`;
      baseRects.set(item.id,baseRect(item,rect));
    }
  }
  function scheduleHandles(){if(renderQueued||!active)return;renderQueued=true;global.requestAnimationFrame(renderHandles);}
  function beginDrag(event,item){
    if(!active||event.button>0)return;event.preventDefault();
    const handle=handles.get(item.id),base=baseRects.get(item.id),start=offsetFor(item.id);if(!handle||!base)return;
    drag={id:item.id,pointerId:event.pointerId,startX:event.clientX,startY:event.clientY,start,base,handle};handle.setPointerCapture?.(event.pointerId);handle.classList.add('is-dragging');
  }
  function moveDrag(event){
    if(!drag||event.pointerId!==drag.pointerId)return;event.preventDefault();
    const candidate={x:drag.start.x+event.clientX-drag.startX,y:drag.start.y+event.clientY-drag.startY},resolved=resolveCollisions(drag.id,drag.base,candidate);setOffset(drag.id,resolved.offset);applyDom();renderHandles();drag.handle.classList.toggle('is-collision',resolved.blocked);
    if(statusNode)statusNode.textContent=resolved.blocked?'这里没有足够空间，请换一个位置。':'布局已修改；模块会自动互斥并贴边。';
  }
  function endDrag(event){if(!drag||event.pointerId!==drag.pointerId)return;drag.handle.classList.remove('is-dragging','is-collision');drag=null;}
  function setEditorVisible(next){active=!!next;document.documentElement.classList.toggle('layout-editing',active);if(editor){editor.hidden=!active;editor.classList.toggle('is-visible',active);editor.setAttribute('aria-hidden',String(!active));}}
  function open(){
    install();if(active)return true;draft=cloneLayouts(saved);setEditorVisible(true);applyDom();renderHandles();
    if(statusNode)statusNode.textContent=`正在编辑${orientation()==='landscape'?'横屏':'竖屏'}布局；游戏保持暂停。`;return true;
  }
  function save(){if(!active)return false;saved=cloneLayouts(draft);writeSaved();setEditorVisible(false);draft=null;applyDom();document.dispatchEvent(new CustomEvent('spacegame-layout-change',{detail:{saved:true}}));return true;}
  function cancel(){if(!active)return false;setEditorVisible(false);draft=null;applyDom();document.dispatchEvent(new CustomEvent('spacegame-layout-change',{detail:{saved:false}}));return true;}
  function resetDraft(){if(!active)return resetAll();draft=blankLayouts();applyDom();renderHandles();if(statusNode)statusNode.textContent='已恢复默认位置；点击“保存布局”确认。';return true;}
  function resetAll(){saved=blankLayouts();draft=active?blankLayouts():null;try{global.localStorage?.removeItem(STORAGE_KEY);}catch(_){}applyDom();renderHandles();document.dispatchEvent(new CustomEvent('spacegame-layout-change',{detail:{reset:true}}));return true;}
  function install(){
    if(installed)return api;installed=true;editor=document.getElementById('layoutEditor');statusNode=document.getElementById('layoutEditorStatus');
    createHandles();editor?.querySelector('[data-layout-save]')?.addEventListener('click',save);editor?.querySelector('[data-layout-cancel]')?.addEventListener('click',cancel);editor?.querySelector('[data-layout-reset]')?.addEventListener('click',resetDraft);
    editor?.addEventListener('pointermove',moveDrag,{passive:false});editor?.addEventListener('pointerup',endDrag);editor?.addEventListener('pointercancel',endDrag);
    global.addEventListener('resize',()=>{applyDom();renderHandles();},{passive:true});global.addEventListener('orientationchange',()=>setTimeout(()=>{applyDom();renderHandles();},120),{passive:true});
    applyDom();return api;
  }
  function status(){return{active,orientation:orientation(),saved:cloneLayouts(saved),current:cloneLayouts(active&&draft?draft:saved)};}
  const api=Object.freeze({install,open,save,cancel,resetAll,resetDraft,placeCanvas,isEditing:()=>active,status});
  global.SpaceGameLayout=api;
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})(globalThis);
