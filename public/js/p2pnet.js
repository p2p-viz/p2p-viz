function dispatchContextEvent(context, event, ...args) {
    const eventCallbacks = context.__on_callbacks[event];
    if (eventCallbacks) {
        for (const callback of eventCallbacks) {
            callback(...args);
        }
    }
}

// https://stackoverflow.com/a/2450976/14911094
function shuffle(array) {
    let currentIndex = array.length, randomIndex;

    // While there remain elements to shuffle.
    while (currentIndex > 0) {

        // Pick a remaining element.
        randomIndex = Math.floor(Math.random() * currentIndex);
        currentIndex--;

        // And swap it with the current element.
        [array[currentIndex], array[randomIndex]] = [
            array[randomIndex], array[currentIndex]];
    }

    return array;
}

function cyrb53(str, seed = 0) {
    if (!str) str = "";
    let h1 = 0xdeadbeef ^ seed, h2 = 0x41c6ce57 ^ seed;
    for (let i = 0, ch; i < str.length; i++) {
        ch = str.charCodeAt(i);
        h1 = Math.imul(h1 ^ ch, 2654435761);
        h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
    h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
    h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);

    return 4294967296 * (2097151 & h2) + (h1 >>> 0);
}

async function registerPeerToChannel(context) {
    dispatchContextEvent(context, "register");
    dispatchContextEvent(context, "log", "Registering peer to channel");
    const url = `${context.__channel}?peer_id=${context.__peer_id}&operation=register`
    const res = await fetch(url);
    return await res.json();
}

async function deregisterPeerFromChannel(context) {
    dispatchContextEvent(context, "deregister");
    dispatchContextEvent(context, "log", "Deregistering peer from channel");
    const url = `${context.__channel}?peer_id=${context.__peer_id}&operation=deregister`
    const res = await fetch(url);
    return await res.json();
}

async function getPeersFromChannel(context) {
    const url = `${context.__channel}`
    const res = await fetch(url);
    return await res.json();
}

function preparePacket(context, message, messageType, targetPeer) {
    if (!messageType) {
        messageType = "general";
    }

    if (!message) {
        message = {};
    }

    let packet = {
        "payload": message,
        "type": messageType,
        "network_type": context.__network_manager_type,
        "sent_time": Date.now(),
        "source": context.__peer_id
    }

    if (targetPeer) {
        packet["target"] = targetPeer;
    }

    const hash = cyrb53(JSON.stringify(packet));
    packet["hash"] = hash;

    return packet;
}

