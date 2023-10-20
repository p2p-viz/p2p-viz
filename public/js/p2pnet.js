function dispatchContextEvent(context, event, ...args) {
    const eventCallbacks = context.__on_callbacks[event];
    if (eventCallbacks) {
        for (const callback of eventCallbacks) {
            callback(...args);
        }
    }
}

async function registerPeerToChannel(context) {
    const url = `https://p2pnet.jaysmito.repl.co/channels/main?peer_id=${context.__peer_id}&operation=deregister`
    const res = await fetch(url);
    return await res.json();
})
    

async function deregisterPeerFromChannel(context) {
    const url = `https://p2pnet.jaysmito.repl.co/channels/main?peer_id=${context.__peer_id}&operation=deregister`
    const res = await fetch(url);
    return await res.json();
}

function gossipNetworkManager(context)
{
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


    manager.onPeerConnect = (id) => {
        registPeerToChannel(context);
    };

    manager.onPeerError = (err) => {

    };

    manager.onPeerConnection = (conn) => {
        
    };

    manager.onPeerClose = () => {
        deregisterPeerFromChannel(context);
    };

    return manager;
}

function setupAutoPeerDestroy(context) {
    if (window && window.addEventListener && context.__peer) {
        window.addEventListener("beforeunload", (e) => {
            dispatchContextEvent(context, "pre_disconnect");
            context.__peer.destroy();
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
        dispatchContextEvent(context, "connect", id);
    });

    context.__peer.on("error", (err) => {
        context.__network_manager.onPeerError(err);
        dispatchContextEvent(context, "error", err);
    });

    context.__peer.on("close", () => {
        context.__network_manager.onPeerClose();
        context.__connected = false;
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

        if (network_manager == "gossip") {
            context.__network_manager = gossipNetworkManager(context);
        }
        else if(network_manager == "mesh") {
            context.__network_manager = meshNetworkManager(context);
        }
        else {
            dispatchContextEvent(context, "error", "Invalid network manager");
            return;
        }

        context.__network_manager = network_manager;
        context.__ice_server = ice_server;
        context.__channel = channel_url;

        connectToIntermediateServer(context);
    }

    context.on('error', (message) => { console.error("p2pnet error: " + message) })


    return context;
};
