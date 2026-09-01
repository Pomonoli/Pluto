'use strict';
/**
 * Isle of Skye - kernlogica voor tegelrotatie, plaatsingsregels en ronde-scoring.
 * Bordrepresentatie: Map<"x,y", {tile, x, y}> met tile={id,edges,features,hasRoad,rotation}.
 * Coördinaten: y neemt toe naar onder, x neemt toe naar rechts.
 */

const ROTATIONS = [0, 90, 180, 270];

const ADJACENT_OFFSETS = [
  { dx: 0, dy: -1, edgeSelf: 'top', edgeNeighbor: 'bottom' },
  { dx: 1, dy: 0, edgeSelf: 'right', edgeNeighbor: 'left' },
  { dx: 0, dy: 1, edgeSelf: 'bottom', edgeNeighbor: 'top' },
  { dx: -1, dy: 0, edgeSelf: 'left', edgeNeighbor: 'right' }
];

function getCoordKey(x, y) { return `${x},${y}`; }

function getRotatedEdges(edges, rotation) {
  const steps = ((Math.round(rotation / 90) % 4) + 4) % 4;
  let current = edges;
  for (let i = 0; i < steps; i++) {
    current = { top: current.left, right: current.top, bottom: current.right, left: current.bottom };
  }
  return current;
}

function isValidPlacement(board, tile, targetX, targetY, rotation) {
  const targetKey = getCoordKey(targetX, targetY);
  if (board.has(targetKey)) return false;
  let hasNeighbor = false;
  const effectiveEdges = getRotatedEdges(tile.edges, rotation);
  for (const offset of ADJACENT_OFFSETS) {
    const neighborKey = getCoordKey(targetX + offset.dx, targetY + offset.dy);
    const neighbor = board.get(neighborKey);
    if (!neighbor) continue;
    hasNeighbor = true;
    const neighborEdges = getRotatedEdges(neighbor.tile.edges, neighbor.tile.rotation);
    if (effectiveEdges[offset.edgeSelf] !== neighborEdges[offset.edgeNeighbor]) return false;
  }
  return hasNeighbor;
}

function candidateCells(board) {
  const cells = new Set();
  for (const key of board.keys()) {
    const [x, y] = key.split(',').map(Number);
    for (const offset of ADJACENT_OFFSETS) {
      const neighborKey = getCoordKey(x + offset.dx, y + offset.dy);
      if (!board.has(neighborKey)) cells.add(neighborKey);
    }
  }
  return [...cells].map((key) => { const [x, y] = key.split(',').map(Number); return { x, y }; });
}

function legalPlacements(board, tile) {
  const out = [];
  for (const { x, y } of candidateCells(board)) {
    for (const rotation of ROTATIONS) {
      if (isValidPlacement(board, tile, x, y, rotation)) out.push({ x, y, rotation });
    }
  }
  return out;
}

function isConnectedToCastleByRoad(board, startX, startY) {
  if (startX === 0 && startY === 0) return true;
  const visited = new Set();
  const queue = [[startX, startY]];
  while (queue.length > 0) {
    const [x, y] = queue.shift();
    const key = getCoordKey(x, y);
    if (x === 0 && y === 0) return true;
    if (visited.has(key)) continue;
    visited.add(key);
    const current = board.get(key);
    if (!current || !current.tile.hasRoad) continue;
    for (const offset of ADJACENT_OFFSETS) {
      const nx = x + offset.dx, ny = y + offset.dy, nKey = getCoordKey(nx, ny);
      const neighbor = board.get(nKey);
      if (neighbor && neighbor.tile.hasRoad && !visited.has(nKey)) queue.push([nx, ny]);
    }
  }
  return false;
}

function cattleIsLonely(board, x, y) {
  return !ADJACENT_OFFSETS.some((offset) => {
    const neighbor = board.get(getCoordKey(x + offset.dx, y + offset.dy));
    return neighbor && neighbor.tile.features.some((f) => f.type === 'cattle');
  });
}

function scoreShipRegions(board) {
  const seen = new Set();
  let points = 0;
  for (const [key, placed] of board) {
    if (seen.has(key)) continue;
    const edges = getRotatedEdges(placed.tile.edges, placed.tile.rotation);
    if (!Object.values(edges).includes('water')) { seen.add(key); continue; }
    const regionSeen = new Set([key]);
    const region = [];
    const queue = [[placed.x, placed.y]];
    let complete = true;
    while (queue.length > 0) {
      const [x, y] = queue.shift();
      const current = board.get(getCoordKey(x, y));
      region.push(current);
      const currentEdges = getRotatedEdges(current.tile.edges, current.tile.rotation);
      for (const offset of ADJACENT_OFFSETS) {
        if (currentEdges[offset.edgeSelf] !== 'water') continue;
        const nx = x + offset.dx, ny = y + offset.dy, nKey = getCoordKey(nx, ny);
        const neighbor = board.get(nKey);
        if (!neighbor) { complete = false; continue; }
        if (!regionSeen.has(nKey)) { regionSeen.add(nKey); queue.push([nx, ny]); }
      }
    }
    for (const k of regionSeen) seen.add(k);
    if (complete && region.some((placedTile) => placedTile.tile.features.some((f) => f.type === 'ship'))) points += 5;
  }
  return points;
}

function calculateRoundScore(board, scoringTileId) {
  let points = 0;
  const tiles = Array.from(board.values());
  switch (scoringTileId) {
    case 'SCORING_WHISKY':
      tiles.forEach((pt) => {
        const whisky = pt.tile.features.find((f) => f.type === 'whisky');
        if (whisky && isConnectedToCastleByRoad(board, pt.x, pt.y)) points += whisky.count * 2;
      });
      break;
    case 'SCORING_SHEEP':
      tiles.forEach((pt) => {
        const sheep = pt.tile.features.find((f) => f.type === 'sheep');
        if (sheep) points += sheep.count;
      });
      break;
    case 'SCORING_CATTLE':
      tiles.forEach((pt) => {
        const cattle = pt.tile.features.find((f) => f.type === 'cattle');
        if (cattle && cattleIsLonely(board, pt.x, pt.y)) points += cattle.count;
      });
      break;
    case 'SCORING_SHIPS':
      points += scoreShipRegions(board);
      break;
    default:
      break;
  }
  return points;
}

module.exports = {
  ROTATIONS,
  ADJACENT_OFFSETS,
  getCoordKey,
  getRotatedEdges,
  isValidPlacement,
  legalPlacements,
  isConnectedToCastleByRoad,
  calculateRoundScore
};
