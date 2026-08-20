"use strict";

// 星际快递员声音系统：纯 Web Audio 合成，不下载音频素材。
// 声音设计刻意避开街机蜂鸣器：推进器以低频燃烧和宽带喷流为主，
// 姿控、开伞、对接与锚定则使用各自独立的气动/机械瞬态。
(function installSpaceGameAudio(global){
  const STORAGE_KEY='spacegame-audio-v1';
  const AudioCtor=global.AudioContext||global.webkitAudioContext;
  let context=null,master=null,compressor=null,noiseBuffer=null;
  let engineTone=null,engineNoise=null,engineToneGain=null,engineNoiseGain=null;
  let engineAirGain=null,engineFilter=null,engineAirFilter=null,engineLfo=null;
  let enabled=loadEnabled(),lastEngineActive=false,lastNamedEvent='',lastNamedAt=-Infinity,lastTurnAt=-Infinity;

  function loadEnabled(){
    try{const value=global.localStorage&&localStorage.getItem(STORAGE_KEY);return value===null?true:value!=='off';}
    catch(_){return true;}
  }
  function saveEnabled(){
    try{if(global.localStorage)localStorage.setItem(STORAGE_KEY,enabled?'on':'off');}catch(_){}
  }
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
    engineNoise.connect(engineAirGain).connect(engineAirFilter).connect(master);
    engineFilter.connect(master);
    engineTone.start();engineNoise.start();engineLfo.start();
  }
  function ensure(){
    if(!enabled||!AudioCtor)return null;
    if(!context){
      context=new AudioCtor({latencyHint:'interactive'});
      master=context.createGain();master.gain.value=.38;
      compressor=context.createDynamicsCompressor();
      compressor.threshold.value=-20;compressor.knee.value=16;compressor.ratio.value=4;
      compressor.attack.value=.008;compressor.release.value=.22;
      master.connect(compressor).connect(context.destination);
      noiseBuffer=buildNoiseBuffer(context);
      createEngine(context);
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
    osc.connect(gain).connect(master);osc.start(start);osc.stop(start+duration+.03);
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
    source.connect(filter).connect(gain).connect(master);
    source.start(start);source.stop(start+duration+.03);
  }
  function airJet(volume=.035,duration=.1,delay=0){
    filteredNoise({duration,delay,volume,type:'bandpass',from:2100,to:720,q:.65,attack:.003});
    filteredNoise({duration:duration*.82,delay,volume:volume*.34,type:'lowpass',from:520,to:190,q:.6,attack:.002});
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
  function sfx(name){
    if(!enabled)return;
    const now=global.performance&&performance.now?performance.now():Date.now();
    if(name==='turn'&&now-lastTurnAt<55)return;
    if(name==='ui'&&now-lastNamedAt<70)return;
    if(name==='ui'&&now-lastNamedAt<140&&lastNamedEvent!=='ui')return;
    if(name==='success'&&now-lastNamedAt<320&&(lastNamedEvent==='dock'||lastNamedEvent==='deploy'))return;
    remember(name);
    switch(name){
      case 'turn':
        lastTurnAt=now;airJet(.032,.105);break;
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
    lastEngineActive=active;
  }
  function setEnabled(next){
    enabled=!!next;saveEnabled();
    if(!enabled)setEngine(false,0);else ensure();
    if(context&&master){
      const now=context.currentTime;
      master.gain.cancelScheduledValues(now);
      master.gain.linearRampToValueAtTime(enabled ? .38 : 0,now+.05);
    }
    return enabled;
  }
  function toggle(){setEnabled(!enabled);if(enabled)sfx('ui');return enabled;}
  function stopAll(){setEngine(false,0);}
  function status(){return {enabled,supported:!!AudioCtor,ready:!!context,engineActive:lastEngineActive};}

  const api={unlock:ensure,sfx,setEngine,setEnabled,toggle,stopAll,status,isEnabled:()=>enabled};
  global.SpaceGameAudio=Object.freeze(api);

  if(global.document){
    document.addEventListener('pointerdown',ensure,{capture:true,passive:true});
    document.addEventListener('keydown',ensure,{capture:true});
    document.addEventListener('click',event=>{
      const button=event.target&&event.target.closest?event.target.closest('button'):null;
      if(button&&!button.matches('[data-hold]'))sfx('ui');
    });
    document.addEventListener('visibilitychange',()=>{if(document.hidden)stopAll();});
  }
})(globalThis);
