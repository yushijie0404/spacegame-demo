"use strict";

// Challenge budgets, star rules, progress persistence and result formatting.
// Physics and mission completion remain in the main runtime; these helpers read
// its live state only when the player starts or finishes a mission.

// 挑战模式预算经过理想转移所需速度增量后留出约 35%～70% 的操作余量。
// 第六关给足 100%：L2/L3 的三星来自路线难度，不以省燃料卡玩家。
// 第九关 40% = 18.39 u/s Δv：起点直推仍低于 36.70 u/s 的逃逸需求；
// 在 240 u 深渊点火并留出正逃逸能量时，确定性模拟剩余约 11.5%。
// scoreReserve 仅保留为高手分数路线的余量审计参考，不再直接奖励星星。
const CHALLENGE_CONFIG={
  1:{fuel:55,scoreReserve:15,parTime:150,life:0,mass:1},
  2:{fuel:70,parTime:180,life:210,mass:1},
  3:{fuel:100,scoreReserve:20,parTime:300,life:300,mass:1.2},
  4:{fuel:95,scoreReserve:18,parTime:390,life:0,mass:1},
  5:{fuel:31,parTime:300,life:0,mass:1,vInfStar:55,exitAngleStar:18},
  6:{fuel:100,parTime:480,life:0,mass:1},
  7:{fuel:100,scoreReserve:18,parTime:220,life:0,mass:1},
  8:{fuel:100,scoreReserve:20,parTime:330,life:0,mass:1},
  9:{fuel:40,scoreReserve:5,parTime:150,life:0,mass:1},
  10:{fuel:85,scoreReserve:20,parTime:190,life:0,mass:1}
};
const STAR_RULES={
  1:['完成同步轨道部署：★','在绿色目标经度内释放：+★','点火段不超过 6 次：+★'],
  2:['安全返回地球：★','全程不使用降落伞：+★','精确落入绿色着陆区：+★'],
  3:['完成重载货运对接：★★','无阶段回退完成：+★'],
  4:['安全着陆月球背面：★','精确落入绿色月背中央区：+★','单次无动力滑行至少 25 秒：+★'],
  5:['飞出绿圈且不会返回：★','逃逸余速 v∞ 至少 55 u/s：+★','穿越绿圈时方向偏差不超过 18°：+★'],
  6:['抵达 L1：★','抵达 L4 或 L5：★★','抵达 L2 或 L3：★★★'],
  7:['让小行星同时避开地球和月球：★','飞船没有在撞击中损毁：+★','单次无动力滑行至少 20 秒：+★'],
  8:['抵达另一颗太阳旁的空间站：★','全程避开两颗恒星的高温区：+★','点火段不超过 8 次：+★'],
  9:['穿过救援门并逃离黑洞：★','在半径 270 u 内完成深渊点火：+★','点火段不超过 3 次：+★'],
  10:['营救求救飞船并逃离三体系统：★','全程不进入红色潮汐危险圈：+★','无阶段回退完成：+★']
};

