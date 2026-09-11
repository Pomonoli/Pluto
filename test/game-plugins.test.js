const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {loadPluginGames,listGamePlugins,listGames}=require('../src/games');

test('game-plugin loader ontdekt een zelfstandige gamemap',()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'pluto-game-plugin-'));
  try{
    const dir=path.join(root,'voorbeeld');fs.mkdirSync(dir);
    fs.writeFileSync(path.join(dir,'manifest.json'),JSON.stringify({key:'voorbeeld',name:'Voorbeeld',category:'original',minPlayers:2,maxPlayers:4,supportsNpc:true,version:'3'}));
    fs.writeFileSync(path.join(dir,'server.js'),"module.exports={createGame(){return{}},handleAction(){},serialize(){return{}}}");
    const [plugin]=loadPluginGames(root);
    assert.equal(plugin.meta.key,'voorbeeld');
    assert.equal(plugin.meta.maxPlayers,4);
    assert.equal(plugin.meta.category,'original');
    assert.equal(plugin.meta.visible,true);
    assert.equal(plugin.createGame([]).gameKey,'voorbeeld');
  } finally {
    fs.rmSync(root,{recursive:true,force:true});
  }
});

test('gamecategorie is verplicht en wordt via pluginmetadata aangeboden',()=>{
  const expected={
    original:['Age of Civilization','Bakkermans Jones','CycClub','De Slag om Waas','Elements Arena','Hofslag','Lutro','Minigolf','Ragnarok','The Big Blue C'],
    classic:['7 Wonders Duel','Blackjack','Carcassonne','Cascadia','Cluedo','Hartenjagen','Isle of Skye','Kingdomino','Pesten','Presidenten','Quoridor','Santorini','Solitaire','Stratego','Ticket to Ride']
  };
  const grouped={original:[],classic:[]};
  for(const plugin of listGamePlugins()){
    assert.ok(plugin.category==='original'||plugin.category==='classic',`${plugin.key}: ongeldige categorie`);
    grouped[plugin.category].push(plugin.name);
  }
  for(const names of Object.values(grouped))names.sort((a,b)=>a.localeCompare(b,'nl-BE',{sensitivity:'base'}));
  assert.deepEqual(grouped,expected);
});

test('alle bestaande games zijn plugins en de template wordt overgeslagen',()=>{
  const plugins=listGamePlugins();
  assert.equal(plugins.length,listGames().length);
  assert.ok(plugins.every((plugin)=>plugin.key!=='_template'&&plugin.clientUrl));
});

test('manifest visibility verbergt alleen de Play-kaart en houdt de plugin beschikbaar',()=>{
  const elements=listGamePlugins().find(plugin=>plugin.key==='elements');
  assert.ok(elements);
  assert.equal(elements.visible,false);
  assert.equal(typeof require('../src/games').getGame('elements').createGame,'function');
  const app=fs.readFileSync(path.join(__dirname,'../public/app.js'),'utf8');
  assert.match(app,/game\.visible!==false&&!els\.gameGrid\.querySelector/);
});

test('frontend heeft een dynamische pluginloader en rendererregistratie',()=>{
  const app=fs.readFileSync(path.join(__dirname,'../public/app.js'),'utf8');
  const ui=fs.readFileSync(path.join(__dirname,'../public/js/game-ui.js'),'utf8');
  assert.match(app,/fetch\('\/api\/game-plugins'/);
  assert.match(app,/gameUi\.registerPlugin\(game\.key,plugin\)/);
  assert.match(ui,/registerPlugin\(key,plugin\)/);
});

test('elke game-client exporteert render()',()=>{
  for(const plugin of listGamePlugins()){
    const client=fs.readFileSync(path.join(__dirname,'..','games',plugin.key,'client.js'),'utf8');
    assert.match(client,/export\s+function\s+render\s*\(/,`${plugin.key} exporteert render() niet`);
  }
});

test('helper-gebaseerde game-clients koppelen render() aan hun hoofdrenderer',()=>{
  const expected={
    blackjack:'renderBlackjack',
    carcassonne:'renderCarcassonne',
    cascadia:'renderCascadia',
    civilization:'renderCivilization',
    cluedo:'renderCluedo',
    hartenjagen:'renderHartenjagen',
    hofslag:'renderHofslag',
    minigolf:'renderMinigolf',
    pesten:'renderPesten',
    presidenten:'renderPresidenten',
    quoridor:'renderQuoridor',
    santorini:'renderSantorini',
    solitaire:'renderSolitaire',
    stratego:'renderStratego',
    'ticket-to-ride':'renderTicketToRide'
  };
  for(const [key,renderer] of Object.entries(expected)){
    const client=fs.readFileSync(path.join(__dirname,'..','games',key,'client.js'),'utf8');
    assert.match(client,new RegExp(`export\\s+function\\s+render\\s*\\([^)]*\\)\\s*\\{[^}]*\\b${renderer}\\s*\\(`,'s'),`${key} render() roept ${renderer} niet aan`);
  }
});
