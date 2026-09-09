// Shared by the map badge and its accessible description. Requirements come
// from the same server node profiles that validate harvesting.
export function treeStatus(tree, you, now = Date.now()) {
  const axeLevel = (you.gear?.axe || 0) + 1;
  const skillLevel = you.skills?.woodcutting?.level || 1;
  const qualified = axeLevel >= tree.requiredToolLevel && skillLevel >= tree.requiredSkillLevel;
  const remaining = Math.max(0, Math.ceil(((you.personalNodes?.[`wood:${tree.x}:${tree.y}`]?.depletedUntil || 0) - now) / 1000));
  const state = !qualified ? 'locked' : remaining ? 'recovering' : 'ready';
  const description = `${tree.name} · Bijl ${tree.requiredToolLevel} · Kappen ${tree.requiredSkillLevel}. `
    + (state === 'ready' ? 'Kapbaar.' : state === 'recovering' ? `Herstelt over ${remaining} sec.`
      : `Nog niet kapbaar. Jij: Bijl ${axeLevel}, Kappen ${skillLevel}.`);
  return { state, qualified, remaining, description };
}

export function treeIconUrl(setId) {
  return new URL(`./assets/trees/${setId}.svg`, import.meta.url).href;
}
