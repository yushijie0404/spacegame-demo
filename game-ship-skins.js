"use strict";

// Player-selectable spacecraft hulls. The separate skill module may add a
// bounded tool, while collision geometry and mission rules stay authoritative.
(function createShipSkinSystem(global){
  const STORAGE_KEY='spacegame-ship-skin-v1';
  const OWNED_KEY='spacegame-ship-skin-owned-v2';
  const DEVELOPER_KEY='spacegame-developer-mode-v1';
  const SKINS=[
    {id:'rocket',name:'星际快递号',tag:'经典火箭',description:'白色装甲、青色座舱与红色短翼；皮实耐用，送货与着陆容错高。',unlock:{type:'default'}},
    {id:'swordwing',name:'飞天一号',tag:'剑形飞行器',description:'按参考图制作的白色双剑机首俯视外形。',unlock:{type:'stars',value:12,text:'累计获得 12 星解锁'}},
    {id:'hyperion',name:'休伯利安号',tag:'人族战列巡航舰',description:'横向重装舰首、细长中轴、双圆主翼与短促推进器尾段。',unlock:{type:'achievement',value:'challenge_ace',text:'获得“挑战王牌”勋章解锁'}},
    {id:'waterdrop',name:'水滴号',tag:'强相互作用力探测器',description:'浑圆舰首、极尖尾部与映照星海的完美镜面外壳。',unlock:{type:'stars',value:18,text:'累计获得 18 星解锁'}}
  ];
  function loadOwned(){
    try{
      const saved=JSON.parse(localStorage.getItem(OWNED_KEY)||'null');
      if(Array.isArray(saved))return new Set(['rocket',...saved.filter(id=>SKINS.some(s=>s.id===id))]);
      const legacy=localStorage.getItem(STORAGE_KEY),migrated=new Set(['rocket']);
      if(legacy&&legacy!=='rocket'&&SKINS.some(s=>s.id===legacy))migrated.add(legacy);
      localStorage.setItem(OWNED_KEY,JSON.stringify([...migrated]));return migrated;
    }catch(_){return new Set(['rocket']);}
  }
  const owned=loadOwned();
  function loadDeveloperMode(){try{return localStorage.getItem(DEVELOPER_KEY)==='true';}catch(_){return false;}}
  let developerMode=loadDeveloperMode();
  function totalStars(){
    try{const progress=typeof loadProgress==='function'?loadProgress():JSON.parse(localStorage.getItem('spacegame-progress-v2')||'{}');let total=0;for(let i=1;i<=10;i++)total+=Math.max(0,Math.min(3,Number(progress?.[i]?.stars||0)));return total;}catch(_){return 0;}
  }
  function isEarned(id){
    const skin=SKINS.find(s=>s.id===id);if(!skin)return false;
    if(owned.has(id)||skin.unlock.type==='default')return true;
    if(skin.unlock.type==='stars')return totalStars()>=skin.unlock.value;
    if(skin.unlock.type==='achievement')return typeof achievementUnlocked==='function'&&achievementUnlocked(skin.unlock.value);
    return false;
  }
  function isUnlocked(id){return developerMode||isEarned(id);}
  function unlockText(id){const skin=SKINS.find(s=>s.id===id);return skin?.unlock?.text||'默认解锁';}
  function load(){
    try{const saved=localStorage.getItem(STORAGE_KEY);return SKINS.some(s=>s.id===saved)?saved:'rocket';}catch(_){return'rocket';}
  }
  let selected=load();
  function current(){return selected;}
  function details(){return SKINS.find(s=>s.id===selected)||SKINS[0];}
  function sync(){
    if(typeof document==='undefined')return;
    document.documentElement.dataset.shipSkin=selected;
    document.documentElement.dataset.developerMode=String(developerMode);
    document.querySelectorAll('[data-ship-skin]').forEach(card=>{
      const active=card.dataset.shipSkin===selected,earned=isEarned(card.dataset.shipSkin),unlocked=developerMode||earned;card.classList.toggle('is-selected',active);card.classList.toggle('is-locked',!unlocked);card.setAttribute('aria-pressed',String(active));card.setAttribute('aria-disabled',String(!unlocked));
      const requirement=card.querySelector?.('[data-ship-unlock]'),t=value=>global.SpaceGameI18n?.t(value)||value;if(requirement)requirement.textContent=developerMode&&!earned?`🧪 ${t('开发者测试')}`:earned?t('✓ 已解锁'):`🔒 ${t(unlockText(card.dataset.shipSkin))}`;
    });
    const label=document.getElementById('shipSkinCurrent');if(label)label.textContent=details().name;
    const button=document.getElementById('developerModeToggle'),stateLabel=document.getElementById('developerModeState'),hint=document.getElementById('shipSkinDeveloperHint');
    if(button){button.classList.toggle('is-on',developerMode);button.setAttribute('aria-pressed',String(developerMode));}
    if(stateLabel)stateLabel.textContent=(global.SpaceGameI18n?.t(developerMode?'开启':'关闭')||(developerMode?'开启':'关闭'));
    if(hint)hint.hidden=!developerMode;
    global.SpaceGameShipSkills?.sync?.();
  }
  function select(id){
    if(!SKINS.some(s=>s.id===id))return selected;
    if(!isUnlocked(id)){const status=typeof document!=='undefined'?document.getElementById('shipSkinUnlockStatus'):null,t=value=>global.SpaceGameI18n?.t(value)||value;if(status)status.textContent=`${t('尚未解锁：')}${t(unlockText(id))}`;return selected;}
    selected=id;try{localStorage.setItem(STORAGE_KEY,selected);}catch(_){}sync();return selected;
  }
  function setDeveloperMode(enabled){
    developerMode=Boolean(enabled);try{localStorage.setItem(DEVELOPER_KEY,String(developerMode));}catch(_){}
    if(!developerMode&&!isEarned(selected)){selected='rocket';try{localStorage.setItem(STORAGE_KEY,selected);}catch(_){}}
    sync();if(typeof global.updateRewardDirection==='function')global.updateRewardDirection();return developerMode;
  }
  function toggleDeveloperMode(){return setDeveloperMode(!developerMode);}
  function open(){const panel=document.getElementById('shipSkinPicker');if(panel){const status=document.getElementById('shipSkinUnlockStatus');if(status)status.textContent='';sync();panel.classList.add('is-visible');}}
  function close(){document.getElementById('shipSkinPicker')?.classList.remove('is-visible');}
  if(typeof document!=='undefined'){
    if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',sync,{once:true});else sync();
    document.addEventListener('keydown',event=>{if(event.key==='Escape'&&document.getElementById('shipSkinPicker')?.classList.contains('is-visible'))close();});
  }
  global.SpaceGameShipSkins={current,details,select,open,close,sync,isUnlocked,isDeveloperMode:()=>developerMode,setDeveloperMode,toggleDeveloperMode,unlockText,list:()=>SKINS.map(item=>({...item,unlock:{...item.unlock}}))};
  global.openShipSkinPicker=open;global.closeShipSkinPicker=close;global.selectShipSkin=select;
  global.toggleDeveloperMode=toggleDeveloperMode;
})(globalThis);
