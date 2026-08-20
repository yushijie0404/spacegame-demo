"use strict";

// Small, independent metaprogression layer. The main progress save only records
// scores and stars; upgrade points, reward claims and upgrade levels live here.
(function createSpacecraftUpgrades(global){
  const STORAGE_KEY='spacegame-upgrades-v1';
  const MAX_LEVEL=3;
  const UPGRADE_TYPES=['engine','structure'];
  const emptyState=()=>({points:0,engine:0,structure:0,completionRewards:[],challengeRewards:[]});
  const clampLevel=value=>Math.max(0,Math.min(MAX_LEVEL,Math.floor(Number(value)||0)));
  const normalizeIds=value=>Array.isArray(value)?Array.from(new Set(value.map(String).filter(id=>/^([1-9]|10)$/.test(id)))):[];
  function normalize(value){
    const source=value&&typeof value==='object'?value:{};
    return {
      points:Math.max(0,Math.floor(Number(source.points)||0)),
      engine:clampLevel(source.engine),
      structure:clampLevel(source.structure),
      completionRewards:normalizeIds(source.completionRewards),
      challengeRewards:normalizeIds(source.challengeRewards)
    };
  }
  function read(){
    try{return normalize(JSON.parse(localStorage.getItem(STORAGE_KEY)||'{}'));}
    catch(_){return emptyState();}
  }
  let current=read();
  function persist(){
    try{localStorage.setItem(STORAGE_KEY,JSON.stringify(current));}catch(_){}
    return state();
  }
  function state(){return {...current,completionRewards:current.completionRewards.slice(),challengeRewards:current.challengeRewards.slice()};}
  function reload(){current=read();return state();}
  function recordResult(levelId,{completed=true,challenge=false,stars=1}={}){
    const id=String(levelId),earned=[];
    if(!/^([1-9]|10)$/.test(id))return {earned:0,reasons:earned,state:state()};
    if(completed&&!current.completionRewards.includes(id)){
      current.completionRewards.push(id);current.points++;earned.push('completion');
    }
    if(challenge&&Number(stars)>=3&&!current.challengeRewards.includes(id)){
      current.challengeRewards.push(id);current.points++;earned.push('challenge-three-star');
    }
    if(earned.length)persist();
    return {earned:earned.length,reasons:earned,state:state()};
  }
  function reconcileProgress(progress){
    let earned=0;
    if(progress&&typeof progress==='object'){
      for(let levelId=1;levelId<=10;levelId++){
        const stars=Math.max(0,Number(progress[levelId]?.stars)||0);
        if(stars>0)earned+=recordResult(levelId,{completed:true,challenge:stars>=3,stars}).earned;
      }
    }
    return {earned,state:state()};
  }
  function purchase(type){
    if(!UPGRADE_TYPES.includes(type))return {ok:false,reason:'unknown',state:state()};
    if(current[type]>=MAX_LEVEL)return {ok:false,reason:'max',state:state()};
    if(current.points<1)return {ok:false,reason:'points',state:state()};
    current.points--;current[type]++;persist();
    return {ok:true,reason:'purchased',state:state()};
  }
  function fuelMultiplier(isChallenge){return isChallenge?1-current.engine*.04:1;}
  function landingMultiplier(isChallenge){return isChallenge?1+current.structure*.05:1;}
  function effects(isChallenge=true){
    return {
      engineLevel:current.engine,structureLevel:current.structure,
      fuelSavingPercent:isChallenge?current.engine*4:0,
      landingBonusPercent:isChallenge?current.structure*5:0,
      fuelMultiplier:fuelMultiplier(isChallenge),landingMultiplier:landingMultiplier(isChallenge)
    };
  }
  if(typeof document!=='undefined'){
    document.addEventListener('keydown',event=>{
      if(event.key==='Escape')document.getElementById('upgradeBay')?.classList.remove('is-visible');
    });
  }
  global.SpaceGameUpgrades={STORAGE_KEY,MAX_LEVEL,state,reload,recordResult,reconcileProgress,purchase,fuelMultiplier,landingMultiplier,effects};
})(globalThis);
