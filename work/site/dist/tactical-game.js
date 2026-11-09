/* Tactical mode integration. Classic match rules and saved matches remain independent. */
function isTactical(){return state.mode==='tactical';}
function configurePitch(){SHOOT_LINE_B=isTactical()?10:12;START_BALL=isTactical()?5:6;document.body.classList.toggle('tactical-game',isTactical());}
function tacticalCards(side){const all=side==='A'?state.homeCards:state.awayCards;const hand=state.tactical?.[side]?.hand||[];return all.filter(c=>hand.includes(c.id));}
function tacticalInitiator(){return state.shotMode?state.shotAttacker:state.turn;}
function tacticalStat(){return state.shotMode?'tiro':getCellStat(state.ball);}
function tacticalType(side){return state.tactical?.[side]?.selected||null;}
function tacticalParts(card,side,stat=tacticalStat(),ball=state.ball){
 const keeper=state.shotMode&&side!==state.shotAttacker&&!card?.role;
 if(!card||keeper)return {base:0,zone:0,tactic:0,total:0};
 const base=Number(card[stat])||0,zone=TacticalRules.zoneBonus(card,ball,side),tactic=TacticalRules.bonus(tacticalType(side),stat,side,tacticalInitiator(),state.shotMode);
 return {base,zone,tactic,total:base+zone+tactic};
}
function tacticalMath(card){return `${card.base}${card.zone?' + zona '+card.zone:''}${card.tactic?' + '+TacticalRules.TACTICS[card.tacticType].name+' '+card.tactic:''}`;}
function initTactical(){
 const A=TacticalRules.playerDeck(state.homeCards),B=TacticalRules.playerDeck(state.awayCards);
 state.tactical={version:1,A,B,duels:0,responseKey:null};
 for(const side of ['A','B']){TacticalRules.drawTactic(state.tactical[side]);TacticalRules.drawTactic(state.tactical[side]);}
}
function chooseTacticalCPU(known=null){
 const side=state.tactical.B,stat=tacticalStat(),initiator=tacticalInitiator(),role=state.shotMode?'shot':known?'defense':'attack';
 const own=tacticalCards('B'),publicOpponents=state.homeCards; // No access to the opponent's hidden hand/pile.
 const shadow=(p,s,type)=>({...p,[stat]:(Number(p[stat])||0)+TacticalRules.zoneBonus(p,state.ball,s)+TacticalRules.bonus(type,stat,s,initiator,state.shotMode)});
 const options=[null,...side.tactics.filter(type=>TacticalRules.eligible(type,stat,'B',initiator,state.shotMode))];
 const ranked=options.map(type=>{
  const decision=CardAI.choose({cards:own.map(p=>shadow(p,'B',type)),stat,role,
   knownOpponent:known?shadow(known,'A',tacticalType('A')):null,opponents:publicOpponents.map(p=>shadow(p,'A',null)),
   roster:state.awayCards,opponentRoster:state.homeCards,opponentKeeper:state.keeperA,ownKeeper:state.keeperB,
   board:BOARD,ball:state.ball,direction:1,minute:state.time,noHalfReset:true});
  let score=decision.score-(type?.8:0),loss=1-decision.win-decision.tie;
  if(type==='cobertura')score+=loss*1.5;
  if(type==='fuera')score+=loss*Math.max(0,6-state.ball)*.65;
  return {type,decision,score};
 }).sort((a,b)=>b.score-a.score);
 const pick=ranked[0];side.selected=pick.type;
 state.aiDecision={...pick.decision,card:undefined,cardId:pick.decision.card.id};
 return own.find(c=>c.id===pick.decision.card.id);
}
function prepareTacticalDuel(){
 if(state.resultPending||state.matchEnded)return;
 const t=state.tactical,selected=getSelectedCard();
 const type=t.A.selected;
 if(type&&!TacticalRules.eligible(type,tacticalStat(),'A',tacticalInitiator(),state.shotMode))t.A.selected=null;
 if(tacticalInitiator()==='B'){
  if(!state.pendingCpuCard)state.pendingCpuCard=chooseTacticalCPU();
 }else if(!state.shotMode){
  const key=selected?`${selected.id}:${t.A.selected||''}`:null;
  if(key&&t.responseKey!==key){state.pendingDefenseCard=chooseTacticalCPU(selected);t.responseKey=key;}
  if(!selected){state.pendingDefenseCard=null;t.B.selected=null;t.responseKey=null;}
 }else{t.B.selected=null;state.pendingDefenseCard=null;}
}
function selectTactic(type){
 if(!isTactical()||state.resultPending||state.matchEnded)return;
 if(type&&(!state.tactical.A.tactics.includes(type)||!TacticalRules.eligible(type,tacticalStat(),'A',tacticalInitiator(),state.shotMode)))return;
 state.tactical.A.selected=state.tactical.A.selected===type?null:type;renderAll();
}
function renderTacticalExtras(){
 let area=document.getElementById('tacticalArea');
 if(!area){area=document.createElement('div');area.id='tacticalArea';area.className='tactic-area';document.getElementById('tab-myteam').append(area);}
 let banner=document.getElementById('zoneBanner');if(!banner){banner=document.createElement('div');banner.id='zoneBanner';banner.className='zone-banner';document.getElementById('miniField').after(banner);}
 area.hidden=banner.hidden=!isTactical();if(!isTactical())return;
 const t=state.tactical,ball=state.resultPending?state.battle.fromBall:state.ball,z=TacticalRules.zone(ball,'A');
 banner.innerHTML=`<strong>${{DEF:'ZONA DEFENSIVA',MED:'MEDIOCAMPO',DEL:'ZONA OFENSIVA'}[z]} · ${TacticalRules.ROLES[z].toUpperCase()} +1</strong><br>Rival: ${TacticalRules.ROLES[TacticalRules.zone(ball,'B')]} +1 · Portero sin bonus`;
 const field=document.getElementById('miniField');field.insertAdjacentHTML('afterbegin','<div class="zone-labels"><span>DEFENSA</span><span>MEDIOCAMPO</span><span>ATAQUE</span></div>');
 $('myTeamInfo').textContent=`Mano ${t.A.hand.length}/4 · Mazo ${t.A.pile.length} · Descarte ${t.A.discard.length} · Táctica cada 3 duelos (${t.duels%3}/3)`;
 $('keeperInfo').textContent='Portero: atributo aleatorio, sin bonus de zona ni tácticas.';
 if(!state.resultPending&&state.shotMode&&state.shotAttacker==='B')$('myCards').inert=true;
 $('rivalInfo').textContent=`Mano rival: ${t.B.hand.length} jugadores · ${t.B.tactics.length} tácticas · Mazo ${t.B.pile.length}`;
 const locked=state.resultPending||state.matchEnded;
 area.innerHTML=`<div class="tactic-heading">TÁCTICAS · ${t.A.tactics.length}/3 en mano</div><div class="tactic-hand">${t.A.tactics.map(type=>`<button class="tactic-card" aria-pressed="${t.A.selected===type}" onclick="selectTactic('${type}')" ${locked||!TacticalRules.eligible(type,tacticalStat(),'A',tacticalInitiator(),state.shotMode)?'disabled':''}><strong>${TacticalRules.TACTICS[type].name}</strong><small>${TacticalRules.TACTICS[type].text}</small></button>`).join('')||'<p class="tactical-note">Sin tácticas. Robarás una cada 3 duelos.</p>'}</div><button class="tactic-clear" onclick="selectTactic(null)" ${locked?'disabled':''}>Sin táctica</button><p class="tactical-note">Una por equipo y duelo. Se descarta al tirar, aunque su efecto no se active. Las grises no se pueden usar ahora.</p>`;
 const best=Math.max(...tacticalCards('A').map(p=>tacticalParts(p,'A').total));
 document.querySelectorAll('#myCards .card').forEach(el=>{const id=Number(el.getAttribute('onclick')?.match(/\d+/)?.[0]),p=state.homeCards.find(c=>c.id===id);if(!p)return;const b=tacticalParts(p,'A'),isBest=b.total===best;el.classList.toggle('top-value',isBest);el.querySelectorAll('.stat').forEach(stat=>stat.classList.remove('best'));const index=['ritmo','fisico','defensa','regate','pase','tiro'].indexOf(tacticalStat());if(isBest&&index>=0)el.querySelectorAll('.stat')[index].classList.add('best');const role=document.createElement('span');role.className='role-chip'+(b.zone?' active':'');role.textContent=`${p.role}${b.zone?' · +1 ZONA':''}`;el.querySelector('.card-body').prepend(role);const stat=el.querySelector('.hand-stat strong');if(stat)stat.textContent=b.total;});
 if(!locked){
  const home=state.shotMode&&state.shotAttacker==='B'?null:getSelectedCard(),away=state.shotMode&&state.shotAttacker==='A'?null:state.pendingCpuCard||state.pendingDefenseCard;
  for(const [s,p,css] of [['A',home,'home'],['B',away,'away']])for(const el of document.querySelectorAll(`.battle-versus .battle-side.${css}`)){
   if(!p)continue;const b=tacticalParts(p,s),type=tacticalType(s);el.querySelector('.battle-total').textContent=b.total;
   el.querySelector('.battle-formula').textContent=`${STAT_LABELS[tacticalStat()]} ${b.base}${b.zone?' + zona 1':''}${b.tactic?' + táctica 2':''}`;
   if(type){const tag=document.createElement('div');tag.className='tactical-event';tag.textContent=TacticalRules.TACTICS[type].name;el.append(tag);}
  }
 }
}
function consumeTacticalTurn(played,types){
 const t=state.tactical;
 for(const side of ['A','B']){
  if(played[side]!=null)TacticalRules.consumePlayer(t[side],played[side]);
  TacticalRules.consumeTactic(t[side],types[side]);t[side].selected=null;
 }
 t.duels++;if(t.duels%3===0)for(const side of ['A','B'])TacticalRules.drawTactic(t[side]);
 state.usedHome=[...t.A.discard];state.usedAway=[...t.B.discard];t.responseKey=null;
 state.selectedCardId=null;state.pendingCpuCard=null;state.pendingDefenseCard=null;
}
function resolveTacticalTurn(){
 prepareTacticalDuel();const initiator=tacticalInitiator(),stat=tacticalStat(),shot=state.shotMode;
 const home=shot&&initiator==='B'?state.keeperA:getSelectedCard(),away=shot&&initiator==='A'?state.keeperB:initiator==='B'?state.pendingCpuCard:state.pendingDefenseCard;
 if(!home||!away)return;
 const types={A:tacticalType('A'),B:tacticalType('B')},played={},from=state.ball;
 logCpuDecision(initiator==='B'?away:!shot?away:null);
 const rolls={A:d6(),B:d6()};state.lastDice=`${rolls.A}-${rolls.B}`;
 let hp,ap;
 if(shot){const k=randomKeeperStatName(),shooter=initiator==='A'?home:away,keeper=initiator==='A'?away:home,s=tacticalParts(shooter,initiator,'tiro'),save={base:keeper[k]||0,zone:0,tactic:0,total:keeper[k]||0};
  hp=initiator==='A'?s:save;ap=initiator==='B'?s:save;
  const shotTotal=s.total+rolls[initiator],saveTotal=save.total+rolls[initiator==='A'?'B':'A'];
  setShotBattle(shooter,keeper,k,rolls[initiator],rolls[initiator==='A'?'B':'A'],shotTotal,saveTotal,initiator);
  played[initiator]=shooter.id;const goal=shotTotal>saveTotal;
  if(goal)state.score[initiator]++;
  state.turn=goal||saveTotal-shotTotal>=3?(initiator==='A'?'B':'A'):initiator;
  state.ball=5;state.shotMode=false;state.shotAttacker=null;
  state.actionText=goal?'¡Gol! El balón vuelve al centro.':'El portero evita el gol. Balón al centro.';
 }else{
  hp=tacticalParts(home,'A',stat);ap=tacticalParts(away,'B',stat);
  const h=hp.total+rolls.A,a=ap.total+rolls.B,diff=h-a;
  setDuelBattle(home,away,stat,rolls.A,rolls.B,h,a);played.A=home.id;played.B=away.id;
  if(!diff){state.turn=initiator==='A'?'B':'A';state.actionText='Empate: cambia quien inicia.';}
  else{const winner=diff>0?'A':'B',defender=initiator==='A'?'B':'A',move=TacticalRules.movement(from,winner,Math.abs(diff),types[defender],defender);
   state.ball=move.ball;state.turn=winner;state.battle.effect=move.effect;state.actionText=move.effect||'Duelo resuelto. Continúa el ganador.';
   if(state.ball===0||state.ball===10){state.shotMode=true;state.shotAttacker=winner;state.actionText='Línea de tiro: otra carta de la mano debe disparar.';}
  }
 }
 for(const [side,part] of [['A',hp],['B',ap]])Object.assign(state.battle[side==='A'?'home':'away'],{zone:part.zone,tactic:part.tactic,tacticType:types[side],role:(side==='A'?home:away).role});
 for(const [side,type] of Object.entries(types))if(type)addLog(`${side==='A'?'Tú':'IA'} juega ${TacticalRules.TACTICS[type].name}.`);
 addLog(`${state.battle.title}: ${home.name} ${tacticalMath(state.battle.home)} + dado ${rolls.A} = ${state.battle.home.total}; ${away.name} ${tacticalMath(state.battle.away)} + dado ${rolls.B} = ${state.battle.away.total}.`);
 if(state.battle.effect)addLog(state.battle.effect);
 state.summaryText=state.actionText;state.showLastResult=true;
 consumeTacticalTurn(played,types);advanceTime();
 if(state.time===45){addLog('Modo táctico: se conservan la mano, el mazo y las tácticas durante el descanso.');}
}
window.selectTactic=selectTactic;
