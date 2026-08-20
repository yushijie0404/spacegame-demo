// SpaceGame reusable canvas artwork.
// Loaded as a classic script so render functions can use the live game state
// without duplicating physics, mission, or input ownership.

const feitianOneSprite=new Image();
feitianOneSprite.decoding='async';
feitianOneSprite.src='./assets/ships/feitian-one-overhead.png';
const hyperionSprite=new Image();
hyperionSprite.decoding='async';
hyperionSprite.src='./assets/ships/hyperion-cartoon-overhead.png';

function drawStylizedStar(b,core,mid,edge,phase=0){
  ctx.save();
  if(!lowPowerMode){ctx.shadowColor=mid;ctx.shadowBlur=Math.max(16,b.r*.12*cam.zoom);const g=ctx.createRadialGradient(b.x-b.r*.3,b.y-b.r*.34,b.r*.05,b.x,b.y,b.r);g.addColorStop(0,core);g.addColorStop(.46,mid);g.addColorStop(1,edge);ctx.fillStyle=g;}
  else ctx.fillStyle=mid;
  ctx.beginPath();ctx.arc(b.x,b.y,b.r,0,TAU);ctx.fill();ctx.shadowBlur=0;
  ctx.beginPath();ctx.arc(b.x,b.y,b.r*.97,0,TAU);ctx.clip();
  ctx.strokeStyle='rgba(255,255,255,.2)';ctx.lineCap='round';
  for(let i=0;i<(lowPowerMode?3:6);i++){const rr=b.r*(.22+i*.12),a=phase*(.42+i*.025)+i*1.37;ctx.lineWidth=Math.max(2/cam.zoom,b.r*(.035-i*.002));ctx.beginPath();ctx.arc(b.x,b.y,rr,a,a+1.05);ctx.stroke();}
  ctx.fillStyle='rgba(92,38,30,.18)';for(let i=0;i<4;i++){const a=phase*.31+i*1.73,rr=b.r*(.34+(i%2)*.22);ctx.beginPath();ctx.ellipse(b.x+Math.cos(a)*rr,b.y+Math.sin(a)*rr,b.r*.12,b.r*.038,a+.4,0,TAU);ctx.fill();}
  ctx.restore();
  ctx.strokeStyle='rgba(255,255,255,.58)';ctx.lineWidth=3/cam.zoom;ctx.beginPath();ctx.arc(b.x,b.y,b.r+5/cam.zoom,0,TAU);ctx.stroke();
  if(!lowPowerMode){ctx.strokeStyle='rgba(255,244,216,.32)';ctx.lineWidth=2.2/cam.zoom;for(let i=0;i<2;i++){const a=phase*.24+i*Math.PI;ctx.beginPath();ctx.arc(b.x+Math.cos(a)*b.r*.92,b.y+Math.sin(a)*b.r*.92,b.r*.23,a-.65,a+.65);ctx.stroke();}}
}
function drawBinaryBody(b){
  if(b.isStar){
    if(b===MARS)drawStylizedStar(b,'#fffbe1','#ffc04d','#e9562c',binary?.angle||0);
    else drawStylizedStar(b,'#ffffff','#bce6ff','#467bd0',-(binary?.angle||0)*.83);
  }else{
    drawEarthDisk(b,lowPowerMode);
  }
  ctx.fillStyle='rgba(255,255,255,.88)';ctx.font=`800 ${13/cam.zoom}px "Microsoft YaHei",sans-serif`;ctx.textAlign='center';ctx.fillText(b.name,b.x,b.y-b.r-16/cam.zoom);ctx.textAlign='left';
}
function drawThreeBodyStar(b){
  const palette=b===EARTH?['#fffde8','#ffe48b','#cb843d']:b===MARS?['#ffffff','#c4e8ff','#507dbd']:['#fff9ff','#ffc3d1','#a95675'];
  drawStylizedStar(b,palette[0],palette[1],palette[2],threeBody.time*(b===MARS?-.72:.58)+(b===MOON?2.1:0));
  ctx.fillStyle='rgba(255,255,255,.88)';ctx.font=`800 ${12/cam.zoom}px "Microsoft YaHei",sans-serif`;ctx.textAlign='center';ctx.fillText(b.name,b.x,b.y-b.r-15/cam.zoom);ctx.textAlign='left';
}
let earthSurfaceTexture=null;
function getEarthSurfaceTexture(){
  if(earthSurfaceTexture)return earthSurfaceTexture;
  const size=1024,c=document.createElement('canvas'),p=c.getContext('2d'),center=size/2,r=size*.48;
  c.width=c.height=size;
  const ocean=p.createRadialGradient(center-r*.34,center-r*.38,r*.06,center,center,r);
  ocean.addColorStop(0,'#8ce4ff');ocean.addColorStop(.36,'#2fa6e8');ocean.addColorStop(.75,'#1674c7');ocean.addColorStop(1,'#0d428f');
  p.fillStyle=ocean;p.beginPath();p.arc(center,center,r,0,TAU);p.fill();
  p.save();p.beginPath();p.arc(center,center,r*.99,0,TAU);p.clip();p.translate(center,center);p.scale(r,r);
  // 海面纹理只生成一次，运行时整张纹理随地球自转，不增加每帧路径数量。
  p.strokeStyle='rgba(174,237,255,.16)';p.lineWidth=.018;p.lineCap='round';
  for(const y of [-.62,-.18,.28,.66]){p.beginPath();p.moveTo(-.9,y);p.bezierCurveTo(-.45,y-.08,.2,y+.09,.88,y-.02);p.stroke();}
  const fillLand=()=>{p.fillStyle='#66cf6b';p.strokeStyle='rgba(12,91,66,.28)';p.lineWidth=.018;p.fill();p.stroke();};
  // 美洲
  p.beginPath();p.moveTo(-.66,-.68);p.bezierCurveTo(-.88,-.53,-.82,-.26,-.62,-.1);p.bezierCurveTo(-.49,.01,-.62,.14,-.47,.28);p.bezierCurveTo(-.34,.41,-.33,.68,-.18,.83);p.bezierCurveTo(-.03,.7,-.07,.49,-.14,.3);p.bezierCurveTo(-.2,.12,.01,-.02,-.1,-.2);p.bezierCurveTo(-.2,-.37,-.38,-.4,-.39,-.57);p.closePath();fillLand();
  // 欧亚大陆与非洲
  p.beginPath();p.moveTo(-.08,-.58);p.bezierCurveTo(.16,-.75,.58,-.66,.78,-.43);p.bezierCurveTo(.94,-.24,.72,-.08,.51,-.03);p.bezierCurveTo(.41,.02,.48,.18,.35,.2);p.bezierCurveTo(.29,.47,.12,.69,-.02,.49);p.bezierCurveTo(-.14,.32,-.19,.12,-.31,.02);p.bezierCurveTo(-.46,-.12,-.29,-.35,-.08,-.58);p.closePath();fillLand();
  // 澳大利亚、格陵兰与岛链
  p.beginPath();p.moveTo(.48,.48);p.bezierCurveTo(.68,.39,.84,.5,.77,.68);p.bezierCurveTo(.66,.8,.42,.76,.39,.61);p.closePath();fillLand();
  p.beginPath();p.moveTo(-.43,-.77);p.bezierCurveTo(-.3,-.91,-.12,-.86,-.15,-.69);p.bezierCurveTo(-.25,-.6,-.39,-.64,-.43,-.77);p.closePath();fillLand();
  p.fillStyle='#3fa85f';
  for(const [x,y,rx,ry,a] of [[-.58,-.43,.12,.08,-.4],[-.34,.42,.08,.17,-.2],[.18,-.38,.22,.09,.1],[.1,.23,.12,.2,-.2],[.58,-.3,.14,.06,.25],[.58,.61,.13,.06,-.25]]){p.beginPath();p.ellipse(x,y,rx,ry,a,0,TAU);p.fill();}
  p.fillStyle='#eafcff';p.beginPath();p.ellipse(0,-.96,.62,.13,0,0,TAU);p.fill();p.beginPath();p.ellipse(0,.97,.52,.1,0,0,TAU);p.fill();
  // 三条柔和云带比原先几个白椭圆更像大气环流。
  p.strokeStyle='rgba(255,255,255,.7)';p.lineCap='round';p.lineWidth=.055;
  p.beginPath();p.moveTo(-.88,-.3);p.bezierCurveTo(-.5,-.45,-.12,-.18,.25,-.29);p.bezierCurveTo(.48,-.37,.67,-.29,.82,-.17);p.stroke();
  p.lineWidth=.045;p.beginPath();p.moveTo(-.76,.2);p.bezierCurveTo(-.42,.09,-.1,.34,.24,.2);p.bezierCurveTo(.48,.1,.67,.19,.84,.32);p.stroke();
  p.lineWidth=.032;p.beginPath();p.moveTo(-.55,.62);p.bezierCurveTo(-.18,.49,.18,.72,.55,.56);p.stroke();
  p.restore();
  earthSurfaceTexture=c;return c;
}
function drawEarthDisk(b,lightweight){
  const texture=getEarthSurfaceTexture();
  ctx.save();
  if(!lightweight){ctx.shadowColor='rgba(76,201,240,.68)';ctx.shadowBlur=Math.max(10,b.r*.065*cam.zoom);}
  ctx.strokeStyle='rgba(104,222,255,.42)';ctx.lineWidth=Math.max(6/cam.zoom,b.r*.045);ctx.beginPath();ctx.arc(b.x,b.y,b.r*1.018,0,TAU);ctx.stroke();
  ctx.shadowBlur=0;ctx.translate(b.x,b.y);ctx.rotate(earthAngle);ctx.drawImage(texture,-b.r,-b.r,b.r*2,b.r*2);ctx.restore();
  if(lightweight){
    ctx.fillStyle='rgba(3,13,42,.3)';ctx.beginPath();ctx.moveTo(b.x,b.y-b.r);ctx.arc(b.x,b.y,b.r,-Math.PI/2,Math.PI/2);ctx.quadraticCurveTo(b.x-b.r*.2,b.y,b.x,b.y-b.r);ctx.fill();
  }else{
    const shade=ctx.createLinearGradient(b.x-b.r,b.y-b.r*.25,b.x+b.r,b.y+b.r*.2);shade.addColorStop(0,'rgba(255,255,255,.15)');shade.addColorStop(.48,'rgba(255,255,255,0)');shade.addColorStop(1,'rgba(1,9,33,.42)');ctx.fillStyle=shade;ctx.beginPath();ctx.arc(b.x,b.y,b.r*.995,0,TAU);ctx.fill();
  }
  ctx.strokeStyle='rgba(185,244,255,.52)';ctx.lineWidth=Math.max(2/cam.zoom,b.r*.012);ctx.beginPath();ctx.arc(b.x,b.y,b.r*.994,.72*Math.PI,1.48*Math.PI);ctx.stroke();
  ctx.strokeStyle='rgba(5,18,52,.48)';ctx.lineWidth=Math.max(2/cam.zoom,b.r*.012);ctx.beginPath();ctx.arc(b.x,b.y,b.r,0,TAU);ctx.stroke();
  const pad=padAngle();ctx.fillStyle='#ffd166';ctx.strokeStyle='#fff3bd';ctx.lineWidth=2/cam.zoom;ctx.beginPath();ctx.arc(b.x+Math.cos(pad)*b.r,b.y+Math.sin(pad)*b.r,Math.max(4/cam.zoom,b.r*.018),0,TAU);ctx.fill();ctx.stroke();
}
let rockySurfaceTextures={};
function getRockySurfaceTexture(kind){
  if(rockySurfaceTextures[kind])return rockySurfaceTextures[kind];
  const size=640,c=document.createElement('canvas'),p=c.getContext('2d'),m=size/2,r=size*.48;c.width=c.height=size;
  const base=p.createRadialGradient(m-r*.34,m-r*.38,r*.06,m,m,r);
  if(kind==='mars'){base.addColorStop(0,'#ffc090');base.addColorStop(.38,'#e67845');base.addColorStop(.78,'#b84a2e');base.addColorStop(1,'#6e2a24');}
  else{base.addColorStop(0,'#fffdf1');base.addColorStop(.42,'#c9c9c4');base.addColorStop(.8,'#8d9299');base.addColorStop(1,'#555e69');}
  p.fillStyle=base;p.beginPath();p.arc(m,m,r,0,TAU);p.fill();p.save();p.beginPath();p.arc(m,m,r*.99,0,TAU);p.clip();p.translate(m,m);p.scale(r,r);
  if(kind==='mars'){
    p.fillStyle='rgba(105,39,31,.22)';for(const [x,y,rx,ry,a] of [[-.38,-.18,.42,.14,.18],[.3,.28,.34,.16,-.4],[.17,-.52,.24,.1,.25],[-.58,.49,.21,.09,-.2]]){p.beginPath();p.ellipse(x,y,rx,ry,a,0,TAU);p.fill();}
    p.strokeStyle='rgba(95,35,29,.48)';p.lineWidth=.045;p.lineCap='round';p.beginPath();p.moveTo(-.82,.06);p.bezierCurveTo(-.4,-.12,-.1,.17,.2,.03);p.bezierCurveTo(.48,-.1,.61,.09,.84,-.06);p.stroke();
    p.strokeStyle='rgba(255,181,116,.22)';p.lineWidth=.018;for(let i=-3;i<=3;i++){p.beginPath();p.moveTo(-.76,i*.17);p.bezierCurveTo(-.22,i*.17-.08,.31,i*.17+.07,.75,i*.17);p.stroke();}
    p.fillStyle='rgba(239,230,205,.85)';p.beginPath();p.ellipse(0,-.96,.47,.085,0,0,TAU);p.fill();
  }else{
    p.fillStyle='rgba(69,75,84,.29)';for(const [x,y,rx,ry,a] of [[-.24,-.12,.38,.24,.2],[.34,.26,.28,.18,-.45],[-.08,.52,.22,.13,.1],[-.5,-.49,.18,.12,-.2]]){p.beginPath();p.ellipse(x,y,rx,ry,a,0,TAU);p.fill();}
    p.strokeStyle='rgba(255,255,244,.17)';p.lineWidth=.012;for(let i=0;i<10;i++){const a=i*.93; p.beginPath();p.moveTo(.28+Math.cos(a)*.08,-.38+Math.sin(a)*.08);p.lineTo(.28+Math.cos(a)*.5,-.38+Math.sin(a)*.5);p.stroke();}
  }
  const craters=kind==='mars'?[[.3,-.4,.17],[-.42,.32,.14],[.02,.61,.1],[-.12,-.7,.11],[.55,.04,.075],[-.6,-.3,.065]]:[[.32,-.42,.16],[-.46,.26,.13],[.04,.62,.105],[-.1,-.7,.11],[.56,.05,.08],[-.58,-.3,.07],[.18,.15,.055],[-.02,-.2,.04]];
  for(const [x,y,s] of craters){p.fillStyle=kind==='mars'?'rgba(74,30,25,.3)':'rgba(49,55,63,.34)';p.beginPath();p.arc(x,y,s,0,TAU);p.fill();p.strokeStyle=kind==='mars'?'rgba(255,167,112,.3)':'rgba(255,253,236,.42)';p.lineWidth=.012;p.beginPath();p.arc(x-s*.12,y-s*.12,s*.86,.7*Math.PI,1.82*Math.PI);p.stroke();p.fillStyle='rgba(25,27,34,.16)';p.beginPath();p.arc(x+s*.16,y+s*.16,s*.55,0,TAU);p.fill();}
  p.restore();rockySurfaceTextures[kind]=c;return c;
}
function drawRockyBodyDisk(b,kind,lightweight){
  const mars=kind==='mars',rotation=mars?earthAngle*.36:moonAngle,texture=getRockySurfaceTexture(kind);
  ctx.save();if(!lightweight){ctx.shadowColor=mars?'rgba(255,112,66,.38)':'rgba(218,232,244,.28)';ctx.shadowBlur=Math.max(8,b.r*.045*cam.zoom);}ctx.translate(b.x,b.y);ctx.rotate(rotation);ctx.drawImage(texture,-b.r,-b.r,b.r*2,b.r*2);ctx.restore();
  if(mars){ctx.strokeStyle='rgba(255,132,84,.3)';ctx.lineWidth=Math.max(4/cam.zoom,b.r*.024);ctx.beginPath();ctx.arc(b.x,b.y,b.r*1.012,0,TAU);ctx.stroke();}
  if(lightweight){ctx.fillStyle='rgba(4,11,31,.25)';ctx.beginPath();ctx.moveTo(b.x,b.y-b.r);ctx.arc(b.x,b.y,b.r,-Math.PI/2,Math.PI/2);ctx.closePath();ctx.fill();}
  else{const shade=ctx.createLinearGradient(b.x-b.r,b.y,b.x+b.r,b.y);shade.addColorStop(0,'rgba(255,255,244,.12)');shade.addColorStop(.54,'rgba(0,0,0,0)');shade.addColorStop(1,'rgba(8,13,25,.38)');ctx.fillStyle=shade;ctx.beginPath();ctx.arc(b.x,b.y,b.r*.995,0,TAU);ctx.fill();}
  ctx.strokeStyle='rgba(7,15,35,.48)';ctx.lineWidth=Math.max(2/cam.zoom,b.r*.012);ctx.beginPath();ctx.arc(b.x,b.y,b.r,0,TAU);ctx.stroke();
  if(!mars){ctx.save();ctx.translate(b.x,b.y);ctx.rotate(moonAngle);ctx.fillStyle='#4cc9f0';ctx.strokeStyle='#e8fbff';ctx.lineWidth=1.5/cam.zoom;ctx.beginPath();ctx.arc(-b.r*.91,0,Math.max(3/cam.zoom,b.r*.018),0,TAU);ctx.fill();ctx.stroke();ctx.restore();}
}
function drawBodyIOS(b){
  if(b===EARTH){drawEarthDisk(b,true);return;}
  drawRockyBodyDisk(b,b===MARS?'mars':'moon',true);
}
function drawBody(b){
  if(lowPowerMode){ drawBodyIOS(b); return; }
  if(b===EARTH){drawEarthDisk(b,false);return;}
  drawRockyBodyDisk(b,b===MARS?'mars':'moon',false);
}

