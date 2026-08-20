"use strict";

// Challenge budgets, star rules, progress persistence and result formatting.
// Physics and mission completion remain in the main runtime; these helpers read
// its live state only when the player starts or finishes a mission.

// 挑战模式预算经过理想转移所需速度增量后留出约 35%～70% 的操作余量。
// 第六关给足 100%：L2/L3 的三星来自路线难度，不以省燃料卡玩家。
const CHALLENGE_CONFIG={
  1:{fuel:55,fuelStar:15,parTime:150,life:0,mass:1},
  2:{fuel:70,parTime:180,life:210,mass:1},
  3:{fuel:100,fuelStar:20,parTime:300,life:300,mass:1.2},
  4:{fuel:95,fuelStar:18,parTime:390,life:0,mass:1},
  5:{fuel:31,parTime:300,life:0,mass:1,vInfStar:55,exitAngleStar:18},
  6:{fuel:100,parTime:480,life:0,mass:1},
  7:{fuel:100,fuelStar:18,parTime:220,life:0,mass:1},
  8:{fuel:100,fuelStar:20,parTime:330,life:0,mass:1},
  9:{fuel:30,fuelStar:2,parTime:150,life:0,mass:1},
  10:{fuel:85,fuelStar:20,parTime:190,life:0,mass:1}
};
const STAR_RULES={
  1:['完成同步轨道部署：★','在绿色目标经度内释放：+★','挑战燃料剩余至少 15%：+★'],
  2:['安全返回地球：★','全程不使用降落伞：+★','精确落入绿色着陆区：+★'],
  3:['完成重载货运对接：★★','挑战燃料剩余至少 20%：+★'],
  4:['安全着陆月球背面：★','精确落入绿色月背中央区：+★','挑战燃料剩余至少 18%：+★'],
  5:['飞出绿圈且不会返回：★','逃逸余速 v∞ 至少 55 u/s：+★','穿越绿圈时方向偏差不超过 18°：+★'],
  6:['抵达 L1：★','抵达 L4 或 L5：★★','抵达 L2 或 L3：★★★'],
  7:['让小行星同时避开地球和月球：★','飞船没有在撞击中损毁：+★','挑战燃料剩余至少 18%：+★'],
  8:['抵达另一颗太阳旁的空间站：★','全程避开两颗恒星的高温区：+★','挑战燃料剩余至少 20%：+★'],
  9:['穿过救援门并逃离黑洞：★','在半径 270 u 内完成深渊点火：+★','挑战燃料剩余至少 2%：+★'],
  10:['营救两艘求救飞船并逃离三体系统：★','全程不进入红色潮汐危险圈：+★','挑战燃料剩余至少 20%：+★']
};

