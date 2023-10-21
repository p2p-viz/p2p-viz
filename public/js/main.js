import p2pnet from '/js/p2pnet.js'

let chat_body = document.getElementById("chat_body")
let chat_msg = document.getElementById("chat_msg")
let chat_btn = document.getElementById("chat_btn")

chat_msg.disabled = chat_btn.disabled = true

window.network = p2pnet()

network.connect({
    host: "p2pnet.jaysmito.repl.co",
    port: 443,
    path: "/peerjs/ice"
}, "https://p2pnet.jaysmito.repl.co/channels/main", "mesh")

network.on("connect", (peer_id) => {
    chat_msg.disabled = chat_btn.disabled = false
    chat_body.innerHTML += `<p>joined as ${peer_id}</p>`
})

network.on("log", (msg) => {
    console.log(msg)
});

network.on("data", (data) => {
    chat_body.innerHTML += `<p>${data.source}: ${data.payload}</p>`
})

network.on("node_connect", (node_id) => {
    chat_body.innerHTML += `<p>${node_id} joined</p>`
})

network.on("node_disconnect", (node_id) => {
    chat_body.innerHTML += `<p>${node_id} left</p>`
})

chat_btn.onclick = () => {
    chat_body.innerHTML += `<p>${chat_msg.value}</p>`
    network.send(chat_msg.value)
    chat_msg.value = ""
}