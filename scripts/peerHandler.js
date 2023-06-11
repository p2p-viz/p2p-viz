function onPeerOpen(id) {
    console.log("created peer with id : " + id);
    //gunAddPeerId(id);
    window.peerId = id;
    if(window.onPeerReady) window.onPeerReady(id);
}

function onPeerClose() {
    //gunRemovePeerId(window.peerId);
    delete window.peerId;
}

function onPeerConnection(conn) {
    
    if(window.onPeerNewConnection) window.onPeerNewConnection(conn);
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
    peer.on("connection", onPeerConnection);
    peer.on("close", onPeerClose);
    
    window.addEventListener("beforeunload", (e) => {
        window.peer.destroy();
        (e || window.event).returnValue = null;
        return null;
    });
        
    window.peer = peer;

    return peer;
}