function gossipNetworkManager(context) {
    let manager = {};

    manager.MAX_PEERS = 3;
    manager.MAX_HASHES_BUFFER = 256;
    manager.type = "gossip";
    manager.__is_registered = false;
    manager.__connected_peers = [];
    manager.__peer_connections = {};
    manager.__forwarded_hashes = [];

    manager.on_data = (data, peer) => {
        const hash = cyrb53(JSON.stringify(data));
        if (manager.__forwarded_hashes.indexOf(hash) != -1) {
            return;
        }

        if (data.source && data.source == context.__peer_id) {
            return;
        }

        manager.__forwarded_hashes.push(hash);
        if (manager.__forwarded_hashes.length >= manager.MAX_HASHES_BUFFER) {
            manager.__forwarded_hashes.splice(0, Math.ceil(manager.MAX_HASHES_BUFFER * 0.1))
        }

        dispatchContextEvent(context, "log", `Data recieved from immediate ${peer}`);
        if (data.type && data.type == "general") {
            dispatchContextEvent(context, "data", data, peer);
        }
        else if (data.type && data.type == "db") {
            context.__update_db(data);
        }
        else if (data.type && data.type == "node_ready") {
            dispatchContextEvent(context, "node_ready", data.payload.id);
            dispatchContextEvent(context, "log", `Connection to ${data.payload.id} ready`);
        }

        if (data.target && data.target == context.__peer_id) {
            return;
        }
        else if (data.target && context.__network_manager.__conntected_peers.indexOf(data.target) != -1) {
            dispatchContextEvent(context, "log", `Data forwarded to ${data.target}`);
            context.__network_manager.__peer_connections[data.target].send(data);
        }
        else {
            dispatchContextEvent(context, "log", `Data forwarded to all peers`);
            for (const peer of context.__network_manager.__connected_peers) {
                // if (peer == data.source) {
                //     continue;
                // }
                context.__network_manager.__peer_connections[peer].send(data);
            }
        }
    };


    manager.prepareConnection = async (conn, type) => {
        if (context.__network_manager.__connected_peers.indexOf(conn.peer) == -1) {

            if (manager.__connected_peers.length >= manager.MAX_PEERS) {
                conn.close();
                return;
            }

            context.__network_manager.__connected_peers.push(conn.peer);
            context.__network_manager.__peer_connections[conn.peer] = conn;

            if (manager.__connected_peers.length == manager.MAX_PEERS && context.__network_manager.__is_registered) {
                await deregisterPeerFromChannel(context);
                context.__network_manager.__is_registered = false;
            }

            conn.on('close', async (data) => {
                const index = context.__network_manager.__connected_peers.indexOf(conn.peer);
                if (index != -1) {
                    context.__network_manager.__connected_peers.splice(index, 1);
                }
                delete context.__network_manager.__peer_connections[conn.peer];

                if (manager.__connected_peers.length < manager.MAX_PEERS) {
                    let peersList = []
                    if (!context.__network_manager.__is_registered) {
                        context.__network_manager.__is_registered = true;
                        peersList = await registerPeerToChannel(context);
                    }
                    else {
                        peersList = await getPeersFromChannel(context);
                    }
                    context.__network_manager.try_connect_to_peers(peersList);
                }

                dispatchContextEvent(context, "node_disconnect", conn.peer, type);
                dispatchContextEvent(context, "log", `Connection to ${conn.peer} closed`);
            });

            conn.on('data', (data) => {
                context.__network_manager.on_data(data, conn.peer);
            });

            if (context.__dynamic_network) {
                setTimeout(() => {
                    conn.close();
                }, context.__dynamic_network_timeout ? context.__dynamic_network_timeout : 20000);
            }

            context.__network_manager.sendMessage({
                id: context.__peer_id
            }, "node_ready", conn.peer);

            dispatchContextEvent(context, 'node_connect', conn.peer, type);
            dispatchContextEvent(context, "log", `Connected to ${conn.peer} with conneciton type ${type}`);
        }
        else {
            conn.close();
        }
    };

    manager.tryConnectToPeers = async (peerList, numTries) => {
        if (manager.__connected_peers.length >= manager.MAX_PEERS * 0.5 || !context.__connected) {
            return;
        }

        shuffle(peerList);

        if (!numTries || (typeof numTries != "number")) {
            numTries = manager.MAX_PEERS * 0.5 - manager.__connected_peers.length;
        }

        for (const peer of peerList) {
            if (peer === context.__peer_id) {
                continue;
            }

            if (context.__network_manager.__connected_peers.indexOf(peer) == -1) {
                let conn = context.__peer.connect(peer);
                dispatchContextEvent(context, "log", `Connection sent to ${peer}`);
                conn.on('open', () => {
                    context.__network_manager.prepare_connection(conn, "sent");
                });

                conn.on('error', (err) => {
                    conn.close();
                    context.__network_manager.try_connect_to_peers(peerList);
                });
            }
            numTries -= 1;
            if (numTries <= 0) {
                break;
            }
        }
    };

    manager.onPeerConnect = async (id) => {
        context.__network_manager.__is_registered = true;
        const peersList = await registerPeerToChannel(context);
        await context.__network_manager.tryConnectToPeers(peersList);
    };

    manager.onPeerError = (err) => {

    };

    manager.onPeerConnection = (conn) => {
        dispatchContextEvent(context, "log", `Connection recieved from ${conn.peer}`);
        conn.on('open', (data) => {
            context.__network_manager.prepare_connection(conn, "recieved");
        })
    };

    manager.onPeerClose = async () => {
        if (context.__network_manager.__is_registered) {
            await deregisterPeerFromChannel(context);
            context.__network_manager.__is_registered = false;
        }
    };

    manager.sendMessage = (message, messageType, targetPeer) => {
        const data = preparePacket(context, message, messageType, targetPeer);

        const hash = cyrb53(JSON.stringify(data));
        manager.__forwarded_hashes.push(hash);

        if (targetPeer && context.__network_manager.__connected_peers.indexOf(targetPeer) != -1) {
            context.__network_manager.__peer_connections[targetPeer].send(data);
        }
        else {
            for (const peer of context.__network_manager.__connected_peers) {
                context.__network_manager.__peer_connections[peer].send(data);
            }
        }
    }


    return manager;
}

