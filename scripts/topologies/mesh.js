function meshInitiate() {
    window.mesh = {
        activeConnections : [],
        globalMap: {}
    };

    window.peerIdsToAlias = {};
    window.peerIdsToAlias[window.peerId] = window.userAlias;
}

function meshCreateSelfPeersAliasList() {
    let peerList = [];
    for(const pid of window.mesh.activeConnections) {
        peerList.push(pid.peer);
    }
    return peerList;
}

function meshIsConnectedTo(pid) {
    for (let i = 0; i < window.mesh.activeConnections.length ; i++) {
        if (window.mesh.activeConnections[i].peer == pid) return true;
    }
    return false;
}

function meshPeerCloseConnection(conn)
{
    window.mesh.activeConnections.splice(window.mesh.activeConnections.indexOf(conn), 1);
    console.log("connection closed with : " + conn.peer);
    delete window.peerIdsToAlias[conn.peer];
    delete window.mesh.globalMap[conn.peer];
    meshBroadcastSelfPeers();
    if(window.onUpdateGlobalMap) window.onUpdateGlobalMap();
}

function meshPeerConnectionPrepare(conn, isAccepted)
{
    if(isAccepted)
    {
        mesh.activeConnections.push(conn);
        console.log("accepted connection established with : " + conn.peer);
    }
    else
    {
        if(meshIsConnectedTo(conn.peer)) 
        {
            console.log("cancelling redundant connection to : " + conn.peer);
            return;
        }
        window.mesh.activeConnections.push(conn);
        console.log("sent connection established with : " + conn.peer);
    }


    conn.on("close", () => { meshPeerCloseConnection(conn) });
    conn.on("data", (data) => {
        if(data && data["peerList"]) {
            console.log(`updated peer list from :  ${conn.peer}`)
            window.mesh.globalMap[conn.peer] = data["peerList"];
            if(window.onUpdateGlobalMap) window.onUpdateGlobalMap();
        }
        else if(data && data["alias"]) {
            console.log("updated alias from : " + conn.peer + " to " + data["alias"]);
            window.peerIdsToAlias[conn.peer] = data["alias"];
        }
        if(window.onMeshPeerConnectionData) window.onMeshPeerConnectionData(conn, data);
    }); 

    meshBroadcastMessage({ alias: window.userAlias }, conn.peer);
    meshBroadcastSelfPeers();
}

function meshTryConnectToPeer(pid) {
    if (pid === window.peerId) return;
    console.log("trying to connect to : " + pid);
    let conn = window.peer.connect(pid);
    conn.on("open", () => { meshPeerConnectionPrepare(conn, false); });
}


function meshOnPeerNewConnection(conn) {
    console.log("recieved connection request from : " + conn.peer);
    conn.on("open", () => {
        meshPeerConnectionPrepare(conn, true);
    });
}

function meshTryConnectToPeers(pids) {
    for (let i = 0 ; i < pids.length ; i++) {
        if(!meshIsConnectedTo(pids[i])) {
            meshTryConnectToPeer(pids[i]);
        }
    }
}

function meshOnNewPeersAdded() {
    meshBroadcastSelfPeers();
}

function meshBroadcastMessage(message, targetPeer = undefined)
{
    for (let i = 0; i < window.mesh.activeConnections.length ; i++) {
        if (!targetPeer || (window.mesh.activeConnections[i].peer === targetPeer)) {
            window.mesh.activeConnections[i].send(message);
        }
    }
}

function meshBroadcastSelfPeers()
{
    window.mesh.globalMap[window.peerId] = meshCreateSelfPeersAliasList();
    meshBroadcastMessage({peerList: window.mesh.globalMap[window.peerId]});
}