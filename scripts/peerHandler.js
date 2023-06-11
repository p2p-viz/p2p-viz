function onPeerOpen(id) {
    console.log("created peer with id : " + id);
    gunAddPeerId(id);
    window.peerId = id;
}

function onPeerClose() {
    gunRemovePeerId(window.peerId);
    delete window.peerId;
}

function onPeerConnection(conn) {

}

function peerCreate(iceServerHost, iceServerPort, iceServerPath) {
    console.log("trying to create peer")
    var peer = new Peer(undefined, {
        host: iceServerHost,
        port: iceServerPort,
        secure: (iceServerPort == 443),
        path: iceServerPath
    });

    peer.on("open", onPeerOpen);
    peer.on("close", onPeerClose);
    peer.on("connection", onPeerConnection);
    window.addEventListener("beforeunload", (e) => {
        gunRemovePeerId(window.peerId);
        window.peerHandler.peer.destroy();
        (e || window.event).returnValue = null;
        return null;
    });
        
    window.peer = peer;

    return peer;
}