function meshNetworkManager(context) {
    let manager = {};

    manager.type = "mesh";
    manager.__connected_peers = [];
    manager.__peer_connections = {};

    manager.onData = (data, peer) => {
        dispatchContextEvent(context, "log", `Data recieved from immediate ${peer}`);


        if (data.type && data.type == "general") {
            dispatchContextEvent(context, "data", data, peer);
        }
        else if (data.type && data.type == "db") {
            context.__update_db(data);
        }
        else if (data.type && data.type == "node_ready") {
            dispatchContextEvent(context, "node_ready", data.payload.id);
            dispatchContextEvent(context, "log", `Connection to ${data.payload.id} ready`);
        }
    };

    manager.prepareConnection = (conn, type) => {
        if (context.__network_manager.__connected_peers.indexOf(conn.peer) == -1) {
            context.__network_manager.__connected_peers.push(conn.peer);
            context.__network_manager.__peer_connections[conn.peer] = conn;
            conn.on('close', (data) => {
                const index = context.__network_manager.__connected_peers.indexOf(conn.peer);
                if (index != -1) {
                    context.__network_manager.__connected_peers.splice(index, 1);
                }
                delete context.__network_manager.__peer_connections[conn.peer];
                dispatchContextEvent(context, "node_disconnect", conn.peer, type);
                dispatchContextEvent(context, "log", `Connection to ${conn.peer} closed`);
            });

            conn.on('data', (data) => {
                context.__network_manager.on_data(data, conn.peer);
            });

            context.__network_manager.sendMessage({
                id: context.__peer_id
            }, "node_ready", conn.peer);

            dispatchContextEvent(context, 'node_connect', conn.peer, type);
            dispatchContextEvent(context, "log", `Connected to ${conn.peer} with conneciton type ${type}`);
        }
        else {
            conn.close();
        }
    };

    manager.tryConnectToPeers = async (peerList) => {
        if (!context.__connected) {
            return;
        }

        for (const peer of peerList) {
            if (peer === context.__peer_id) {
                continue;
            }
            if (context.__network_manager.__connected_peers.indexOf(peer) == -1) {
                let conn = context.__peer.connect(peer);
                dispatchContextEvent(context, "log", `Connection sent to ${peer}`);
                conn.on('open', () => {
                    context.__network_manager.prepare_connection(conn, "sent");
                });
            }
        }
    };

    manager.onPeerConnect = async (id) => {
        const peersList = await registerPeerToChannel(context);
        await context.__network_manager.try_connect_to_peers(peersList);
    };

    manager.onPeerError = (err) => {
        // nothing todo here for now
    };

    manager.onPeerConnection = (conn) => {
        dispatchContextEvent(context, "log", `Connection recieved from ${conn.peer}`);
        conn.on('open', (data) => {
            context.__network_manager.prepare_connection(conn, "recieved");
        })
    };

    manager.onPeerClose = async () => {
        await deregisterPeerFromChannel(context);
    };

    manager.sendMessage = (message, message_type, target_peer) => {
        const data = preparePacket(context, message, message_type, target_peer);
        if (target_peer && context.__network_manager.__connected_peers.indexOf(target_peer) != -1) {
            context.__network_manager.__peer_connections[target_peer].send(data);
        }
        else {
            for (const peer of context.__network_manager.__connected_peers) {
                context.__network_manager.__peer_connections[peer].send(data);
            }
        }
    }

    return manager;
};

