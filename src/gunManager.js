function gunInitiate() {
    const gun = Gun({
        peers: ['https://HerokuCoordinator.karmakarmeghdip.repl.co/gun']
    });
    window.gunRoot = gun.get("p2p-viz-test-5");
    window.gunUser = gun.user()
}

async function gunLogin(username, password) {
    return new Promise((resolve, reject) => {
        if (!username) reject("Username can't be empty")
        if (!password) reject("Password can't be empty")
        gunUser.auth(username, password, (ack) => {
            if (ack.err) reject(ack.err)
            // console.log(ack)
            resolve(ack)
        })
    })
}

async function gunCreateAcccount(username, password) {
    return new Promise((resolve, reject) => {
        if (!username) reject("Username can't be empty")
        if (!password) reject("Password can't be empty")
        gunUser.create(username, password, (ack) => {
            if (ack.err) reject(ack.err)
            // console.log(ack)
            resolve(ack)
        })
    })
}

function gunAddPeerId(peerId) {
    const alias = gunUser.is.alias
    gunUser.get("peerId").put(peerId)
    gunRoot.get("accepting").set(gunUser)
    gunRoot.get("not_accepting").unset(gunUser)
}

function gunRemovePeerId(peerId) {
    const alias = gunUser.is.alias
    gunRoot.get("accepting").unset(gunUser)
    gunRoot.get("not_accepting").set(gunUser)
}

function gunMaintainActivePeerIdsList(newPeerId = {}) {
    window.peerIds = newPeerId;

    gunRoot.get("accepting").map().on((us) => {
        if (!us) return;
        const alias = us.alias;
        window.peerIds[alias] = us.peerId;
        // console.log(us.alias, us.peerId)
        if (window.onGunUpdatePeerList) window.onGunUpdatePeerList();
    });

    gunRoot.get("not_accepting").map().on((us) => {
        if (!us) return;
        const alias = us.alias;
        delete window.peerIds[alias];
        if (window.onGunUpdatePeerList) window.onGunUpdatePeerList();
    });
}
