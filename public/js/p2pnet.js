
function dispatchContextEvent(context, event, ...args) {
    const eventCallbacks = context.__on_callbacks[event];
    if (eventCallbacks) {
        for (const callback of eventCallbacks) {
            callback(...args);
        }
    }
}


function setupAutoPeerDestroy(context) {
    if(window && window.addEventListener && context.__peer) {
        window.addEventListener("beforeunload", (e) => {
            dispatchContextEvent(context, "pre_disconnect");
            context.__peer.destroy();
            (e || window.event).returnValue = null;
            return null;
        });
    }
}


function connectToIntermediateServer(context) {

    const ice_server = context.ice_server;

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
        dispatchContextEvent(context, "connect", id);
    });

    context.__peer.on("error", (err) => {
    });

    context.__peer.on("close", () => {
        dispatchContextEvent(context, "disconnect");        
    });

    context.__peer.on("connection", (connection) => {
    });
}

export default function p2pnet() {
    let context = {
        __on_callbacks: {},
        ice_server: "",
        channel: ""
    };


    context.on = (event, callback) => {
        if (!(event in context.__on_callbacks)) {
            context.__on_callbacks[event] = [];
        }
        context.__on_callbacks[event].push(callback);
    }

    context.connect = (ice_server, channel_url) => {
        if (context.__connected) {
            dispatchContextEvent(context, "error", "Already connected");
        }

        context.ice_server = ice_server;
        context.channel = channel_url;

        connectToIntermediateServer(context);
    }

    context.on('error', (message) => { console.error("p2pnet error: " + message) })


    return context;
};
