function dispatchContextEvent(context, event, ...args) {
    const eventCallbacks = context.__on_callbacks[event];
    if (eventCallbacks) {
        for (const callback of eventCallbacks) {
            callback(...args);
        }
    }
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

function preparePacket(context, message, message_type, target_peer) {
    if (!message_type) {
        message_type = "general";
    }

    if (!message) {
        message = {};
    }
    
    let packet = {
        "payload": message,
        "type": message_type,
        "network_type": context.__network_manager_type,
        "sent_time": Date.now(),
        "source": context.__peer_id
    }
    
    if (target_peer) {
        packet["target"] = target_peer;
    }
    
    // Add some sort of message hash maybe??
    
    return packet;
}

function gossipNetworkManager(context) {
    let manager = {};

    manager.onPeerConnect = (id) => {

    };

    manager.onPeerError = (err) => {

    };

    manager.onPeerConnection = (conn) => {

    };

    manager.onPeerClose = () => {

    };


    return manager;
}

function meshNetworkManager(context) {
    let manager = {};

    manager.__connected_peers = [];
    manager.__peer_connections = {};

    manager.on_data = (data, peer) => {
        dispatchContextEvent(context, "log", `Data recieved from immediate ${peer}`);
        if (data.type && data.type == "general") {
            dispatchContextEvent(context, "data", data, peer);
        }
        else if (data.type && data.type == "db") {
            context.__update_db(data);
        }
    };

    manager.prepare_connection = (conn, type) => {
        if (!(conn.peer in context.__network_manager.__connected_peers)) {
            context.__network_manager.__connected_peers.push(conn.peer);
            context.__network_manager.__peer_connections[conn.peer] = conn;
            conn.on('close', (data) => {
                dispatchContextEvent(context, "node_disconnect", conn.peer, type);
                dispatchContextEvent(context, "log", `Connection to ${conn.peer} closed`);
                const index = context.__network_manager.__connected_peers.indexOf(conn.peer);
                if (index != -1) {
                    context.__network_manager.__connected_peers.splice(index, 1);
                }
                delete context.__network_manager.__peer_connections[conn.peer];
            });

            conn.on('data', (data) => {
                context.__network_manager.on_data(data, conn.peer);
            });
            dispatchContextEvent(context, 'node_connect', conn.peer, type);
            dispatchContextEvent(context, "log", `Connected to ${conn.peer} with conneciton type ${type}`);
        }
        else {
            conn.close();
        }
    };

    manager.try_connect_to_peers = (peerList) => {
        for (const peer of peerList) {
            if (peer === context.__peer_id) {
                continue;
            }
            if (!(peer in context.__network_manager.__connected_peers)) {
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
        context.__network_manager.try_connect_to_peers(peersList);
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
            context.__peer.destroy();
            await dispatchContextEvent(context, "pre_disconnect");
            (e || window.event).returnValue = null;
            return null;
        });
    }
}

function connectToIntermediateServer(context) {

    const ice_server = context.__ice_server;

    if (!ice_server || !ice_server.host || !ice_server.port || !ice_server.path) {
        dispatchContextEvent(context, "error", "Invalid ICE server settings");
        return;
    }

    context.__peer = new Peer(undefined, {
        host: ice_server.host,
        port: ice_server.port,
        secure: (ice_server.port == 443),
        path: ice_server.path
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

    context.connect = (ice_server, channel_url, network_manager) => {
        if (context.__connected) {
            dispatchContextEvent(context, "error", "Already connected");
            return;
        }

        context._network_manager_type = network_manager;
        context.__ice_server = ice_server;
        context.__channel = channel_url;

        if (network_manager == "gossip") {
            context.__network_manager = gossipNetworkManager(context);
        }
        else if (network_manager == "mesh") {
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

    context.__dbs = {}

    context.__update_db = (data) => {
        const data_db = data.payload;

        if(!data_db) {
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

    context.__create_db = (db_name) => {
        dispatchContextEvent(context, "log", `Create database ${db_name}`);
        
        let db_obj = {
            name: db_name,
            callbacks: {},
            data: {}
        };

        db_obj.__update = (data) => {
            dispatchContextEvent(context, "log", `Update database ${db_name}`);
            context.__dbs[db_name].__dispatch_callback("update", data);

            for (const [key, value] of Object.entries(data)) {
                if (!(key in context.__dbs[db_name].data)) {
                    context.__dbs[db_name].data[key] = structuredClone(value);
                }
                else {
                    const current_value = context.__dbs[db_name].data[key];
                    if(new Date(current_value.last_updated) < new Date(value.last_updated)) {
                        context.__dbs[db_name].data[key] = structuredClone(value);
                    }
                }
            }
            
        }

        db_obj.on = (event, callback) => {
            if (!(event in context.__dbs[db_name].callbacks)) {
                context.__dbs[db_name].callbacks[event] = [];
            }
            context.__dbs[db_name].callbacks[event].push(callback);
        }

        db_obj.__dispatch_callback = (event, ...args) => {
            if (!(event in db_obj.callbacks)) {
                return;
            }
            for (let callback of db_obj.callbacks[event]) {
                callback(...args);
            }
        }

        db_obj.set_many = (data) => {
            dispatchContextEvent(context, "log", `Set database ${db_name}`);
            for (const [key, value] of Object.entries(data)) {
                let data2 = {
                    value: structuredClone(value),
                    last_updated: new Date(),
                    last_updated_by: context.__peer_id
                };
                data[key] = data2;
                context.__dbs[db_name].data[key] = data2;
            }
            context.__dbs[db_name].__dispatch_callback("update", data);
            context.__network_manager.sendMessage({
                type: "update_db",
                name: db_name,
                data: data
            
            }, "db");
        }

        db_obj.set = (key, value) => {
            let data = {};
            data[key] = value;
            context.__dbs[db_name].set_many(data);
        }
        
        db_obj.get_raw = (key) => {
            if (typeof key != "string") {
                dispatchContextEvent(context, "error", "Key must be a string");
                return;
            }

            if (!(key in context.__dbs[db_name].data)) {
                return null;
            }

            return structuredClone(context.__dbs[db_name].data[key]);
        }

        db_obj.get = (key) => {
            const value = context.__dbs[db_name].get_raw(key);
            
            if (!value) {
                return null;
            }

            return value.value;
        }

        context.on("node_connect", (node_id) => {
            if (node_id == context.__peer_id) {
                return;
            }

            dispatchContextEvent(context, "log", `Share database ${db_name} with ${node_id}`);
            context.__network_manager.sendMessage({
                type: "update_db",
                name: db_name,
                data: context.__dbs[db_name].data
            }, "db", node_id);
        });

        context.__dbs[db_name] = db_obj;

        context.__network_manager.sendMessage({
            type: "create_db",
            name: db_name
        }, "db");
        
        return db_obj;
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
    
    context.on('error', (message) => { console.error("p2pnet error: " + message) })
    
    return context;
};
