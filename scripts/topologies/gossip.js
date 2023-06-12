function gossipInitiate() {
    window.gossip = {
        activeConnections : [],
        globalMap: {},
        forwardedMessages: {},
        maxConnections: 3
    };

    window.peerIdsToAlias = {};
    window.peerIdsToAlias[window.peerId] = window.userAlias;
}

function gossipCreateSelfPeersAliasList() {
    let peerList = [];
    for(const pid of window.gossip.activeConnections) {
        peerList.push(pid.peer);
    }
    return peerList;
}

function gossipIsConnectedTo(pid) {
    for (let i = 0; i < window.gossip.activeConnections.length ; i++) {
        if (window.gossip.activeConnections[i].peer == pid) return true;
    }
    return false;
}

async function gossipPeerCloseConnection(conn)
{
    window.gossip.activeConnections.splice(window.gossip.activeConnections.indexOf(conn), 1);
    console.log("connection closed with : " + conn.peer);
    delete window.peerIdsToAlias[conn.peer];
    delete window.gossip.globalMap[conn.peer];
    gossipBroadcastSelfPeers();
    if(window.onUpdateGlobalMap) window.onUpdateGlobalMap();

    if(window.gossip.activeConnections.length <= window.gossip.maxConnections - 2) {
        // register back to list and try connect to others
    }
    else if(window.gossip.activeConnections.length <= window.gossip.maxConnections - 1) {
        // register back to list
    }
}

function gossipPeerConnectionPrepare(conn, isAccepted)
{
    if(isAccepted)
    {
        window.gossip.activeConnections.push(conn);
        console.log("accepted connection established with : " + conn.peer);
    }
    else
    {
        if(gossipIsConnectedTo(conn.peer)) 
        {
            console.log("cancelling redundant connection to : " + conn.peer);
            return;
        }
        window.gossip.activeConnections.push(conn);
        console.log("sent connection established with : " + conn.peer);
    }


    conn.on("close", () => { gossipPeerCloseConnection(conn) });
    conn.on("data", (data) => {
        if(data && data["payload"] && data["payload"]["peerList"]) {
            console.log(`updated peer list from :  ${data["payload"]["source"]}`)
            window.gossip.globalMap[data["source"]] = data["payload"]["peerList"];
            if(window.onUpdateGlobalMap) window.onUpdateGlobalMap();
        }
        else if(data && data["payload"] && data["payload"]["alias"]) {
            console.log("updated alias from : " + data["source"] + " to " + data["payload"]["alias"]);
            window.peerIdsToAlias[data["source"]] = data["payload"]["alias"];
            // this means a new user registered on chain
            gossipBroadcastSelfPeers();
        }

        const hash = cyrb53(JSON.stringify(data));
        if (window.gossip.forwardedMessages[hash] == undefined) {
            for (let i = 0; i < window.gossip.activeConnections.length ; i++) {
                if(window.gossip.activeConnections[i].peer != conn.peer) {
                    window.gossip.activeConnections[i].send(data);
                }
            }            
        }
        window.gossip.forwardedMessages[hash] = new Date();
        
        if(window.onGossipPeerConnectionData)
        {
            if(data["target"] == undefined || data["target"] == window.peerId)
            {
                let conn2 = {peer: data["source"]};
                window.onGossipPeerConnectionData(conn2, data["payload"]);
            }
        }

    }); 

    gossipBroadcastMessage({ alias: window.userAlias });
    gossipBroadcastSelfPeers();

    if(window.gossip.activeConnections.length > window.gossip.maxConnections) {
        // derigister from list
    }
}

function gossipTryConnectToPeer(pid) {
    if (pid === window.peerId) return;
    console.log("trying to connect to : " + pid);
    let conn = window.peer.connect(pid);
    conn.on("open", () => { gossipPeerConnectionPrepare(conn, false); });
}


function gossipOnPeerNewConnection(conn) {
    console.log("recieved connection request from : " + conn.peer);
    conn.on("open", () => {
        gossipPeerConnectionPrepare(conn, true);
    });
}

function gossipTryConnectToPeers(pids) {
    for (let i = 0 ; i < pids.length ; i++) {
        if(!gossipIsConnectedTo(pids[i])) {
            gossipTryConnectToPeer(pids[i]);
        }
    }
}


function gossipBroadcastMessage(message, targetPeer = undefined)
{
    const data = {
        source: window.peerId,
        target: targetPeer,
        payload: message,
        timestamp: new Date().toISOString()
    };
    for (let i = 0; i < window.gossip.activeConnections.length ; i++) {
        window.gossip.activeConnections[i].send(data);
    }
}

function gossipBroadcastSelfPeers()
{
    window.gossip.globalMap[window.peerId] = gossipCreateSelfPeersAliasList();
    gossipBroadcastMessage({peerList: window.gossip.globalMap[window.peerId]});
}