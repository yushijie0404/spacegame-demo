"use strict";

// 星际快递员声音系统：纯 Web Audio 合成，不下载音频素材。
// 声音设计刻意避开街机蜂鸣器：推进器以低频燃烧和宽带喷流为主，
// 姿控、开伞、对接与锚定则使用各自独立的气动/机械瞬态。
(function installSpaceGameAudio(global){
  const STORAGE_KEY='spacegame-audio-v1',SFX_VOLUME_KEY='spacegame-sfx-volume-v1',MUSIC_STORAGE_KEY='spacegame-music-v1';
  const MUSIC_BUS_MAX=.14,MUSIC_HEAD_SKIP=.075;
  const MUSIC_TRACKS=Object.freeze({
    menu:{file:'星海主界面.mp3',trimDb:-1.6,overlap:3,phrase:3},
    reading:{file:'星海主界面 (1).mp3',trimDb:-.5,overlap:3.5,phrase:3.5},
    l1:{file:'启航星港 (1).mp3',trimDb:-1.5,overlap:3,phrase:3},
    l2:{file:'启航星港.mp3',trimDb:-.6,overlap:4,phrase:4},
    l3:{file:'星海远航 (1).mp3',trimDb:-3.3,overlap:3.5,phrase:3.5},
    l4:{file:'星海远航.mp3',trimDb:-3.7,overlap:3,phrase:3},
    l5:{file:'引力弹弓 (1).mp3',trimDb:-2.6,overlap:3,phrase:3},
    l6:{file:'引力弹弓.mp3',trimDb:-1.8,overlap:3,phrase:3},
    l7:{file:'小行星拦截.mp3',trimDb:-1.1,overlap:3,phrase:3},
    l7High:{file:'小行星拦截 (1).mp3',trimDb:-2.3,overlap:3,phrase:3},
    l8:{file:'双星航迹 (1).mp3',trimDb:-.5,overlap:3,phrase:3},
    l8High:{file:'双星航迹.mp3',trimDb:-2.8,overlap:3,phrase:3},
    l9:{file:'黑洞航线.mp3',trimDb:-2.6,overlap:3,phrase:3},
    l9High:{file:'黑洞航线 (1).mp3',trimDb:-1.8,overlap:3,phrase:3},
    l10:{file:'三体救援航道 (1).mp3',trimDb:-1,overlap:5,phrase:4},
    l10Finale:{file:'三体救援航道.mp3',trimDb:-.4,overlap:3,phrase:3}
  });
  const LEVEL_TRACKS=Object.freeze({1:'l1',2:'l2',3:'l3',4:'l4',5:'l5',6:'l6',7:'l7',8:'l8',9:'l9',10:'l10'});
  const INTENSITY_TRACKS=Object.freeze({7:{high:'l7High'},8:{high:'l8High'},9:{high:'l9High'},10:{finale:'l10Finale',high:'l10Finale'}});
  const AudioCtor=global.AudioContext||global.webkitAudioContext;
  let context=null,master=null,compressor=null,sfxBus=null,musicBus=null,noiseBuffer=null;
  let engineTone=null,engineNoise=null,engineToneGain=null,engineNoiseGain=null;
  let engineAirGain=null,engineFilter=null,engineAirFilter=null,engineLfo=null;
  let turnNoise=null,turnHighGain=null,turnBodyGain=null,turnHighFilter=null,turnBodyFilter=null;
  let enabled=loadEnabled(),sfxVolume=loadSfxVolume(),lastEngineActive=false,lastTurnActive=false,lastNamedEvent='',lastNamedAt=-Infinity,lastTurnAt=-Infinity;
  let musicEnabled=true,musicVolume=.8,userUnlocked=false,autoplayBlocked=false;
  let musicRuntimeState='idle',musicRuntimeError='';
  let desiredTrack='',currentVoice=null,pendingTrack='',switchTimer=null,loopTimer=null,transitionSerial=0;
  let visibilityPauseTimer=null,transientDuckTimer=null;
  const voices=new Set(),musicDucks=new Map(),preloadedTracks=new Map();

  function loadEnabled(){
    try{const value=global.localStorage&&localStorage.getItem(STORAGE_KEY);return value===null?true:value!=='off';}
    catch(_){return true;}
  }
  function saveEnabled(){
    try{if(global.localStorage)localStorage.setItem(STORAGE_KEY,enabled?'on':'off');}catch(_){}
  }
  function loadSfxVolume(){
    try{const raw=global.localStorage&&localStorage.getItem(SFX_VOLUME_KEY);if(raw===null||raw===undefined||raw==='')return 1;const value=Number(raw);return Number.isFinite(value)&&value>=0?Math.min(1,value):1;}
    catch(_){return 1;}
  }
  function saveSfxVolume(){
    try{if(global.localStorage)localStorage.setItem(SFX_VOLUME_KEY,String(sfxVolume));}catch(_){}
  }
  function loadMusicSettings(){
    try{
      const raw=global.localStorage&&localStorage.getItem(MUSIC_STORAGE_KEY);
      if(!raw)return;
      const saved=JSON.parse(raw);musicEnabled=saved.enabled!==false;
      if(Number.isFinite(saved.volume))musicVolume=Math.max(0,Math.min(1,saved.volume));
    }catch(_){}
  }
  function saveMusicSettings(){
    try{if(global.localStorage)localStorage.setItem(MUSIC_STORAGE_KEY,JSON.stringify({enabled:musicEnabled,volume:musicVolume}));}catch(_){}
  }
  loadMusicSettings();
  function setParam(param,value,when,ramp=.025){
    if(!param)return;
    const safe=Math.max(.0001,value);
    param.cancelScheduledValues(when);
    param.setValueAtTime(Math.max(.0001,param.value||.0001),when);
    param.exponentialRampToValueAtTime(safe,when+ramp);
  }
  function buildNoiseBuffer(ctx){
    const length=Math.max(1,Math.floor(ctx.sampleRate*1.35));
    const buffer=ctx.createBuffer(1,length,ctx.sampleRate),data=buffer.getChannelData(0);
    let seed=0x51a7c0de,previous=0;
    for(let i=0;i<length;i++){
      seed=(seed*1664525+1013904223)>>>0;
      const white=(seed/4294967295)*2-1;
      previous=previous*.16+white*.84;
      data[i]=previous;
    }
    return buffer;
  }
  function createEngine(ctx){
    engineFilter=ctx.createBiquadFilter();
    engineFilter.type='lowpass';engineFilter.frequency.value=245;engineFilter.Q.value=.72;
    engineAirFilter=ctx.createBiquadFilter();
    engineAirFilter.type='bandpass';engineAirFilter.frequency.value=760;engineAirFilter.Q.value=.48;
    engineToneGain=ctx.createGain();engineToneGain.gain.value=.0001;
    engineNoiseGain=ctx.createGain();engineNoiseGain.gain.value=.0001;
    engineAirGain=ctx.createGain();engineAirGain.gain.value=.0001;
    engineTone=ctx.createOscillator();engineTone.type='sine';engineTone.frequency.value=37;
    engineNoise=ctx.createBufferSource();engineNoise.buffer=noiseBuffer;engineNoise.loop=true;
    engineLfo=ctx.createOscillator();engineLfo.type='sine';engineLfo.frequency.value=6.4;
    const lfoDepth=ctx.createGain();lfoDepth.gain.value=24;
    engineLfo.connect(lfoDepth).connect(engineFilter.frequency);
    engineTone.connect(engineToneGain).connect(engineFilter);
    engineNoise.connect(engineNoiseGain).connect(engineFilter);
    engineNoise.connect(engineAirGain).connect(engineAirFilter).connect(sfxBus);
    engineFilter.connect(sfxBus);
    turnHighFilter=ctx.createBiquadFilter();turnHighFilter.type='highpass';turnHighFilter.frequency.value=1180;turnHighFilter.Q.value=.22;
    turnBodyFilter=ctx.createBiquadFilter();turnBodyFilter.type='bandpass';turnBodyFilter.frequency.value=430;turnBodyFilter.Q.value=.5;
    turnHighGain=ctx.createGain();turnHighGain.gain.value=.0001;turnBodyGain=ctx.createGain();turnBodyGain.gain.value=.0001;
    turnNoise=ctx.createBufferSource();turnNoise.buffer=noiseBuffer;turnNoise.loop=true;
    turnNoise.connect(turnHighFilter).connect(turnHighGain).connect(sfxBus);turnNoise.connect(turnBodyFilter).connect(turnBodyGain).connect(sfxBus);
    engineTone.start();engineNoise.start();engineLfo.start();turnNoise.start();
  }
  function ensure(){
    if((!enabled&&!musicEnabled)||!AudioCtor)return null;
    if(!context){
      context=new AudioCtor({latencyHint:'interactive'});
      master=context.createGain();master.gain.value=.38;
      sfxBus=context.createGain();sfxBus.gain.value=enabled?Math.max(.0001,sfxVolume):.0001;
      musicBus=context.createGain();musicBus.gain.value=.0001;
      compressor=context.createDynamicsCompressor();
      compressor.threshold.value=-20;compressor.knee.value=16;compressor.ratio.value=4;
      compressor.attack.value=.008;compressor.release.value=.22;
      sfxBus.connect(master);musicBus.connect(master);master.connect(compressor).connect(context.destination);
      noiseBuffer=buildNoiseBuffer(context);
      createEngine(context);
      updateMusicBus(0);
    }
    if(context.state==='suspended')context.resume().catch(()=>{});
    return context;
  }
  function oscillatorPartial(frequency,duration=.1,volume=.05,delay=0,endFrequency=null,type='sine',attack=.004){
    const ctx=ensure();if(!ctx)return;
    const start=ctx.currentTime+delay,osc=ctx.createOscillator(),gain=ctx.createGain();
    osc.type=type;osc.frequency.setValueAtTime(Math.max(18,frequency),start);
    if(endFrequency)osc.frequency.exponentialRampToValueAtTime(Math.max(18,endFrequency),start+duration);
    gain.gain.setValueAtTime(.0001,start);
    gain.gain.exponentialRampToValueAtTime(Math.max(.0001,volume),start+Math.min(attack,duration*.3));
    gain.gain.exponentialRampToValueAtTime(.0001,start+duration);
    osc.connect(gain).connect(sfxBus);osc.start(start);osc.stop(start+duration+.03);
  }
  function filteredNoise(options={}){
    const ctx=ensure();if(!ctx)return;
    const duration=options.duration??.12,delay=options.delay??0,start=ctx.currentTime+delay;
    const source=ctx.createBufferSource(),filter=ctx.createBiquadFilter(),gain=ctx.createGain();
    source.buffer=noiseBuffer;
    filter.type=options.type||'bandpass';
    filter.Q.value=options.q??.7;
    const from=Math.max(30,options.from??900),to=Math.max(30,options.to??from);
    filter.frequency.setValueAtTime(from,start);
    filter.frequency.exponentialRampToValueAtTime(to,start+duration);
    const attack=Math.min(options.attack??.004,duration*.35),volume=Math.max(.0001,options.volume??.04);
    gain.gain.setValueAtTime(.0001,start);
    gain.gain.exponentialRampToValueAtTime(volume,start+attack);
    gain.gain.exponentialRampToValueAtTime(.0001,start+duration);
    source.connect(filter).connect(gain).connect(sfxBus);
    source.start(start,Math.max(0,Math.min(.95,Number(options.offset)||0)));source.stop(start+duration+.03);
  }
  function airJet(volume=.035,duration=.1,delay=0){
    filteredNoise({duration,delay,volume,type:'bandpass',from:2100,to:720,q:.65,attack:.003});
    filteredNoise({duration:duration*.82,delay,volume:volume*.34,type:'lowpass',from:520,to:190,q:.6,attack:.002});
  }
  function rcsJet(volume=.05,duration=.18,delay=0){
    const offset=Math.random()*.75;
    // Cold-gas attitude thruster: an immediate high-pressure hiss followed by
    // a short, broader exhaust puff. No pitched oscillator is used.
    filteredNoise({duration,delay,volume,type:'highpass',from:5200,to:1100,q:.28,attack:.0015,offset});
    filteredNoise({duration:duration*.78,delay:delay+.006,volume:volume*.44,type:'lowpass',from:1050,to:280,q:.45,attack:.002,offset:offset+.13});
  }
  function lowThump(volume=.07,duration=.18,delay=0,from=78,to=36){
    oscillatorPartial(from,duration,volume,delay,to,'sine',.002);
  }
  function mechanicalClunk(volume=.055,delay=0){
    oscillatorPartial(176,.105,volume,delay,118,'sine',.002);
    oscillatorPartial(263,.07,volume*.42,delay+.006,202,'sine',.001);
    filteredNoise({duration:.045,delay,volume:volume*.38,type:'bandpass',from:1500,to:520,q:1.15,attack:.001});
  }
  function relayClick(volume=.025,delay=0){
    filteredNoise({duration:.022,delay,volume,type:'highpass',from:3400,to:1450,q:.8,attack:.001});
    oscillatorPartial(118,.034,volume*.75,delay,82,'sine',.001);
  }
  function glassNote(frequency,delay=0,volume=.035,duration=.28){
    oscillatorPartial(frequency,duration,volume,delay,null,'sine',.003);
    oscillatorPartial(frequency*2.71,duration*.48,volume*.18,delay,null,'sine',.002);
  }
  function remember(name){
    const now=global.performance&&performance.now?performance.now():Date.now();
    lastNamedEvent=name;lastNamedAt=now;
    return now;
  }
  function dbToGain(db){return Math.pow(10,Number(db||0)/20);}
  function musicUrl(file){
    const relative=`music/${file}`;
    try{return new URL(relative,global.document?.baseURI||global.location?.href||'file:///').href;}
    catch(_){return encodeURI(relative);}
  }
  function newTrackAudio(trackId){
    const track=MUSIC_TRACKS[trackId],direct=global.location?.protocol==='file:';
    if(!track||typeof global.Audio!=='function')return null;
    const audio=new global.Audio();audio.preload='auto';if(!direct)audio.crossOrigin='anonymous';audio.src=musicUrl(track.file);audio.playsInline=true;
    return audio;
  }
  function preloadTrack(trackId,onProgress){
    if(!MUSIC_TRACKS[trackId]||typeof global.Audio!=='function')return Promise.resolve(false);
    let entry=preloadedTracks.get(trackId);
    if(entry){if(typeof onProgress==='function'){entry.listeners.add(onProgress);onProgress(entry.progress);}return entry.promise;}
    const audio=newTrackAudio(trackId),listeners=new Set();if(typeof onProgress==='function')listeners.add(onProgress);
    entry={audio,listeners,progress:.02,claimed:false,promise:null,timer:null};preloadedTracks.set(trackId,entry);
    const report=value=>{entry.progress=Math.max(entry.progress,Math.min(1,Number(value)||0));for(const listener of entry.listeners){try{listener(entry.progress);}catch(_){}}};
    entry.promise=new Promise(resolve=>{
      let done=false;const finish=ok=>{if(done)return;done=true;if(entry.timer!==null){clearTimeout(entry.timer);entry.timer=null;}report(1);if(!ok&&!entry.claimed)preloadedTracks.delete(trackId);resolve(ok);};
      audio.addEventListener?.('loadedmetadata',()=>report(.18),{once:true});
      audio.addEventListener?.('progress',()=>{
        try{if(audio.duration>0&&audio.buffered?.length)report(.18+.76*Math.min(1,audio.buffered.end(audio.buffered.length-1)/audio.duration));}catch(_){}
      });
      audio.addEventListener?.('canplay',()=>report(.78),{once:true});
      audio.addEventListener?.('canplaythrough',()=>finish(true),{once:true});
      audio.addEventListener?.('error',()=>finish(false),{once:true});
      entry.timer=setTimeout(()=>finish(audio.readyState>=3),12000);
      try{audio.load?.();}catch(_){finish(false);}
    });
    report(.02);return entry.promise;
  }
  function preloadLevel(level,options={}){
    const id=Math.max(1,Math.min(10,Number(level)||1)),intensity=options.intensity||'normal';
    const trackId=intensity!=='normal'&&INTENSITY_TRACKS[id]?.[intensity]||LEVEL_TRACKS[id];
    return preloadTrack(trackId,options.onProgress);
  }
  function publishMusicState(state,trackId=desiredTrack,error=''){
    musicRuntimeState=state;musicRuntimeError=error?.name||String(error||'');
    const doc=global.document,root=doc?.documentElement;
    if(root){root.dataset.musicState=state;root.dataset.musicTrack=trackId||'';root.dataset.musicError=musicRuntimeError;}
    if(doc&&typeof doc.dispatchEvent==='function'&&typeof global.CustomEvent==='function')doc.dispatchEvent(new global.CustomEvent('spacegame-music-state',{detail:{state,track:trackId||'',error:musicRuntimeError}}));
  }
  function musicBusLevel(){
    let factor=1;
    for(const value of musicDucks.values())factor=Math.min(factor,Math.max(0,Math.min(1,Number(value))));
    return musicEnabled?MUSIC_BUS_MAX*musicVolume*factor:0;
  }
  function rampLinear(param,value,when,duration){
    if(!param)return;
    const start=Math.max(.0001,Number(param.value)||.0001),target=Math.max(.0001,value);
    param.cancelScheduledValues(when);param.setValueAtTime(start,when);param.linearRampToValueAtTime(target,when+Math.max(.01,duration));
  }
  function updateMusicBus(duration=.25){
    if(context&&musicBus)rampLinear(musicBus.gain,musicBusLevel(),context.currentTime,duration);
    for(const voice of voices)if(voice.direct&&!voice.released)applyDirectVolume(voice);
  }
  function setMusicDuck(reason,level=.4,duration=.6){
    if(!reason)return;
    musicDucks.set(String(reason),Math.max(0,Math.min(1,Number(level))));updateMusicBus(duration);
  }
  function clearMusicDuck(reason,duration=.8){musicDucks.delete(String(reason));updateMusicBus(duration);}
  function duckForCriticalSfx(name){
    const settings={warning:[.38,.75],explosion:[.28,1.05],dock:[.45,.7],success:[.42,.9],deploy:[.55,.5],chute:[.55,.65],anchor:[.52,.55]};
    const setting=settings[name];if(!setting)return;
    setMusicDuck('critical-sfx',setting[0],.035);
    if(transientDuckTimer!==null)clearTimeout(transientDuckTimer);
    transientDuckTimer=setTimeout(()=>{transientDuckTimer=null;clearMusicDuck('critical-sfx',.28);},setting[1]*1000);
  }
  function equalPowerCurve(param,fadeIn,peak,start,duration){
    if(!param)return;
    const steps=33,curve=new Float32Array(steps);
    for(let i=0;i<steps;i++){const phase=i/(steps-1)*Math.PI/2;curve[i]=(fadeIn?Math.sin(phase):Math.cos(phase))*peak;}
    param.cancelScheduledValues(start);param.setValueAtTime(Math.max(.0001,param.value||.0001),start);param.setValueCurveAtTime(curve,start,Math.max(.05,duration));
  }
  function applyDirectVolume(voice){
    if(!voice?.direct)return;
    voice.audio.volume=Math.max(0,Math.min(1,(voice.envelope||0)*voice.level*musicBusLevel()*.38));
  }
  function fadeVoice(voice,fadeIn,peak,start,duration){
    if(!voice||voice.released)return;
    if(!voice.direct){equalPowerCurve(voice.gain.gain,fadeIn,peak,start,duration);return;}
    if(voice.fadeTimer!==null){clearInterval(voice.fadeTimer);voice.fadeTimer=null;}
    const from=Math.max(0,Math.min(1,voice.envelope||0)),began=Date.now(),seconds=Math.max(.05,duration);
    const tick=()=>{
      const progress=Math.min(1,(Date.now()-began)/(seconds*1000)),curve=fadeIn?Math.sin(progress*Math.PI/2):Math.cos(progress*Math.PI/2);
      voice.envelope=fadeIn?from+(1-from)*curve:from*curve;applyDirectVolume(voice);
      if(progress>=1&&voice.fadeTimer!==null){clearInterval(voice.fadeTimer);voice.fadeTimer=null;}
    };
    tick();voice.fadeTimer=setInterval(tick,30);
  }
  function releaseVoice(voice,delay=0){
    if(!voice||voice.released)return;
    const finish=()=>{
      if(voice.released)return;voice.released=true;
      if(voice.fadeTimer!==null){clearInterval(voice.fadeTimer);voice.fadeTimer=null;}
      try{voice.audio.pause();voice.audio.removeAttribute?.('src');voice.audio.load?.();}catch(_){}
      try{voice.source?.disconnect();voice.gain?.disconnect();}catch(_){}
      voices.delete(voice);if(currentVoice===voice)currentVoice=null;
    };
    if(voice.releaseTimer!==null){clearTimeout(voice.releaseTimer);voice.releaseTimer=null;}
    if(delay>0)voice.releaseTimer=setTimeout(finish,delay*1000);else finish();
  }
  function createVoice(trackId,startOffset=MUSIC_HEAD_SKIP){
    const track=MUSIC_TRACKS[trackId];
    if(!track||!context||!musicBus||typeof global.Audio!=='function')return null;
    const direct=global.location?.protocol==='file:';
    const preload=preloadedTracks.get(trackId),audio=preload&&!preload.claimed?(preload.claimed=true,preloadedTracks.delete(trackId),preload.audio):newTrackAudio(trackId);if(!audio)return null;
    const source=direct?null:context.createMediaElementSource(audio),gain=direct?null:context.createGain();if(gain)gain.gain.value=.0001;
    if(source&&gain)source.connect(gain).connect(musicBus);
    const voice={trackId,track,audio,source,gain,direct,envelope:0,fadeTimer:null,level:dbToGain(track.trimDb),released:false,looping:false,releaseTimer:null,playPromise:null};
    if(direct)applyDirectVolume(voice);
    voices.add(voice);
    try{audio.currentTime=Math.max(0,startOffset);}catch(_){}
    audio.addEventListener?.('loadedmetadata',()=>{
      if(!voice.released&&startOffset>0&&audio.currentTime<startOffset*.5){try{audio.currentTime=startOffset;}catch(_){}}
    },{once:true});
    audio.addEventListener?.('ended',()=>{if(!voice.released&&currentVoice===voice&&desiredTrack===voice.trackId)overlapLoop(voice,true);});
    audio.addEventListener?.('error',()=>{if(!voice.released)publishMusicState('error',trackId,audio.error?.message||`MediaError ${audio.error?.code||0}`);});
    try{
      const result=audio.play();voice.playPromise=result&&typeof result.then==='function'?result:Promise.resolve();
    }catch(error){voice.playPromise=Promise.reject(error);}
    return voice;
  }
  function fadeOutOtherVoices(keep,start,duration){
    for(const voice of [...voices]){
      if(voice===keep||voice.released)continue;
      fadeVoice(voice,false,voice.direct?voice.level:Math.max(.0001,voice.gain.gain.value||voice.level),start,duration);
      releaseVoice(voice,duration+.12);
    }
  }
  function beginTransition(trackId,duration=2.8,serial=transitionSerial,startOffset=MUSIC_HEAD_SKIP){
    if(serial!==transitionSerial||trackId!==desiredTrack)return false;
    const ctx=ensure();if(!ctx||typeof global.Audio!=='function')return false;
    for(const stale of [...voices])if(stale!==currentVoice)releaseVoice(stale);
    pendingTrack='';const outgoing=currentVoice,voice=createVoice(trackId,startOffset);if(!voice)return false;
    const activate=()=>{
      if(serial!==transitionSerial||trackId!==desiredTrack){releaseVoice(voice);return false;}
      autoplayBlocked=false;const start=ctx.currentTime;
      fadeOutOtherVoices(voice,start,duration);fadeVoice(voice,true,voice.level,start,duration);
      currentVoice=voice;publishMusicState('playing',trackId);startLoopMonitor();return true;
    };
    voice.playPromise.then(activate).catch(error=>{
      autoplayBlocked=error?.name==='NotAllowedError';publishMusicState(autoplayBlocked?'blocked':'error',trackId,error);releaseVoice(voice);
      if(outgoing&&!outgoing.released){fadeVoice(outgoing,true,outgoing.level,ctx.currentTime,.35);currentVoice=outgoing;}
    });
    return true;
  }
  function phraseDelay(voice){
    if(!voice||!Number.isFinite(voice.audio.currentTime))return 0;
    const window=Math.max(2,Math.min(4,voice.track.phrase||3)),position=Math.max(0,voice.audio.currentTime-MUSIC_HEAD_SKIP),remainder=position%window;
    const delay=window-remainder;return delay<.18?0:delay;
  }
  function playBgm(trackId,options={}){
    if(!MUSIC_TRACKS[trackId])return false;
    desiredTrack=trackId;
    const same=currentVoice&&!currentVoice.released&&currentVoice.trackId===trackId;
    if(same){
      transitionSerial++;pendingTrack='';if(switchTimer!==null){clearTimeout(switchTimer);switchTimer=null;}
      for(const stale of [...voices])if(stale!==currentVoice)releaseVoice(stale);
      if(context)fadeVoice(currentVoice,true,currentVoice.level,context.currentTime,.2);
      return false;
    }
    transitionSerial++;const serial=transitionSerial;
    if(switchTimer!==null){clearTimeout(switchTimer);switchTimer=null;}
    if(!userUnlocked||!musicEnabled||!AudioCtor||typeof global.Audio!=='function'){pendingTrack=trackId;publishMusicState('pending',trackId);return true;}
    const duration=Math.max(.2,Number(options.duration)||2.8),delay=options.phraseBoundary?phraseDelay(currentVoice):0;
    pendingTrack=trackId;
    if(delay>0)switchTimer=setTimeout(()=>{switchTimer=null;beginTransition(trackId,duration,serial);},delay*1000);
    else beginTransition(trackId,duration,serial);
    return true;
  }
  function playLevel(level,options={}){
    const id=Math.max(1,Math.min(10,Number(level)||1)),intensity=options.intensity||'normal';
    const trackId=intensity!=='normal'&&INTENSITY_TRACKS[id]?.[intensity]||LEVEL_TRACKS[id];
    return playBgm(trackId,{duration:options.duration||2.8,phraseBoundary:!!options.phraseBoundary});
  }
  function setIntensity(level,intensity='normal',options={}){
    return playLevel(level,{intensity,duration:options.duration||3.5,phraseBoundary:options.phraseBoundary!==false});
  }
  function startLoopMonitor(){
    if(loopTimer!==null)return;
    loopTimer=setInterval(()=>{
      const voice=currentVoice;if(!voice||voice.released||voice.looping||!musicEnabled||!Number.isFinite(voice.audio.duration))return;
      if(voice.audio.duration-voice.audio.currentTime<=voice.track.overlap)overlapLoop(voice,false);
    },250);
  }
  function overlapLoop(voice,endedFallback=false){
    if(!voice||voice.released||voice.looping||currentVoice!==voice||desiredTrack!==voice.trackId)return false;
    voice.looping=true;const serial=transitionSerial,newVoice=createVoice(voice.trackId,MUSIC_HEAD_SKIP);if(!newVoice){voice.looping=false;return false;}
    const duration=endedFallback?.18:voice.track.overlap;
    newVoice.playPromise.then(()=>{
      if(serial!==transitionSerial||currentVoice!==voice||desiredTrack!==voice.trackId){releaseVoice(newVoice);return;}
      const start=context.currentTime;fadeVoice(voice,false,voice.level,start,duration);fadeVoice(newVoice,true,newVoice.level,start,duration);
      currentVoice=newVoice;releaseVoice(voice,duration+.12);
    }).catch(()=>{autoplayBlocked=true;releaseVoice(newVoice);voice.looping=false;});
    return true;
  }
  function resumeVoices(){
    if(!musicEnabled)return;
    for(const voice of voices){if(voice.released)continue;try{const result=voice.audio.play();if(result?.catch)result.catch(()=>{autoplayBlocked=true;});}catch(_){autoplayBlocked=true;}}
  }
  function pauseMusic(duration=.25){
    setMusicDuck('paused',0,duration);
    setTimeout(()=>{for(const voice of voices){if(!voice.released)voice.audio.pause();}},Math.max(.05,duration)*1000+30);
  }
  function resumeMusic(duration=.45){clearMusicDuck('paused',duration);resumeVoices();if(desiredTrack&&!currentVoice)playBgm(desiredTrack,{duration});}
  function stopMusic(duration=.25){
    transitionSerial++;desiredTrack='';pendingTrack='';if(switchTimer!==null){clearTimeout(switchTimer);switchTimer=null;}
    if(loopTimer!==null){clearInterval(loopTimer);loopTimer=null;}
    publishMusicState('stopped','');
    if(context){const start=context.currentTime;for(const voice of voices)fadeVoice(voice,false,voice.direct?voice.level:Math.max(.0001,voice.gain.gain.value||voice.level),start,duration);}
    for(const voice of [...voices])releaseVoice(voice,duration+.12);currentVoice=null;
  }
  function unlock(){
    userUnlocked=true;const ctx=ensure();if(!ctx)return null;
    if(musicEnabled){updateMusicBus(.12);if(desiredTrack&&!currentVoice)playBgm(desiredTrack,{duration:2.5});else resumeVoices();}
    return ctx;
  }
  function setMusicEnabled(next){
    musicEnabled=!!next;saveMusicSettings();
    if(musicEnabled){unlock();clearMusicDuck('setting',.25);resumeVoices();if(desiredTrack&&!currentVoice)playBgm(desiredTrack,{duration:.6});}
    else{setMusicDuck('setting',0,.18);setTimeout(()=>{for(const voice of voices){if(!voice.released)voice.audio.pause();}},230);}
    return musicEnabled;
  }
  function toggleMusic(){return setMusicEnabled(!musicEnabled);}
  function setMusicVolume(next){musicVolume=Math.max(0,Math.min(1,Number(next)||0));saveMusicSettings();updateMusicBus(.08);return musicVolume;}
  function musicStatus(){
    const voice=currentVoice&&!currentVoice.released?currentVoice:null;
    return {enabled:musicEnabled,volume:musicVolume,supported:!!AudioCtor&&typeof global.Audio==='function',unlocked:userUnlocked,blocked:autoplayBlocked,
      state:musicRuntimeState,error:musicRuntimeError,direct:!!voice?.direct,track:voice?.trackId||desiredTrack||'',file:voice?.track.file||MUSIC_TRACKS[desiredTrack]?.file||'',playing:!!voice&&!voice.audio.paused,pending:pendingTrack,voices:[...voices].filter(v=>!v.released).length,duck:musicBusLevel()};
  }
  function sfx(name){
    if(!enabled)return;
    const now=global.performance&&performance.now?performance.now():Date.now();
    if(name==='turn'&&now-lastTurnAt<55)return;
    if(name==='ui'&&now-lastNamedAt<70)return;
    if(name==='ui'&&now-lastNamedAt<140&&lastNamedEvent!=='ui')return;
    if(name==='success'&&now-lastNamedAt<320&&(lastNamedEvent==='dock'||lastNamedEvent==='deploy'))return;
    remember(name);duckForCriticalSfx(name);
    switch(name){
      case 'turn':
        lastTurnAt=now;rcsJet(.052,.18);break;
      case 'chute':
        lowThump(.07,.2,0,68,42);
        filteredNoise({duration:.62,volume:.085,type:'bandpass',from:1850,to:460,q:.38,attack:.018});
        filteredNoise({duration:.3,delay:.04,volume:.03,type:'highpass',from:3100,to:1200,q:.5,attack:.006});
        break;
      case 'explosion':
        // Hard fracture first, then a compact pressure wave and short debris tail.
        // Keeping the blast under 0.6 s prevents the old soft "puff/whistle" character.
        filteredNoise({duration:.055,volume:.15,type:'highpass',from:6200,to:1800,q:.45,attack:.001});
        filteredNoise({duration:.17,volume:.19,type:'bandpass',from:2600,to:260,q:.58,attack:.001});
        lowThump(.23,.39,0,108,27);
        filteredNoise({duration:.56,volume:.145,type:'lowpass',from:980,to:72,q:.46,attack:.001});
        mechanicalClunk(.032,.085);mechanicalClunk(.022,.17);
        lowThump(.052,.25,.075,54,23);
        break;
      case 'deploy':
        relayClick(.04);mechanicalClunk(.045,.055);
        airJet(.013,.13,.11);
        break;
      case 'dock':
        mechanicalClunk(.065);
        mechanicalClunk(.043,.115);
        oscillatorPartial(96,.28,.035,.16,68,'sine',.003);
        break;
      case 'anchor':
        mechanicalClunk(.075);
        filteredNoise({duration:.18,delay:.045,volume:.027,type:'bandpass',from:780,to:210,q:1.2,attack:.002});
        lowThump(.038,.22,.07,58,31);
        break;
      case 'release':
        relayClick(.032);mechanicalClunk(.03,.045);airJet(.012,.09,.08);
        break;
      case 'success':
        glassNote(329.63,0,.032,.24);
        glassNote(440,.105,.034,.27);
        glassNote(659.25,.22,.038,.42);
        break;
      case 'achievement':
        mechanicalClunk(.026);
        glassNote(523.25,.045,.034,.22);
        glassNote(783.99,.14,.035,.46);
        break;
      case 'warning':
        lowThump(.052,.13,0,88,61);
        lowThump(.052,.16,.17,78,52);
        break;
      case 'skill':
        relayClick(.028);glassNote(392,.035,.025,.16);glassNote(587.33,.12,.028,.3);
        break;
      case 'space_warp_charge':
        relayClick(.018);filteredNoise({duration:.1,from:180,to:1450,volume:.025,q:2.2,attack:.003});glassNote(330,.025,.02,.07);
        break;
      case 'space_warp':
        relayClick(.022);filteredNoise({duration:.22,from:260,to:2400,volume:.035,q:1.25});
        glassNote(440,.035,.025,.08);glassNote(880,.16,.038,.18);glassNote(1318.51,.22,.028,.31);
        break;
      case 'yamato_charge':
        relayClick(.03);filteredNoise({duration:.86,from:95,to:1450,volume:.035,q:3.1});
        glassNote(110,.035,.045,.03);glassNote(220,.1,.04,.3);glassNote(440,.18,.045,.64);
        break;
      case 'yamato_cannon':
        lowThump(.12,.28,0,88,34);filteredNoise({duration:.11,from:5200,to:680,volume:.12,q:.75,attack:.001});
        filteredNoise({duration:.52,from:1100,to:160,volume:.065,q:1.25,delay:.025});glassNote(880,.08,.035,.01);
        break;
      case 'sharp_angle_maneuver':
        filteredNoise({duration:.18,from:260,to:2800,volume:.045,q:2.4,attack:.002});
        glassNote(659.25,.01,.032,.08);glassNote(987.77,.075,.036,.22);lowThump(.038,.13,.02,96,54);
        break;
      default:
        relayClick(.022);
        break;
    }
  }
  function setEngine(active,power=1){
    active=!!active&&enabled;power=Math.max(0,Math.min(1,Number(power)||0));
    if(!context&&!active)return;
    const ctx=active?ensure():context;if(!ctx||!engineToneGain)return;
    const now=ctx.currentTime;
    const targetTone=active ? .025+.025*power : .0001;
    const targetNoise=active ? .025+.035*power : .0001;
    const targetAir=active ? .007+.016*power : .0001;
    const ramp=active ? .07 : .105;
    setParam(engineToneGain.gain,targetTone,now,ramp);
    setParam(engineNoiseGain.gain,targetNoise,now,ramp);
    setParam(engineAirGain.gain,targetAir,now,ramp);
    engineTone.frequency.cancelScheduledValues(now);
    engineTone.frequency.linearRampToValueAtTime(32+15*power,now+.1);
    engineFilter.frequency.cancelScheduledValues(now);
    engineFilter.frequency.linearRampToValueAtTime(175+235*power,now+.1);
    engineAirFilter.frequency.cancelScheduledValues(now);
    engineAirFilter.frequency.linearRampToValueAtTime(540+540*power,now+.1);
    if(active!==lastEngineActive){if(active)setMusicDuck('engine',.68,.12);else clearMusicDuck('engine',.24);}
    lastEngineActive=active;
  }
  function setTurn(active){
    active=!!active&&enabled;
    if(active===lastTurnActive)return;
    if(!context&&!active)return;
    const ctx=active?ensure():context;if(!ctx||!turnHighGain||!turnBodyGain)return;
    const now=ctx.currentTime,ramp=active?.045:.18;
    setParam(turnHighGain.gain,active?.038:.0001,now,ramp);setParam(turnBodyGain.gain,active?.024:.0001,now,ramp);
    turnHighFilter.frequency.cancelScheduledValues(now);turnHighFilter.frequency.linearRampToValueAtTime(active?1320:980,now+(active?.12:.2));
    turnBodyFilter.frequency.cancelScheduledValues(now);turnBodyFilter.frequency.linearRampToValueAtTime(active?510:350,now+(active?.16:.22));
    lastTurnActive=active;
  }
  function setEnabled(next){
    enabled=!!next;saveEnabled();
    if(!enabled){setEngine(false,0);setTurn(false);}else ensure();
    if(context&&sfxBus){
      const now=context.currentTime;
      sfxBus.gain.cancelScheduledValues(now);
      sfxBus.gain.linearRampToValueAtTime(enabled ? Math.max(.0001,sfxVolume) : .0001,now+.05);
    }
    return enabled;
  }
  function setSfxVolume(next){
    sfxVolume=Math.max(0,Math.min(1,Number(next)||0));saveSfxVolume();
    if(context&&sfxBus){const now=context.currentTime;sfxBus.gain.cancelScheduledValues(now);sfxBus.gain.linearRampToValueAtTime(enabled?Math.max(.0001,sfxVolume):.0001,now+.05);}
    return sfxVolume;
  }
  function toggle(){setEnabled(!enabled);if(enabled)sfx('ui');return enabled;}
  function stopAll(){setEngine(false,0);setTurn(false);}
  function status(){return {enabled,volume:sfxVolume,supported:!!AudioCtor,ready:!!context,engineActive:lastEngineActive,turnActive:lastTurnActive,music:musicStatus()};}

  const api={unlock,sfx,setEngine,setTurn,setEnabled,setSfxVolume,toggle,stopAll,status,isEnabled:()=>enabled,preloadTrack,preloadLevel,preloadMenu:onProgress=>preloadTrack('menu',onProgress),
    playBgm,playLevel,playMenu:options=>playBgm('menu',options),playReading:options=>playBgm('reading',options),setIntensity,
    pauseMusic,resumeMusic,stopMusic,setMusicDuck,clearMusicDuck,setMusicEnabled,toggleMusic,setMusicVolume,musicStatus,
    isMusicEnabled:()=>musicEnabled,musicTracks:()=>MUSIC_TRACKS,levelTracks:()=>LEVEL_TRACKS};
  global.SpaceGameAudio=Object.freeze(api);

  if(global.document){
    document.addEventListener('pointerdown',unlock,{capture:true,passive:true});
    document.addEventListener('touchstart',unlock,{capture:true,passive:true});
    document.addEventListener('keydown',unlock,{capture:true});
    // Mouse activation is granted on click/pointerup in Chromium, not reliably
    // on pointerdown. Retry here so a rejected early attempt becomes audible.
    document.addEventListener('click',unlock,{capture:true});
    document.addEventListener('click',event=>{
      const button=event.target&&event.target.closest?event.target.closest('button'):null;
      if(button&&!button.matches('[data-hold]'))sfx('ui');
    });
    document.addEventListener('visibilitychange',()=>{
      stopAll();
      if(document.hidden){
        setMusicDuck('visibility',0,.22);
        if(visibilityPauseTimer!==null)clearTimeout(visibilityPauseTimer);
        visibilityPauseTimer=setTimeout(()=>{visibilityPauseTimer=null;for(const voice of voices){if(!voice.released)voice.audio.pause();}},280);
      }else{
        if(visibilityPauseTimer!==null){clearTimeout(visibilityPauseTimer);visibilityPauseTimer=null;}
        clearMusicDuck('visibility',.45);resumeVoices();
      }
    });
  }
})(globalThis);