function drawAsteroid(){
  if(!asteroid||!asteroid.alive||!worldCircleVisible(asteroid,160))return;
  ctx.save();ctx.translate(asteroid.x,asteroid.y);ctx.rotate(asteroid.angle);
  ctx.shadowColor='rgba(255,157,92,.35)';ctx.shadowBlur=lowPowerMode?0:16/cam.zoom;
  const grad=ctx.createRadialGradient(-25,-30,5,0,0,asteroid.r);
  grad.addColorStop(0,'#d8a16f');grad.addColorStop(.55,'#996644');grad.addColorStop(1,'#4e3428');
  ctx.fillStyle=grad;ctx.strokeStyle='#2d211d';ctx.lineWidth=3/cam.zoom;
  ctx.beginPath();
  const bumps=[1,.91,1.06,.88,1.03,.93,1.08,.9,1.02,.94,1.05,.89];
  for(let i=0;i<bumps.length;i++){const a=i/bumps.length*TAU,r=asteroid.r*bumps[i],x=Math.cos(a)*r,y=Math.sin(a)*r;i?ctx.lineTo(x,y):ctx.moveTo(x,y);}ctx.closePath();ctx.fill();ctx.stroke();
  ctx.shadowBlur=0;
  for(const [x,y,r] of [[-.32,-.28,.18],[.3,.18,.22],[-.05,.48,.12],[.48,-.35,.1],[-.52,.25,.09]]){
    ctx.fillStyle='rgba(45,28,22,.38)';ctx.beginPath();ctx.ellipse(x*asteroid.r,y*asteroid.r,r*asteroid.r,r*asteroid.r*.68,.3,0,TAU);ctx.fill();
    ctx.strokeStyle='rgba(255,213,170,.23)';ctx.lineWidth=1.5/cam.zoom;ctx.stroke();
  }
  ctx.restore();
  ctx.fillStyle='#ffd1a8';ctx.font=`900 ${13/cam.zoom}px "Microsoft YaHei",sans-serif`;ctx.textAlign='center';
  ctx.fillText(asteroid.name,asteroid.x,asteroid.y-(asteroid.r+18/cam.zoom));ctx.textAlign='left';
}

