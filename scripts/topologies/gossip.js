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
    if(window.onUpdateGlobalMap) window.onUpdateGlobalMap();
    
    gossipBroadcastMessage({ quiterId: conn.peer });
    // gossipBroadcastSelfPeers();

    if(window.gossip.activeConnections.length < window.gossip.maxConnections) {
        if(window.registerPeerForConenctions) await window.registerPeerForConenctions();
    }
    
    if(window.gossip.activeConnections.length == 0) {
        let activePeerList = {};
        if(window.getActivePeerList) activePeerList = await window.getActivePeerList();
        gossipTryConnectToPeers(activePeerList);
    }

}

async function gossipPeerConnectionPrepare(conn, isAccepted)
{
    if(gossipIsConnectedTo(conn.peer)) {
        console.log("cancelling redundant connection to : " + conn.peer);
        return;
    }
    window.gossip.activeConnections.push(conn);
    if(isAccepted) {
        console.log("accepted connection established with : " + conn.peer);
    }
    else {
        console.log("sent connection established with : " + conn.peer);
        gossipBroadcastMessage({ newJoinee: window.userAlias });        
    }

    conn.on("close", () => { gossipPeerCloseConnection(conn) });
    conn.on("data", (data) => {
        if(data && data.payload && data.payload.alias) {
            window.peerIdsToAlias[data.source] = data.payload.alias;
        }
        else if(data && data.payload && data.payload.quiterId) {
            if(window.peerIdsToAlias[data.payload.quiterId]) {
                console.log(window.peerIdsToAlias[data.payload.quiterId] + " quit the network");
                delete window.peerIdsToAlias[data.payload.quiterId];
                delete window.gossip.globalMap[data.payload.quiterId];
                gossipBroadcastSelfPeers();
                try { if(window.onUpdateGlobalMap) window.onUpdateGlobalMap();} catch(err) {}
            }
        }
        else if(data && data.payload && data.payload.newJoinee) {
            window.peerIdsToAlias[data.source] = data.payload.newJoinee;
            gossipBroadcastMessage({ alias: window.userAlias });
            gossipBroadcastSelfPeers();
            try { if(window.onUpdateGlobalMap) window.onUpdateGlobalMap();} catch(err) {}
        }
        else if(data && data.payload && data.payload.peerList) {
            window.gossip.globalMap[data.source] = data.payload.peerList;
            try { if(window.onUpdateGlobalMap) window.onUpdateGlobalMap();} catch(err) {}
        }
        
        
        const hash = cyrb53(JSON.stringify(data));
        
        if(window.onGossipPeerConnectionData && !window.gossip.forwardedMessages[hash]) {
            if(!data.target || data.target === window.peerId) {
                let conn2 = {peer: data.source};
                try { window.onGossipPeerConnectionData(conn2, data.payload); } catch(err) {}
            }
        }

        if(data.target !== window.peerID && data.source !== window.peerId) {
            if (window.gossip.forwardedMessages[hash] == undefined) {
                for (let i = 0; i < window.gossip.activeConnections.length ; i++) {
                    if(window.gossip.activeConnections[i].peer != conn.peer) {
                        window.gossip.activeConnections[i].send(data);
                    }
                }            
            }
            window.gossip.forwardedMessages[hash] = new Date();
        }
        

    }); 

    gossipBroadcastMessage({ alias: window.userAlias });
    gossipBroadcastSelfPeers();
    
    if(window.gossip.activeConnections.length > window.gossip.maxConnections) {
        if(window.deregisterPeerForConenctions) await window.deregisterPeerForConenctions();
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
    let possibleConnections = [];
    for (const pid in pids) {
        if(!gossipIsConnectedTo(pid) && pids[pid] && pids[pid] == true) {
            possibleConnections.push(pid);
        }
    }
    const targetConnections = _.sample(possibleConnections, Math.max(window.gossip.maxConnections - 1, 1));
    for(let i = 0; i < targetConnections.length ; i++) {
        gossipTryConnectToPeer(targetConnections[i]);
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

function gossipBroadcastSelfPeers() {
    window.gossip.globalMap[window.peerId] = gossipCreateSelfPeersAliasList();
    gossipBroadcastMessage({peerList: window.gossip.globalMap[window.peerId]});
}