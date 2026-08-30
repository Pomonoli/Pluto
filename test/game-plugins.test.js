const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {loadPluginGames,listGamePlugins}=require('../src/games');

test('game-plugin loader ontdekt een zelfstandige gamemap',()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'pluto-game-plugin-'));
  try{
    const dir=path.join(root,'voorbeeld');fs.mkdirSync(dir);
    fs.writeFileSync(path.join(dir,'manifest.json'),JSON.stringify({key:'voorbeeld',name:'Voorbeeld',minPlayers:2,maxPlayers:4,supportsNpc:true,version:'3'}));
    fs.writeFileSync(path.join(dir,'server.js'),"module.exports={createGame(){return{}},handleAction(){},serialize(){return{}}}");
    const [plugin]=loadPluginGames(root);
    assert.equal(plugin.meta.key,'voorbeeld');
    assert.equal(plugin.meta.maxPlayers,4);
    assert.equal(plugin.createGame([]).gameKey,'voorbeeld');
  } finally {
    fs.rmSync(root,{recursive:true,force:true});
  }
});

test('alle bestaande games zijn plugins en de template wordt overgeslagen',()=>{
  const plugins=listGamePlugins();
  assert.equal(plugins.length,9);
  assert.ok(plugins.every((plugin)=>plugin.key!=='_template'&&plugin.clientUrl));
});

test('frontend heeft een dynamische pluginloader en rendererregistratie',()=>{
  const app=fs.readFileSync(path.join(__dirname,'../public/app.js'),'utf8');
  const ui=fs.readFileSync(path.join(__dirname,'../public/js/game-ui.js'),'utf8');
  assert.match(app,/fetch\('\/api\/game-plugins'/);
  assert.match(app,/gameUi\.registerPlugin\(game\.key,plugin\)/);
  assert.match(ui,/registerPlugin\(key,plugin\)/);
});

test('elke game-client koppelt render() aan zijn echte hoofdrenderer',()=>{
  const expected={
    blackjack:'renderBlackjack',
    carcassonne:'renderCarcassonne',
    cluedo:'renderCluedo',
    hartenjagen:'renderHartenjagen',
    hofslag:'renderHofslag',
    minigolf:'renderMinigolf',
    pesten:'renderPesten',
    presidenten:'renderPresidenten',
    solitaire:'renderSolitaire'
  };
  for(const [key,renderer] of Object.entries(expected)){
    const client=fs.readFileSync(path.join(__dirname,'..','games',key,'client.js'),'utf8');
    assert.match(client,new RegExp(`export\\s+function\\s+render\\s*\\([^)]*\\)\\s*\\{[^}]*\\b${renderer}\\s*\\(`,'s'),`${key} render() roept ${renderer} niet aan`);
  }
});
