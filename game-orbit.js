"use strict";

// Stateless orbital/navigation mathematics shared by physics, missions and predictors.
(function createSpaceGameOrbit(global){
  const EPSILON=1e-9;

  function relativeState(body,ship){
    return {
      dx:ship.x-body.x,dy:ship.y-body.y,
      vx:ship.vx-(body.vx||0),vy:ship.vy-(body.vy||0)
    };
  }
  function specificEnergy(body,ship){
    const s=relativeState(body,ship),r=Math.max(1,Math.hypot(s.dx,s.dy));
    return .5*(s.vx*s.vx+s.vy*s.vy)-body.mu/r;
  }
  function angularRate(body,ship){
    const s=relativeState(body,ship),r2=Math.max(EPSILON,s.dx*s.dx+s.dy*s.dy);
    return (s.dx*s.vy-s.dy*s.vx)/r2;
  }
  function apsides(body,ship){
    const s=relativeState(body,ship),r=Math.max(1,Math.hypot(s.dx,s.dy));
    const v2=s.vx*s.vx+s.vy*s.vy,mu=body.mu,E=v2/2-mu/r,h=s.dx*s.vy-s.dy*s.vx;
    const e=Math.sqrt(Math.max(0,1+2*E*h*h/(mu*mu))),p=h*h/mu;
    return {rp:p/(1+e),ra:e<1?p/(1-e):Infinity,r,bound:E<0,energy:E,eccentricity:e};
  }
  function relativeNavigation(target,ship){
    const dx=target.x-ship.x,dy=target.y-ship.y,distance=Math.hypot(dx,dy);
    const rvx=ship.vx-(target.vx||0),rvy=ship.vy-(target.vy||0),relSpeed=Math.hypot(rvx,rvy);
    return {dx,dy,distance,rvx,rvy,relSpeed,closing:distance>0?(rvx*dx+rvy*dy)/distance:0};
  }
  function normalizeAngle(angle){
    while(angle>Math.PI)angle-=Math.PI*2;
    while(angle<-Math.PI)angle+=Math.PI*2;
    return angle;
  }
  function surfaceVelocity(body,dx,dy,omega){
    return {vx:(body.vx||0)-omega*dy,vy:(body.vy||0)+omega*dx};
  }
  function barycenter(bodies,defaultWeight=1){
    let x=0,y=0,vx=0,vy=0,total=0;
    for(const body of bodies){
      const weight=Number.isFinite(body.mu)&&body.mu>0?body.mu:defaultWeight;
      x+=body.x*weight;y+=body.y*weight;vx+=(body.vx||0)*weight;vy+=(body.vy||0)*weight;total+=weight;
    }
    total=Math.max(EPSILON,total);
    return {x:x/total,y:y/total,vx:vx/total,vy:vy/total};
  }
  function gravityAt(x,y,sources,softening=0,out=null){
    let ax=0,ay=0;
    const soft2=softening*softening;
    for(const source of sources){
      const dx=source.x-x,dy=source.y-y,d2=Math.max(1,dx*dx+dy*dy+soft2),invR=1/Math.sqrt(d2);
      const factor=(source.mu||0)/d2*invR;
      ax+=dx*factor;ay+=dy*factor;
    }
    const result=out||{};result.ax=ax;result.ay=ay;return result;
  }
  function dominantGravityAt(x,y,sources){
    let source=null,acceleration=0,total=0;
    const contributions=[];
    for(const candidate of sources||[]){
      const dx=candidate.x-x,dy=candidate.y-y,d2=Math.max(1,dx*dx+dy*dy);
      const value=Math.max(0,Number(candidate.mu)||0)/d2;
      contributions.push({source:candidate,acceleration:value});total+=value;
      if(value>acceleration){source=candidate;acceleration=value;}
    }
    return {source,acceleration,total,share:total>EPSILON?acceleration/total:0,contributions};
  }
  function seededRandom(seed){
    let value=seed>>>0;
    return ()=>{value=(value+0x6D2B79F5)>>>0;let t=value;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return((t^(t>>>14))>>>0)/4294967296;};
  }
  function periodFromEnergy(mu,energy){
    if(!(energy<0))return Infinity;
    const a=-mu/(2*energy);
    return Math.PI*2*Math.sqrt(a*a*a/mu);
  }

  global.SpaceGameOrbit=Object.freeze({
    relativeState,specificEnergy,angularRate,apsides,relativeNavigation,normalizeAngle,
    surfaceVelocity,barycenter,gravityAt,dominantGravityAt,seededRandom,periodFromEnergy
  });
})(globalThis);
