function linearInitiate() {
    window.linear = {
        activeConnections: [],
        peerChain: []
    };

    window.peerIdsToAlias = {};
    window.peerIdsToAlias[window.peerId] = window.userAlias;
}

function linearCreateSelfPeersAliasList() {
    let peerList = [];
    for(const pid of window.linear.activeConnections) {
        peerList.push(pid.peer);
    }
    return peerList;
}

function linearPeerCloseConnection(conn) {
    window.linear.activeConnections.splice(window.linear.activeConnections.indexOf(conn), 1);
    window.linear.peerChain.splice(window.linear.peerChain.indexOf(conn.peer), 1);
    delete window.peerIdsToAlias[conn.peer];
    delete window.linear.globalMap[conn.peer];
    linearBroadcastSelfPeers();
    if(window.onUpdateGlobalMap) window.onUpdateGlobalMap();
}

function linearPeerConnectionPrepare(conn, isAccepted) {
    if(isAccepted) {
        if(linear.activeConnections.length<2) {
            console.log(`Connection accepted with ${ conn.peer }`);
            linear.activeConnections.push(conn);
        } else {
            console.log("2 Connections have already been formed");
        }
    } else {
        
    }
}