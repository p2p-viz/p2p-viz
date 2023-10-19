const express = require("express");
const { ExpressPeerServer } = require("peer");

const app = express();

app.get("/", (req, res, next) => res.redirect('https://github.com/p2p-viz/p2p-viz'));

const server = app.listen(3000);

const peerServer = ExpressPeerServer(server, {
    path: "/ice",
});

app.use("/peerjs", peerServer);

app.use(express.static('public'));