function drawGuideRocket(ship,label){
  if(!ship||!worldCircleVisible({x:ship.x,y:ship.y,r:42},90)) return;
  ctx.save(); ctx.translate(ship.x,ship.y);
  if(ship.chute){
    ctx.save();ctx.rotate(ship.a+Math.PI/2);ctx.globalAlpha=.25;ctx.strokeStyle='#b9f2ff';ctx.fillStyle='#80e6ff';ctx.lineWidth=1.5/cam.zoom;
    ctx.beginPath();ctx.moveTo(-4,-16);ctx.lineTo(-18,-45);ctx.moveTo(4,-16);ctx.lineTo(18,-45);ctx.stroke();
    ctx.beginPath();ctx.arc(0,-45,21,Math.PI,0);ctx.closePath();ctx.fill();ctx.stroke();ctx.restore();
  }
  ctx.rotate(ship.a+Math.PI/2);
  ctx.globalAlpha=.28;
  if(ship.thrust||ship.thrusting){
    ctx.fillStyle='#7de3ff'; ctx.beginPath(); ctx.moveTo(-5,13); ctx.quadraticCurveTo(0,39,5,13); ctx.closePath(); ctx.fill();
  }
  ctx.fillStyle='#dff8ff'; ctx.strokeStyle='#4cc9f0'; ctx.lineWidth=2.8/cam.zoom;
  ctx.beginPath(); ctx.moveTo(0,-23); ctx.quadraticCurveTo(9,-9,8,14); ctx.lineTo(-8,14); ctx.quadraticCurveTo(-9,-9,0,-23); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.restore();
  ctx.save(); ctx.globalAlpha=.72; ctx.fillStyle='#b9f2ff';
  ctx.font=`800 ${12/cam.zoom}px "Microsoft YaHei",sans-serif`; ctx.textAlign='center';
  ctx.fillText(label,ship.x,ship.y-34/cam.zoom); ctx.restore();
}
function drawGuideGhost(){
  if(!guideGhostVisible()||!ghostShip||!ghostTrail) return;
  ctx.save(); ctx.globalAlpha=.24;
  if(ghostTrail.length>1){
    ctx.strokeStyle='#80e6ff'; ctx.lineWidth=2.2/cam.zoom; ctx.setLineDash([8/cam.zoom,10/cam.zoom]);
    ctx.beginPath(); ctx.moveTo(ghostTrail[0].x,ghostTrail[0].y);
    for(let i=1;i<ghostTrail.length;i++) ctx.lineTo(ghostTrail[i].x,ghostTrail[i].y);
    ctx.stroke(); ctx.setLineDash([]);
  }
  ctx.restore();
  const ghostLabel=level===5
    ? (!ghostShip.started?'示范：等待首次推进 · 世界暂停':ghostShip.complete?'示范完成：已逃逸':ghostShip.thrusting?(ghostShip.turning?'示范：推进 + 右转':'示范：只按推进'):'示范：滑行')
    : (ghostShip.complete?'标准示范完成':`示范：${ghostShip.label||'等待点火'}`);
  drawGuideRocket(ghostShip,ghostLabel+` · 燃料 ${ghostShip.fuel.toFixed(1)}%`);
}
function drawThreeBodyTimelines(){
  if(level!==10||!threeBody||mission.hintsHidden||!showPred||state!=='fly')return;
  const result=getThreeBodyTimelines();
  for(const branch of result.branches){
    if(branch.pts.length<2)continue;
    ctx.save();ctx.strokeStyle=branch.color;ctx.lineWidth=(branch.id==='coast'?1.7:2.1)/cam.zoom;ctx.setLineDash(branch.id==='coast'?[4/cam.zoom,7/cam.zoom]:[8/cam.zoom,7/cam.zoom]);
    ctx.beginPath();ctx.moveTo(branch.pts[0].x,branch.pts[0].y);for(let i=1;i<branch.pts.length;i++)ctx.lineTo(branch.pts[i].x,branch.pts[i].y);ctx.stroke();ctx.setLineDash([]);
    const a=Math.atan2(branch.vy,branch.vx),size=8/cam.zoom;ctx.translate(branch.x,branch.y);ctx.rotate(a);ctx.globalAlpha=.58;ctx.fillStyle=branch.color;ctx.beginPath();ctx.moveTo(size*1.5,0);ctx.lineTo(-size,size*.72);ctx.lineTo(-size,-size*.72);ctx.closePath();ctx.fill();ctx.restore();
    if(branch.impact){const s=8/cam.zoom;ctx.strokeStyle='#ef476f';ctx.lineWidth=2/cam.zoom;ctx.beginPath();ctx.moveTo(branch.impact.x-s,branch.impact.y-s);ctx.lineTo(branch.impact.x+s,branch.impact.y+s);ctx.moveTo(branch.impact.x+s,branch.impact.y-s);ctx.lineTo(branch.impact.x-s,branch.impact.y+s);ctx.stroke();}
    if(W>=760){ctx.fillStyle=branch.color;ctx.font=`800 ${11/cam.zoom}px "Microsoft YaHei",sans-serif`;ctx.textAlign='center';ctx.fillText(branch.impact?`${branch.label} · 终止`:branch.label,branch.x,branch.y-14/cam.zoom);}
  }
  ctx.textAlign='left';
}

