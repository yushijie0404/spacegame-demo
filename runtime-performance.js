(function attachSpaceGamePerformance(global){
  "use strict";

  const metrics=Object.create(null);
  const WINDOW_MS=5000;
  let windowStarted=performance.now(),frameCount=0,longFrameCount=0,worstGap=0;
  let recent={frames:0,longFrames:0,longFrameRate:0,worstGap:0};

  function metric(name){
    return metrics[name]||(metrics[name]={average:0,peak:0,count:0});
  }

  function sample(name,milliseconds){
    if(!Number.isFinite(milliseconds)||milliseconds<0)return;
    const value=Math.min(milliseconds,1000),item=metric(name);
    item.average=item.count===0?value:item.average*.9+value*.1;
    item.peak=Math.max(value,item.peak*.997);
    item.count++;
  }

  function frameGap(milliseconds,now=performance.now()){
    sample('gap',milliseconds);
    frameCount++;
    if(milliseconds>=42)longFrameCount++;
    worstGap=Math.max(worstGap,milliseconds);
    if(now-windowStarted>=WINDOW_MS){
      recent={
        frames:frameCount,
        longFrames:longFrameCount,
        longFrameRate:frameCount?longFrameCount/frameCount:0,
        worstGap
      };
      windowStarted=now;frameCount=0;longFrameCount=0;worstGap=0;
    }
  }

  function snapshot(){
    const read=name=>{
      const item=metrics[name];
      return item?{average:item.average,peak:item.peak,count:item.count}:{average:0,peak:0,count:0};
    };
    const liveRecent=frameCount?{
      frames:frameCount,longFrames:longFrameCount,
      longFrameRate:longFrameCount/frameCount,worstGap
    }:recent;
    return {
      physics:read('physics'),world:read('world'),hud:read('hud'),prediction:read('prediction'),work:read('work'),gap:read('gap'),
      recent:{...liveRecent}
    };
  }

  function reset(){
    for(const name of Object.keys(metrics))delete metrics[name];
    windowStarted=performance.now();frameCount=0;longFrameCount=0;worstGap=0;
    recent={frames:0,longFrames:0,longFrameRate:0,worstGap:0};
  }

  global.SpaceGamePerformance=Object.freeze({sample,frameGap,snapshot,reset});
})(globalThis);
