function loginIsUserLoggedIn() {
    return (localStorage.getItem("loginUsername") && localStorage.getItem("loginPassword"));
}

async function loginLogInUser(username, password) {
    // await gunLogin(username, password);
    localStorage.setItem("loginUsername", username);
    localStorage.setItem("loginPassword", password);
    window.userAlias = username;
}

async function loginCreateUser(username, password) {
    // await gunCreateAcccount(username, password);
}

async function loginLogOutUser() {
    if(loginIsUserLoggedIn()) {
        console.log("logging out user");
        localStorage.removeItem("loginUsername");
        localStorage.removeItem("loginPassword");
    }
}

function loginRedirectToLoginPage() {
    const query = "?source=" + encodeURI(window.location.href);
    window.location.href = window.location.host==='p2p-viz.github.io' ? '/p2p-viz/login.html':'/login.html' + query;
}

async function loginCheck() {
    if (!loginIsUserLoggedIn()) {
        console.log("user is not logged in!");
        loginRedirectToLoginPage();
    }
    else {
        await loginLogInUser(localStorage.getItem("loginUsername"), localStorage.getItem("loginPassword"));
    }
}