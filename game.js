// ── constants ──────────────────────────────────────────────────────────────
const W = 380, H = 340;
const R = 14;          // node radius
const MARGIN = 30;     // keep nodes inside canvas

// ── state ──────────────────────────────────────────────────────────────────
let v = 4;
let edges = [];        // pairs [i,j], 0-indexed
let graphs = [null, null]; // each: { nodes: [{x,y},...] }

// ── graph generation ───────────────────────────────────────────────────────
function randInt(lo, hi) {          // [lo, hi)
    return lo + Math.floor(Math.random() * (hi - lo));
}

function generateGraph(vCount) {
    const lo = 2 * vCount - 4;
    const hi = 3 * vCount - 6;       // exclusive
    const eCount = randInt(lo, hi);
    // build edge list; retry if we can't fill without duplicates
    const edgeSet = new Set();
    let attempts = 0;
    while (edgeSet.size < eCount && attempts < 100000) {
        attempts++;
        const a = randInt(0, vCount);
        let b = randInt(0, vCount - 1);
        if (b >= a) b++;
        const key = a < b ? `${a},${b}` : `${b},${a}`;
        edgeSet.add(key);
    }
    return [...edgeSet].map(k => k.split(',').map(Number));
}

// ── layout ─────────────────────────────────────────────────────────────────
function randomLayout(vCount) {
    const nodes = [];
    const maxTries = 5000;
    for (let i = 0; i < vCount; i++) {
        let x, y, ok;
        let tries = 0;
        do {
            x = randInt(MARGIN + R, W - MARGIN - R);
            y = randInt(MARGIN + R, H - MARGIN - R);
            ok = true;
            for (const n of nodes) {
                const dx = n.x - x, dy = n.y - y;
                if (Math.sqrt(dx*dx + dy*dy) < R * 2.8) {
                    ok = false;
                    break;
                }
            }
            tries++;
        } while (!ok && tries < maxTries);
        nodes.push({ x, y });
    }
    return nodes;
}

// apply a random permutation to a copy of edges
function permuteEdges(edgeList, vCount) {
    const perm = Array.from({length: vCount}, (_, i) => i);
    for (let i = vCount - 1; i > 0; i--) {
        const j = randInt(0, i + 1);
        [perm[i], perm[j]] = [perm[j], perm[i]];
    }
    return edgeList.map(([a, b]) => [perm[a], perm[b]]);
}

// ── round setup ────────────────────────────────────────────────────────────
function newRound(keepV) {
    if (!keepV) { /* v already set externally */ }
    edges = generateGraph(v);
    // graph 0: canonical edges, scrambled layout
    // graph 1: permuted edges (still isomorphic), different scrambled layout
    const permutedEdges = permuteEdges(edges, v);
    graphs[0] = { nodes: randomLayout(v), edges: edges };
    graphs[1] = { nodes: randomLayout(v), edges: permutedEdges };
    document.getElementById('round-badge').textContent = `v = ${v}`;
    document.getElementById('edge-info').textContent =
        `${v} nodes · ${edges.length} edges`;
    setStatus('');
    draw(0); draw(1);
}

// ── drawing ────────────────────────────────────────────────────────────────
const NODE_COLOR  = 'black';
const NODE_STROKE = 'gray';
const EDGE_COLOR  = 'gray';
const HIGHLIGHT   = ['lime', 'red'];

function draw(gi, matchPairs) {
    const canvas = document.getElementById(`c${gi}`);
    const ctx = canvas.getContext('2d');
    const { nodes, edges: edgeList } = graphs[gi];
    ctx.clearRect(0, 0, W, H);
    // edges
    ctx.strokeStyle = EDGE_COLOR;
    ctx.lineWidth = 1.5;
    for (const [a, b] of edgeList) {
        ctx.beginPath();
        ctx.moveTo(nodes[a].x, nodes[a].y);
        ctx.lineTo(nodes[b].x, nodes[b].y);
        ctx.stroke();
    }
    // nodes
    for (let i = 0; i < nodes.length; i++) {
        const { x, y } = nodes[i];
        ctx.beginPath();
        ctx.arc(x, y, R, 0, Math.PI * 2);
        ctx.fillStyle = NODE_COLOR;
        ctx.fill();
        ctx.strokeStyle = NODE_STROKE;
        ctx.lineWidth = 1.5;
        ctx.stroke();
    }
}

function drawWithMatch(matchPairs, isOk) {
    // redraw both canvases highlighting matched pairs
    [0, 1].forEach(gi => {
        const canvas = document.getElementById(`c${gi}`);
        const ctx = canvas.getContext('2d');
        const { nodes, edges: edgeList } = graphs[gi];

        ctx.clearRect(0, 0, W, H);

        ctx.strokeStyle = EDGE_COLOR;
        ctx.lineWidth = 1.5;
        for (const [a, b] of edgeList) {
            ctx.beginPath();
            ctx.moveTo(nodes[a].x, nodes[a].y);
            ctx.lineTo(nodes[b].x, nodes[b].y);
            ctx.stroke();
        }

        for (let i = 0; i < nodes.length; i++) {
            const { x, y } = nodes[i];
            // find which pair index this node belongs to
            const pairIdx = matchPairs.findIndex(p => p[gi] === i);
            ctx.beginPath();
            ctx.arc(x, y, R, 0, Math.PI * 2);
            ctx.fillStyle = NODE_COLOR;
            ctx.fill();
            ctx.strokeStyle = pairIdx >= 0
                ? (isOk ? 'lime' : 'red')
                : NODE_STROKE;
            ctx.lineWidth = pairIdx >= 0 ? 2.5 : 1.5;
            ctx.stroke();
        }
    });
}