function drawShipFlame(x,y,width,length,redshift,phase=0){
  const flicker=length+Math.random()*7;
  ctx.save();ctx.translate(x,y);
  ctx.fillStyle=redshift>0?`rgb(255,${Math.round(177-82*redshift)},${Math.round(66-38*redshift)})`:'#ffb142';
  ctx.beginPath();ctx.moveTo(-width,0);ctx.quadraticCurveTo(Math.sin(phase)*1.6,flicker,width,0);ctx.closePath();ctx.fill();
  ctx.fillStyle=redshift>0?'#ffe2a8':'#fff3b0';ctx.beginPath();ctx.moveTo(-width*.48,0);ctx.quadraticCurveTo(0,flicker*.58,width*.48,0);ctx.closePath();ctx.fill();ctx.restore();
}

function drawClassicRocketSkin(redshift,thrusting){
  if(thrusting)drawShipFlame(0,14,5,22,redshift);
  const wingColor=redshift>0?`rgb(239,${Math.round(71-42*redshift)},${Math.round(111-62*redshift)})`:'#ef476f';
  ctx.fillStyle=wingColor;
  ctx.beginPath();ctx.moveTo(-6,6);ctx.lineTo(-13,17);ctx.lineTo(-6,14);ctx.closePath();ctx.fill();
  ctx.beginPath();ctx.moveTo(6,6);ctx.lineTo(13,17);ctx.lineTo(6,14);ctx.closePath();ctx.fill();
  ctx.fillStyle=redshift>0?`rgb(248,${Math.round(249-105*redshift)},${Math.round(250-160*redshift)})`:'#f8f9fa';ctx.strokeStyle='#222';ctx.lineWidth=2.2;
  ctx.beginPath();ctx.moveTo(0,-22);ctx.quadraticCurveTo(8,-10,7,6);ctx.lineTo(7,14);ctx.lineTo(-7,14);ctx.lineTo(-7,6);ctx.quadraticCurveTo(-8,-10,0,-22);ctx.closePath();ctx.fill();ctx.stroke();
  ctx.fillStyle=redshift>0?`rgb(${Math.round(76+145*redshift)},${Math.round(201-95*redshift)},${Math.round(240-175*redshift)})`:'#4cc9f0';ctx.beginPath();ctx.arc(0,-4,4,0,TAU);ctx.fill();ctx.lineWidth=1.8;ctx.stroke();
  ctx.fillStyle=wingColor;ctx.fillRect(-7,9,14,3.2);ctx.strokeRect(-7,9,14,3.2);
}

