let state,els,E,action,profileButton,sound,socket,handleAck,cardNode,valueLabel,titlebar,logBox,renderGame,renderCardOpponents,renderDiscardStack,scoreList;
const notes={},selections={};
function bind(api){({state,els,E,action,profileButton,sound,socket,handleAck,cardNode,valueLabel,titlebar,logBox,renderGame,renderCardOpponents,renderDiscardStack,scoreList}=api)}
export function render(api){bind(api);cluedoNoteKey(api.room,api.game)}
export const playerStrip=true;

function cluedoNoteKey(roomId, cardId){return `${roomId}|${cardId}`}

function getCluedoNote(roomId, cardId){return notes[cluedoNoteKey(roomId,cardId)]||0}

function cycleCluedoNote(roomId, cardId){
  const key=cluedoNoteKey(roomId,cardId);
  notes[key]=(getCluedoNote(roomId,cardId)+1)%3;
  return notes[key];
}

function clueLabel(card){return ({suspect:'Verdachte',weapon:'Wapen',room:'Kamer'})[card.category]||card.category}

function renderCluedo(room,game) {
  const me=game.players.find(p=>p.id===room.meId);
  const turn=game.players.find(p=>p.id===game.turnPlayerId);
  const mine=me?.id===game.turnPlayerId;
  const own=new Set((me?.hand||[]).map(c=>c.id));

  els.gameStage.append(titlebar(
    'Cluedo',
    game.gameOver?'Mysterie opgelost.':mine?'Jouw beurt: maak een suggestie of beschuldiging.':`${turn?.name||''} denkt na…`
  ));

  const layout=E('div','cluedo-layout');
  const main=E('div','table-surface');

  if(game.lastSuggestion){
    const s=game.lastSuggestion;
    const box=E('div','cluedo-last');
    box.append(
      E('span','eyebrow','LAATSTE SUGGESTIE'),
      E('strong','',`${s.playerName}: ${s.suspect} · ${s.weapon} · ${s.room}`),
      E('div','player-note',s.disprovedByName?`${s.disprovedByName} kon één kaart tonen.`:'Niemand kon dit weerleggen.')
    );
    main.append(box);
  }

  if(game.privateReveal){
    const reveal=E('div','cluedo-reveal');
    reveal.append(
      E('span','eyebrow','ALLEEN VOOR JOU'),
      E('strong','',`${game.privateReveal.byName} toonde: ${game.privateReveal.card.name}`),
      E('div','player-note',clueLabel(game.privateReveal.card))
    );
    main.append(reveal);
  }

  const form=E('div','cluedo-form');
  const selects={};
  const savedSelections=selections[room.id]||{};
  [['suspect','Verdachte'],['weapon','Wapen'],['room','Kamer']].forEach(([key,label])=>{
    const wrap=E('label','cluedo-field');
    wrap.append(E('span','',label));
    const sel=document.createElement('select');
    (game.categories[key]||[]).forEach(name=>{
      const id=`${key}:${name}`;const note=getCluedoNote(room.id,id);const isOwned=own.has(id);const o=document.createElement('option');o.value=name;o.textContent=isOwned?`● ${name} (in hand)`:note===1?`✕ ${name}`:note===2?`★ ${name}`:`? ${name}`;o.className=isOwned?'cluedo-option-owned':note===1?'cluedo-option-excluded':note===2?'cluedo-option-suspect':'';o.selected=savedSelections[key]===name;sel.append(o)
    });
    sel.onchange=()=>{selections[room.id]={...(selections[room.id]||{}),[key]:sel.value}};
    selects[key]=sel;wrap.append(sel);form.append(wrap)
  });

  const rememberCluedoSelections=()=>{selections[room.id]={suspect:selects.suspect.value,weapon:selects.weapon.value,room:selects.room.value};return selections[room.id]};

  const ar=E('div','action-row');
  const suggest=E('button','primary','Doe suggestie');
  suggest.disabled=!mine||game.gameOver||!me?.canAccuse;
  suggest.onclick=()=>action('suggest',rememberCluedoSelections());

  const accuse=E('button','danger-button','Beschuldig definitief');
  accuse.disabled=!mine||game.gameOver||!me?.canAccuse;
  accuse.onclick=()=>{
    if(confirm('Dit is definitief. Bij een foute beschuldiging kan je niet meer winnen.')){
      action('accuse',rememberCluedoSelections())
    }
  };
  ar.append(suggest,accuse);form.append(ar);

  if(me && !me.canAccuse) form.append(E('div','cluedo-eliminated','Je beschuldiging was fout. Je blijft kaarten tonen, maar kan niet meer winnen.'));
  main.append(form);

  const hand=E('div','hand-area');
  const handRow=E('div','clue-hand');
  const categoryOrder={suspect:0,weapon:1,room:2};const knownCards=(me?.hand||[]).slice().sort((a,b)=>categoryOrder[a.category]-categoryOrder[b.category]||a.name.localeCompare(b.name,'nl'));knownCards.forEach(card=>{
    const c=E('div',`clue-card ${card.category}`);
    c.append(E('span','clue-category',clueLabel(card)),E('strong','',card.name));
    handRow.append(c)
  });
  hand.append(E('span','eyebrow','JOUW GEKENDE KAARTEN'),handRow);
  main.append(hand);
  layout.append(main);

  const notes=E('aside','cluedo-notes');
  notes.append(E('span','eyebrow','NOTITIEBLOK'));
  [['suspect','Verdachten'],['weapon','Wapens'],['room','Kamers']].forEach(([key,title])=>{
    const section=E('section','cluedo-note-section');
    section.append(E('h3','',title));
    (game.categories[key]||[]).forEach(name=>{
      const id=`${key}:${name}`;
      const note=getCluedoNote(room.id,id);const row=E('button',`cluedo-note ${own.has(id)?'owned':note===1?'note-excluded':note===2?'note-suspect':''}`);
      row.type='button';
      row.append(E('span','',name),E('strong','',own.has(id)?'IN HAND':note===1?'✕':note===2?'★':'?'));
      row.disabled=own.has(id);
      if(!own.has(id))row.onclick=()=>{const next=cycleCluedoNote(room.id,id);row.classList.toggle('note-excluded',next===1);row.classList.toggle('note-suspect',next===2);row.querySelector('strong').textContent=next===1?'✕':next===2?'★':'?';const option=[...selects[key].options].find(item=>item.value===name);if(option){option.textContent=next===1?`✕ ${name}`:next===2?`★ ${name}`:`? ${name}`;option.className=next===1?'cluedo-option-excluded':next===2?'cluedo-option-suspect':''}};
      section.append(row)
    });
    notes.append(section)
  });

  layout.append(notes);
  els.gameStage.append(layout);
}

export function metric({player}){return {text:player.canAccuse?`${player.handCount} kaarten`:'uit',score:null}}
export function presentResult({game}){const winner=game.players.find(p=>p.id===game.winnerId);return {title:winner?.name||'Winnaar',copy:'is de winnaar.'}}
export function isWinner({game,myId}){return game.winnerId===myId}
