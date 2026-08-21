"use strict";

// First-paint loading sequence. It keeps the game covered until the visible
// ship art, menu score and recommended mission score have buffered enough to
// make the first interaction feel immediate.
(function installSpaceGameLoader(global){
  const overlay=global.document?.getElementById('gameLoader');
  if(!overlay){global.SpaceGameLoader=Object.freeze({begin(){return Promise.resolve();}});return;}
  const track=overlay.querySelector('[role="progressbar"]'),percent=overlay.querySelector('#gameLoaderPercent');
  const weights={runtime:.14,images:.18,menu:.43,level:.25},progress={runtime:0,images:0,menu:0,level:0};
  const startedAt=global.performance?.now?.()||Date.now();
  let begun=false,finished=false,audioApi=null;

  function render(){
    let total=0;for(const [key,weight] of Object.entries(weights))total+=weight*(progress[key]||0);
    const value=Math.max(0,Math.min(100,Math.round(total*100)));
    overlay.style.setProperty('--loader-progress',`${value}%`);track?.setAttribute('aria-valuenow',String(value));if(percent)percent.textContent=`${value}%`;
  }
  function setProgress(channel,value){progress[channel]=Math.max(progress[channel]||0,Math.min(1,Number(value)||0));render();}
  function delay(ms){return new Promise(resolve=>setTimeout(resolve,ms));}
  function imageReady(image){
    if(image.complete&&image.naturalWidth>0)return Promise.resolve(true);
    const decoded=typeof image.decode==='function'?image.decode():new Promise((resolve,reject)=>{image.addEventListener('load',resolve,{once:true});image.addEventListener('error',reject,{once:true});});
    return decoded.then(()=>true).catch(()=>false);
  }
  async function preloadImages(){
    const images=[...document.querySelectorAll('img[src]')];if(!images.length){setProgress('images',1);return;}
    let complete=0;await Promise.all(images.map(image=>imageReady(image).finally(()=>{complete++;setProgress('images',complete/images.length);})));setProgress('images',1);
  }
  function unlockMusic(){try{audioApi?.unlock?.();}catch(_){}}
  async function finish(){
    if(finished)return;finished=true;
    for(const key of Object.keys(progress))setProgress(key,1);
    const elapsed=(global.performance?.now?.()||Date.now())-startedAt;if(elapsed<2200)await delay(2200-elapsed);
    overlay.classList.add('is-leaving');document.documentElement.dataset.loaderState='complete';
    setTimeout(()=>{overlay.hidden=true;overlay.setAttribute('aria-hidden','true');},680);
  }
  async function begin(audio,options={}){
    if(begun)return;begun=true;audioApi=audio;
    overlay.addEventListener('pointerdown',unlockMusic,{capture:true,passive:true});
    overlay.addEventListener('touchstart',unlockMusic,{capture:true,passive:true});
    audio?.playMenu?.({duration:.8});
    const runtimeTask=Promise.allSettled([
      document.fonts?.ready||Promise.resolve(),
      document.readyState==='complete'?Promise.resolve():new Promise(resolve=>global.addEventListener('load',resolve,{once:true}))
    ]).then(()=>setProgress('runtime',1));
    const imageTask=preloadImages();
    const menuTask=audio?.preloadMenu?.(value=>setProgress('menu',value))||Promise.resolve(false);
    const levelTask=audio?.preloadLevel?.(options.recommendedLevel||1,{onProgress:value=>setProgress('level',value)})||Promise.resolve(false);
    Promise.resolve(menuTask).then(()=>unlockMusic()).catch(()=>setProgress('menu',1));
    await Promise.race([
      Promise.allSettled([runtimeTask,imageTask,menuTask,levelTask]),
      delay(15000)
    ]);
    await finish();
  }

  render();document.documentElement.dataset.loaderState='loading';
  global.SpaceGameLoader=Object.freeze({begin,setProgress,status:()=>({begun,finished,progress:{...progress}})});
})(globalThis);