function drawSwordwingSkin(redshift,thrusting){
  if(!feitianOneSprite.complete||!feitianOneSprite.naturalWidth){drawClassicRocketSkin(redshift,thrusting);return;}
  if(thrusting){drawShipFlame(-8.8,29,2.7,17,redshift,.4);drawShipFlame(0,30,2.4,15,redshift);drawShipFlame(8.8,29,2.7,17,redshift,-.4);}
  // 参考图的正俯视透明贴图。只放大视觉轮廓，不改物理碰撞半径。
  ctx.drawImage(feitianOneSprite,-34,-34,68,68);
}

function drawHyperionSkin(redshift,thrusting){
  if(!hyperionSprite.complete||!hyperionSprite.naturalWidth){drawClassicRocketSkin(redshift,thrusting);return;}
  if(thrusting){for(const x of [-13,-4.4,4.4,13])drawShipFlame(x,31,2.15,14,redshift,x*.12);}
  // 休伯利安号的卡通俯视贴图；显示更宽，碰撞盒仍沿用小火箭。
  ctx.drawImage(hyperionSprite,-22,-32,44,64);
}

function drawRocket(){
  if(!rocket.alive) return;
  if(level===7&&mission.asteroidContact&&asteroid){
    ctx.strokeStyle=mission.asteroidAnchored?'#7de3ff':'rgba(255,209,102,.75)';ctx.lineWidth=(mission.asteroidAnchored?4:2)/cam.zoom;
    ctx.beginPath();ctx.moveTo(asteroid.x+Math.cos(mission.asteroidMountAngle)*asteroid.r,asteroid.y+Math.sin(mission.asteroidMountAngle)*asteroid.r);ctx.lineTo(rocket.x,rocket.y);ctx.stroke();
  }
  ctx.save();
  ctx.translate(rocket.x, rocket.y);
  let blackHoleVisual=null;
  if(level===9&&blackHole){
    const m=blackHoleMetrics(),tidal=Math.max(0,Math.min(1,(520-m.r)/330));blackHoleVisual={m,tidal,shift:blackHole.redshift};
    const radial=Math.atan2(m.dy,m.dx);ctx.rotate(radial);ctx.scale(1+tidal*1.45,Math.max(.5,1-tidal*.42));ctx.rotate(-radial);
    ctx.globalAlpha=Math.max(.42,.98-blackHole.redshift*.48);
    if(!lowPowerMode)ctx.filter=`sepia(${Math.round(blackHole.redshift*80)}%) saturate(${100+Math.round(blackHole.redshift*170)}%) hue-rotate(-18deg) brightness(${100-Math.round(blackHole.redshift*34)}%)`;
  }
  const redshift=blackHoleVisual?blackHoleVisual.shift:0;
  // 降落伞使用独立世界朝向：伞面随气流平滑变化，不再粘在机头上一起翻转。
  if(rocket.chute){
    ctx.save();
    ctx.rotate((Number.isFinite(rocket.chuteAngle)?rocket.chuteAngle:rocket.a) + Math.PI/2);
    ctx.strokeStyle='rgba(255,255,255,.8)'; ctx.lineWidth=1.2;
    ctx.beginPath(); ctx.moveTo(-3,-16); ctx.lineTo(-16,-46); ctx.moveTo(3,-16); ctx.lineTo(16,-46); ctx.moveTo(0,-16); ctx.lineTo(0,-46); ctx.stroke();
    ctx.fillStyle='#ff9f43'; ctx.strokeStyle='#222'; ctx.lineWidth=1.8;
    ctx.beginPath(); ctx.arc(0,-46,20,Math.PI,0); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle='rgba(255,255,255,.35)';
    ctx.beginPath(); ctx.arc(0,-46,20,Math.PI,Math.PI*1.5); ctx.closePath(); ctx.fill();
    ctx.restore();
  }
  ctx.rotate(rocket.a + Math.PI/2);
  const thrusting=(keys['ArrowUp']||keys['KeyW'])&&rocket.fuel>0&&state==='fly';
  const skin=globalThis.SpaceGameShipSkins?.current?.()||'rocket';
  if(skin==='swordwing')drawSwordwingSkin(redshift,thrusting);
  else if(skin==='hyperion')drawHyperionSkin(redshift,thrusting);
  else drawClassicRocketSkin(redshift,thrusting);
  ctx.restore();
}