function setupAutoPeerDestroy(context) {
    if (window && window.addEventListener && context.__peer) {
        window.addEventListener("beforeunload", async (e) => {
            await dispatchContextEvent(context, "pre_disconnect");
            context.__peer.destroy();
            (e || window.event).returnValue = null;
            return null;
        });
    }
}

function connectToIntermediateServer(context) {

    const iceServer = context.__ice_server;

    if (!iceServer || !iceServer.host || !iceServer.port || !iceServer.path) {
        dispatchContextEvent(context, "error", "Invalid ICE server settings");
        return;
    }

    context.__peer = new Peer(undefined, {
        host: iceServer.host,
        port: iceServer.port,
        secure: (iceServer.port == 443),
        path: iceServer.path
    });

    setupAutoPeerDestroy(context);

    context.__peer.on("open", (id) => {
        context.__peer_id = id;
        context.__network_manager.onPeerConnect(id);
        context.__connected = true;
        dispatchContextEvent(context, "log", `Connected to the network ice server`);
        dispatchContextEvent(context, "connect", id);
    });

    context.__peer.on("error", (err) => {
        context.__network_manager.onPeerError(err);
        dispatchContextEvent(context, "error", err);
    });

    context.__peer.on("close", () => {
        context.__network_manager.onPeerClose();
        context.__connected = false;
        dispatchContextEvent(context, "log", `Disconnected from the network ice server`);
        dispatchContextEvent(context, "disconnect");
    });

    context.__peer.on("connection", (conn) => {
        context.__network_manager.onPeerConnection(conn);
    });
}

