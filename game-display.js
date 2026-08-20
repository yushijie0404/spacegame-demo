"use strict";

// Screen-orientation preference and the graceful fallback used by mobile browsers.
// Layout is still driven by the real viewport; this module never rotates the canvas artificially.
(function createSpaceGameDisplay(global){
  const STORAGE_KEY='spacegame-orientation-v1';
  const MODES=['auto','landscape','portrait'];
  const LABELS={auto:'自动旋转',landscape:'横屏驾驶',portrait:'竖屏驾驶'};
  let installed=false,mode=readMode(),lockFailed=false;

  function readMode(){
    try{const saved=localStorage.getItem(STORAGE_KEY);return MODES.includes(saved)?saved:'auto';}
    catch(_){return 'auto';}
  }
  function saveMode(){try{localStorage.setItem(STORAGE_KEY,mode);}catch(_){} }
  function actualOrientation(){
    if(typeof matchMedia==='function') return matchMedia('(orientation: landscape)').matches?'landscape':'portrait';
    return innerWidth>=innerHeight?'landscape':'portrait';
  }
  function isCoarse(){return typeof matchMedia==='function'&&matchMedia('(pointer: coarse)').matches;}
  function status(){
    const actual=actualOrientation(),mismatch=mode!=='auto'&&mode!==actual;
    return {mode,label:LABELS[mode],actual,mismatch,lockFailed,lockSupported:!!(screen.orientation&&screen.orientation.lock)};
  }
  function render(){
    const root=document.documentElement,info=status(),hint=document.getElementById('orientationHint');
    root.dataset.orientationPreference=mode;
    root.dataset.viewportOrientation=info.actual;
    if(!hint)return info;
    const visible=isCoarse()&&info.mismatch;
    hint.classList.toggle('is-visible',visible);
    hint.setAttribute('aria-hidden',String(!visible));
    const title=hint.querySelector('strong'),copy=hint.querySelector('span:last-child');
    if(title)title.textContent=mode==='landscape'?'建议横屏游玩':'建议竖屏游玩';
    if(copy)copy.textContent=lockFailed?'浏览器未允许自动旋转，请手动转动设备':'请转动设备以使用所选布局';
    return info;
  }
  async function requestLock(){
    lockFailed=false;
    try{
      if(mode==='auto'){
        if(screen.orientation&&screen.orientation.unlock)screen.orientation.unlock();
      }else if(screen.orientation&&screen.orientation.lock){
        await screen.orientation.lock(mode);
      }else lockFailed=true;
    }catch(_){lockFailed=true;}
    render();
  }
  function cycle(){
    mode=MODES[(MODES.indexOf(mode)+1)%MODES.length];
    saveMode();
    const info=render();
    requestLock();
    return info;
  }
  function install(){
    if(installed)return status();
    installed=true;
    addEventListener('resize',render,{passive:true});
    addEventListener('orientationchange',render,{passive:true});
    return render();
  }

  global.SpaceGameDisplay={install,cycle,status,render};
})(globalThis);
