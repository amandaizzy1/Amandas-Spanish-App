'use strict';
// Spanish Sentence Trainer — standalone, offline-capable after loading; no server required.
const KEY='spanish_sentence_trainer_v1';
const LEVELS=[['A0',0],['A1',250],['B1',1000],['B2',10000],['C1',20000],['C2',40000]];
const $=id=>document.getElementById(id);
const DAY=86400000;
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const today=()=>{const d=new Date();return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');};
const daysBetween=(a,b)=>{const parts=s=>s.split('-').map(Number);const x=parts(a),y=parts(b);return Math.round((Date.UTC(...[y[0],y[1]-1,y[2]])-Date.UTC(...[x[0],x[1]-1,x[2]]))/DAY);};
const normalize=s=>String(s||'').normalize('NFC').toLocaleLowerCase('es').replace(/[\p{P}\p{S}]/gu,' ').replace(/\s+/g,' ').trim();
// Spanish accents matter: si and sí, tu and tú are different words.
const tokens=s=>normalize(s).split(' ').filter(Boolean);
const canonical=s=>String(s||'').normalize('NFC').trim().replace(/\s+/g,' ');
function hash(s){let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619);}return (h>>>0).toString(16);}
const newProgress=()=>({reps:0,correctStreak:0,bestStreak:0,lapses:0,ease:2.2,intervalDays:0,dueAt:0,lastSeenAt:0});
const newState=()=>({version:1,items:{},order:[],meta:{totalXP:0,dailyXP:0,dailyDate:today(),dailyGoal:80,streak:0,lastStudy:'',lastLevel:'A0',sessionXP:0,sessionGoal:40}});
function load(){try{const s=JSON.parse(localStorage.getItem(KEY));if(!s||!s.items||!Array.isArray(s.order)||!s.meta)throw Error('invalid');s.meta={...newState().meta,...s.meta};for(const id of s.order){const it=s.items[id];if(it){it.progress={...newProgress(),...(it.progress||{})};it.esTokens=tokens(it.es);}}return s;}catch{return newState();}}
let state=load();
function save(){try{localStorage.setItem(KEY,JSON.stringify(state));return true;}catch(e){toast('Could not save. Browser storage may be full. Export a backup.',true);return false;}}
function toast(msg,big=false){const region=$('toastRegion');region.replaceChildren();const d=document.createElement('div');d.className='toast'+(big?' big':'');d.textContent=msg;region.append(d);setTimeout(()=>{if(d.isConnected)d.remove();},big?2800:2000);}
function parseLine(line){let s=line.replace(/\u00a0/g,' ').trim().replace(/^\d+[.)]?\s+/,'');const i=s.indexOf('=');if(i<0)return null;const en=canonical(s.slice(0,i)),es=canonical(s.slice(i+1));return en&&es?{en,es}:null;}
function existingPair(en,es){return state.order.some(id=>{const it=state.items[id];return it&&normalize(it.en)===normalize(en)&&normalize(it.es)===normalize(es);});}
function addSentence(en,es){en=canonical(en);es=canonical(es);if(!en||!es||!tokens(es).length)return {ok:false,message:'Enter both English and Spanish.'};if(existingPair(en,es))return {ok:false,message:'That sentence pair is already in your library.'};const id='s_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,9);state.items[id]={id,en,es,esTokens:tokens(es),progress:newProgress()};state.order.push(id);save();renderAll();return {ok:true,message:'Sentence added! ✨'};}
function importLines(text){let added=0,duplicates=0,invalid=0;const seen=new Set(state.order.map(id=>state.items[id]).filter(Boolean).map(it=>normalize(it.en)+'\u0000'+normalize(it.es)));for(const line of text.split(/\r?\n/)){if(!line.trim())continue;const p=parseLine(line);if(!p){invalid++;continue;}const key=normalize(p.en)+'\u0000'+normalize(p.es);if(seen.has(key)){duplicates++;continue;}seen.add(key);const id='s_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,10);state.items[id]={id,...p,esTokens:tokens(p.es),progress:newProgress()};state.order.push(id);added++;}if(added)save();renderAll();return `${added} added · ${duplicates} duplicates · ${invalid} invalid lines`;}

function mastery(p){if(!p.reps)return 'new';if(p.correctStreak>=3)return 'mastered';if(p.correctStreak>=1)return 'learned';return 'seen';}
function stats(){const r={total:0,new:0,seen:0,learned:0,mastered:0,due:0};for(const id of state.order){const it=state.items[id];if(!it)continue;r.total++;r[mastery(it.progress)]++;if(it.progress.dueAt&&it.progress.dueAt<=Date.now())r.due++;}r.learnedTotal=r.learned+r.mastered;return r;}
function level(count){return LEVELS.filter(x=>count>=x[1]).at(-1)||LEVELS[0];}
function nextLevel(count){return LEVELS.find(x=>x[1]>count);}
function dailyReset(){if(state.meta.dailyDate!==today()){state.meta.dailyDate=today();state.meta.dailyXP=0;}}
function activeStreak(){if(!state.meta.lastStudy)return 0;return daysBetween(state.meta.lastStudy,today())<=1?state.meta.streak:0;}
function studyDay(){const t=today();if(state.meta.lastStudy===t)return;state.meta.streak=state.meta.lastStudy&&daysBetween(state.meta.lastStudy,t)===1?state.meta.streak+1:1;state.meta.lastStudy=t;}
function progressBar(pct,cls=''){const outer=document.createElement('div');outer.className='progressBar '+cls;const inner=document.createElement('div');inner.style.width=clamp(pct,0,100)+'%';outer.append(inner);return outer;}
function ring(pct){const p=clamp(pct,0,100),c=2*Math.PI*29;const w=document.createElement('div');w.className='ringWrap';w.innerHTML=`<svg width="75" height="75" viewBox="0 0 75 75" aria-hidden="true"><circle cx="37.5" cy="37.5" r="29" fill="none" stroke="#ffffff20" stroke-width="8"/><circle cx="37.5" cy="37.5" r="29" fill="none" stroke="#38bdf8" stroke-width="8" stroke-linecap="round" stroke-dasharray="${(c*p/100).toFixed(2)} ${c.toFixed(2)}" transform="rotate(-90 37.5 37.5)"/><text x="37.5" y="42" text-anchor="middle" font-size="15" font-weight="bold" fill="white">${p}%</text></svg>`;const t=document.createElement('div');t.innerHTML='<div class="ringLabel">Daily goal</div>';const b=document.createElement('b');b.textContent=p>=100?'Complete!':`${Math.max(0,state.meta.dailyGoal-state.meta.dailyXP)} XP left`;t.append(b);w.append(t);return w;}
function renderHUD(){dailyReset();const st=stats(),lv=level(st.learnedTotal);$('hudLevel').textContent=lv[0];$('hudSub').textContent=`${st.learnedTotal.toLocaleString()} learned · ${st.mastered.toLocaleString()} mastered`;$('hudStreak').textContent=activeStreak();$('hudDailyXP').textContent=state.meta.dailyXP;$('hudDailyGoal').textContent=state.meta.dailyGoal||'off';$('hudTotalXP').textContent=state.meta.totalXP.toLocaleString();$('hudDue').textContent=st.due.toLocaleString();$('dailyGoalInput').value=state.meta.dailyGoal;const holder=$('dailyRingHolder');holder.replaceChildren();if(state.meta.dailyGoal>0)holder.append(ring(Math.round(state.meta.dailyXP/state.meta.dailyGoal*100)));else holder.textContent='Goal off';$('libraryCount').textContent=`(${st.total.toLocaleString()})`;}
function renderStats(){const st=stats(),lv=level(st.learnedTotal),next=nextLevel(st.learnedTotal),root=$('stats');root.replaceChildren();const grid=document.createElement('div');grid.className='statColumns';for(const [label,num] of [['New',st.new],['Seen',st.seen],['Learned',st.learned],['Mastered',st.mastered]]){const b=document.createElement('div');b.className='statBox';const strong=document.createElement('strong');strong.textContent=num.toLocaleString();const span=document.createElement('span');span.textContent=label;b.append(strong,span);grid.append(b);}root.append(grid);function addProgress(label,pct,cls=''){const wrap=document.createElement('div');const title=document.createElement('div');title.className='progressLabel';title.textContent=label;wrap.append(title,progressBar(pct,cls));root.append(wrap);}addProgress(`Learned: ${st.learnedTotal} / ${st.total} (${st.total?Math.round(st.learnedTotal/st.total*100):0}%)`,st.total?st.learnedTotal/st.total*100:0);addProgress(`Mastered: ${st.mastered} / ${st.total}`,st.total?st.mastered/st.total*100:0);addProgress(`Session XP: ${state.meta.sessionXP} / ${state.meta.sessionGoal}`,state.meta.sessionXP/state.meta.sessionGoal*100,'session');const line=document.createElement('p');line.className='muted';line.style.marginTop='14px';line.textContent=next?`${lv[0]} → ${next[0]}: ${Math.max(0,next[1]-st.learnedTotal).toLocaleString()} more learned sentences`:`${lv[0]} · Highest achievement`;root.append(line);}
let visibleAdmin=40;
function renderAdmin(){const q=normalize($('adminSearch').value),list=$('adminList');list.replaceChildren();const matching=state.order.filter(id=>{const it=state.items[id];return it&&(!q||normalize(it.en).includes(q)||normalize(it.es).includes(q));});$('adminCount').textContent=`${matching.length.toLocaleString()} found`;
for(const id of matching.slice(0,visibleAdmin)){const it=state.items[id],card=document.createElement('div');card.className='adminItem';const heading=document.createElement('div');heading.className='adminItemHeader';heading.textContent=`Sentence ${state.order.indexOf(id)+1} · ${mastery(it.progress)}`;const labelEn=document.createElement('label');labelEn.textContent='English';const en=document.createElement('textarea');en.rows=2;en.value=it.en;const labelEs=document.createElement('label');labelEs.textContent='Spanish';const es=document.createElement('textarea');es.rows=2;es.value=it.es;const actions=document.createElement('div');actions.className='adminActions';const saveBtn=document.createElement('button');saveBtn.textContent='Save edits';saveBtn.type='button';saveBtn.addEventListener('click',()=>{const a=canonical(en.value),b=canonical(es.value);if(!a||!b||!tokens(b).length){toast('Both fields are required.');return;}if(state.order.some(other=>other!==id&&normalize(state.items[other].en)===normalize(a)&&normalize(state.items[other].es)===normalize(b))){toast('That pair already exists.');return;}it.en=a;it.es=b;it.esTokens=tokens(b);save();toast('Saved — mastery and SRS preserved.');renderAll();});const del=document.createElement('button');del.textContent='Delete';del.type='button';del.className='dangerButton';del.addEventListener('click',()=>{if(!confirm('Delete this sentence and its progress?'))return;delete state.items[id];state.order=state.order.filter(x=>x!==id);save();renderAll();toast('Sentence deleted.');});actions.append(saveBtn,del);card.append(heading,labelEn,en,labelEs,es,actions);list.append(card);}
$('btnMore').classList.toggle('hidden',matching.length<=visibleAdmin);$('btnMore').textContent=`Show more (${matching.length-visibleAdmin} remaining)`;}
function renderAll(){renderHUD();renderStats();if($('libraryPanel').open)renderAdmin();}
const shuffle=a=>{a=a.slice();for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;};
function pickLesson(size,newMax){const all=state.order.map(id=>state.items[id]).filter(Boolean),now=Date.now();const due=all.filter(x=>x.progress.reps>0&&x.progress.dueAt<=now).sort((a,b)=>a.progress.dueAt-b.progress.dueAt);const fresh=all.filter(x=>x.progress.reps===0);const selected=[...due.slice(0,Math.max(0,size-newMax))];selected.push(...fresh.slice(0,Math.min(newMax,size-selected.length)));const used=new Set(selected.map(x=>x.id));const remaining=all.filter(x=>!used.has(x.id)&&x.progress.reps>0).sort((a,b)=>a.progress.dueAt-b.progress.dueAt);selected.push(...remaining.slice(0,size-selected.length));if(selected.length<size)selected.push(...fresh.filter(x=>!used.has(x.id)).slice(0,size-selected.length));return shuffle(selected).slice(0,size);}
const lesson={items:[],index:0,current:null,bank:[],chosen:[],submitted:false};
function bankFor(item){const required=item.esTokens.map((word,i)=>({id:`r${i}`,word}));const requiredSet=new Set(item.esTokens);const pool=new Set();for(const id of state.order){const other=state.items[id];if(!other||other.id===item.id)continue;for(const w of other.esTokens){if(!requiredSet.has(w)&&w.length>1)pool.add(w);}}const fallback=['pero','también','nunca','siempre','porque','aunque','mañana','ayer','ellos','nosotros','tengo','quiero','puedo','ella','usted','muy','mucho','entonces','ahora'];for(const w of fallback)if(!requiredSet.has(w))pool.add(w);const distractors=shuffle([...pool]).slice(0,Math.min(6,Math.max(3,Math.ceil(required.length*.5)))).map((word,i)=>({id:`d${i}`,word}));return shuffle([...required,...distractors]);}
function renderTiles(){const used=new Set(lesson.chosen),answer=$('answerLine'),bank=$('bank');answer.replaceChildren();bank.replaceChildren();for(const id of lesson.chosen){const tile=lesson.bank.find(x=>x.id===id);if(!tile)continue;const btn=document.createElement('button');btn.type='button';btn.className='tile';btn.textContent=tile.word;btn.disabled=lesson.submitted;btn.title='Remove word';btn.addEventListener('click',()=>{lesson.chosen=lesson.chosen.filter(x=>x!==id);sfx('tap');renderTiles();});answer.append(btn);}for(const tile of lesson.bank){const btn=document.createElement('button');btn.type='button';btn.className='tile'+(used.has(tile.id)?' used':'');btn.textContent=tile.word;btn.disabled=lesson.submitted||used.has(tile.id);btn.addEventListener('click',()=>{lesson.chosen.push(tile.id);sfx('tap');renderTiles();});bank.append(btn);}}
function loadQuestion(){const it=lesson.items[lesson.index];if(!it){finishLesson();return;}lesson.current=state.items[it.id]||it;lesson.bank=bankFor(lesson.current);lesson.chosen=[];lesson.submitted=false;$('promptEn').textContent=lesson.current.en;$('questionCount').textContent=`QUESTION ${lesson.index+1} OF ${lesson.items.length}`;$('questionMastery').textContent=mastery(lesson.current.progress).toUpperCase();$('feedback').className='feedback hidden';$('feedback').textContent='';$('btnSubmit').disabled=false;$('btnNext').disabled=true;$('btnSpeak').disabled=true;renderTiles();}
function startLesson(){const size=clamp(Number($('lessonSize').value)||20,1,50),fresh=clamp(Number($('newPerLesson').value)||0,0,size);lesson.items=pickLesson(size,fresh);if(!lesson.items.length){$('lessonStatus').textContent='Add your first sentences to begin.';$('libraryPanel').open=true;renderAdmin();return;}lesson.index=0;state.meta.sessionXP=0;state.meta.sessionGoal=40;save();$('promptArea').classList.remove('hidden');$('lessonStatus').textContent=`${lesson.items.length} questions · reviews mixed in automatically`;loadQuestion();renderAll();}
function sameWords(a,b){if(a.length!==b.length)return false;const counts=new Map();for(const w of b)counts.set(w,(counts.get(w)||0)+1);for(const w of a){const n=counts.get(w)||0;if(!n)return false;counts.set(w,n-1);}return true;}
function updateSRS(p,quality){const now=Date.now();p.lastSeenAt=now;p.reps++;if(quality==='miss'){p.lapses++;p.correctStreak=0;p.ease=Math.max(1.3,p.ease-.2);p.intervalDays=1;p.dueAt=now+DAY;return;}p.correctStreak++;p.bestStreak=Math.max(p.bestStreak,p.correctStreak);p.ease=clamp(p.ease+(quality==='perfect'?.03:-.05),1.3,3);p.intervalDays=p.intervalDays===0?1:Math.max(1,Math.round(p.intervalDays*(quality==='perfect'?2.6*p.ease/2.2:1.3)));p.dueAt=now+p.intervalDays*DAY;}
const VOICE_KEY='spanish_sentence_trainer_voice_v1';
let preferredVoice='';
try{preferredVoice=localStorage.getItem(VOICE_KEY)||'';}catch{}
function spanishVoices(){
  if(!('speechSynthesis' in window))return [];
  return speechSynthesis.getVoices().filter(v=>/^es(?:-|$)/i.test(v.lang))
    .sort((a,b)=>{
      const rank=v=>/^es-(MX|US|419|CO|AR|CL|PE|VE|EC|GT|CR|DO|PR)/i.test(v.lang)?0:/^es-ES/i.test(v.lang)?2:1;
      return rank(a)-rank(b)||a.name.localeCompare(b.name);
    });
}
function voiceKey(v){return v.voiceURI+'|'+v.lang+'|'+v.name;}
function refreshVoiceOptions(){
  const select=$('voiceSelect'),voices=spanishVoices(),old=select.value||preferredVoice;
  select.replaceChildren();
  const automatic=document.createElement('option');
  automatic.value='';automatic.textContent='Automatic (prefer Latin American Spanish)';
  select.append(automatic);
  for(const voice of voices){
    const opt=document.createElement('option');
    opt.value=voiceKey(voice);
    opt.textContent=`${voice.name} (${voice.lang})${voice.localService?' · device':''}`;
    select.append(opt);
  }
  select.value=voices.some(v=>voiceKey(v)===old)?old:'';
  if(preferredVoice&&!voices.some(v=>voiceKey(v)===preferredVoice)&&voices.length){
    $('voiceStatus').textContent='Saved voice is unavailable on this device; using automatic selection.';
  }else{
    $('voiceStatus').textContent=voices.length?`${voices.length} Spanish voice${voices.length===1?'':'s'} available.`:'No Spanish voices reported yet. Try again after your browser loads voices.';
  }
}
function speak(text){
  if(!('speechSynthesis'in window)){toast('Speech audio is unavailable on this browser.');return;}
  const utter=new SpeechSynthesisUtterance(text);
  utter.lang='es-MX';utter.rate=.92;
  const voices=spanishVoices();
  const selected=voices.find(v=>voiceKey(v)===preferredVoice);
  utter.voice=selected||voices.find(v=>/^es-MX$/i.test(v.lang))
    ||voices.find(v=>/^es-(US|419|CO|AR|CL|PE)/i.test(v.lang))
    ||voices[0]||null;
  if(utter.voice)utter.lang=utter.voice.lang;
  speechSynthesis.cancel();
  speechSynthesis.speak(utter);
}
let audioCtx;function beep(f,d=.07){try{audioCtx??=new (window.AudioContext||window.webkitAudioContext)();if(audioCtx.state==='suspended')audioCtx.resume();const o=audioCtx.createOscillator(),g=audioCtx.createGain();o.type='sine';o.frequency.value=f;g.gain.value=.025;o.connect(g);g.connect(audioCtx.destination);o.start();o.stop(audioCtx.currentTime+d);}catch{}}
function sfx(type){if(type==='tap')beep(520,.025);else if(type==='good'){beep(660);setTimeout(()=>beep(880),90);}else if(type==='bad')beep(210,.13);else{beep(523);setTimeout(()=>beep(659),110);setTimeout(()=>beep(784),220);}}
function submit(){if(!lesson.current||lesson.submitted)return;const item=lesson.current,p=item.progress;const chosen=lesson.chosen.map(id=>lesson.bank.find(t=>t.id===id)?.word).filter(Boolean),expected=item.esTokens;const ok=sameWords(chosen,expected);const exact=chosen.join(' ')===expected.join(' ');const quality=!ok?'miss':exact?'perfect':'hard';const previous=mastery(p),oldLevel=level(stats().learnedTotal)[0];lesson.submitted=true;updateSRS(p,quality);const feedback=$('feedback');feedback.className='feedback '+(ok?(exact?'good':'warn'):'bad');if(ok){const xp=exact?12:8;dailyReset();studyDay();state.meta.totalXP+=xp;state.meta.dailyXP+=xp;state.meta.sessionXP+=xp;feedback.textContent=`✅ Correct! +${xp} XP\n${exact?'Exact word order.':'Same words — alternate word order accepted.'}\n${item.es}`;if(previous!==mastery(p))feedback.textContent+=`\n✨ ${mastery(p).toUpperCase()}!`;if(state.meta.sessionXP>state.meta.sessionGoal)state.meta.sessionGoal=Math.ceil(state.meta.sessionXP/40)*40;sfx('good');}else{feedback.textContent=`❌ Not quite.\nCorrect: ${item.es}\nTry it again when it returns in a future lesson.`;feedback.classList.add('shake');sfx('bad');}save();const newLevel=level(stats().learnedTotal)[0];if(oldLevel!==newLevel&&newLevel!=='A0'){state.meta.lastLevel=newLevel;save();sfx('level');toast(`🎉 Level up: ${newLevel}!`,true);$('hudLevel').classList.add('levelPop');setTimeout(()=>$('hudLevel').classList.remove('levelPop'),700);}else if(ok&&state.meta.dailyGoal>0&&state.meta.dailyXP>=state.meta.dailyGoal&&state.meta.dailyXP-(exact?12:8)<state.meta.dailyGoal){toast('✨ Daily goal complete!',true);}feedback.classList.remove('hidden');$('btnSubmit').disabled=true;$('btnNext').disabled=false;$('btnSpeak').disabled=false;renderTiles();renderAll();speak(item.es);}
function finishLesson(){$('promptArea').classList.add('hidden');$('lessonStatus').textContent=`🎉 Lesson complete! ${state.meta.sessionXP} XP earned. Start another whenever you want.`;lesson.current=null;renderAll();}
function next(){if(!lesson.submitted){toast('Check your answer first.');return;}lesson.index++;if(lesson.index>=lesson.items.length)finishLesson();else loadQuestion();}
function exportBackup(){const blob=new Blob([JSON.stringify({app:'spanish-sentence-trainer',exportedAt:new Date().toISOString(),state},null,2)],{type:'application/json'});const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`spanish-trainer-backup-${today()}.json`;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);$('backupStatus').textContent='Backup downloaded.';}
async function restoreBackup(file){if(!file)return;try{const data=JSON.parse(await file.text());if(data.app!=='spanish-sentence-trainer'||!data.state||!Array.isArray(data.state.order)||typeof data.state.items!=='object'||!data.state.meta)throw Error('Not a valid Spanish Trainer backup.');if(!confirm('Replace ALL current Spanish sentences and progress with this backup? This cannot be undone.'))return;const old=state;state=data.state;for(const id of state.order){const it=state.items[id];if(!it||typeof it.en!=='string'||typeof it.es!=='string')throw Error('Invalid sentence in backup.');it.esTokens=tokens(it.es);it.progress={...newProgress(),...(it.progress||{})};}state.meta={...newState().meta,...state.meta};if(!save()){state=old;return;}lesson.current=null;$('promptArea').classList.add('hidden');renderAll();$('backupStatus').textContent=`Restored ${state.order.length} sentences.`;toast('Backup restored!',true);}catch(err){$('backupStatus').textContent=err.message;}}
// Voice settings
$('voiceSelect').addEventListener('change',e=>{
  preferredVoice=e.target.value;
  try{localStorage.setItem(VOICE_KEY,preferredVoice);}catch{}
  $('voiceStatus').textContent=preferredVoice?'Voice preference saved.':'Automatic voice selection enabled.';
});
$('btnPreviewVoice').addEventListener('click',()=>speak('Hola, ¿cómo estás hoy? Me alegra verte.'));
if('speechSynthesis' in window){
  speechSynthesis.addEventListener?.('voiceschanged',refreshVoiceOptions);
  refreshVoiceOptions();
  // Some browsers populate voices asynchronously.
  setTimeout(refreshVoiceOptions,350);
  setTimeout(refreshVoiceOptions,1400);
}else{
  $('voiceStatus').textContent='This browser does not support speech synthesis.';
  $('btnPreviewVoice').disabled=true;
}
// Events
$('btnStart').addEventListener('click',startLesson);
$('btnSubmit').addEventListener('click',submit);
$('btnNext').addEventListener('click',next);
$('btnUndo').addEventListener('click',()=>{if(lesson.submitted)return;lesson.chosen.pop();renderTiles();sfx('tap');});
$('btnClear').addEventListener('click',()=>{if(lesson.submitted)return;lesson.chosen=[];renderTiles();sfx('tap');});
$('btnSpeak').addEventListener('click',()=>{if(lesson.current&&lesson.submitted)speak(lesson.current.es);});
$('btnSetGoal').addEventListener('click',()=>{const n=Number($('dailyGoalInput').value);if(!Number.isFinite(n)||n<0){toast('Enter a valid XP goal.');return;}state.meta.dailyGoal=Math.floor(n);save();renderAll();toast(state.meta.dailyGoal?`Goal set: ${state.meta.dailyGoal} XP`:'Daily goal off');});
$('btnOpenQuick').addEventListener('click',()=>{$('libraryPanel').open=true;renderAdmin();$('quickEn').focus();$('quickEn').scrollIntoView({behavior:'smooth',block:'center'});});
$('quickForm').addEventListener('submit',e=>{e.preventDefault();const result=addSentence($('quickEn').value,$('quickEs').value);$('quickStatus').textContent=result.message;if(result.ok){$('quickEn').value='';$('quickEs').value='';$('quickEn').focus();toast(result.message);}});
$('btnImport').addEventListener('click',()=>{$('importStatus').textContent=importLines($('dataInput').value);});
$('btnLoadSample').addEventListener('click',()=>{$('dataInput').value=`I miss you. = Te extraño.\nI want to go home. = Quiero ir a casa.\nI don't feel like going out tonight. = No tengo ganas de salir esta noche.\nI already told you. = Ya te lo dije.\nWhat are you doing tomorrow? = ¿Qué vas a hacer mañana?`;toast('Examples loaded — tap Import to add them.');});
$('adminSearch').addEventListener('input',()=>{visibleAdmin=40;renderAdmin();});
$('btnMore').addEventListener('click',()=>{visibleAdmin+=40;renderAdmin();});
$('libraryPanel').addEventListener('toggle',()=>{if($('libraryPanel').open)renderAdmin();});
$('btnExport').addEventListener('click',exportBackup);
$('restoreFile').addEventListener('change',async e=>{await restoreBackup(e.target.files?.[0]);e.target.value='';});
$('btnReset').addEventListener('click',()=>{if(!confirm('First confirmation: erase ALL Spanish sentences, XP, and progress?'))return;if(!confirm('FINAL confirmation: permanently erase everything on this device?'))return;localStorage.removeItem(KEY);state=newState();lesson.current=null;$('promptArea').classList.add('hidden');$('lessonStatus').textContent='All data reset.';renderAll();toast('Spanish app data reset.');});
renderAll();