const SAVE_KEY='spacegame-progress-v2';
const CAMPAIGN_ACT_RANGES=Object.freeze([[1,3],[4,6],[7,8],[9,10]]);
const SpaceGameCampaign=Object.freeze({
  actComplete(actId,progress={}){
    const range=CAMPAIGN_ACT_RANGES[Number(actId)-1];if(!range)return false;
    for(let i=range[0];i<=range[1];i++)if(Number(progress?.[i]?.stars||0)<1)return false;
    return true;
  },
  completedActs(progress={}){return CAMPAIGN_ACT_RANGES.map((_,index)=>index+1).filter(id=>this.actComplete(id,progress));},
  eligibleAct(levelId,progress={},viewed=[]){
    const id=CAMPAIGN_ACT_RANGES.findIndex(([start,end])=>Number(levelId)>=start&&Number(levelId)<=end)+1;
    return id>0&&!viewed.includes(id)&&this.actComplete(id,progress)?id:0;
  }
});
globalThis.SpaceGameCampaign=SpaceGameCampaign;
function loadProgress(){
  try{
    const saved=JSON.parse(localStorage.getItem(SAVE_KEY)||'{}');
    return saved&&typeof saved==='object'?saved:{};
  }catch(_){ return {}; }
}
function starText(count){ return '★'.repeat(count)+'☆'.repeat(3-count); }
function totalCampaignStars(progress=loadProgress()){let total=0;for(let i=1;i<=10;i++)total+=Math.max(0,Math.min(3,Number(progress?.[i]?.stars||0)));return total;}
function scoreBenchmark(score){
  const value=Math.max(0,Math.round(Number(score)||0));
  if(value>=850)return {rank:'S',next:0,nextRank:'S',label:'S 级纪录'};
  if(value>=700)return {rank:'A',next:850-value,nextRank:'S',label:'A 级 · 距 S 级'};
  if(value>=550)return {rank:'B',next:700-value,nextRank:'A',label:'B 级 · 距 A 级'};
  if(value>0)return {rank:'C',next:550-value,nextRank:'B',label:'C 级 · 距 B 级'};
  return {rank:'—',next:550,nextRank:'B',label:'尚无纪录'};
}
function progressionText(value){return typeof SG_I18N!=='undefined'?SG_I18N.t(value):(globalThis.SpaceGameI18n?.t?.(value)||value);}
function scoreBenchmarkText(benchmark){return benchmark.next?`${progressionText(benchmark.label)} ${benchmark.next} ${progressionText('分')}`:progressionText(benchmark.label);}
function rewardDirectionState(progress=loadProgress()){
  const totalStars=totalCampaignStars(progress),completedActs=SpaceGameCampaign.completedActs(progress).length;
  let totalBestScore=0;for(let i=1;i<=10;i++)totalBestScore+=Math.max(0,Number(progress?.[i]?.score||0));
  const nextStarMilestone=[12,18].find(value=>totalStars<value)||null;
  return {totalStars,completedActs,totalBestScore,nextStarMilestone};
}
function campaignCatalogState(progress=loadProgress()){
  const completed=[];
  for(let i=1;i<=10;i++)if(Number(progress?.[i]?.stars||0)>0)completed.push(i);
  const recommended=Array.from({length:10},(_,i)=>i+1).find(i=>!completed.includes(i))||0;
  const pathLevels=recommended?[...completed,recommended].sort((a,b)=>a-b):completed.slice().sort((a,b)=>a-b);
  const freeLevels=Array.from({length:10},(_,i)=>i+1).filter(i=>!pathLevels.includes(i));
  return {novice:completed.length===0,recommended,pathLevels,freeLevels,completedLevels:completed};
}
function saveLevelResult(levelId,score,earnedStars=1,options={}){
  const progress=loadProgress(), previous=progress[levelId]||{score:0,stars:0};
  const currentScore=Math.max(0,Math.min(1000,Math.round(score)));
  const currentStars=Math.max(1,Math.min(3,Math.round(earnedStars)));
  const scoreSaved=options.saveScore!==false;
  const bestScore=scoreSaved?Math.max(previous.score||0,currentScore):(previous.score||0),bestStars=Math.max(previous.stars||0,currentStars);
  progress[levelId]={score:bestScore,stars:bestStars};
  try{ localStorage.setItem(SAVE_KEY,JSON.stringify(progress)); }catch(_){}
  if(typeof globalThis.queueCampaignSummary==='function')globalThis.queueCampaignSummary(levelId,progress);
  if(typeof window!=='undefined'){
    unlockAchievement(LEVEL_ACHIEVEMENTS[levelId]);
    if(levelId===8)unlockAchievement('orbital_handshake');
    if(typeof challengeMode!=='undefined'&&challengeMode&&currentStars>=3)unlockAchievement('challenge_ace');
    if(Array.from({length:10},(_,i)=>progress[i+1]).every(item=>(item?.stars||0)>0))unlockAchievement('tenfold_voyager');
    if(typeof evaluateSpecialAchievements==='function')evaluateSpecialAchievements(levelId);
  }
  updateLevelCards();
  return {score:currentScore,stars:currentStars,bestScore,bestStars,scoreSaved};
}
function updateLevelCards(){
  const progress=loadProgress();
  for(let i=1;i<=10;i++){
    const result=progress[i]||{score:0,stars:0};
    const scoreEl=document.querySelector(`[data-level-score="${i}"]`), starsEl=document.querySelector(`[data-level-stars="${i}"]`);
    if(scoreEl) scoreEl.textContent=result.score||'—';
    if(scoreEl?.parentElement)scoreEl.parentElement.dataset.rank=scoreBenchmarkText(scoreBenchmark(result.score));
    if(starsEl){ starsEl.textContent=starText(result.stars||0); starsEl.setAttribute('aria-label',(result.stars||0)+' 星'); }
  }
  if(typeof updateCampaignCatalog==='function')updateCampaignCatalog(progress);
  updateRewardDirection(progress);
  globalThis.SpaceGameShipSkins?.sync?.();
}
function updateRewardDirection(progress=loadProgress()){
  if(typeof document==='undefined'||typeof document.getElementById!=='function')return;
  const state=rewardDirectionState(progress),t=progressionText,set=(id,text)=>{const node=document.getElementById(id);if(node)node.textContent=text;};
  set('rewardStarTotal',`${state.totalStars} / 30 ${t('星')}`);
  set('rewardActProgress',`${state.completedActs} / 4 ${t('幕已完成')}`);
  const ships=globalThis.SpaceGameShipSkins?.list?.()||[],nextStarShip=ships.filter(item=>item.unlock?.type==='stars'&&Number(item.unlock.value)>state.totalStars).sort((a,b)=>a.unlock.value-b.unlock.value)[0];
  set('rewardNextUnlock',nextStarShip?`${t('再获得')} ${nextStarShip.unlock.value-state.totalStars} ${t('星解锁')} ${t(nextStarShip.name)}`:t('全部星级外观已达到条件'));
  set('rewardScoreTotal',`${t('十关最高分合计')} ${state.totalBestScore}`);
  const unlocked=ships.filter(item=>globalThis.SpaceGameShipSkins.isUnlocked(item.id)).length||1;
  set('rewardSkinProgress',`${unlocked} / ${Math.max(1,ships.length)} ${t('外观已解锁')}`);
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
  const benchmark=scoreBenchmark(result.score),rank=`<span style="color:#5b62b5;font-weight:900">${scoreBenchmarkText(benchmark)}</span>`;
  const skillText=globalThis.SpaceGameShipSkills?.resultText?.()||'',skill=skillText?`<span style="color:#5570ad">${skillText}</span><br>`:'';
  if(result.scoreSaved===false)return `本局练习得分 <b style="font-size:24px">${result.score}</b> · ${rank} · <span style="color:#e3a600;font-size:21px">${starText(result.stars)}</span><br><span style="color:#888">固定种子练习：本局星级正常结算，分数不计入最高分。</span><br>${skill}`;
  const best=(result.bestScore>result.score||result.bestStars>result.stars)?`<span style="color:#888">历史最佳 ${result.bestScore} 分 · ${starText(result.bestStars)}</span><br>`:'';
  return `本次得分 <b style="font-size:24px">${result.score}</b> · ${rank} · <span style="color:#e3a600;font-size:21px">${starText(result.stars)}</span><br>${best}${skill}`;
}
function performanceDetail(){
  if(!challengeMode) return `教学模式 · 无限燃料 · 时间 ${flightT.toFixed(1)}s（教学模式最高 600 分）`;
  return `挑战模式 · 剩余燃料 ${challengeRemainingFuel().toFixed(1)} / ${mission.fuelBudget}% · 时间 ${flightT.toFixed(1)}s`;
}
