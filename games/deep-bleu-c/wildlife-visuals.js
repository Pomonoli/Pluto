export function wildlifeStatus(spot, you, dayPhase) {
  let reason = '';
  if (spot.nightOnly && dayPhase !== 'night') reason = 'Alleen bejaagbaar tijdens de nacht.';
  else if (you.stats?.energy <= 0) reason = 'Eet iets om energie te herstellen.';
  else if (you.combat) reason = 'Rond eerst je gevecht af.';
  else if (you.path?.length) reason = 'Blijf even stilstaan.';
  else if (you.gathering && you.gathering.phase !== 'result') reason = 'Rond eerst je verzamelactie af.';
  return { state: reason ? 'locked' : 'ready', description: `${spot.name || 'Wild dier'}. ${reason || 'Bejaagbaar.'}` };
}

export function wildlifeIconUrl(setId) {
  return new URL(`./assets/wildlife/${setId}.svg`, import.meta.url).href;
}
