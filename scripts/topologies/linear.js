function linearInitiate() {
    window.linear = {
        activeConnections: [],
        // peerChain: []
    };

    window.peerIdsToAlias = {};
    window.peerIdsToAlias[window.peerId] = window.userAlias;
    window.onPeerAboutToClose = linearShutDown;
}

function linearCreateSelfPeersAliasList() {
    let peerList = [];
    for(const pid of window.linear.activeConnections) {
        peerList.push(pid.peer);
    }
    return peerList;
}

function linearPeerCloseConnection(conn) {
    // window.linear.activeConnections.splice(window.linear.activeConnections.indexOf(conn), 1);
    // window.linear.peerChain.splice(window.linear.peerChain.indexOf(conn.peer), 1);
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
        if(linear.activeConnections.length<1) {
            console.log(`Connection sent to ${ conn.peer }`);
            linear.activeConnections.push(conn);
        } else {
            console.log("Connection has already been sent");
        }
    }

    conn.on("close", () => { linearPeerCloseConnection(conn) });
    conn.on("data", (data) => {
        if(data && data.peerList) {
            console.log(`Updated peer list from :  ${conn.peer}`)
            window.mesh.globalMap[conn.peer] = data.peerList;
            if(window.onUpdateGlobalMap) window.onUpdateGlobalMap();
        }
        else if(data && data.alias) {
            console.log(`Updated alias from : ${ conn.peer } to ${ data["alias"] }`);
            window.peerIdsToAlias[conn.peer] = data["alias"];
        } else if(data && data.next) {
            console.log(`Peer ${conn.peer} dropped from chain, connecting to next peer`);
            window.linear.activeConnections.splice(window.linear.activeConnections.indexOf(conn), 1);
            linearTryConnectToPeer(data.next);
        }
        if(window.onLinearPeerConnectionData) window.onLinearPeerConnectionData(conn, data);
    });
    linearBroadcastMessage({ alias: window.userAlias }, conn.peer);
    linearBroadcastSelfPeers();
        
}

function onLinearPeerConnectionData(conn, data) {
    for (const pr of window.linear.activeConnections) {
        if(pr.peer===conn.peer) continue;
        pr.send(data);
    }
}

function linearTryConnectToPeer(pid) {
    if (pid === window.peerId) return;
    // if(window.linear.activeConnections.length) return;
    console.log("Trying to connect to : " + pid);
    let conn = window.peer.connect(pid);
    conn.on("open", () => { linearPeerConnectionPrepare(conn, false); });
}

function linearOnPeerNewConnection(conn) {
    console.log("Recieved connection request from : " + conn.peer);
    conn.on("open", () => {
        linearPeerConnectionPrepare(conn, true);
    });
}

function linearTryConnectToPeers(pids) {
    for(const pid of pids) {
        if(window.linear.activeConnections.length) return;
        if(!linearIsConnectedTo(pid)) {
            linearTryConnectToPeer(pid);
        }
    }
}

function linearOnNewPeersAdded() {
    linearBroadcastSelfPeers();
}

function linearBroadcastMessage(message)
{
    for (const pr of window.linear.activeConnections) {
        
        pr.send(message);
        
    }
}

function linearBroadcastSelfPeers()
{
    window.linear.globalMap[window.peerId] = linearCreateSelfPeersAliasList();
    linearBroadcastMessage({peerList: window.linear.globalMap[window.peerId]});
}