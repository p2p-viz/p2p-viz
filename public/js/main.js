import p2pnet from '/js/p2pnet.js'

let network = p2pnet()

network.connect({
    host: "p2pnet.jaysmito.repl.co",
    port: 443,
    path: "/peerjs/ice"
}, "https://p2pnet.jaysmito.repl.co/channels/main", "mesh")

network.on("connect", (peer_id) => {
    console.log("Connected to network with id: " + peer_id)
})

network.on("disconnect", () => {
    console.log("Disconnected!")
});

console.log (network)