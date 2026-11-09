(function(root){
 'use strict';
 const ROLES={DEF:'Defensa',MED:'Medio',DEL:'Delantero'};
 const TACTICS={
  pared:{name:'Pared',text:'+2 Pase al atacar',kind:'bonus'},
  desborde:{name:'Desborde',text:'+2 Ritmo o Regate al atacar',kind:'bonus'},
  presion:{name:'Presión alta',text:'+2 al atributo al defender',kind:'bonus'},
  cobertura:{name:'Cobertura',text:'Si pierdes: −2 avance rival (mín. 1)',kind:'movement'},
  fuera:{name:'Fuera de juego',text:'Si llega a tiro: retrocede 2; sigue atacando',kind:'movement'},
  colocado:{name:'Disparo colocado',text:'+2 Tiro al disparar',kind:'bonus'}
 };
 function inferRole(p){
  if(ROLES[p?.role])return p.role;
  const f=p?.pes6?.fields||{},raw=f['registred positions']||f['registered positions']||f.positions||'';
  const pos=String(raw).replace(/★/g,'').trim().split(/[, /]+/)[0].toUpperCase();
  if(['CB','CWP','SW','SB','WB'].includes(pos))return 'DEF';
  if(['DMF','CMF','AMF','SMF','DM','CM','AM','SM'].includes(pos))return 'MED';
  if(['CF','SS','WF','ST'].includes(pos))return 'DEL';return null;
 }
 function shuffle(input,rng=Math.random){const arr=[...input];for(let i=arr.length-1;i>0;i--){const j=Math.floor(rng()*(i+1));[arr[i],arr[j]]=[arr[j],arr[i]];}return arr;}
 function playerDeck(cards,rng=Math.random){
  const pile=shuffle(cards.map(c=>c.id),rng),hand=[];
  for(const role of Object.keys(ROLES)){const index=pile.findIndex(id=>cards.find(c=>c.id===id).role===role);if(index<0)throw new Error('El modo táctico necesita al menos un defensa, un medio y un delantero en cada equipo.');hand.push(...pile.splice(index,1));}
  hand.push(...pile.splice(0,1));return {hand,pile,discard:[],tactics:[],tacticPile:shuffle(Object.keys(TACTICS),rng),tacticDiscard:[]};
 }
 function drawPlayer(deck,rng=Math.random){if(!deck.pile.length&&deck.discard.length){deck.pile=shuffle(deck.discard,rng);deck.discard=[];}if(deck.pile.length)deck.hand.push(deck.pile.shift());}
 function consumePlayer(deck,id,rng=Math.random){const index=deck.hand.indexOf(id);if(index<0)throw new Error('La carta no está en la mano.');deck.hand.splice(index,1);deck.discard.push(id);drawPlayer(deck,rng);}
 function drawTactic(deck,rng=Math.random){if(deck.tactics.length>=3)return;if(!deck.tacticPile.length){deck.tacticPile=shuffle(deck.tacticDiscard,rng);deck.tacticDiscard=[];}if(deck.tacticPile.length)deck.tactics.push(deck.tacticPile.shift());}
 function consumeTactic(deck,type){if(!type)return;const index=deck.tactics.indexOf(type);if(index<0)throw new Error('La táctica no está en la mano.');deck.tactics.splice(index,1);deck.tacticDiscard.push(type);}
 function zone(ball,side){const homeZone=ball<=3?'DEL':ball>=7?'DEF':'MED';return side==='A'?homeZone:homeZone==='MED'?'MED':homeZone==='DEL'?'DEF':'DEL';}
 function zoneBonus(card,ball,side){return card?.role===zone(ball,side)?1:0;}
 function eligible(type,stat,side,initiator,shot){const attack=side===initiator;
  if(type==='colocado')return shot&&attack;
  if(shot)return false;
  if(type==='pared')return attack&&stat==='pase';
  if(type==='desborde')return attack&&['ritmo','regate'].includes(stat);
  return ['presion','cobertura','fuera'].includes(type)&&!attack;
 }
 function bonus(type,stat,side,initiator,shot){return eligible(type,stat,side,initiator,shot)&&TACTICS[type]?.kind==='bonus'?2:0;}
 function movement(ball,winner,amount,defenderTactic,defender){
  let travel=amount,effect='';
  if(winner!==defender&&defenderTactic==='cobertura'){travel=Math.max(1,travel-2);effect='Cobertura reduce el avance en 2 (mínimo 1).';}
  let dest=Math.max(0,Math.min(10,ball+(winner==='A'?-travel:travel)));
  if(winner!==defender&&defenderTactic==='fuera'&&(dest===0||dest===10)){dest=dest===0?2:8;effect='Fuera de juego: retrocede 2 casillas y no hay disparo todavía.';}
  return {ball:dest,effect,travel:Math.abs(dest-ball)};
 }
 function board(center){return [{key:0,label:'Tiro A',shoot:true},...['defensa','fisico','pase','regate',center,'ritmo','pase','fisico','defensa'].map((stat,i)=>({key:i+1,label:i===4?'Centro':String(i+1),center:i===4,stat})),{key:10,label:'Tiro B',shoot:true}];}
 const api={ROLES,TACTICS,inferRole,shuffle,playerDeck,drawPlayer,consumePlayer,drawTactic,consumeTactic,zone,zoneBonus,eligible,bonus,movement,board};
 if(typeof module!=='undefined'&&module.exports)module.exports=api;if(root)root.TacticalRules=api;
})(typeof window!=='undefined'?window:null);