const SAVE_KEY='spacegame-progress-v2';
function loadProgress(){
  try{
    const saved=JSON.parse(localStorage.getItem(SAVE_KEY)||'{}');
    return saved&&typeof saved==='object'?saved:{};
  }catch(_){ return {}; }
}
function starText(count){ return '★'.repeat(count)+'☆'.repeat(3-count); }
function saveLevelResult(levelId,score,earnedStars=1){
  const progress=loadProgress(), previous=progress[levelId]||{score:0,stars:0};
  const currentScore=Math.max(0,Math.min(1000,Math.round(score)));
  const currentStars=Math.max(1,Math.min(3,Math.round(earnedStars)));
  const bestScore=Math.max(previous.score||0,currentScore),bestStars=Math.max(previous.stars||0,currentStars);
  progress[levelId]={score:bestScore,stars:bestStars};
  try{ localStorage.setItem(SAVE_KEY,JSON.stringify(progress)); }catch(_){}
  if(typeof window!=='undefined'){
    unlockAchievement(LEVEL_ACHIEVEMENTS[levelId]);
    if(levelId===8)unlockAchievement('orbital_handshake');
    if(typeof challengeMode!=='undefined'&&challengeMode&&currentStars>=3)unlockAchievement('challenge_ace');
    if(Array.from({length:10},(_,i)=>progress[i+1]).every(item=>(item?.stars||0)>0))unlockAchievement('tenfold_voyager');
  }
  updateLevelCards();
  return {score:currentScore,stars:currentStars,bestScore,bestStars};
}
function updateLevelCards(){
  const progress=loadProgress();
  for(let i=1;i<=10;i++){
    const result=progress[i]||{score:0,stars:0};
    const scoreEl=document.querySelector(`[data-level-score="${i}"]`), starsEl=document.querySelector(`[data-level-stars="${i}"]`);
    if(scoreEl) scoreEl.textContent=result.score||'—';
    if(starsEl){ starsEl.textContent=starText(result.stars||0); starsEl.setAttribute('aria-label',(result.stars||0)+' 星'); }
  }
}
function challengeLifeEnabled(){ return challengeMode&&(level===2||level===3); }
function challengeRemainingFuel(){ return Math.max(0,(mission?.fuelBudget||0)-(mission?.fuelUsed||0)); }
function performanceScore(){
  const cfg=CHALLENGE_CONFIG[level],timeRatio=Math.max(0,Math.min(1,(cfg.parTime*2-flightT)/cfg.parTime));
  if(!challengeMode) return Math.round(350+250*timeRatio); // 教学分最高 600，星级固定为一星。
  const fuelRatio=cfg.fuel>0?Math.max(0,Math.min(1,challengeRemainingFuel()/cfg.fuel)):0;
  return Math.round(440+300*fuelRatio+260*timeRatio);
}
function evaluateStars(bonuses,forcedStars=null){
  if(!challengeMode) return {stars:1,items:[{ok:true,label:'教学模式完成任务：获得基础星'}],penalty:false};
  let stars=forcedStars===null?1+bonuses.filter(item=>item.ok).length:forcedStars;
  const penalty=challengeLifeEnabled()&&mission.lifeExpired;
  if(penalty) stars=Math.max(1,stars-1);
  return {stars:Math.max(1,Math.min(3,stars)),items:[{ok:true,label:'完成本关：基础星'},...bonuses],penalty};
}
function starBreakdownHtml(starResult){
  const rows=starResult.items.map(item=>`${item.ok?'✅':'⬜'} ${item.label}`).join('<br>');
  return rows+(starResult.penalty?'<br><span style="color:#c43d4b">⚠️ 生命维持耗尽：本次扣 1 星</span>':'');
}

// 评分：剩余燃料越多越好，耗时越短越好；船员死亡/生命耗尽大幅降档
function calcScore(){
  const fuelScore = rocket.fuel * 5;                                   // 0~500
  const timeScore = Math.max(0, 500 - flightT);                        // 越快越高
  let score = fuelScore + timeScore;
  let grade, note;
  if(rocket.crewDead){
    score *= 0.2; grade='D';
    note = '⚰️ ' + rocket.deadReason + '——任务失败：货物到了，人没了';
  }else if(score>=800){ grade='S'; note='教科书级的完美飞行！'; }
  else if(score>=650){ grade='A'; note='出色的航行！'; }
  else if(score>=450){ grade='B'; note='任务完成，还有优化空间'; }
  else { grade='C'; note='勉强抵达，燃料和时间都很惊险'; }
  return {score:Math.round(score), grade, note,
    fuel:rocket.fuel.toFixed(0), time:flightT.toFixed(1),
    maxG:(rocket.maxG/G_REF).toFixed(1)};
}
function resultLine(result){
  const best=(result.bestScore>result.score||result.bestStars>result.stars)?`<span style="color:#888">历史最佳 ${result.bestScore} 分 · ${starText(result.bestStars)}</span><br>`:'';
  return `本次得分 <b style="font-size:24px">${result.score}</b> · <span style="color:#e3a600;font-size:21px">${starText(result.stars)}</span><br>${best}`;
}
function performanceDetail(){
  if(!challengeMode) return `教学模式 · 无限燃料 · 时间 ${flightT.toFixed(1)}s（教学模式最高 600 分）`;
  return `挑战模式 · 剩余燃料 ${challengeRemainingFuel().toFixed(1)} / ${mission.fuelBudget}% · 时间 ${flightT.toFixed(1)}s`;
}
