"use strict";

// Player-selectable visual skins. Physics, hit boxes, mass and thrust remain owned by the flight model.
(function createShipSkinSystem(global){
  const STORAGE_KEY='spacegame-ship-skin-v1';
  const SKINS=[
    {id:'rocket',name:'星际快递号',tag:'经典火箭',description:'熟悉的小火箭，轮廓最简洁。'},
    {id:'swordwing',name:'飞天一号',tag:'剑形飞行器',description:'按参考图制作的白色双剑机首俯视外形。'},
    {id:'hyperion',name:'休伯利安号',tag:'人族战列巡航舰',description:'卡通简化的灰蓝色重型旗舰。'}
  ];
  function load(){
    try{const saved=localStorage.getItem(STORAGE_KEY);return SKINS.some(s=>s.id===saved)?saved:'rocket';}catch(_){return'rocket';}
  }
  let selected=load();
  function current(){return selected;}
  function details(){return SKINS.find(s=>s.id===selected)||SKINS[0];}
  function sync(){
    if(typeof document==='undefined')return;
    document.documentElement.dataset.shipSkin=selected;
    document.querySelectorAll('[data-ship-skin]').forEach(card=>{
      const active=card.dataset.shipSkin===selected;card.classList.toggle('is-selected',active);card.setAttribute('aria-pressed',String(active));
    });
    const label=document.getElementById('shipSkinCurrent');if(label)label.textContent=details().name;
  }
  function select(id){
    if(!SKINS.some(s=>s.id===id))return selected;
    selected=id;try{localStorage.setItem(STORAGE_KEY,selected);}catch(_){}sync();return selected;
  }
  function open(){const panel=document.getElementById('shipSkinPicker');if(panel){sync();panel.classList.add('is-visible');}}
  function close(){document.getElementById('shipSkinPicker')?.classList.remove('is-visible');}
  if(typeof document!=='undefined'){
    if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',sync,{once:true});else sync();
    document.addEventListener('keydown',event=>{if(event.key==='Escape'&&document.getElementById('shipSkinPicker')?.classList.contains('is-visible'))close();});
  }
  global.SpaceGameShipSkins={current,details,select,open,close,list:()=>SKINS.slice()};
  global.openShipSkinPicker=open;global.closeShipSkinPicker=close;global.selectShipSkin=select;
})(globalThis);
