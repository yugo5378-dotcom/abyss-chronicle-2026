'use strict';
// Original prerecorded score: ordinary media playback, including iPhone Safari.
const AV=(()=>{
 const KEY='abyss_av_v07',defaults={music:false,sfx:false,volume:65,motion:true};let prefs={...defaults};
 try{const p=JSON.parse(localStorage.getItem(KEY));if(p){for(const k of ['music','sfx','motion'])if(typeof p[k]==='boolean')prefs[k]=p[k];if(Number.isFinite(p.volume))prefs.volume=Math.max(0,Math.min(100,p.volume));}}catch{}
 let bgm=null,fx=null,scene='home',activated=false,error='',playing=false;
 const reduced=()=>!prefs.motion||!!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
 function syncMotion(){document.documentElement?.classList.toggle('still-effects',reduced());}
 function persist(){try{localStorage.setItem(KEY,JSON.stringify(prefs));}catch{}syncMotion();}
 function status(){if(error)return error;if(prefs.volume===0)return '音量が0です。スライダーを上げてください。';return playing?'音声データを再生しました。聞こえない場合は本体音量と出力先を確認してください。':'音をオンにするか「音をテスト」をタップしてください。';}
 function updateStatus(){const el=document.getElementById?.('audio-status');if(el)el.textContent=status();}
 function setup(){if(bgm)return true;const Audio=window.Audio;if(!Audio){error='このブラウザでは音声再生を利用できません。';updateStatus();return false;}
 bgm=new Audio();bgm.loop=true;bgm.preload='none';fx=new Audio();fx.preload='none';
 for(const media of [bgm,fx]){media.addEventListener('playing',()=>{error='';playing=true;updateStatus();});media.addEventListener('error',()=>{error='音声ファイルを読み込めません。ページを再読み込みして、直接再生テストをお試しください。';updateStatus();});}
 return true;}
 function applyGains(){if(bgm)bgm.volume=prefs.volume/100*.5;if(fx)fx.volume=prefs.volume/100;}
 function play(media){try{const result=media.play();if(result?.catch)result.catch(e=>{if(e.name==='AbortError')return;error=e.name==='NotAllowedError'?'音の再生が保留されています。「音をテスト」または直接再生の▶をタップしてください。':'音声を再生できません。直接再生テストをお試しください。';updateStatus();});}catch{error='音声を再生できません。直接再生テストをお試しください。';updateStatus();}}
 function track(){return scene==='battle'?'battle':'explore';}
 function startMusic(){if(!activated||!prefs.music||document.hidden||!bgm)return;const desired='assets/audio/'+track()+'.mp3';if(bgm.getAttribute('src')!==desired){bgm.src=desired;bgm.load();}if(bgm.paused)play(bgm);}
 function unlock(){if(document.hidden||(!prefs.music&&!prefs.sfx))return;if(!setup())return;activated=true;try{if(window.navigator?.audioSession)window.navigator.audioSession.type='playback';}catch{}applyGains();startMusic();}
 function cue(kind,force=false){if((!prefs.sfx&&!force)||document.hidden)return;if(!setup())return;const allowed=['attack','enemy','guard','heal','victory','defeat','select','turn','magic'];if(!allowed.includes(kind))kind='magic';applyGains();fx.pause();fx.src='assets/audio/'+kind+'.mp3';fx.load();play(fx);}
 function set(key,value){if(!(key in defaults))return;if(key==='volume')prefs.volume=Math.max(0,Math.min(100,Number(value)||0));else prefs[key]=!!value;persist();applyGains();if(key==='music'&&!prefs.music)bgm?.pause();if(key==='sfx'&&!prefs.sfx)fx?.pause();if(prefs.music||prefs.sfx)unlock();if(key==='sfx'&&prefs.sfx)cue('select');updateStatus();}
 function sync(nextScene){syncMotion();if(scene!==nextScene){scene=nextScene;startMusic();}}
 function controls(){return `<h2>演出・音</h2><p class="small muted">iPhone向けに音声ファイル方式へ変更しました。初期設定は無音です。</p><div class="av-options"><label><input type="checkbox" onchange="AV.set('music',this.checked)" ${prefs.music?'checked':''}> BGMを再生</label><label><input type="checkbox" onchange="AV.set('sfx',this.checked)" ${prefs.sfx?'checked':''}> 効果音を再生</label><label>音量 <input aria-label="音量" type="range" min="0" max="100" value="${prefs.volume}" oninput="AV.set('volume',this.value)"></label><label><input type="checkbox" onchange="AV.set('motion',this.checked)" ${prefs.motion?'checked':''}> 戦闘アニメーション</label></div><button class="btn secondary" onclick="AV.preview()">音をテスト（設定に関係なく再生）</button><label class="small">直接再生テスト（▶をタップ）<audio id="native-audio-test" controls preload="none" src="assets/audio/heal.mp3"></audio></label><p class="small muted">iPhoneの音量は本体ボタンでも調整してください。端末の音量・消音状態も確認してください。アプリを離れると音は停止します。端末の「視差効果を減らす」設定にも対応。</p><p class="small" role="status" id="audio-status">${status()}</p>`;}

 function preview(){if(!setup())return;activated=true;try{if(window.navigator?.audioSession)window.navigator.audioSession.type='playback';}catch{}if(prefs.volume===0){prefs.volume=65;persist();const slider=document.querySelector?.('input[aria-label="音量"]');if(slider)slider.value=prefs.volume;}applyGains();cue('heal',true);startMusic();}
 function stop(){bgm?.pause();fx?.pause();document.getElementById?.('native-audio-test')?.pause();playing=false;}
 document.addEventListener?.('click',unlock,{passive:true});
 document.addEventListener?.('touchend',unlock,{passive:true});
 document.addEventListener?.('keydown',unlock,{passive:true});
 document.addEventListener?.('visibilitychange',()=>{if(document.hidden)stop();});
 window.addEventListener?.('pagehide',stop);
 syncMotion();return {set,sync,cue,preview,controls,getPreferences:()=>({...prefs}),getStatus:status};
})();