function drawStation(){
  if(!station||!worldCircleVisible({x:station.x,y:station.y,r:70},120)) return;
  // 远景时只放大绘制，不改变碰撞盒，让空间站在手机上仍能辨认。
  const lod=Math.max(1,Math.min(2.35,.52/Math.max(.04,cam.zoom))),pulse=.55+.35*Math.sin((mission?.flightTime||0)*3.4);
  ctx.save();ctx.translate(station.x,station.y);ctx.rotate(station.a+Math.PI/2);ctx.scale(lod,lod);
  if(!lowPowerMode){ctx.shadowColor='rgba(115,210,255,.34)';ctx.shadowBlur=11/cam.zoom/lod;}
  // 双层桁架和四块太阳翼。
  ctx.strokeStyle='#d6e4ee';ctx.lineWidth=2/cam.zoom/lod;ctx.beginPath();ctx.moveTo(-47,-2);ctx.lineTo(47,-2);ctx.moveTo(-47,2);ctx.lineTo(47,2);ctx.stroke();
  ctx.fillStyle='#275ea9';ctx.strokeStyle='#9fe8ff';ctx.lineWidth=1.3/cam.zoom/lod;
  for(const x of [-51,-31,31,51]){ctx.fillRect(x-9,-12,18,24);ctx.strokeRect(x-9,-12,18,24);ctx.strokeStyle='rgba(185,230,255,.48)';for(let k=-1;k<=1;k++){ctx.beginPath();ctx.moveTo(x-9,-k*6);ctx.lineTo(x+9,-k*6);ctx.stroke();}ctx.beginPath();ctx.moveTo(x,-12);ctx.lineTo(x,12);ctx.stroke();ctx.strokeStyle='#9fe8ff';}
  ctx.shadowBlur=0;
  // 居住舱、节点舱、补给舱与金色隔热层。
  ctx.fillStyle='#edf3f7';ctx.strokeStyle='#26334a';ctx.lineWidth=1.8/cam.zoom/lod;
  roundRect(-18,-7,36,14,6);ctx.fill();ctx.stroke();
  ctx.fillStyle='#cbd6df';for(const x of [-14,14]){ctx.beginPath();ctx.arc(x,0,8,0,TAU);ctx.fill();ctx.stroke();}
  ctx.fillStyle='#f4bf45';ctx.fillRect(-6,-18,12,36);ctx.strokeRect(-6,-18,12,36);
  ctx.fillStyle='#10182b';ctx.beginPath();ctx.arc(0,0,5.5,0,TAU);ctx.fill();
  // 对接口、天线碟与导航灯。
  ctx.strokeStyle=mission&&mission.stage===3?'#5fd068':'#4cc9f0';ctx.lineWidth=2.4/cam.zoom/lod;ctx.beginPath();ctx.arc(0,0,20,0,TAU);ctx.stroke();
  ctx.strokeStyle='rgba(226,242,255,.86)';ctx.lineWidth=1.6/cam.zoom/lod;ctx.beginPath();ctx.moveTo(10,-9);ctx.lineTo(22,-23);ctx.stroke();ctx.beginPath();ctx.arc(24,-25,7,.2*Math.PI,1.2*Math.PI);ctx.stroke();
  ctx.fillStyle=`rgba(95,208,104,${pulse})`;ctx.beginPath();ctx.arc(-18,-7,2.4,0,TAU);ctx.fill();ctx.fillStyle=`rgba(239,71,111,${1-pulse*.45})`;ctx.beginPath();ctx.arc(18,7,2.4,0,TAU);ctx.fill();
  ctx.restore();
  ctx.fillStyle='#dff7ff'; ctx.font=`800 ${12/cam.zoom}px "Microsoft YaHei",sans-serif`; ctx.textAlign='center';
  ctx.fillText(station.docked?'已对接':(level===8?'暮光站':'天宫实验站'),station.x,station.y-(34+Math.min(18,(lod-1)*18))/cam.zoom); ctx.textAlign='left';
}

// 预测未来轨迹（无动力滑行，与主物理同模型）；同时标注近/远地点

// Shared canvas path primitive used by spacecraft art and the HUD renderer.
function roundRect(x,y,w,h,r){ ctx.beginPath(); ctx.moveTo(x+r,y);
  ctx.arcTo(x+w,y,x+w,y+h,r); ctx.arcTo(x+w,y+h,x,y+h,r);
  ctx.arcTo(x,y+h,x,y,r); ctx.arcTo(x,y,x+w,y,r); ctx.closePath(); }
