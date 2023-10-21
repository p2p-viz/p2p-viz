import p2pnet from '/js/p2pnet.js'

let chat_body = document.getElementById("chat_body")
let chat_msg = document.getElementById("chat_msg")
let chat_btn = document.getElementById("chat_btn")
let dscnt_btn = document.getElementById("dcnt_btn")
let js_body = document.getElementById("json")

chat_msg.disabled = chat_btn.disabled = true

window.network = p2pnet()

network.connect({
    host: "p2pnet.jaysmito.repl.co",
    port: 443,
    path: "/peerjs/ice"
}, "https://p2pnet.jaysmito.repl.co/channels/main", "gossip")

network.on("connect", (peer_id) => {
    chat_msg.disabled = chat_btn.disabled = false
    chat_body.innerHTML += `<p>joined as ${peer_id}</p>`
})

// this line makes the gossip network change every 5 seconds
network.__dynamic_network = true;

network.on("log", (msg) => {
    console.log(msg)
});

network.on("data", (data) => {
    chat_body.innerHTML += `<p>${data.source}: ${data.payload}</p>`
})

network.on("node_connect", (node_id) => {
    // chat_body.innerHTML += `<p>${node_id} joined</p>`
    // js_body.textContent = JSON.stringify(network.__network_manager.__connected_peers, undefined, 2)
    peers_db.set(network.get_peer_id(), network.get_immediate_peers())
})

network.on("node_disconnect", (node_id) => {
    // chat_body.innerHTML += `<p>${node_id} left</p>`
    // js_body.js_body.textContent = JSON.stringify(network.__network_manager.__connected_peers, undefined, 2)
    peers_db.set(network.get_peer_id(), network.get_immediate_peers())
})

const peers_db = network.db("peers_table");

peers_db.on("update", () => {
    js_body.textContent = JSON.stringify(peers_db.get_all(), undefined, 2)
})


chat_btn.onclick = () => {
    chat_body.innerHTML += `<p>${chat_msg.value}</p>`
    network.send(chat_msg.value)
    chat_msg.value = ""
}

dscnt_btn.onclick = () => {
    network.disconnect()
}