const express = require("express");
const { ExpressPeerServer } = require("peer");

const app = express();

let active_peers = {}
let channels = {}

app.get("/", (req, res, next) => res.redirect('https://github.com/p2p-viz/p2p-viz'))

const server = app.listen(3000)

const peer_server = ExpressPeerServer(server, {
    path: "/ice",
});

peer_server.on("connection", (peer) => {
    console.log("connection", peer.id)
    active_peers[peer.id] = []

    peer.socket._socket.on("close", () => {
        console.log("disconnect", peer.id)
        peer_channels = active_peers[peer.id]
        for (let i = 0; i < peer_channels.length; i++) {
            let channel = peer_channels[i]
            if (channels[channel]) {
                var index = channels[channel].indexOf(peer.id)
                if (index !== -1) {
                    channels[channel].splice(index, 1)
                }
            }
        }
        delete active_peers[peer.id]
    })
})

app.use("/peerjs", peer_server)

app.use(express.static('public'))

app.get("/channels/:channel_id", (req, res) => {
    const channel_id = req.params.channel_id;
    const peer_id = req.query.peer_id;
    const operation = req.query.operation ? req.query.operation : "register";

    if (peer_id && active_peers[peer_id]) {
        if (operation == "register") {
            if (!channels[channel_id]) {
                channels[channel_id] = []
            }
            if (!channels[channel_id].includes(peer_id)) {
                active_peers[peer_id].push(channel_id)
                channels[channel_id].push(peer_id)
            }
        }
        else if (operation == "deregister") {
            if (!channels[channel_id]) {
                res.status(404).send("Channel not found")
                return
            }
            var index = channels[channel_id].indexOf(peer_id);
            if (index !== -1) {
                channels[channel_id].splice(index, 1);
            }
            if (channels[channel_id].length == 0) {
                delete channels[channel_id]
            }

            index = active_peers[peer_id].indexOf(channel_id);
            if (index !== -1) {
                active_peers[peer_id].splice(index, 1);
            }
        }
    }

    res.send(channels[channel_id] ? channels[channel_id] : [])
})

app.get('/p', (req, res) => res.json(active_peers))