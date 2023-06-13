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

    gossipBroadcastMessage({ quiterId: conn.peer });

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
            console.log(`updated peer list from :  ${data["source"]}`)
            window.gossip.globalMap[data["source"]] = data["payload"]["peerList"];
            if(window.onUpdateGlobalMap) window.onUpdateGlobalMap();
        }
        if(data && data["payload"] && data["payload"]["quiterId"]) {
            if(window.gossip[data["payload"]["quiterId"]])
            {
                delete window.gossip[data["payload"]["quiterId"]];
                delete window.peerIdsToAlias[data["payload"]["quiterId"]];
            }
        }
        else if(data && data["payload"] && data["payload"]["globalMap"]) {
            console.log("updating global map from " + data["source"]);
            const pidmp = data["payload"]["globalMap"];
            for(const item in pidmp) {
                window.gossip.globalMap[item] = pidmp[item];
            }
            const pidal = data["payload"]["pidToAlias"];
            for(const item in pidal) {
                window.peerIdsToAlias[item] = pidal[item];
            }
        }
        else if(data && data["payload"] && data["payload"]["alias"]) {
            console.log("updated alias from : " + data["source"] + " to " + data["payload"]["alias"]);
            window.peerIdsToAlias[data["source"]] = data["payload"]["alias"];
        }

        const hash = cyrb53(JSON.stringify(data));
        
        if(window.onGossipPeerConnectionData && window.gossip.forwardedMessages[hash] == undefined)
        {
            if(data["target"] == undefined || data["target"] == window.peerId)
            {
                let conn2 = {peer: data["source"]};
                window.onGossipPeerConnectionData(conn2, data["payload"]);
            }
        }

        if(data["target"] !== window.peerID) {
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

    conn.send({
        source: window.peerId,
        target: conn.peer,
        payload: {
            globalMap: window.gossip.globalMap,
            pidToAlias: window.peerIdsToAlias
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

function gossipBroadcastSelfPeers()
{
    window.gossip.globalMap[window.peerId] = gossipCreateSelfPeersAliasList();
    gossipBroadcastMessage({peerList: window.gossip.globalMap[window.peerId]});
}