export default function p2pnet() {
    let context = {
        __on_callbacks: {}
    };


    context.on = (event, callback) => {
        if (!(event in context.__on_callbacks)) {
            context.__on_callbacks[event] = [];
        }
        context.__on_callbacks[event].push(callback);
    }

    context.connect = (iceServer, channelUrl, networkManager) => {
        if (context.__connected) {
            dispatchContextEvent(context, "error", "Already connected");
            return;
        }

        context._network_manager_type = networkManager;
        context.__ice_server = iceServer;
        context.__channel = channelUrl;

        if (networkManager == "gossip") {
            context.__network_manager = gossipNetworkManager(context);
        }
        else if (networkManager == "mesh") {
            context.__network_manager = meshNetworkManager(context);
        }
        else {
            dispatchContextEvent(context, "error", "Invalid network manager");
            return;
        }

        connectToIntermediateServer(context);
    }


    context.get_immediate_peers = () => {
        return context.__network_manager.__connected_peers;
    }

    context.send = (data, target_peer) => {
        context.__network_manager.sendMessage(data, "general", target_peer);
    }

    context.disconnect = async () => {
        await dispatchContextEvent(context, "pre_disconnect");
        context.__peer.destroy();
    }

    context.__dbs = {}

    context.__update_db = (data) => {
        const data_db = data.payload;

        if (!data_db) {
            return;
        }

        dispatchContextEvent(context, "log", `Update database ${data_db.name}`);

        const update_type = data_db.type;
        if (update_type == "create_db") {
            if (!context.has_db(data_db.name)) {
                context.__create_db(data_db.name)
            }
        }
        else if (update_type == "update_db") {
            if (!context.has_db(data_db.name)) {
                context.__create_db(data_db.name)
            }
            context.__dbs[data_db.name].__update(data_db.data);
        }
    }

    context.__create_db = (dbName) => {
        dispatchContextEvent(context, "log", `Create database ${dbName}`);

        let dbObj = {
            name: dbName,
            callbacks: {},
            data: {}
        };

        dbObj.__update = (data) => {
            dispatchContextEvent(context, "log", `Update database ${dbName}`);
            let updatedItems = {};

            for (const [key, value] of Object.entries(data)) {
                if (!(key in context.__dbs[dbName].data) && value.value != null) {
                    context.__dbs[dbName].data[key] = structuredClone(value);
                    updatedItems[key] = context.__dbs[dbName].data[key];
                }
                else {
                    const current_value = context.__dbs[dbName].data[key];
                    if (new Date(current_value.last_updated) < new Date(value.last_updated)) {
                        if (value.value == null) {
                            delete context.__dbs[dbName].data[key];
                        }
                        else {
                            context.__dbs[dbName].data[key] = structuredClone(value);
                            updatedItems[key] = context.__dbs[dbName].data[key];
                        }
                    }
                }
            }

            context.__dbs[dbName].__dispatch_callback("update", updatedItems);
        }

        dbObj.on = (event, callback) => {
            if (!(event in context.__dbs[dbName].callbacks)) {
                context.__dbs[dbName].callbacks[event] = [];
            }
            context.__dbs[dbName].callbacks[event].push(callback);
        }

        dbObj.__dispatch_callback = (event, ...args) => {
            if (!(event in dbObj.callbacks)) {
                return;
            }
            for (let callback of dbObj.callbacks[event]) {
                callback(...args);
            }
        }

        dbObj.set_many = (data) => {
            dispatchContextEvent(context, "log", `Set database ${dbName}`);
            for (const [key, value] of Object.entries(data)) {
                let data2 = {
                    value: structuredClone(value),
                    last_updated: new Date(),
                    last_updated_by: context.__peer_id
                };
                data[key] = data2;
                context.__dbs[dbName].data[key] = data2;
            }
            context.__dbs[dbName].__dispatch_callback("update", data);
            context.__network_manager.sendMessage({
                type: "update_db",
                name: dbName,
                data: data

            }, "db");
        }

        dbObj.set = (key, value) => {
            let data = {};
            data[key] = value;
            context.__dbs[dbName].set_many(data);
        }

        dbObj.get_raw = (key) => {
            if (typeof key != "string") {
                dispatchContextEvent(context, "error", "Key must be a string");
                return;
            }

            if (!(key in context.__dbs[dbName].data)) {
                return null;
            }

            return structuredClone(context.__dbs[dbName].data[key]);
        }

        dbObj.get = (key) => {
            const value = context.__dbs[dbName].get_raw(key);

            if (!value) {
                return null;
            }

            return value.value;
        }

        dbObj.get_all = () => {
            let dat = {};
            for (const [key, value] of Object.entries(context.__dbs[dbName].data)) {
                dat[key] = value.value;
            }
            return dat;
        }

        context.on("node_connect", (node_id) => {
            if (node_id == context.__peer_id) {
                return;
            }

            dispatchContextEvent(context, "log", `Share database ${dbName} with ${node_id}`);
            context.__network_manager.sendMessage({
                type: "update_db",
                name: dbName,
                data: context.__dbs[dbName].data
            }, "db", node_id);
        });

        context.__dbs[dbName] = dbObj;

        context.__network_manager.sendMessage({
            type: "create_db",
            name: dbName
        }, "db");

        return dbObj;
    }

    context.has_db = (db_name) => {
        return db_name in context.__dbs;
    }

    context.db = (name) => {
        if (name in context.__dbs) {
            return context.__dbs[name];
        }

        return context.__create_db(name);
    }

    context.get_peer_id = () => {
        return context.__peer_id;
    }

    context.on('error', (message) => { console.error("p2pnet error: " + message) })

    return context;
};
