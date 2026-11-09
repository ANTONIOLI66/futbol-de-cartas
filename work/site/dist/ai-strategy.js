(function(root){
  'use strict';
  const STATS=['ritmo','fisico','defensa','regate','pase','tiro'];
  const KEEPERS=['parada','reflejos','juego_aereo','uno_contra_uno'];
  const value=(card,stat)=>Number(card?.[stat])||0;
  const max=(cards,stat)=>Math.max(0,...cards.map(c=>value(c,stat)));
  // Enumerate every equally likely pair of d6, rather than sampling or predicting the next roll.
  function duelOdds(base,other){
    let win=0,tie=0,loss=0;const margins=[];
    for(let a=1;a<=6;a++)for(let b=1;b<=6;b++){
      const diff=base+a-other-b;margins.push(diff);
      if(diff>0)win++;else if(diff===0)tie++;else loss++;
    }
    return {win:win/36,tie:tie/36,loss:loss/36,margins};
  }
  function shotChance(base,keeper){return KEEPERS.reduce((sum,k)=>sum+duelOdds(base,value(keeper,k)).win,0)/4;}
  function resetHorizon(minute,cardsLeft,noHalfReset=false){
    const boundary=noHalfReset?90:minute<45?45:90;
    return Math.max(0,Math.min(3,cardsLeft-1,Math.ceil((boundary-minute)/3)-1));
  }
  function futureWeights(ctx,outcomes,horizon){
    const weights={},end=Math.max(...ctx.board.map(c=>c.key));
    for(const outcome of outcomes)for(let step=0;step<horizon;step++){
      const pos=Math.max(0,Math.min(end,outcome.ball+outcome.direction*step));
      const cell=ctx.board.find(c=>c.key===pos),stat=cell?.shoot?'tiro':cell?.stat;
      if(stat)weights[stat]=(weights[stat]||0)+outcome.weight*[1,.55,.3][step];
      if(cell?.shoot)break;
    }
    return weights;
  }
  function opportunityCost(cards,candidate,weights){
    const remaining=cards.filter(c=>c.id!==candidate.id),parts={};let cost=0;
    for(const stat of STATS){const drop=Math.max(0,max(cards,stat)-max(remaining,stat));parts[stat]=drop*(weights[stat]||0);cost+=parts[stat];}
    return {cost,parts};
  }
  function choose(ctx){
    const cards=ctx.cards||[];if(!cards.length)return null;
    const horizon=resetHorizon(ctx.minute,cards.length,ctx.noHalfReset),direction=ctx.direction||1;
    const end=Math.max(...ctx.board.map(c=>c.key)),center=Math.floor(end/2);
    const opponents=ctx.opponents?.length?ctx.opponents:[{[ctx.stat]:5,tiro:5}];
    const strongest=max(opponents,ctx.stat);
    // When attacking first, estimate a distribution of plausible replies from the public hand.
    // The user's selected card is not an input to this branch.
    const replies=ctx.role==='defense'&&ctx.knownOpponent?[{card:ctx.knownOpponent,weight:1}]:
      opponents.map(card=>({card,weight:Math.exp((value(card,ctx.stat)-strongest)/1.7)}));
    const total=replies.reduce((s,r)=>s+r.weight,0);replies.forEach(r=>r.weight/=total);
    const evaluations=cards.map(card=>{
      const remaining=cards.filter(c=>c.id!==card.id);
      const nextCards=remaining.length?remaining:(ctx.roster||cards);
      let immediate=0,win=0,tie=0;const outcomes=[];
      if(ctx.role==='shot'){
        win=shotChance(value(card,'tiro'),ctx.opponentKeeper);immediate=win*22;
        // A shot returns the ball to centre, so assess the next midfield phase too.
        outcomes.push({ball:center,direction,weight:.5},{ball:center,direction:-direction,weight:.5});
      }else{
        const halftimeNext=!ctx.noHalfReset&&ctx.minute+3===45;
        const nextGoal=shotChance(max(halftimeNext?(ctx.roster||nextCards):nextCards,'tiro'),ctx.opponentKeeper);
        for(const reply of replies){
          const opponentsLeft=opponents.filter(p=>p.id!==reply.card.id);
          const nextOpponents=halftimeNext||!opponentsLeft.length?(ctx.opponentRoster||opponents):opponentsLeft;
          const opponentGoal=shotChance(max(nextOpponents,'tiro'),ctx.ownKeeper);
          const odds=duelOdds(value(card,ctx.stat),value(reply.card,ctx.stat));win+=odds.win*reply.weight;tie+=odds.tie*reply.weight;
          for(const margin of odds.margins){
            const weight=reply.weight/36,moveDirection=margin>0?direction:margin<0?-direction:ctx.role==='defense'?direction:-direction;
            const dest=Math.max(0,Math.min(end,ctx.ball+moveDirection*Math.abs(margin))),travel=Math.abs(dest-ctx.ball);
            const onShot=dest===0||dest===end,canShoot=ctx.minute+3<90;
            const reward=margin>0?6+.45*travel+(onShot&&canShoot?5*nextGoal:0):
              margin<0?-6-.55*travel-(onShot&&canShoot?5*opponentGoal:0):(ctx.role==='defense'?1:-1);
            immediate+=weight*reward;
            outcomes.push({ball:dest,direction:moveDirection,weight});
          }
        }
      }
      const weights=futureWeights(ctx,outcomes,horizon),reserve=opportunityCost(cards,card,weights);
      // No conservation tax when this is the final card or the next turn resets the hand.
      // Future play is uncertain: cap its price so hoarding cannot overwhelm a dangerous current duel.
      const cost=Math.min(4,reserve.cost*1.35);
      return {card,win,tie,immediate,cost,parts:reserve.parts,score:immediate-cost};
    }).sort((a,b)=>b.score-a.score||b.win-a.win||value(b.card,ctx.stat)-value(a.card,ctx.stat)||a.card.id-b.card.id);
    const best=evaluations[0],highest=max(cards,ctx.stat),reserveStat=STATS.reduce((a,b)=>(best.parts[b]||0)>(best.parts[a]||0)?b:a,'ritmo');
    let reason='equilibra la probabilidad del duelo y el valor de la mano restante';
    if(!horizon)reason=ctx.minute>=87?'prioriza esta última jugada; no queda otra antes del final':ctx.noHalfReset?'gestiona las cartas disponibles en mano':cards.length===1?'gasta la última carta; el mazo se recupera después':'prioriza esta jugada; el descanso restablece el mazo';
    else if(value(best.card,ctx.stat)<highest){
      const stronger=evaluations.find(e=>value(e.card,ctx.stat)===highest);
      const saved=STATS.reduce((a,b)=>((stronger?.parts[b]||0)-(best.parts[b]||0))>((stronger?.parts[a]||0)-(best.parts[a]||0))?b:a,'ritmo');
      if((stronger?.parts[saved]||0)-(best.parts[saved]||0)>.05)reason='reserva recursos de '+saved+' para las próximas casillas';
    }else if(best.cost<.05&&cards.some(c=>STATS.some(s=>value(c,s)>value(best.card,s))))reason='usa una respuesta eficaz sin gastar otros especialistas';
    else if(ctx.role==='shot')reason='busca el gol considerando los cuatro atributos posibles del portero';
    return {card:best.card,win:best.win,tie:best.tie,score:best.score,reserveCost:best.cost,horizon,reason,reserveStat,
      estimate:ctx.role==='attack',role:ctx.role,stat:ctx.stat,version:'hand-planner-v1'};
  }
  const api={choose,duelOdds,shotChance,resetHorizon,futureWeights,opportunityCost};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  if(root)root.CardAI=api;
})(typeof window!=='undefined'?window:null);