// ── drag handling ──────────────────────────────────────────────────────────
let drag = null; // { gi, nodeIdx, offX, offY }

function canvasMouseDown(gi, e) {
    const rect = e.target.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const nodes = graphs[gi].nodes;
    for (let i = 0; i < nodes.length; i++) {
        const dx = nodes[i].x - mx, dy = nodes[i].y - my;
        if (dx*dx + dy*dy <= R*R) {
            drag = { gi, nodeIdx: i, offX: dx, offY: dy };
            e.target.style.cursor = 'grabbing';
            return;
        }
    }
}

function canvasMouseMove(e) {
    if (!drag) return;
    const canvas = document.getElementById(`c${drag.gi}`);
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const node = graphs[drag.gi].nodes[drag.nodeIdx];
    node.x = Math.max(R, Math.min(W - R, mx + drag.offX));
    node.y = Math.max(R, Math.min(H - R, my + drag.offY));
    draw(drag.gi);
}

function canvasMouseUp(e) {
    if (drag) {
        document.getElementById(`c${drag.gi}`).style.cursor = 'default';
        drag = null;
    }
}

[0, 1].forEach(gi => {
    const c = document.getElementById(`c${gi}`);
    c.addEventListener('mousedown', e => canvasMouseDown(gi, e));
});
document.addEventListener('mousemove', canvasMouseMove);
document.addEventListener('mouseup', canvasMouseUp);

// touch support
[0, 1].forEach(gi => {
    const c = document.getElementById(`c${gi}`);
    c.addEventListener('touchstart', e => {
        e.preventDefault();
        const t = e.touches[0];
        canvasMouseDown(gi, { clientX: t.clientX, clientY: t.clientY, target: c });
    }, { passive: false });
});
document.addEventListener('touchmove', e => {
    if (!drag) return;
    e.preventDefault();
    const t = e.touches[0];
    canvasMouseMove({ clientX: t.clientX, clientY: t.clientY });
}, { passive: false });
document.addEventListener('touchend', canvasMouseUp);

// ── matching & checking ────────────────────────────────────────────────────
function normalise(nodes) {
    // map each node to [0,1]^2 within bounding box of that graph
    const xs = nodes.map(n => n.x), ys = nodes.map(n => n.y);
    const minX = Math.min(...xs), maxX = Math.max(...xs);
    const minY = Math.min(...ys), maxY = Math.max(...ys);
    const spanX = maxX - minX || 1, spanY = maxY - minY || 1;
    return nodes.map(n => ({ nx: (n.x - minX) / spanX, ny: (n.y - minY) / spanY }));
}

function matchNodes() {
    // nearest-neighbour bipartite matching by normalised position
    const n0 = normalise(graphs[0].nodes);
    const n1 = normalise(graphs[1].nodes);
    const used = new Array(v).fill(false);
    const pairs = []; // pairs[i] = { 0: idx in g0, 1: idx in g1 }

    for (let i = 0; i < v; i++) {
        let best = -1, bestDist = Infinity;
        for (let j = 0; j < v; j++) {
            if (used[j]) continue;
            const dx = n0[i].nx - n1[j].nx, dy = n0[i].ny - n1[j].ny;
            const d = dx*dx + dy*dy;
            if (d < bestDist) { bestDist = d; best = j; }
        }
        used[best] = true;
        pairs.push({ 0: i, 1: best });
    }
    return pairs;
}

function checkIsomorphism(pairs) {
    // build mapping: g0 node → g1 node
    const map = new Array(v);
    for (const p of pairs) map[p[0]] = p[1];
    // for every edge in g0, check mapped edge exists in g1
    const edgeSet1 = new Set(graphs[1].edges.map(
        ([a, b]) => a < b ? `${a},${b}` : `${b},${a}`
    ));
    for (const [a, b] of graphs[0].edges) {
        const ma = map[a], mb = map[b];
        const key = ma < mb ? `${ma},${mb}` : `${mb},${ma}`;
        if (!edgeSet1.has(key)) return false;
    }
    // also check g1 edge count matches (should, but guard permutation bugs)
    return graphs[0].edges.length === graphs[1].edges.length;
}

function setStatus(msg, cls) {
    const el = document.getElementById('status');
    el.textContent = msg;
    el.className = cls || '';
}

document.getElementById('btn-check').addEventListener('click', () => {
    const pairs = matchNodes();
    const matchArr = pairs.map(p => [p[0], p[1]]);
    const ok = checkIsomorphism(pairs);
    drawWithMatch(matchArr, ok);
    if (ok) {
        setStatus('Isomorphism confirmed — advancing to next round.', 'ok');
        setTimeout(() => { v++; newRound(); }, 900);
    } else {
        setStatus('Mapping does not preserve all edges. Keep rearranging.', 'err');
    }
});

document.getElementById('btn-new').addEventListener('click', () => {
    newRound();
});

// ── boot ───────────────────────────────────────────────────────────────────
newRound();
