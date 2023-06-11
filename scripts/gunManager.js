function gunInitiate()
{
    const gun = Gun({
        peers: ['https://HerokuCoordinator.karmakarmeghdip.repl.co/gun']
    });
    window.gunRoot = gun.get("p2p-viz-test-1");
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