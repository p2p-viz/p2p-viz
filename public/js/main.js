import p2pnet from "/js/p2pnet.js";

let chat_body = document.getElementById("chat_body");
let chat_msg = document.getElementById("chat_msg");
let chat_btn = document.getElementById("chat_btn");
let dscnt_btn = document.getElementById("dcnt_btn");
let js_body = document.getElementById("json");

chat_msg.disabled = chat_btn.disabled = true;

window.network = p2pnet();

network.connect(
  {
    host: "p2pnet.jaysmito.repl.co",
    port: 443,
    path: "/peerjs/ice",
  },
  "https://p2pnet.jaysmito.repl.co/channels/main",
  "gossip"
);

network.on("connect", (peer_id) => {
  chat_msg.disabled = chat_btn.disabled = false;
  chat_body.innerHTML += `<p>joined as ${peer_id}</p>`;
});

network.on("log", (msg) => {
  console.log(msg);
});

network.on("data", (data) => {
  chat_body.innerHTML += `<p>${data.source}: ${data.payload}</p>`;
});

network.on("node_ready", (node_id) => {
  // chat_body.innerHTML += `<p>${node_id} joined</p>`
  // js_body.textContent = JSON.stringify(network.__network_manager.__connected_peers, undefined, 2)
  peers_db.set(network.get_peer_id(), network.get_immediate_peers());
});

network.on("node_disconnect", (node_id) => {
  // chat_body.innerHTML += `<p>${node_id} left</p>`
  // js_body.js_body.textContent = JSON.stringify(network.__network_manager.__connected_peers, undefined, 2)
  peers_db.set(network.get_peer_id(), network.get_immediate_peers());
});

network.on("pre_disconnect", () => {
  peers_db.set(network.get_peer_id(), null);
});

const peers_db = network.db("peers_table");

peers_db.on("update", () => {
  js_body.textContent = JSON.stringify(peers_db.get_all(), undefined, 2);
  document.getElementById("map").innerHTML = "";
  try {
    document.getElementById("map").appendChild(d3VisualizeGossip());
  } catch (err) {
    console.log(err);
  }
});

chat_btn.onclick = () => {
  chat_body.innerHTML += `<p>${chat_msg.value}</p>`;
  network.send(chat_msg.value);
  chat_msg.value = "";
};

dscnt_btn.onclick = () => {
  network.disconnect();
};

// -----------------------------------------------------------------------------------------------
// -----------------------------------------------------------------------------------------------

const cyrb53 = (str, seed = 0) => {
  if (!str) str = "";
  let h1 = 0xdeadbeef ^ seed,
    h2 = 0x41c6ce57 ^ seed;
  for (let i = 0, ch; i < str.length; i++) {
    ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
  h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
  h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);

  return 4294967296 * (2097151 & h2) + (h1 >>> 0);
};

