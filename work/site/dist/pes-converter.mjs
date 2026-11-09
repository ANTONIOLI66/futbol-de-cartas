export const FIELD = {ritmo:'Ritmo',fisico:'Físico',defensa:'Defensa',regate:'Regate',pase:'Pase',tiro:'Tiro'};
export const KEEPER = {parada:'Parada',reflejos:'Reflejos',juego_aereo:'Juego aéreo',uno_contra_uno:'1 contra 1'};
export const RECIPES = {
  ritmo:['Speed','Acceleration'], fisico:['Balance','Stamina','Jump'],
  defensa:['Defence','Response'], regate:['Dribble Accuracy','Dribble Speed','Agility','Technique'],
  pase:['Short Pass Accuracy','Long Pass Accuracy','Technique'], tiro:['Shot Accuracy','Shot Technique','Shot Power'],
  parada:['GK Skills','GK Skills','Response'], reflejos:['GK Skills','Response','Agility'],
  juego_aereo:['GK Skills','Jump','Balance'], uno_contra_uno:['GK Skills','Response','Speed']
};
export function scale(value) {
  const anchors=[[40,1],[50,2],[60,3],[70,5],[80,7],[90,9],[95,10]];
  if(value<=40)return 1;if(value>=95)return 10;
  for(let i=1;i<anchors.length;i++)if(value<=anchors[i][0]){
    const [x,y]=anchors[i-1], [xx,yy]=anchors[i];
    return Math.round(y+(value-x)/(xx-x)*(yy-y));
  }
}
export function parsePES(text) {
  const fields={}, special=[]; let inSpecial=false;
  for(const line of text.split(/\r?\n/)) {
    const trimmed=line.trim();if(!trimmed)continue;
    if(/^special abilities\s*:/i.test(trimmed)){inSpecial=true;continue;}
    const match=trimmed.match(/^([^:]+):\s*(.*)$/);
    if(match){fields[match[1].trim().toLowerCase()]=match[2].trim();inSpecial=false;}
    else if(inSpecial)special.push(trimmed.replace(/^[★*]\s*/,''));
  }
  if(!fields.name)throw new Error('Falta la línea Name: con el nombre del jugador.');
  return {fields,special,raw:text};
}
export function convertPES(text,kind='player') {
  const parsed=parsePES(text), stats={}, averages={}, labels=kind==='keeper'?KEEPER:FIELD;
  for(const key of Object.keys(labels)){
    const values=RECIPES[key].map(label=>{
      const raw=parsed.fields[label.toLowerCase()];
      if(raw===undefined||raw==='')throw new Error(`Falta ${label}: en la ficha PES.`);
      const n=Number(raw.replace(',','.'));
      if(!Number.isFinite(n)||n<1||n>99)throw new Error(`${label} debe estar entre 1 y 99.`);
      return n;
    });
    averages[key]=values.reduce((a,b)=>a+b,0)/values.length;stats[key]=scale(averages[key]);
  }
  return {name:parsed.fields.name,...stats,pes6:{...parsed,conversion:'pes6-cartas-v1',kind,averages,converted_stats:{...stats}}};
}
export function validateDatabase(db,playable=false) {
  if(!db||typeof db!=='object'||!Array.isArray(db.teams))throw new Error('El JSON debe contener una lista teams.');
  if(playable&&db.teams.length<2)throw new Error('Para jugar necesitas al menos 2 equipos completos.');
  const ids=new Set();
  for(const t of db.teams){
    if(!t.team_name?.trim()||typeof t.team_id!=='string'||!t.team_id||ids.has(t.team_id))throw new Error('Cada equipo necesita nombre e identificador único.');
    if(/[<>\"]/.test(t.team_name))throw new Error('El nombre del equipo debe ser texto, sin etiquetas HTML ni comillas dobles.');
    checkImage(t.badge_data);ids.add(t.team_id);
    if(!Array.isArray(t.players)||t.players.length>10)throw new Error(`${t.team_name}: máximo 10 jugadores de campo.`);
    if(playable&&(t.players.length!==10||!t.keeper))throw new Error(`${t.team_name}: necesita 10 jugadores y un portero.`);
    const pids=new Set();
    for(const p of t.players){
      if(!Number.isInteger(p.id)||p.id<1||pids.has(p.id))throw new Error(`${t.team_name}: identificadores de jugadores no válidos o repetidos.`);
      pids.add(p.id);validatePerson(p,FIELD);
    }
    if(t.keeper)validatePerson(t.keeper,KEEPER);
  }
  return db;
}
export function validatePerson(p,labels){
  if(p.role&&!['DEF','MED','DEL'].includes(p.role))throw new Error('Posición no válida: usa DEF, MED o DEL.');
  if(typeof p.name!=='string'||!p.name.trim())throw new Error('Todos los jugadores necesitan un nombre.');
  if(/[<>\"]/.test(p.name)||/[<>\"]/.test(p.avatar||''))throw new Error('El nombre y el avatar deben ser texto, sin etiquetas HTML ni comillas dobles.');
  checkImage(p.photo_data);
  for(const [k,label] of Object.entries(labels))if(!Number.isInteger(p[k])||p[k]<1||p[k]>10)throw new Error(`${p.name}: ${label} debe ser un entero entre 1 y 10.`);
}
function checkImage(value){if(value&&!/^data:image\/(png|jpeg|webp);base64,[a-z0-9+/=\s]+$/i.test(value))throw new Error('Las imágenes deben estar incrustadas como JPG, PNG o WebP.');}
