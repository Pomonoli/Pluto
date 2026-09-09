// Preserve live buttons between touch-down and click during simulation ticks.
function key(node) {
  return node.nodeType === 1 ? node.getAttribute('data-bj-key') : null;
}

function matches(current, next) {
  return current && current.nodeType === next.nodeType &&
    current.nodeName === next.nodeName && key(current) === key(next);
}

export function patchChildren(parent, nextParent) {
  const nextChildren = [...nextParent.childNodes];
  nextChildren.forEach((next, index) => {
    let current = parent.childNodes[index];
    if (!matches(current, next)) {
      const existing = key(next) && [...parent.childNodes].slice(index + 1)
        .find((node) => matches(node, next));
      if (existing) {
        parent.insertBefore(existing, current || null);
        current = existing;
      } else {
        parent.insertBefore(next, current || null);
        return;
      }
    }
    if (current.nodeType !== 1) {
      if (current.nodeValue !== next.nodeValue) current.nodeValue = next.nodeValue;
      return;
    }
    for (const attr of [...current.attributes]) {
      if (!next.hasAttribute(attr.name)) current.removeAttribute(attr.name);
    }
    for (const attr of [...next.attributes]) {
      if (current.getAttribute(attr.name) !== attr.value) current.setAttribute(attr.name, attr.value);
    }
    current.onclick = next.onclick;
    patchChildren(current, next);
  });
  while (parent.childNodes.length > nextChildren.length) parent.lastChild.remove();
}
