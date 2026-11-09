// Simplified equal-stat sensitivity experiment, not a claim of complete tactical balance.
const R=require('./work/site/dist/tactical-rules.js');
function rng(seed){return ()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};}
function squad(counts,offset){return Object.entries(counts).flatMap(([role,n])=>Array.from({length:n},()=>({id:++offset,role})));}
// Use globally unique sequential IDs within each side (the flatMap callback's offset is shared).
function game(seed,countsA,countsB){const random=rng(seed),cards={A:squad(countsA,0),B:squad(countsB,100)},decks={A:R.playerDeck(cards.A,random),B:R.playerDeck(cards.B,random)},score={A:0,B:0};let ball=5,turn=seed%2?'A':'B',shot=false;
 for(let t=0;t<30;t++){
  const choose=side=>decks[side].hand.map(id=>cards[side].find(p=>p.id===id)).sort((a,b)=>R.zoneBonus(b,ball,side)-R.zoneBonus(a,ball,side))[0];
  const die=()=>1+Math.floor(random()*6);
  if(shot){const shooter=choose(turn),other=turn==='A'?'B':'A',attack=7+R.zoneBonus(shooter,ball,turn)+die(),save=7+die();R.consumePlayer(decks[turn],shooter.id,random);if(attack>save){score[turn]++;turn=other;}else if(save-attack>=3)turn=other;ball=5;shot=false;}
  else{const a=choose('A'),b=choose('B'),diff=R.zoneBonus(a,ball,'A')+die()-R.zoneBonus(b,ball,'B')-die();R.consumePlayer(decks.A,a.id,random);R.consumePlayer(decks.B,b.id,random);if(!diff)turn=turn==='A'?'B':'A';else{turn=diff>0?'A':'B';ball=R.movement(ball,turn,Math.abs(diff),null,turn==='A'?'B':'A').ball;shot=ball===0||ball===10;}}
 }return score;
}
const standard={DEF:4,MED:3,DEL:3};
for(const counts of [standard,{DEF:3,MED:4,DEL:3},{DEF:3,MED:3,DEL:4}]){
 let wins=0,losses=0,draws=0,goalsA=0,goalsB=0;const N=5000;
 for(let i=1;i<=N;i++){const s=game(i*7919,counts,standard);goalsA+=s.A;goalsB+=s.B;if(s.A>s.B)wins++;else if(s.A<s.B)losses++;else draws++;}
 console.log(JSON.stringify({experiment:'Equal stats 7, no tactics, greedy zone choice, 30 turns, alternating initial attack',roles:counts,games:N,wins,draws,losses,goalsA:goalsA/N,goalsB:goalsB/N}));
}
