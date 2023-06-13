function linearInitiate() {
    window.linear = {
        activeConnections: [],
        // peerChain: []
        globalMap: {}
    };

    window.peerIdsToAlias = {};
    window.peerIdsToAlias[window.peerId] = window.userAlias;
    window.onPeerAboutToClose = linearShutDown;
}

function linearCreateSelfPeersAliasList() {
    let peerList = [];
    for (const pid of window.linear.activeConnections) {
        peerList.push(pid.peer);
    }
    return peerList;
}

function linearPeerCloseConnection(conn) {
    console.log("conenction closed with " + conn.peer);
    window.linear.activeConnections.splice(window.linear.activeConnections.indexOf(conn), 1);
    // window.linear.peerChain.splice(window.linear.peerChain.indexOf(conn.peer), 1);
    delete window.peerIdsToAlias[conn.peer];
    // delete window.linear.globalMap[conn.peer];
    linearBroadcastSelfPeers();
    if (window.onUpdateGlobalMap) window.onUpdateGlobalMap();
}

function linearPeerConnectionPrepare(conn, isAccepted) {
    if (isAccepted) {
        if (linear.activeConnections.length < 2) {
            console.log(`Connection accepted with ${conn.peer}`);
            linear.activeConnections.push(conn);
        } else {
            console.log("2 Connections have already been formed");
            conn.close();
        }
    } else {
        if (linear.activeConnections.length < 1) {
            console.log(`Connection sent to ${conn.peer}`);
            linear.activeConnections.push(conn);
        } else {
            console.log("Connection has already been sent");
            conn.close();
        }
    }

    conn.on("close", () => { linearPeerCloseConnection(conn) });
    conn.on("data", (data) => {
        console.log(data);
        if (data && data.peerList) {
            console.log(`Updated peer list from :  ${conn.peer}`)
            window.linear.globalMap[data.source] = data.peerList;
            if (window.onUpdateGlobalMap) window.onUpdateGlobalMap();
        }
        else if (data && data.alias) {
            console.log(`Updated alias from : ${conn.peer} to ${data["alias"]}`);
            window.peerIdsToAlias[data.source] = data.alias;
        } else if (data && data.next) {
            console.log(`Peer ${conn.peer} dropped from chain, connecting to next peer`);
            window.linear.activeConnections.splice(window.linear.activeConnections.indexOf(conn), 1);
            linearTryConnectToPeer(data.next);
            return;
        }
        const conn2 = {peer: data.source};
        if (window.onLinearPeerConnectionData) window.onLinearPeerConnectionData(conn2, data);
        for (const pr of window.linear.activeConnections) {
            if (pr.peer === conn.peer) continue;
            pr.send(data);
        }
    });
    linearBroadcastMessage({ alias: window.userAlias }, conn.peer);
    linearBroadcastSelfPeers();

}


function linearTryConnectToPeer(pid) {
    if (pid === window.peerId) return;
    if(window.linear.activeConnections.length) return;
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
    for (const pid of pids) {
        if (window.linear.activeConnections.length) return;
        if (!linearIsConnectedTo(pid)) {
            linearTryConnectToPeer(pid);
        }
    }
}


function linearBroadcastMessage(message) {
    console.log("Broadcasting..."); console.log(message);
    for (const pr of window.linear.activeConnections) {
        // linear.activeConnections[1].send({ next: linear.activeConnections[0].peer });
        pr.send({
            source: window.peerId,
            ...message
        });

    }
}

function linearBroadcastSelfPeers() {
    window.linear.globalMap[window.peerId] = linearCreateSelfPeersAliasList();
    linearBroadcastMessage({ peerList: window.linear.globalMap[window.peerId] });
}

function linearShutDown() {
    console.log("Shutting Down...");
    try {
        if(linear.activeConnections.length > 1)
        {
            console.log("HOOOOOOOOOOO");
            linear.activeConnections[1].send({ next: linear.activeConnections[0].peer });
        }
    } catch (err) {
        console.error(err);
    }
}

function linearIsConnectedTo(pid) {
    for (let i = 0; i < window.linear.activeConnections.length ; i++) {
        if (window.linear.activeConnections[i].peer == pid) return true;
    }
    return false;
}