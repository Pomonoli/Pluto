export function createMapEditor(ctx) {
  const {
    state:session, els, E, toast, openAccount, hideMainViews,
    svgEl, minigolfPathPoint, minigolfTerrainNode, minigolfBoostNode
  } = ctx;
  let editorState=null;

function newEditorMap() {
  return {
    name:'Nieuwe map', difficulty:'Normaal', maxStrokes:5,
    startZone:{x:50,y:365,w:125,h:85,r:13}, start:{x:112.5,y:407.5}, cup:{x:790,y:110},
    terrain:[], walls:[], props:[], boosts:[]
  };
}

function ensureMapEditor() {
  if(editorState){editorState.map=ensureEditorV8Map(editorState.map);return editorState}
  editorState={
    id:null, canEdit:false, map:ensureEditorV8Map(newEditorMap()), maps:[], tool:'select', selected:null,
    dirty:false, testMode:false, testBall:null, testRemovedPropIds:[], testAnimation:null, drawDraft:null
  };
  return editorState;
}

function cloneJson(value){return JSON.parse(JSON.stringify(value))}
function ensureEditorV8Map(map){
  const m=map||newEditorMap();
  if(!m.startZone){
    const s=m.start||{x:110,y:410};
    m.startZone={x:Math.max(14,s.x-62),y:Math.max(14,s.y-42),w:124,h:84,r:13}
  }
  m.start={x:m.startZone.x+m.startZone.w/2,y:m.startZone.y+m.startZone.h/2};
  if(!Array.isArray(m.boosts))m.boosts=[];
  return m
}
function editorLogicalPoint(event){
  const r=els.mapEditorCanvas.getBoundingClientRect();
  return {x:Math.max(0,Math.min(900,(event.clientX-r.left)/r.width*900)),y:Math.max(0,Math.min(520,(event.clientY-r.top)/r.height*520))};
}
function editorMarkDirty(){const ed=ensureMapEditor();ed.dirty=true;els.mapSaveState.textContent=ed.id?'Gewijzigd':'Niet opgeslagen'}
function syncEditorMetaToMap(){
  const ed=ensureMapEditor();
  ed.map.name=(els.mapNameInput.value||'Nieuwe map').trim().slice(0,40)||'Nieuwe map';
  ed.map.difficulty=els.mapDifficultySelect.value;
  ed.map.maxStrokes=Math.max(3,Math.min(10,Number(els.mapMaxStrokesInput.value)||5));
}
function syncEditorMetaFromMap(){
  const ed=ensureMapEditor();
  els.mapNameInput.value=ed.map.name||'Nieuwe map';
  els.mapDifficultySelect.value=ed.map.difficulty||'Normaal';
  els.mapMaxStrokesInput.value=ed.map.maxStrokes||5;
  els.mapSaveState.textContent=ed.id?(ed.dirty?'Gewijzigd':'Opgeslagen'):'Niet opgeslagen';
}
function selectEditorTool(tool){
  const ed=ensureMapEditor();ed.tool=tool;ed.testMode=false;ed.testAnimation=null;ed.testBall=null;
  els.mapToolGrid.querySelectorAll('.map-tool').forEach(b=>b.classList.toggle('active',b.dataset.tool===tool));
  const helps={select:'Klik een object om te selecteren en sleep om te verplaatsen.',start:'Sleep een startvak. Spelers kiezen binnen dit vak zelf hun balpositie.',cup:'Klik waar de hole moet staan.',sand:'Sleep een vlak voor normale slowdown.',cement:'Sleep een roze vlak voor extreme slowdown.',water:'Sleep een waterzone. Een bal wordt na de slag teruggelegd.',wall:'Sleep om een solide muur te tekenen.',boost:'Sleep een boostvlak. Pas richting en sterkte aan in de inspector.',tree:'Klik om een verdwijnende boom te plaatsen.',tractor:'Klik om een verdwijnende tractor te plaatsen.',rock:'Klik om een solide rots te plaatsen.',hay:'Klik om een verdwijnende hooibaal te plaatsen.',windmill:'Klik om een solide windmolen te plaatsen.'};
  els.mapToolHelp.textContent=helps[tool]||'';renderMapEditorCanvas();
}
function editorSelectionObject(){
  const ed=ensureMapEditor(),s=ed.selected;if(!s)return null;
  if(s.kind==='start')return ed.map.startZone;if(s.kind==='cup')return ed.map.cup;
  const list=s.kind==='terrain'?ed.map.terrain:s.kind==='wall'?ed.map.walls:s.kind==='boost'?ed.map.boosts:ed.map.props;
  return list?.[s.index]||null;
}
function editorDeleteSelection(){
  const ed=ensureMapEditor(),s=ed.selected;if(!s||s.kind==='start'||s.kind==='cup')return;
  const list=s.kind==='terrain'?ed.map.terrain:s.kind==='wall'?ed.map.walls:s.kind==='boost'?ed.map.boosts:ed.map.props;
  list.splice(s.index,1);ed.selected=null;editorMarkDirty();renderMapEditorCanvas();renderMapInspector();
}
function editorAssetHref(kind){return `/game-plugins/minigolf/assets/${kind}.svg`}
function renderEditorProp(prop,index){
  const g=svgEl('g',{'data-editor-key':`prop:${index}`,class:'editor-object editor-prop'});
  if(prop.shape==='circle'){
    const size=Math.max(44,(prop.r||28)*2.5);g.append(svgEl('image',{href:editorAssetHref(prop.kind),x:prop.cx-size/2,y:prop.cy-size/2,width:size,height:size,preserveAspectRatio:'xMidYMid meet'}));
    g.append(svgEl('circle',{cx:prop.cx,cy:prop.cy,r:prop.r||28,class:'editor-hitbox'}));
  }else{
    const pad=prop.kind==='windmill'?10:5;g.append(svgEl('image',{href:editorAssetHref(prop.kind),x:prop.x-pad,y:prop.y-pad,width:prop.w+pad*2,height:prop.h+pad*2,preserveAspectRatio:'xMidYMid meet'}));
    g.append(svgEl('rect',{x:prop.x,y:prop.y,width:prop.w,height:prop.h,rx:5,class:'editor-hitbox'}));
  }
  return g;
}
function renderMapEditorCanvas(){
  const ed=ensureMapEditor(),svg=els.mapEditorCanvas;svg.replaceChildren();
  svg.append(svgEl('rect',{x:0,y:0,width:900,height:520,rx:26,class:'editor-world'}));
  svg.append(svgEl('rect',{x:10,y:10,width:880,height:500,rx:20,class:'golf-border'}));
  ed.map.terrain.forEach((z,i)=>{const n=minigolfTerrainNode(z);n.setAttribute('data-editor-key',`terrain:${i}`);n.classList.add('editor-object');svg.append(n)});
  ed.map.walls.forEach((w,i)=>svg.append(svgEl('rect',{x:w.x,y:w.y,width:w.w,height:w.h,rx:8,class:'golf-wall editor-object','data-editor-key':`wall:${i}`})));
  ed.map.boosts.forEach((b,i)=>{const n=minigolfBoostNode({...b,id:b.id||`boost${i+1}`});n.setAttribute('data-editor-key',`boost:${i}`);n.classList.add('editor-object');svg.append(n)});
  ed.map.props.forEach((prop,i)=>{if(!ed.testRemovedPropIds.includes(`prop${i+1}`))svg.append(renderEditorProp(prop,i))});
  const sz=ed.map.startZone;svg.append(svgEl('rect',{x:sz.x,y:sz.y,width:sz.w,height:sz.h,rx:sz.r||13,class:'editor-start-zone editor-object','data-editor-key':'start'}));
  const cupG=svgEl('g',{'data-editor-key':'cup',class:'editor-object'});cupG.append(svgEl('circle',{cx:ed.map.cup.x,cy:ed.map.cup.y,r:18,class:'golf-cup'}),svgEl('line',{x1:ed.map.cup.x,y1:ed.map.cup.y,x2:ed.map.cup.x,y2:ed.map.cup.y-55,class:'editor-flag-line'}),svgEl('path',{d:`M ${ed.map.cup.x} ${ed.map.cup.y-55} l 32 11 l -32 11 z`,class:'editor-flag'}));svg.append(cupG);
  if(ed.drawDraft){svg.append(svgEl('rect',{x:ed.drawDraft.x,y:ed.drawDraft.y,width:ed.drawDraft.w,height:ed.drawDraft.h,rx:ed.drawDraft.tool==='wall'?8:16,class:`editor-draft draft-${ed.drawDraft.tool}`}))}
  if(ed.selected&&!ed.testMode){const obj=editorSelectionObject();if(obj){let box;if(ed.selected.kind==='cup')box={x:obj.x-25,y:obj.y-25,w:50,h:50};else if(obj.shape==='ellipse')box={x:obj.cx-obj.rx,y:obj.cy-obj.ry,w:obj.rx*2,h:obj.ry*2};else if(obj.shape==='circle')box={x:obj.cx-obj.r,y:obj.cy-obj.r,w:obj.r*2,h:obj.r*2};else box={x:obj.x,y:obj.y,w:obj.w,h:obj.h};svg.append(svgEl('rect',{x:box.x-5,y:box.y-5,width:box.w+10,height:box.h+10,rx:8,class:'editor-selection'}))}}
  if(ed.testMode){const ball=ed.testBall||{x:ed.map.startZone.x+ed.map.startZone.w/2,y:ed.map.startZone.y+ed.map.startZone.h/2};svg.append(svgEl('circle',{cx:ball.x+3,cy:ball.y+5,r:12,class:'golf-ball-shadow'}));svg.append(svgEl('circle',{cx:ball.x,cy:ball.y,r:11,class:'golf-ball editor-test-ball',fill:'#f0c94d'}));const aim=svgEl('g',{id:'editorTestAim',class:'golf-aim hidden'});aim.append(svgEl('line',{id:'editorTestAimLine',class:'golf-aim-line'}),svgEl('circle',{id:'editorTestAimHead',r:6,class:'golf-aim-head'}),svgEl('line',{id:'editorTestPullLine',class:'golf-pull-line'}));svg.append(aim)}
}
function renderMapInspector(){
  const ed=ensureMapEditor(),s=ed.selected,obj=editorSelectionObject();
  els.deleteMapObjectButton.classList.toggle('hidden',!s||s.kind==='start'||s.kind==='cup');
  els.mapInspectorEmpty.classList.toggle('hidden',Boolean(obj));els.mapInspectorFields.classList.toggle('hidden',!obj);els.mapInspectorFields.replaceChildren();if(!obj)return;
  const title=E('h3','',s.kind==='terrain'?`Terrein: ${obj.type}`:s.kind==='wall'?'Muur':s.kind==='boost'?'Boost':s.kind==='prop'?`Object: ${obj.kind}`:s.kind==='start'?'Startvak':'Hole');els.mapInspectorFields.append(title);
  if(s.kind==='terrain'){
    const shapeLabel=E('label','inspector-field');shapeLabel.append(E('span','','Vorm'));const shapeSelect=document.createElement('select');[['rect','Rechthoek'],['ellipse','Ovaal']].forEach(([v,t])=>{const o=document.createElement('option');o.value=v;o.textContent=t;shapeSelect.append(o)});shapeSelect.value=obj.shape||'rect';shapeSelect.onchange=()=>{if(shapeSelect.value===obj.shape)return;if(shapeSelect.value==='ellipse'){const x=obj.x||0,y=obj.y||0,w=obj.w||100,h=obj.h||80;delete obj.x;delete obj.y;delete obj.w;delete obj.h;delete obj.r;obj.shape='ellipse';obj.cx=x+w/2;obj.cy=y+h/2;obj.rx=w/2;obj.ry=h/2}else{const cx=obj.cx||450,cy=obj.cy||260,rx=obj.rx||60,ry=obj.ry||40;delete obj.cx;delete obj.cy;delete obj.rx;delete obj.ry;obj.shape='rect';obj.x=cx-rx;obj.y=cy-ry;obj.w=rx*2;obj.h=ry*2;obj.r=16}editorMarkDirty();renderMapEditorCanvas();renderMapInspector()};shapeLabel.append(shapeSelect);els.mapInspectorFields.append(shapeLabel);
  }
  const fields=[];
  if(s.kind==='cup')fields.push(['x','X'],['y','Y']);
  else if(s.kind==='start')fields.push(['x','X'],['y','Y'],['w','Breedte'],['h','Hoogte']);
  else if(obj.shape==='ellipse')fields.push(['cx','X'],['cy','Y'],['rx','Breedte / 2'],['ry','Hoogte / 2']);
  else if(obj.shape==='circle')fields.push(['cx','X'],['cy','Y'],['r','Radius']);
  else fields.push(['x','X'],['y','Y'],['w','Breedte'],['h','Hoogte']);
  fields.forEach(([key,label])=>{const l=E('label','inspector-field');l.append(E('span','',label));const input=E('input');input.type='number';input.value=Math.round(obj[key]);input.onchange=()=>{obj[key]=Number(input.value)||0;editorMarkDirty();renderMapEditorCanvas()};l.append(input);els.mapInspectorFields.append(l)});
  if(s.kind==='boost'){
    const l=E('label','inspector-field');l.append(E('span','','Richting °'));const i=E('input');i.type='number';i.value=Math.round((obj.angle||0)*180/Math.PI);i.onchange=()=>{obj.angle=(Number(i.value)||0)*Math.PI/180;editorMarkDirty();renderMapEditorCanvas()};l.append(i);els.mapInspectorFields.append(l);
    const sl=E('label','inspector-field');sl.append(E('span','','Sterkte'));const si=E('input');si.type='number';si.min='0.35';si.max='2.25';si.step='0.05';si.value=obj.strength||1;si.onchange=()=>{obj.strength=Math.max(.35,Math.min(2.25,Number(si.value)||1));editorMarkDirty()};sl.append(si);els.mapInspectorFields.append(sl)
  }
  if(s.kind==='prop')els.mapInspectorFields.append(E('div','inspector-note',obj.destructible?'Verdwijnt wanneer een bal het raakt.':'Solide object: blijft staan.'));
}
function parseEditorKey(value){if(!value)return null;if(value==='start'||value==='cup')return{kind:value};const [kind,index]=value.split(':');return{kind,index:Number(index)}}
function editorFindKeyTarget(event){return event.target.closest?.('[data-editor-key]')?.getAttribute('data-editor-key')||null}
function editorMoveObject(obj,kind,dx,dy,initial){
  if(kind==='cup'){obj.x=Math.max(15,Math.min(885,initial.x+dx));obj.y=Math.max(15,Math.min(505,initial.y+dy));return}
  if(kind==='start'){obj.x=Math.max(5,Math.min(895-(obj.w||52),initial.x+dx));obj.y=Math.max(5,Math.min(515-(obj.h||52),initial.y+dy));return}
  if(obj.shape==='ellipse'||obj.shape==='circle'){obj.cx=Math.max(15,Math.min(885,initial.cx+dx));obj.cy=Math.max(15,Math.min(505,initial.cy+dy))}else{obj.x=Math.max(5,Math.min(880-(obj.w||20),initial.x+dx));obj.y=Math.max(5,Math.min(510-(obj.h||20),initial.y+dy))}
}
function addEditorProp(kind,point){
  const specs={tree:{shape:'circle',r:28,destructible:true},tractor:{shape:'rect',w:76,h:46,destructible:true},rock:{shape:'circle',r:28,destructible:false},hay:{shape:'rect',w:70,h:46,destructible:true},windmill:{shape:'rect',w:70,h:95,destructible:false}};const spec=specs[kind];if(!spec)return;
  const prop={kind,...spec};if(spec.shape==='circle'){prop.cx=point.x;prop.cy=point.y}else{prop.x=point.x-spec.w/2;prop.y=point.y-spec.h/2}ensureMapEditor().map.props.push(prop);ensureMapEditor().selected={kind:'prop',index:ensureMapEditor().map.props.length-1};editorMarkDirty();renderMapEditorCanvas();renderMapInspector();
}
function editorAddRect(tool,a,b){
  const x=Math.min(a.x,b.x),y=Math.min(a.y,b.y),w=Math.abs(a.x-b.x),h=Math.abs(a.y-b.y);if(w<15||h<15)return;
  const ed=ensureMapEditor();
  if(tool==='wall'){ed.map.walls.push({x,y,w,h});ed.selected={kind:'wall',index:ed.map.walls.length-1}}
  else if(tool==='start'){ed.map.startZone={x,y,w:Math.max(52,w),h:Math.max(52,h),r:13};ed.map.start={x:x+w/2,y:y+h/2};ed.selected={kind:'start'}}
  else if(tool==='boost'){ed.map.boosts.push({x,y,w,h,angle:0,strength:1});ed.selected={kind:'boost',index:ed.map.boosts.length-1}}
  else{ed.map.terrain.push({type:tool,shape:'rect',x,y,w,h,r:Math.min(24,w/3,h/3)});ed.selected={kind:'terrain',index:ed.map.terrain.length-1}}
  editorMarkDirty();renderMapEditorCanvas();renderMapInspector();
}
function bindMapCanvasEvents(){
  const svg=els.mapEditorCanvas;let interaction=null;
  svg.addEventListener('pointerdown',(event)=>{
    const ed=ensureMapEditor(),point=editorLogicalPoint(event);
    if(ed.testMode){const ball=ed.testBall||{x:ed.map.startZone.x+ed.map.startZone.w/2,y:ed.map.startZone.y+ed.map.startZone.h/2};if(Math.hypot(point.x-ball.x,point.y-ball.y)>42)return;interaction={type:'test',pointerId:event.pointerId,origin:{...ball}};svg.setPointerCapture?.(event.pointerId);event.preventDefault();return}
    if(['sand','cement','water','wall','start','boost'].includes(ed.tool)){interaction={type:'draw',tool:ed.tool,pointerId:event.pointerId,start:point};ed.drawDraft={tool:ed.tool,x:point.x,y:point.y,w:0,h:0};svg.setPointerCapture?.(event.pointerId);renderMapEditorCanvas();event.preventDefault();return}
    if(ed.tool==='cup'){ed.map.cup={x:point.x,y:point.y};ed.selected={kind:'cup'};editorMarkDirty();selectEditorTool('select');renderMapInspector();event.preventDefault();return}
    if(['tree','tractor','rock','hay','windmill'].includes(ed.tool)){addEditorProp(ed.tool,point);selectEditorTool('select');event.preventDefault();return}
    const key=editorFindKeyTarget(event);ed.selected=parseEditorKey(key);renderMapEditorCanvas();renderMapInspector();if(ed.selected){const obj=editorSelectionObject();interaction={type:'move',pointerId:event.pointerId,start:point,selection:{...ed.selected},initial:cloneJson(obj)};svg.setPointerCapture?.(event.pointerId);event.preventDefault()}
  });
  svg.addEventListener('pointermove',(event)=>{
    if(!interaction||interaction.pointerId!==event.pointerId)return;const point=editorLogicalPoint(event),ed=ensureMapEditor();
    if(interaction.type==='draw'){ed.drawDraft={tool:interaction.tool,x:Math.min(interaction.start.x,point.x),y:Math.min(interaction.start.y,point.y),w:Math.abs(point.x-interaction.start.x),h:Math.abs(point.y-interaction.start.y)};renderMapEditorCanvas()}
    else if(interaction.type==='move'){const obj=editorSelectionObject();if(obj){editorMoveObject(obj,interaction.selection.kind,point.x-interaction.start.x,point.y-interaction.start.y,interaction.initial);editorMarkDirty();renderMapEditorCanvas()}}
    else if(interaction.type==='test')updateEditorTestAim(interaction.origin,point);
    event.preventDefault();
  });
  const finish=async(event)=>{if(!interaction||interaction.pointerId!==event.pointerId)return;const point=editorLogicalPoint(event),current=interaction;interaction=null;const ed=ensureMapEditor();if(current.type==='draw'){ed.drawDraft=null;editorAddRect(current.tool,current.start,point)}else if(current.type==='move'){renderMapInspector()}else if(current.type==='test'){const shot=editorTestShotData(current.origin,point);hideEditorTestAim();if(shot&&shot.power>=.06)await runEditorTestShot(shot)}event.preventDefault()};
  svg.addEventListener('pointerup',finish);svg.addEventListener('pointercancel',()=>{interaction=null;ensureMapEditor().drawDraft=null;hideEditorTestAim();renderMapEditorCanvas()});
}
function editorTestShotData(origin,point){let dx=origin.x-point.x,dy=origin.y-point.y,d=Math.hypot(dx,dy);if(d<5)return null;const max=155,clamped=Math.min(max,d),ux=dx/d,uy=dy/d;return{angle:Math.atan2(uy,ux),power:Math.min(1,clamped/max)}}
function updateEditorTestAim(origin,point){const data=editorTestShotData(origin,point),g=document.getElementById('editorTestAim');if(!g||!data)return;const d=Math.min(155,Math.hypot(origin.x-point.x,origin.y-point.y)),ux=Math.cos(data.angle),uy=Math.sin(data.angle),end={x:origin.x+ux*(55+data.power*115),y:origin.y+uy*(55+data.power*115)};g.classList.remove('hidden');const line=document.getElementById('editorTestAimLine'),head=document.getElementById('editorTestAimHead'),pull=document.getElementById('editorTestPullLine');line.setAttribute('x1',origin.x);line.setAttribute('y1',origin.y);line.setAttribute('x2',end.x);line.setAttribute('y2',end.y);head.setAttribute('cx',end.x);head.setAttribute('cy',end.y);pull.setAttribute('x1',origin.x);pull.setAttribute('y1',origin.y);pull.setAttribute('x2',origin.x-ux*d);pull.setAttribute('y2',origin.y-uy*d)}
function hideEditorTestAim(){document.getElementById('editorTestAim')?.classList.add('hidden')}
async function runEditorTestShot(shot){
  const ed=ensureMapEditor();syncEditorMetaToMap();els.mapTestHint.textContent='Physics berekenen…';
  try{const response=await fetch('/api/minigolf/test-shot',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({map:ed.map,start:ed.testBall||ed.map.start,removedPropIds:ed.testRemovedPropIds,...shot})});const data=await response.json();if(!data.ok)throw new Error(data.error||'Test mislukt.');const result=data.result,start=performance.now(),duration=Math.max(500,result.durationMs||900);ed.testAnimation={path:result.path,start,duration};const animate=(now)=>{if(!ed.testMode||ed.testAnimation?.start!==start)return;const t=Math.min(1,(now-start)/duration),pt=minigolfPathPoint(result.path,t);ed.testBall=pt||ed.testBall;renderMapEditorCanvas();if(t<1)requestAnimationFrame(animate);else{ed.testBall=result.holed?{...ed.map.cup}:result.end;ed.testRemovedPropIds=result.removedPropIds||ed.testRemovedPropIds;ed.testAnimation=null;renderMapEditorCanvas();els.mapTestHint.textContent=result.holed?'Gepot. Reset of test opnieuw.':result.water?'Water: bal terug op startpositie.':'Test klaar. Trek opnieuw of reset.'}};requestAnimationFrame(animate)}catch(error){toast(error.message);els.mapTestHint.textContent='Test mislukt.'}
}
function toggleEditorTest(){const ed=ensureMapEditor();ed.testMode=!ed.testMode;ed.testBall={x:ed.map.startZone.x+ed.map.startZone.w/2,y:ed.map.startZone.y+ed.map.startZone.h/2};ed.testRemovedPropIds=[];ed.selected=null;els.testGolfMapButton.textContent=ed.testMode?'Stop test':'Test map';els.resetGolfTestButton.classList.toggle('hidden',!ed.testMode);els.mapToolGrid.classList.toggle('disabled',ed.testMode);els.mapTestHint.textContent=ed.testMode?'Test mode gebruikt dezelfde server-physics. Sleep vanaf de bal om een slag te testen.':'Klik Test om de echte server-physics te proberen.';renderMapEditorCanvas();renderMapInspector()}
function resetEditorTest(){const ed=ensureMapEditor();ed.testBall={x:ed.map.startZone.x+ed.map.startZone.w/2,y:ed.map.startZone.y+ed.map.startZone.h/2};ed.testRemovedPropIds=[];ed.testAnimation=null;renderMapEditorCanvas()}
async function loadCustomMapLibrary(){
  try{const response=await fetch('/api/minigolf/maps',{cache:'no-store'}),data=await response.json();if(!data.ok)throw new Error(data.error||'Kon maps niet laden.');const ed=ensureMapEditor();ed.maps=data.maps||[];els.customMapCount.textContent=String(ed.maps.length);renderCustomMapList()}catch(error){els.customMapList.replaceChildren(E('p','muted',error.message))}
}
function renderCustomMapList(){
  const ed=ensureMapEditor();els.customMapList.replaceChildren();if(!ed.maps.length){els.customMapList.append(E('p','muted','Nog geen custom maps. Maak de eerste.'));return}
  ed.maps.forEach(row=>{const item=E('div','custom-map-item');const info=E('div');info.append(E('strong','',row.name),E('span','',`door ${row.ownerName} · max ${row.map.maxStrokes}${row.validation?.ok?' · speelbaar':' · ⚠ niet speelbaar'}`));const actions=E('div','custom-map-actions');const open=E('button','ghost',row.canEdit?'Bewerk':'Open als kopie');open.type='button';open.onclick=()=>openCustomMap(row);actions.append(open);if(row.canEdit){const del=E('button','ghost danger-text','Verwijder');del.type='button';del.onclick=()=>deleteCustomMap(row);actions.append(del)}item.append(info,actions);els.customMapList.append(item)})
}
function openCustomMap(row){const ed=ensureMapEditor();ed.map=ensureEditorV8Map(cloneJson(row.map));ed.id=row.canEdit?row.id:null;ed.canEdit=Boolean(row.canEdit);if(!row.canEdit)ed.map.name=`${row.name} kopie`;ed.selected=null;ed.dirty=!row.canEdit;ed.testMode=false;ed.testBall=null;ed.testRemovedPropIds=[];syncEditorMetaFromMap();selectEditorTool('select');renderMapEditorCanvas();renderMapInspector();window.scrollTo({top:0,behavior:'smooth'})}
async function deleteCustomMap(row){if(!confirm(`Map “${row.name}” verwijderen?`))return;const response=await fetch(`/api/minigolf/maps/${row.id}`,{method:'DELETE'}),data=await response.json();if(!data.ok)return toast(data.error||'Verwijderen mislukt.');if(ensureMapEditor().id===row.id)resetEditorMap();await loadCustomMapLibrary();toast('Map verwijderd.')}
function resetEditorMap(){const ed=ensureMapEditor();ed.id=null;ed.canEdit=false;ed.map=newEditorMap();ed.selected=null;ed.dirty=false;ed.testMode=false;ed.testBall=null;ed.testRemovedPropIds=[];syncEditorMetaFromMap();selectEditorTool('select');renderMapInspector()}
async function saveEditorMap(){
  if(!session.authUser){openAccount();toast('Log in om custom maps op te slaan.');return}const ed=ensureMapEditor();syncEditorMetaToMap();const method=ed.id&&ed.canEdit?'PUT':'POST',url=method==='PUT'?`/api/minigolf/maps/${ed.id}`:'/api/minigolf/maps';els.saveGolfMapButton.disabled=true;els.saveGolfMapButton.textContent='Opslaan…';
  try{const response=await fetch(url,{method,headers:{'Content-Type':'application/json'},body:JSON.stringify({map:ed.map})}),data=await response.json();if(!data.ok)throw new Error(data.error||'Opslaan mislukt.');ed.id=data.map.id;ed.canEdit=true;ed.map=ensureEditorV8Map(cloneJson(data.map.map));ed.dirty=false;syncEditorMetaFromMap();renderMapEditorCanvas();await loadCustomMapLibrary();toast('Map opgeslagen en toegevoegd aan de map pool.')}catch(error){toast(error.message)}finally{els.saveGolfMapButton.disabled=false;els.saveGolfMapButton.textContent='Map opslaan'}
}
async function showMinigolfEditor(){
  if(session.room)return toast('Verlaat eerst de room.');hideMainViews();els.minigolfEditorView.classList.remove('hidden');els.rulesButton.classList.add('hidden');const ed=ensureMapEditor();syncEditorMetaFromMap();renderMapEditorCanvas();renderMapInspector();await loadCustomMapLibrary();
}


  return {
    ensureMapEditor,
    editorMarkDirty,
    selectEditorTool,
    resetEditorMap,
    saveEditorMap,
    editorDeleteSelection,
    toggleEditorTest,
    resetEditorTest,
    syncEditorMetaToMap,
    showMinigolfEditor,
    bindMapCanvasEvents
  };
}