function utilsGenerateColorFromString(str) {
  const hash = cyrb53(str);

  // Generate RGB values from the hash
  const r = (hash & 0xff0000) >> 16;
  const g = (hash & 0x00ff00) >> 8;
  const b = hash & 0x0000ff;

  // Construct the color string in hexadecimal format
  const color = `#${r.toString(16).padStart(2, "0")}${g
    .toString(16)
    .padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;

  return color;
}

// Copyright 2021 Observable, Inc.
// Released under the ISC license.
// https://observablehq.com/@d3/force-directed-graph
function ForceGraph(
  {
    nodes, // an iterable of node objects (typically [{id}, …])
    links, // an iterable of link objects (typically [{source, target}, …])
  },
  {
    nodeId = (d) => d.id, // given d in nodes, returns a unique identifier (string)
    nodeGroup, // given d in nodes, returns an (ordinal) value for color
    nodeGroups, // an array of ordinal values representing the node groups
    nodeTitle, // given d in nodes, a title string
    nodeFill = "currentColor", // node stroke fill (if not using a group color encoding)
    nodeStroke = "#fff", // node stroke color
    nodeStrokeWidth = 1.5, // node stroke width, in pixels
    nodeStrokeOpacity = 1, // node stroke opacity
    nodeRadius = 5, // node radius, in pixels
    nodeStrength,
    linkSource = ({ source }) => source, // given d in links, returns a node identifier string
    linkTarget = ({ target }) => target, // given d in links, returns a node identifier string
    linkStroke = "#999", // link stroke color
    linkStrokeOpacity = 0.6, // link stroke opacity
    linkStrokeWidth = 1.5, // given d in links, returns a stroke width in pixels
    linkStrokeLinecap = "round", // link stroke linecap
    linkStrength,
    colors = d3.schemeTableau10, // an array of color strings, for the node groups
    width = 640, // outer width, in pixels
    height = 400, // outer height, in pixels
    linkDist = 250,
    invalidation, // when this promise resolves, stop the simulation
  } = {}
) {
  // Compute values.
  const N = d3.map(nodes, nodeId).map(intern);
  const LS = d3.map(links, linkSource).map(intern);
  const LT = d3.map(links, linkTarget).map(intern);
  if (nodeTitle === undefined) nodeTitle = (_, i) => N[i];
  const T = nodeTitle == null ? null : d3.map(nodes, nodeTitle);
  const G = nodeGroup == null ? null : d3.map(nodes, nodeGroup).map(intern);
  const W =
    typeof linkStrokeWidth !== "function"
      ? null
      : d3.map(links, linkStrokeWidth);
  const L = typeof linkStroke !== "function" ? null : d3.map(links, linkStroke);

  // Replace the input nodes and links with mutable objects for the simulation.
  nodes = d3.map(nodes, (_, i) => ({
    id: N[i],
  }));
  links = d3.map(links, (_, i) => ({
    source: LS[i],
    target: LT[i],
  }));

  // Compute default domains.
  if (G && nodeGroups === undefined) nodeGroups = d3.sort(G);

  // Construct the scales.
  const color = nodeGroup == null ? null : d3.scaleOrdinal(nodeGroups, colors);

  // Construct the forces.
  const forceNode = d3.forceManyBody();
  const forceLink = d3
    .forceLink(links)
    .id(({ index: i }) => N[i])
    .distance(linkDist);
  if (nodeStrength !== undefined) forceNode.strength(nodeStrength);
  if (linkStrength !== undefined) forceLink.strength(linkStrength);

  const simulation = d3
    .forceSimulation(nodes)
    .force("link", forceLink)
    .force("charge", forceNode)
    .force("center", d3.forceCenter())
    .on("tick", ticked);

  const svg = d3
    .create("svg")
    .attr("width", width)
    .attr("height", height)
    .attr("viewBox", [-width / 2, -height / 2, width, height])
    .attr("style", "max-width: 100%; height: auto; height: intrinsic;");

  const link = svg
    .append("g")
    .attr("stroke", typeof linkStroke !== "function" ? linkStroke : null)
    .attr("stroke-opacity", linkStrokeOpacity)
    .attr(
      "stroke-width",
      typeof linkStrokeWidth !== "function" ? linkStrokeWidth : null
    )
    .attr("stroke-linecap", linkStrokeLinecap)
    .selectAll("line")
    .data(links)
    .join("line");

  const node = svg
    .append("g")
    .attr("fill", nodeFill)
    .attr("stroke", nodeStroke)
    .attr("stroke-opacity", nodeStrokeOpacity)
    .attr("stroke-width", nodeStrokeWidth)
    .selectAll("circle")
    .data(nodes)
    .join("circle")
    .attr("r", nodeRadius)
    .call(drag(simulation));

  if (W) link.attr("stroke-width", ({ index: i }) => W[i]);
  if (L) link.attr("stroke", ({ index: i }) => L[i]);

  // if (G) node.attr("fill", ({
  //     index: i
  // }) => color(G[i]));

  if (T)
    node.attr("fill", ({ index: i }) => utilsGenerateColorFromString(T[i]));

  if (T) node.append("title").text(({ index: i }) => T[i]);

  if (invalidation != null) invalidation.then(() => simulation.stop());

  function intern(value) {
    return value !== null && typeof value === "object"
      ? value.valueOf()
      : value;
  }

  function ticked() {
    link
      .attr("x1", (d) => d.source.x)
      .attr("y1", (d) => d.source.y)
      .attr("x2", (d) => d.target.x)
      .attr("y2", (d) => d.target.y);

    node.attr("cx", (d) => d.x).attr("cy", (d) => d.y);
  }

  function drag(simulation) {
    function dragstarted(event) {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      event.subject.fx = event.subject.x;
      event.subject.fy = event.subject.y;
    }

    function dragged(event) {
      event.subject.fx = event.x;
      event.subject.fy = event.y;
    }

    function dragended(event) {
      if (!event.active) simulation.alphaTarget(0);
      event.subject.fx = null;
      event.subject.fy = null;
    }

    return d3
      .drag()
      .on("start", dragstarted)
      .on("drag", dragged)
      .on("end", dragended);
  }

  return Object.assign(svg.node(), {
    scales: {
      color,
    },
  });
}

function d3VisualizeGossip() {
  const data = structuredClone(peers_db.get_all());

  // Create an array of nodes and links
  let nodes = [];
  let links = [];

  // Iterate through the data and create nodes and links
  for (let key in data) {
    // Add current node
    nodes.push({
      id: key,
      // id: key
    });

    // Add links from the current node to its connected nodes
    let connectedNodes = data[key];

    for (let connectedNode of connectedNodes) {
      // if (window.peerIdsToAlias[connectedNode]) {
      links.push({
        source: key,
        target: connectedNode,
        // source: key,
        // target: connectedNode
      });
      // }
    }
  }

  console.log(nodes, links);
  // console.log(nodes, links)

  const chart = ForceGraph(
    {
      nodes,
      links,
    },
    {
      nodeId: (d) => d.id,
      nodeGroup: (d) => d.group,
      nodeTitle: (d) => d.id,
      linkStrokeWidth: (l) => Math.sqrt(l.value),
      width: 600,
      height: 600,
      nodeRadius: 10,
      linkStrength: 0.1,
      invalidation: null, // a promise to stop the simulation when the cell is re-run
    }
  );

  return chart;
}
