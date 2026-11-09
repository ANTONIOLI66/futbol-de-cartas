import {FIELD,KEEPER,RECIPES,convertPES,validateDatabase,validatePerson} from './pes-converter.mjs';
const $=id=>document.getElementById(id), DRAFT='editor2026_2027', FORM='editor2026_2027_form';
let db, database, teamId=null, form=null, dirty=false, teamDirty=false, badge='', queue=Promise.resolve(), photoBusy=false, badgeBusy=false;
const fresh=()=>({database_name:'Temporada 2026-2027',version:1,season:'2026-2027',teams:[]});
const team=()=>database.teams.find(t=>t.team_id===teamId);
function message(text,error=false){$('status').textContent=text;$('status').classList.toggle('error',error);}
function openStore(){return new Promise((resolve,reject)=>{const r=indexedDB.open('futbol-cartas',1);r.onupgradeneeded=()=>r.result.createObjectStore('data');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}
function read(key){return new Promise((resolve,reject)=>{const tx=db.transaction('data','readonly'),r=tx.objectStore('data').get(key);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}
function writeEntries(entries){return new Promise((resolve,reject)=>{const tx=db.transaction('data','readwrite');for(const [key,value] of entries){if(value===undefined)tx.objectStore('data').delete(key);else tx.objectStore('data').put(value,key);}tx.oncomplete=resolve;tx.onabort=()=>reject(tx.error||new Error('Guardado interrumpido'));tx.onerror=()=>reject(tx.error);});}
function saveDraft(){const snapshot=structuredClone(database);queue=queue.catch(()=>{}).then(()=>writeEntries([[DRAFT,snapshot]]));queue.then(()=>message(`Guardado en este navegador · ${database.teams.length} equipos · 2026–27`),()=>message('No se pudo guardar. Exporta el JSON antes de salir.',true));return queue;}
function capture(){if(!form)return;form.role=$('personRole').value;form.name=$('personName').value;form.raw=$('pesText').value;for(const k of Object.keys(form.kind==='keeper'?KEEPER:FIELD))form.stats[k]=$('stat-'+k).value;}
function download(data,name){const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1500);}
function checkpoint(){if(!form)return;capture();dirty=true;$('formSave').textContent='Borrador de carta recuperable';const snapshot=structuredClone(form);queue=queue.catch(()=>{}).then(()=>writeEntries([[FORM,snapshot]]));queue.catch(()=>message('No se pudo guardar el borrador. Guarda o exporta antes de salir.',true));try{localStorage.setItem(FORM,JSON.stringify({...snapshot,photo:'',photoOmitted:true}));}catch{} }
async function clearCheckpoint(){try{localStorage.removeItem(FORM);}catch{}queue=queue.catch(()=>{}).then(()=>writeEntries([[FORM,undefined]]));await queue;}
function allowLeave(){return !(dirty||teamDirty)||confirm('Hay cambios sin guardar. ¿Descartarlos para continuar?');}
function safeImage(value){return typeof value==='string'&&/^data:image\/(png|jpeg|webp);base64,[a-z0-9+/=\s]+$/i.test(value)?value:'';}
function picture(value){const img=document.createElement('img');img.src=safeImage(value);img.alt='';return img;}
function text(tag,value){const e=document.createElement(tag);e.textContent=value;return e;}
function render(){
  $('teams').replaceChildren();
  for(const t of database.teams){const b=document.createElement('button');b.type='button';b.className='team'+(t.team_id===teamId?' active':'');if(safeImage(t.badge_data))b.append(picture(t.badge_data));const info=text('span',t.team_name);info.append(text('small',`${t.players.length}/10 · ${t.keeper?'portero listo':'sin portero'}`));b.append(info);b.onclick=()=>selectTeam(t.team_id);$('teams').append(b);}
  const t=team();$('teamForm').hidden=!t;$('addPlayer').disabled=!t||t.players.length>=10;$('addKeeper').disabled=!t||!!t.keeper;$('count').textContent=`${t?.players.length||0} / 10`;
  if(t){const counts=Object.fromEntries(['DEF','MED','DEL'].map(role=>[role,t.players.filter(p=>TacticalRules.inferRole(p)===role).length]));$('count').textContent+=` · ${counts.DEF} DEF / ${counts.MED} MED / ${counts.DEL} DEL`;const missing=t.players.length-Object.values(counts).reduce((a,b)=>a+b,0);if(missing)$('count').textContent+=` · ${missing} sin rol`;$('count').style.fontSize='12px';}
  $('empty').querySelector('h2').textContent=database.teams.length?'Tu plantilla, carta a carta':'El inicio de la 2026–27';
  $('empty').querySelector('p').textContent=database.teams.length?'Selecciona una carta para editarla, o añade un jugador o portero desde la plantilla.':'Esta base empieza vacía. Crea tu primer equipo y añade jugadores pegando sus fichas PES o introduciendo los valores a mano.';
  $('roster').replaceChildren();
  if(t){$('teamName').value=t.team_name;badge=t.badge_data||'';for(const [p,kind] of [...t.players.map(p=>[p,'player']),...(t.keeper?[[t.keeper,'keeper']]:[])]){const b=document.createElement('button');b.type='button';b.className='player';if(safeImage(p.photo_data))b.append(picture(p.photo_data));const info=text('span',p.name);info.append(text('small',kind==='keeper'?'Portero':`${p.ritmo} RIT · ${p.defensa} DEF · ${p.tiro} TIR`));b.append(info);b.onclick=()=>editPerson(kind,p);$('roster').append(b);}}
  $('empty').hidden=!!form;$('personForm').hidden=!form;$('firstTeam').hidden=database.teams.length>0;
}
async function selectTeam(id){if(!allowLeave())return;teamId=id;form=null;dirty=false;teamDirty=false;await clearCheckpoint();render();}
async function createTeam(){if(!allowLeave())return;const name=prompt('Nombre del equipo para la temporada 2026–27:');if(!name?.trim())return;if(/[<>\"]/.test(name))throw new Error('El nombre debe ser texto, sin etiquetas HTML ni comillas dobles.');teamId='t_'+crypto.randomUUID();database.teams.push({team_id:teamId,team_name:name.trim().slice(0,100),badge_data:'',players:[],keeper:null});form=null;dirty=false;teamDirty=false;await clearCheckpoint();await saveDraft();render();}
function showForm(){
  if(!form)return;const keeper=form.kind==='keeper',labels=keeper?KEEPER:FIELD;
  $('roleLabel').hidden=keeper;$('personRole').value=form.role||'';
  $('personForm').hidden=false;$('empty').hidden=true;$('personType').textContent=keeper?'PORTERO':'JUGADOR DE CAMPO';$('formTitle').textContent=form.personId==='new'?'Nueva carta':'Editar carta';$('personName').value=form.name;$('pesText').value=form.raw;
  $('stats').replaceChildren();$('recipes').replaceChildren();
  for(const [k,label] of Object.entries(labels)){const l=text('label',label),input=document.createElement('input');input.id='stat-'+k;input.type='number';input.min='1';input.max='10';input.step='1';input.required=true;input.value=form.stats[k]??'';l.append(input);$('stats').append(l);const r=document.createElement('div');r.className='recipe';r.append(text('strong',label),text('span',RECIPES[k].join(' + ')));$('recipes').append(r);}
  $('deletePerson').hidden=form.personId==='new';$('conversionStatus').textContent='';$('formSave').textContent='';updatePreview();
}
async function editPerson(kind,p=null){
  if(!team()||!allowLeave())return;await clearCheckpoint();const labels=kind==='keeper'?KEEPER:FIELD;
  form={teamId,kind,role:TacticalRules.inferRole(p)||'',personId:p?(kind==='keeper'?'keeper':p.id):'new',name:p?.name||'',raw:p?.pes6?.raw||'',photo:p?.photo_data||'',stats:Object.fromEntries(Object.keys(labels).map(k=>[k,p?.[k]??''])),original:p?structuredClone(p):{},pes6:p?.pes6||null};dirty=false;teamDirty=false;render();showForm();$('personForm').scrollIntoView({behavior:'smooth',block:'start'});
}
function updatePreview(){if(!form)return;$('previewName').textContent=$('personName').value||'Nueva carta';const photo=safeImage(form.photo);$('photoPreview').hidden=!photo;$('photoPlaceholder').hidden=!!photo;if(photo)$('photoPreview').src=photo;else $('photoPreview').removeAttribute('src');}
async function imageData(file){
  if(!file)return null;if(!['image/jpeg','image/png','image/webp'].includes(file.type))throw new Error('Usa una imagen JPG, PNG o WebP.');if(file.size>12*1024*1024)throw new Error('La imagen es demasiado grande (máximo 12 MB).');
  const source=await createImageBitmap(file);const ratio=Math.min(1,600/Math.max(source.width,source.height)),canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(source.width*ratio));canvas.height=Math.max(1,Math.round(source.height*ratio));canvas.getContext('2d').drawImage(source,0,0,canvas.width,canvas.height);source.close();return canvas.toDataURL('image/jpeg',.88);
}
function guarded(action){return async(...args)=>{try{await action(...args);}catch(e){message(e.message||'No se pudo completar la operación.',true);}};}
$('addTeam').onclick=guarded(createTeam);$('firstTeam').onclick=guarded(createTeam);
$('addPlayer').onclick=guarded(()=>editPerson('player'));$('addKeeper').onclick=guarded(()=>editPerson('keeper'));
$('teamName').oninput=()=>{teamDirty=true;};
$('teamForm').onsubmit=guarded(async e=>{e.preventDefault();if(badgeBusy)throw new Error('Espera a que termine de cargar el escudo.');const t=team(),name=$('teamName').value.trim();if(!name)throw new Error('Introduce un nombre para el equipo.');if(/[<>\"]/.test(name))throw new Error('El nombre debe ser texto, sin etiquetas HTML ni comillas dobles.');t.team_name=name;t.badge_data=badge;teamDirty=false;await saveDraft();render();});
$('badgeFile').onchange=guarded(async e=>{badgeBusy=true;try{const image=await imageData(e.target.files[0]);if(image!==null){badge=image;teamDirty=true;message('Escudo preparado. Pulsa Guardar equipo.');}}finally{badgeBusy=false;e.target.value='';}});
$('clearBadge').onclick=()=>{badge='';teamDirty=true;message('Pulsa Guardar equipo para quitar el escudo.');};
$('deleteTeam').onclick=guarded(async()=>{const t=team();if(!t||!confirm(`¿Eliminar ${t.team_name} y su plantilla del borrador 2026–27? No afecta a la base activa del juego.`))return;database.teams=database.teams.filter(x=>x.team_id!==teamId);teamId=database.teams[0]?.team_id||null;form=null;dirty=false;teamDirty=false;await clearCheckpoint();await saveDraft();render();});
$('personForm').oninput=()=>{if(form){checkpoint();updatePreview();}};
$('convert').onclick=()=>{try{const result=convertPES($('pesText').value,form.kind);form.pes6=result.pes6;form.role=TacticalRules.inferRole(result)||form.role||'';form.name=result.name;form.raw=$('pesText').value;for(const k of Object.keys(form.stats))form.stats[k]=result[k];showForm();$('conversionStatus').className='';$('conversionStatus').textContent='Conversión lista. Revisa los valores y la posición antes de guardar.';checkpoint();}catch(e){$('conversionStatus').className='error';$('conversionStatus').textContent=e.message;}};
$('photoFile').onchange=guarded(async e=>{const target=form;photoBusy=true;$('savePerson').disabled=true;try{const image=await imageData(e.target.files[0]);if(target===form&&image!==null){form.photo=image;checkpoint();updatePreview();}}finally{photoBusy=false;$('savePerson').disabled=false;e.target.value='';}});
$('clearPhoto').onclick=()=>{form.photo='';checkpoint();updatePreview();};
$('personForm').onsubmit=guarded(async e=>{
  e.preventDefault();if(photoBusy)throw new Error('Espera a que termine de cargar la foto.');if(teamDirty)throw new Error('Guarda primero los cambios del equipo.');capture();const t=team(),labels=form.kind==='keeper'?KEEPER:FIELD;
  const person={...form.original,name:form.name.trim(),avatar:form.original.avatar||(form.kind==='keeper'?'🧤':'⚽'),photo_data:form.photo,...Object.fromEntries(Object.entries(form.stats).map(([k,v])=>[k,Number(v)]))};
  if(form.kind!=='keeper'&&form.role){person.role=form.role;person.role_provisional=false;}
  if(form.pes6&&form.pes6.raw!==form.raw)throw new Error('Has cambiado la ficha PES. Vuelve a convertirla antes de guardar.');
  if(form.pes6)person.pes6={...form.pes6};else if(form.raw.trim())person.pes6={raw:form.raw,conversion:null};validatePerson(person,labels);
  if(form.kind==='keeper')t.keeper=person;else if(form.personId==='new'){if(t.players.length>=10)throw new Error('El equipo ya tiene 10 jugadores de campo.');person.id=Math.max(0,...t.players.map(x=>x.id))+1;t.players.push(person);}else{person.id=form.personId;const index=t.players.findIndex(x=>x.id===person.id);if(index<0)throw new Error('La carta ya no existe.');t.players[index]=person;}
  await saveDraft();form=null;dirty=false;await clearCheckpoint();render();
});
$('deletePerson').onclick=guarded(async()=>{if(!confirm(`¿Eliminar la carta de ${form.name} del borrador?`))return;const t=team();if(form.kind==='keeper')t.keeper=null;else t.players=t.players.filter(p=>p.id!==form.personId);await saveDraft();form=null;dirty=false;await clearCheckpoint();render();});
$('cancel').onclick=guarded(async()=>{if(!allowLeave())return;form=null;dirty=false;teamDirty=false;await clearCheckpoint();render();});
$('export').onclick=guarded(async()=>{
  if((dirty||teamDirty)&&!confirm('Hay cambios sin guardar. ¿Exportar solo los equipos y cartas ya guardados?'))return;
  validateDatabase(database);await queue;download(database,'futbol-cartas_2026-2027.json');message('JSON exportado. Puedes importarlo en otro dispositivo. Los equipos incompletos se exportan como borrador.');
});
$('import').onclick=()=>{if(allowLeave())$('jsonFile').click();};
$('jsonFile').onchange=guarded(async e=>{try{
  const file=e.target.files[0];if(!file)return;if(file.size>30*1024*1024)throw new Error('El JSON supera el límite de 30 MB.');const data=JSON.parse(await file.text());validateDatabase(data);
  if(data.season&&data.season!=='2026-2027')throw new Error('Esta base pertenece a otra temporada. Este editor está reservado a la 2026–27.');
  if(!confirm(`¿Reemplazar el borrador 2026–27 por «${data.database_name||file.name}»? No se mezcla con la base del juego. Exporta antes si quieres conservar tu borrador actual.`))return;
  await writeEntries([['editor2026_2027_previous',structuredClone(database)]]);database={...data,season:'2026-2027',database_name:data.database_name||'Temporada 2026-2027',version:data.version||1};teamId=database.teams[0]?.team_id||null;form=null;dirty=false;teamDirty=false;await clearCheckpoint();await saveDraft();render();
}finally{e.target.value='';}});
$('use').onclick=guarded(async()=>{
  if(dirty||teamDirty)throw new Error('Guarda o cancela los cambios de la carta y el equipo antes de usar la base.');validateDatabase(database,true);await queue;
  if(!confirm('¿Usar la temporada 2026–27 para los nuevos partidos? Reemplaza la base activa, sin mezclar equipos. Se guardará una copia de la base anterior. El partido en curso no cambia.'))return;
  const previous=await read('database'),backup=await read('database_backup_before_2026_2027');const entries=[['database',structuredClone(database)]];if(previous&&!backup)entries.push(['database_backup_before_2026_2027',previous]);await writeEntries(entries);$('exportBackup').hidden=!(previous||backup);message('Base 2026–27 activada. Vuelve al juego para iniciar un nuevo partido. La primera base anterior queda respaldada en este navegador.');
});
$('exportBackup').onclick=guarded(async()=>{const previous=await read('database_backup_before_2026_2027');if(!previous)throw new Error('No hay una base anterior guardada.');download(previous,'futbol-cartas_base-anterior.json');message('Base anterior exportada. Puedes cargarla desde el menú del juego.');});
$('back').onclick=e=>{if(!allowLeave())e.preventDefault();};
window.addEventListener('beforeunload',e=>{if(teamDirty){e.preventDefault();e.returnValue='';}});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&form)checkpoint();});
window.addEventListener('pagehide',()=>{if(form)checkpoint();});
async function init(){
  try{db=await openStore();database=(await read(DRAFT))||fresh();validateDatabase(database);if(database.season!=='2026-2027')throw new Error('El borrador guardado no corresponde a la temporada 2026–27.');teamId=database.teams[0]?.team_id||null;
    let saved=await read(FORM);try{const quick=JSON.parse(localStorage.getItem(FORM)||'null');if(quick){saved={...quick,photo:saved?.teamId===quick.teamId&&saved?.personId===quick.personId?saved.photo:''};}}catch{}
    if(saved&&database.teams.some(t=>t.team_id===saved.teamId)){teamId=saved.teamId;form=saved;dirty=true;}
    $('exportBackup').hidden=!(await read('database_backup_before_2026_2027'));render();if(form){showForm();message('Se ha recuperado la carta que estabas editando. Revisa y pulsa Guardar carta.');}else message(`Base 2026–27 · ${database.teams.length} equipos · guardado local`);
  }catch(e){message('No se pudo abrir el guardado local: '+e.message+'. No se ha modificado la base del juego.',true);document.querySelectorAll('button').forEach(b=>b.disabled=true);}
}
await init();
