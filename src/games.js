const fs = require('node:fs');
const path = require('node:path');
const pluginRoot = path.join(__dirname, '..', 'games');

function loadPluginGames(root = pluginRoot) {
  if (!fs.existsSync(root)) return [];
  const plugins = [];
  for (const entry of fs.readdirSync(root, { withFileTypes:true })) {
    if (!entry.isDirectory() || entry.name.startsWith('_') || entry.name.startsWith('.')) continue;
    const directory = path.join(root, entry.name);
    const manifestPath = path.join(directory, 'manifest.json');
    const serverPath = path.join(directory, 'server.js');
    if (!fs.existsSync(manifestPath) || !fs.existsSync(serverPath)) continue;
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    const rulesPath=path.join(directory,'rules.html');
    if(fs.existsSync(rulesPath))manifest.rules=fs.readFileSync(rulesPath,'utf8').trim();
    const key = String(manifest.key || '').toLowerCase();
    if (!/^[a-z0-9-]+$/.test(key) || key !== entry.name.toLowerCase()) throw new Error(`Ongeldige game-plugin map of key: ${entry.name}`);
    const engine = require(serverPath);
    for (const fn of ['createGame','handleAction','serialize']) if (typeof engine[fn] !== 'function') throw new Error(`Game-plugin ${key} mist ${fn}().`);
    const createGame=engine.createGame;
    engine.createGame=(...args)=>{const game=createGame(...args);game.gameKey=key;return game};
    engine.meta = {
      key, name:String(manifest.name || key), description:String(manifest.description || ''),
      minPlayers:Number(manifest.minPlayers || 1), maxPlayers:Number(manifest.maxPlayers || 1),
      supportsNpc:Boolean(manifest.supportsNpc), realtime:Boolean(manifest.realtime), solo:Boolean(manifest.solo)
    };
    engine.plugin = { directory, manifest:{...manifest,key}, version:String(manifest.version || '1') };
    plugins.push(engine);
  }
  return plugins;
}

const pluginModules = loadPluginGames();
const modules = pluginModules;
const byKey = new Map(modules.map((game) => [game.meta.key, game]));
if (byKey.size !== modules.length) throw new Error('Dubbele game key in game registry.');

function getGame(key) {
  return byKey.get(String(key || '').toLowerCase()) || null;
}

function listGames() {
  return modules.map((game) => game.meta);
}

function listGamePlugins() {
  return pluginModules.map((game) => {
    const m=game.plugin.manifest;
    const clientAvailable=m.client!==false&&fs.existsSync(path.join(game.plugin.directory,'client.js'));
    return {
      key:m.key,name:game.meta.name,description:game.meta.description,minPlayers:game.meta.minPlayers,maxPlayers:game.meta.maxPlayers,
      supportsNpc:game.meta.supportsNpc,realtime:game.meta.realtime,solo:game.meta.solo,
      icon:String(m.icon||'🎮'),badge:String(m.badge||`${game.meta.minPlayers}-${game.meta.maxPlayers}`),actionLabel:String(m.actionLabel||'Nieuw spel'),
      toolLabel:m.toolLabel?String(m.toolLabel):null,rules:String(m.rules||''),version:game.plugin.version,
      loadError:clientAvailable?null:'Frontendmodule ontbreekt.',
      clientUrl:clientAvailable?`/game-plugins/${encodeURIComponent(m.key)}/client.js?v=${encodeURIComponent(game.plugin.version)}`:null,
      styleUrl:m.styles===false||!fs.existsSync(path.join(game.plugin.directory,'styles.css'))?null:`/game-plugins/${encodeURIComponent(m.key)}/styles.css?v=${encodeURIComponent(game.plugin.version)}`,
      viewUrl:fs.existsSync(path.join(game.plugin.directory,'view.html'))?`/game-plugins/${encodeURIComponent(m.key)}/view.html?v=${encodeURIComponent(game.plugin.version)}`:null
    };
  }).sort((a,b)=>a.name.localeCompare(b.name,'nl-BE',{sensitivity:'base'}));
}

function getGamePlugin(key) {
  const game=getGame(key);
  return game?.plugin || null;
}

module.exports = { getGame, listGames, listGamePlugins, getGamePlugin, loadPluginGames, modules };
