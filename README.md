# P2P-Net

## Introduction
It is a simplistic implementation of the Gossip and Mesh protocol as an easy to use library, which can be imported as a npm lib or via a CDN link

## Examples
```
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
```