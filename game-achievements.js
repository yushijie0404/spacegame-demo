"use strict";

const ACHIEVEMENT_KEY='spacegame-achievements-v1';
const ACHIEVEMENTS=[
  {id:'first_flame',title:'点火许可',icon:'flame',accent:'#ff9f43',accent2:'#ef476f',method:'第一次按下推进，让飞船真正开始运动。',joke:'万事开头难，除了火箭——它的开头主要是热。'},
  {id:'first_orbit',title:'横着掉下去',icon:'orbit',accent:'#4cc9f0',accent2:'#4361ee',method:'形成闭合地球轨道，并让近地点安全离开地表。',joke:'恭喜，你终于学会了持续横着掉下去。'},
  {id:'geo_postman',title:'静止的快递员',icon:'satellite',accent:'#ffd166',accent2:'#ff9f43',method:'完成第一关，把卫星部署到地球同步轨道。',joke:'站着不动，其实需要跑得非常快。'},
  {id:'silk_wings',title:'相信一块布',icon:'chute',accent:'#ff7eb6',accent2:'#7de3ff',method:'第二关下降时亲手打开降落伞。',joke:'承认自己需要一块布，是成熟航天员的表现。'},
  {id:'homecoming',title:'回家别砸门',icon:'home',accent:'#5fd068',accent2:'#4cc9f0',method:'完成第二关，让载人飞船安全返回地球。',joke:'回家最难的部分，是别把家门口砸出一个坑。'},
  {id:'orbital_handshake',title:'轨道握手',icon:'dock',accent:'#7de3ff',accent2:'#8b7dff',method:'完成一次空间站对接。第三关或第八关均可。',joke:'宇宙中最昂贵的“轻轻碰一下”。'},
  {id:'far_side_footprint',title:'月背脚印',icon:'moon',accent:'#e8edf2',accent2:'#7f8ca6',method:'完成第四关，在月球背面动力着陆。',joke:'这里信号不好，风景倒是绝对没人抢。'},
  {id:'lunar_slingshot',title:'借力不还',icon:'sling',accent:'#c99cff',accent2:'#4cc9f0',method:'完成第五关，借月球引力飞出绿色逃逸圈。',joke:'月球没推你，它只是很礼貌地借给你一点速度。'},
  {id:'balance_artist',title:'引力端水大师',icon:'balance',accent:'#ffd166',accent2:'#5fd068',method:'完成第六关，停稳在任意一个地月引力平衡点。',joke:'你停在了一个连引力都拿不定主意的地方。'},
  {id:'asteroid_whisperer',title:'小行星劝退员',icon:'asteroid',accent:'#d8a16f',accent2:'#ef6f4b',method:'完成第七关，让小行星预测轨迹同时避开地球和月球。',joke:'拯救世界完成。飞船刮蹭赔偿单稍后寄到。'},
  {id:'binary_commuter',title:'双日通勤',icon:'binary',accent:'#ffb142',accent2:'#9fdcff',method:'完成第八关，穿越双星引力通道并与暮光站对接。',joke:'一颗太阳嫌通勤不够难，于是又加了一颗。'},
  {id:'abyss_return',title:'深渊回信',icon:'abyss',accent:'#f4f7ff',accent2:'#a66cff',method:'完成第九关，从黑洞深渊点火并逃回救援圈外。',joke:'你赢过了黑洞，但任务中心的钟先老了。'},
  {id:'chaos_surfer',title:'混沌救援队长',icon:'chaos',accent:'#ff8fba',accent2:'#6fdcff',method:'完成最终关，营救两艘求救飞船并逃离三体系统。',joke:'三颗太阳都不知道下一步，你还顺手救了两船人。'},
  {id:'five_g_club',title:'5G 俱乐部',icon:'bolt',accent:'#ef476f',accent2:'#ffb142',method:'飞行中承受至少 5G，并保持飞船与船员完好。',joke:'脸留在了座椅上，灵魂勉强跟了上来。'},
  {id:'challenge_ace',title:'挑战王牌',icon:'star',accent:'#fff0a8',accent2:'#f0a500',method:'在任意一关的挑战模式中获得三星。',joke:'无限燃料是教学。你显然没在听课。'},
  {id:'tenfold_voyager',title:'十界远航者',icon:'crown',accent:'#7de3ff',accent2:'#ffd166',method:'完成全部十个关卡。星级不限，活着回来就算。',joke:'十关之后，你已具备把任何问题解释成轨道力学的资格。'},
  {id:'blind_navigator',title:'关掉答案飞',icon:'orbit',accent:'#ffd166',accent2:'#4cc9f0',method:'在挑战模式中关闭轨迹预测，并全程不再开启直至通关。',joke:'预测线休假了。牛顿本人被临时叫来导航。'},
  {id:'pulse_economist',title:'六句话说完',icon:'bolt',accent:'#ffb142',accent2:'#ef476f',method:'在任意挑战任务中，用不超过 6 个点火段完成任务。',joke:'发动机发言很少，但每一句都切中轨道。'},
  {id:'silent_coast',title:'关机漂流者',icon:'sling',accent:'#9fdcff',accent2:'#8b7dff',method:'在挑战任务中完成一次至少 30 秒的连续无动力滑行并通关。',joke:'最长的一段操作，是坚定地什么也不做。'},
  {id:'lagrange_collector',title:'换个地方停车',icon:'balance',accent:'#5fd068',accent2:'#ffd166',method:'分别从至少两个不同的拉格朗日点完成第六关。',joke:'宇宙有五个停车位，你拒绝办固定月卡。'},
  {id:'gentle_persuasion',title:'轻轻劝退',icon:'asteroid',accent:'#8be39a',accent2:'#d8a16f',method:'先软着陆小行星，再用持续推力完成行星防御。',joke:'没有撞击，没有爆炸，只有一场很有推力的谈判。'},
  {id:'kinetic_answer',title:'以舰作锤',icon:'asteroid',accent:'#ef476f',accent2:'#ffb142',method:'使用动能撞击路线完成第七关。',joke:'任务书写着“改变轨道”，你选择了最有标点的一种。'},
  {id:'clean_run',title:'不读档的人',icon:'crown',accent:'#f4f7ff',accent2:'#7de3ff',method:'在挑战模式中不使用阶段回退完成任意任务。',joke:'时间线只有一条，因为你没给宇宙反悔的机会。'},
  {id:'prisoner_7251',title:'囚犯7251的狱牌',icon:'prison',accent:'#d4d8df',accent2:'#ef6f4b',method:'使用休伯利安号的大和炮击毁友方空间站。',joke:'他说是猫碰撒了咖啡让发射按钮短路了，猫听了也直摇头。'},
  {id:'double_birds',title:'一箭双雕',icon:'double',accent:'#69eaff',accent2:'#ffb866',method:'用一发大和炮同时击毁第十关两艘求救飞船。',joke:'任务写的是营救两艘。你只看见了“两艘”。'},
  {id:'inertia_pilot',title:'惯性很有主见',icon:'satellite',accent:'#c99cff',accent2:'#4cc9f0',method:'在纯惯性姿态下累计飞行至少 30 秒并完成挑战任务。',joke:'飞船不替你转弯。它只是安静地尊重你的决定。'}
];
globalThis.SpaceGameAchievementContent=ACHIEVEMENTS;
const LEVEL_ACHIEVEMENTS={1:'geo_postman',2:'homecoming',3:'orbital_handshake',4:'far_side_footprint',5:'lunar_slingshot',6:'balance_artist',7:'asteroid_whisperer',8:'binary_commuter',9:'abyss_return',10:'chaos_surfer'};
function achievementIconSvg(kind){
  const paths={
    flame:'<path d="M32 8c8 8 11 16 8 25-2 6-7 10-8 19-1-8-8-10-9-18-2-9 4-17 9-26Z"/><path d="M32 31c4 5 5 9 0 17-5-7-4-12 0-17Z" class="fill"/>',
    orbit:'<ellipse cx="32" cy="32" rx="25" ry="12" transform="rotate(-25 32 32)"/><circle cx="32" cy="32" r="7"/><circle cx="53" cy="19" r="4" class="fill"/>',
    satellite:'<rect x="25" y="22" width="14" height="20" rx="3"/><path d="M25 26H8v12h17M39 26h17v12H39M12 26v12M52 26v12M32 15v7M28 15h8"/>',
    chute:'<path d="M9 29a23 19 0 0 1 46 0c-7-4-12-4-18 0-4-4-7-4-11 0-6-4-11-4-17 0Z"/><path d="m10 29 18 24m26-24L36 53M26 29l5 24m7-24-5 24M27 53h10"/>',
    home:'<circle cx="32" cy="34" r="20"/><path d="M15 30c8 1 8-8 16-6 6 2 5 8 12 8 4 0 7 3 8 7M22 48c4-5 3-10-2-13M51 13c-7 0-12 4-15 10"/><path d="m46 8 6 5-7 4"/>',
    dock:'<path d="M8 20h16v9h8v6h-8v9H8M56 20H40v9h-8v6h8v9h16"/><path d="M5 27v10M59 27v10"/>',
    moon:'<path d="M43 10a22 22 0 1 0 9 38A19 19 0 0 1 43 10Z"/><path d="m22 43 8 4 8-4M30 47v8M25 55h10"/>',
    sling:'<path d="M13 47c3-24 16-35 36-28"/><path d="m43 10 8 9-11 5"/><circle cx="25" cy="35" r="8"/><path d="M38 49c7-1 12-5 15-11"/>',
    balance:'<path d="M32 11v41M16 19h32M12 52h40"/><path d="m18 20-9 19h18L18 20Zm28 0-9 19h18L46 20Z"/>',
    asteroid:'<path d="m15 22 8-10 15-2 11 8 5 14-6 15-13 7-15-5-9-13 4-14Z"/><circle cx="28" cy="27" r="5"/><circle cx="42" cy="39" r="4"/><path d="M7 53 20 40m-12 4-1 9 9-1"/>',
    binary:'<circle cx="22" cy="31" r="11"/><circle cx="45" cy="27" r="9"/><path d="M22 13V7M22 55v-6M4 31h6M34 31h5M45 12V7M45 48v-6M56 27h5"/>',
    abyss:'<circle cx="32" cy="32" r="12" class="fill"/><ellipse cx="32" cy="32" rx="27" ry="10" transform="rotate(-12 32 32)"/><path d="M9 23c10-13 36-17 47-2M8 42c11 10 35 14 48 1"/>',
    chaos:'<ellipse cx="24" cy="30" rx="20" ry="9" transform="rotate(35 24 30)"/><ellipse cx="40" cy="30" rx="20" ry="9" transform="rotate(-35 40 30)"/><ellipse cx="32" cy="38" rx="20" ry="9" transform="rotate(90 32 38)"/><circle cx="20" cy="20" r="3" class="fill"/><circle cx="45" cy="23" r="3" class="fill"/><circle cx="31" cy="49" r="3" class="fill"/>',
    bolt:'<path d="M36 6 16 35h14l-3 23 21-32H34l2-20Z" class="fill"/>',
    star:'<path d="m32 7 7 16 18 2-14 12 4 18-15-9-15 9 4-18L7 25l18-2 7-16Z"/>',
    crown:'<path d="m9 19 12 10 11-18 11 18 12-10-5 31H14L9 19Z"/><path d="M15 42h34M20 50v5m12-5v5m12-5v5"/>',
    prison:'<path d="M15 8h29l8 8v40H15Z"/><circle cx="43" cy="17" r="3"/><path d="M22 25h23M22 46h23M23 30v11m7-11v11m7-11v11m7-11v11"/><text x="32" y="53" text-anchor="middle" class="fill" style="font:900 8px sans-serif">7251</text>',
    double:'<path d="M7 32h27m0 0 12-14m-12 14 12 14"/><path d="m25 25 10 7-10 7" class="fill"/><circle cx="51" cy="15" r="7"/><circle cx="51" cy="49" r="7"/><circle cx="51" cy="15" r="2" class="fill"/><circle cx="51" cy="49" r="2" class="fill"/>'
  };
  return `<svg viewBox="0 0 64 64" aria-hidden="true">${paths[kind]||paths.star}</svg>`;
}
function achievementBadgeMarkup(item,locked=false){
  return `<div class="medal${locked?' is-locked':''}" style="--badge-accent:${item.accent};--badge-accent2:${item.accent2}"><span class="medal-ribbon left"></span><span class="medal-ribbon right"></span><span class="medal-disk"><span class="medal-core">${locked?'':achievementIconSvg(item.icon)}</span></span></div>`;
}
function loadAchievementState(){try{const saved=JSON.parse(localStorage.getItem(ACHIEVEMENT_KEY)||'{}');return saved&&typeof saved==='object'?saved:{}}catch(_){return{}}}
let achievementState=loadAchievementState(),achievementCollectionOpen=false,achievementToastQueue=[],achievementToastTimer=null,achievementFlightCheckT=0;
function saveAchievementState(){try{localStorage.setItem(ACHIEVEMENT_KEY,JSON.stringify(achievementState));}catch(_){}}
function achievementUnlocked(id){return !!achievementState[id];}
function unlockAchievement(id,{silent=false}={}){
  const item=ACHIEVEMENTS.find(a=>a.id===id);if(!item||achievementUnlocked(id))return false;
  achievementState[id]={unlockedAt:new Date().toISOString()};saveAchievementState();updateAchievementCount();
  if(achievementCollectionOpen)renderAchievements();
  globalThis.SpaceGameShipSkins?.sync?.();
  if(typeof updateRewardDirection==='function')updateRewardDirection();
  if(!silent)queueAchievementToast(item);
  return true;
}
function updateAchievementCount(){const el=document.getElementById('achievementCount'),count=ACHIEVEMENTS.filter(a=>achievementUnlocked(a.id)).length,t=value=>globalThis.SpaceGameI18n?.t(value)||value;if(el)el.textContent=`${count}/${ACHIEVEMENTS.length}`;const summary=document.getElementById('achievementSummary');if(summary)summary.textContent=`${t('已解锁')} ${count} / ${ACHIEVEMENTS.length} · ${t('勋章邀请你尝试不同路线与驾驶限制')}`;}
function renderAchievements(){
  const grid=document.getElementById('achievementGrid');if(!grid)return;grid.replaceChildren();
  for(const item of ACHIEVEMENTS){const unlocked=achievementUnlocked(item.id),card=document.createElement('button');card.type='button';card.className='achievement-card'+(unlocked?'':' is-locked');card.style.setProperty('--badge-accent',item.accent);card.style.setProperty('--badge-accent2',item.accent2);card.setAttribute('aria-label',`${item.title}，${unlocked?'已解锁':'未解锁'}`);card.innerHTML=achievementBadgeMarkup(item,!unlocked)+`<div class="achievement-state">${unlocked?'✓ 已解锁':'○ 尚未解锁'}</div><h2>${item.title}</h2><p class="achievement-method ${unlocked?'':'achievement-hint'}">${unlocked?'点击查看勋章吐槽':'解锁方法：'+item.method}</p>`;card.addEventListener('click',()=>openAchievementDetail(item.id));grid.appendChild(card);}
  updateAchievementCount();
}
function openAchievementCollection(){achievementCollectionOpen=true;paused=true;closeAchievementDetail();renderAchievements();document.getElementById('achievementCollection').classList.add('is-visible');}
function closeAchievementCollection(){achievementCollectionOpen=false;closeAchievementDetail();document.getElementById('achievementCollection').classList.remove('is-visible');}
function openAchievementDetail(id){const item=ACHIEVEMENTS.find(a=>a.id===id);if(!item)return;const unlocked=achievementUnlocked(id);document.getElementById('achievementDetailBadge').innerHTML=achievementBadgeMarkup(item,!unlocked);document.getElementById('achievementDetailTitle').textContent=item.title;const state=achievementState[id],date=state?.unlockedAt?new Date(state.unlockedAt).toLocaleDateString('zh-CN'):'';document.getElementById('achievementDetailStatus').textContent=unlocked?`已解锁${date?' · '+date:''}`:'尚未解锁';document.getElementById('achievementDetailQuote').textContent=unlocked?'“'+item.joke+'”':'这枚勋章现在还是空的。先给它一个值得吐槽的故事。';document.getElementById('achievementDetailRequirement').textContent=(unlocked?'解锁条件：':'解锁方法：')+item.method;document.getElementById('achievementDetail').classList.add('is-visible');}
function closeAchievementDetail(){document.getElementById('achievementDetail')?.classList.remove('is-visible');}
function queueAchievementToast(item){
  // Headless regression harnesses intentionally provide only a tiny DOM shim.
  // Keep persistence testable there without pretending the visual toast exists.
  const toast=typeof document!=='undefined'&&document.getElementById?document.getElementById('achievementToast'):null;
  if(!toast||!toast.classList||!toast.style||typeof toast.style.setProperty!=='function'||typeof requestAnimationFrame!=='function'||typeof setTimeout!=='function')return;
  achievementToastQueue.push(item);if(!achievementToastTimer)showNextAchievementToast();
}
function showNextAchievementToast(){
  const toast=document.getElementById('achievementToast'),item=achievementToastQueue.shift();if(!toast||!item){achievementToastTimer=null;return;}
  if(typeof SG_AUDIO!=='undefined') SG_AUDIO.sfx('achievement');
  toast.style.setProperty('--toast-accent',item.accent);document.getElementById('achievementToastBadge').innerHTML=achievementBadgeMarkup(item,false);document.getElementById('achievementToastName').textContent=item.title;document.getElementById('achievementToastJoke').textContent=item.joke;requestAnimationFrame(()=>toast.classList.add('is-visible'));
  achievementToastTimer=setTimeout(()=>{toast.classList.remove('is-visible');achievementToastTimer=setTimeout(showNextAchievementToast,450);},3600);
}
function syncProgressAchievements(){
  const progress=loadProgress();let completed=0,hasOrbitHistory=false;
  for(let i=1;i<=10;i++){if((progress[i]?.stars||0)>0){completed++;unlockAchievement(LEVEL_ACHIEVEMENTS[i],{silent:true});if([1,3,4,5,6,7,8].includes(i))hasOrbitHistory=true;if(i===8)unlockAchievement('orbital_handshake',{silent:true});if((progress[i]?.stars||0)>=3)unlockAchievement('challenge_ace',{silent:true});}}
  if(hasOrbitHistory)unlockAchievement('first_orbit',{silent:true});if(completed===10)unlockAchievement('tenfold_voyager',{silent:true});updateAchievementCount();
}
function recordLagrangeAchievementVisit(pointId){
  const id=Math.max(1,Math.min(5,Number(pointId)||1)),visits=Array.isArray(achievementState._lagrangeVisits)?achievementState._lagrangeVisits.slice():[];
  if(!visits.includes(id)){visits.push(id);achievementState._lagrangeVisits=visits.sort((a,b)=>a-b);saveAchievementState();}
  if(visits.length>=2)unlockAchievement('lagrange_collector');
  return visits.slice();
}
function evaluateSpecialAchievements(levelId){
  if(!mission)return [];
  const unlocked=[] ,award=id=>{if(unlockAchievement(id))unlocked.push(id);};
  if(Number(levelId)===6){const before=achievementUnlocked('lagrange_collector');recordLagrangeAchievementVisit(mission.lagrangeTarget);if(!before&&achievementUnlocked('lagrange_collector'))unlocked.push('lagrange_collector');}
  if(Number(levelId)===7){if(mission.asteroidImpact)award('kinetic_answer');else if(mission.asteroidSoftContact)award('gentle_persuasion');}
  if(typeof challengeMode==='undefined'||!challengeMode)return unlocked;
  if(!mission.predictionUsed)award('blind_navigator');
  if((mission.burnCount||0)>0&&mission.burnCount<=6)award('pulse_economist');
  if((mission.longestCoast||0)>=30)award('silent_coast');
  if((mission.rewindCount||0)===0)award('clean_run');
  if((mission.inertialTime||0)>=30)award('inertia_pilot');
  return unlocked;
}
globalThis.evaluateSpecialAchievements=evaluateSpecialAchievements;
