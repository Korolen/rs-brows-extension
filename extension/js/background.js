// A static import is required in b/g scripts because they are executed in their own env
// not connected to the content scripts where wasm is loaded automatically
import initWasmModule, { hello_background, add_random_tracks } from './wasm/wasm_mod.js';

console.log("Background script started");

// values extracted from headers and spotify responses
// for passing onto WASM
let authHeaderValue = ""; // creds
let tokenHeaderValue = ""; // creds
let userUri = ""; // user ID
let userDetailsRequestHeaders = new Headers(); // a copy of Spotify headers to impersonate the user

// a temp flag to stop multiple fetches
let fetching = false;

// run the wasm initializer before calling wasm methods
// the initializer is generated by wasm_pack
(async () => {
    await initWasmModule();
    hello_background();
})();

// A placeholder for OnSuccess in .then
function onSuccess(message) {
    // console.log(`Send OK: ${JSON.stringify(message)}`);
}

// A placeholder for OnError in .then
function onError(error) {
    console.error(`Promise error: ${error}`);
}

// Popup button handler
// Fetches the data from Spotify using the creds extracted earlier
chrome.runtime.onMessage.addListener(async (request, sender, sendResponse) => {
    // console.log(`Popup message received: ${JSON.stringify(request)}, ${JSON.stringify(sender)}`);

    // check what kind of message it is and either log it or act on it
    if (request?.action == "btn_add") {
        // this is a check for the main action - let the code run its course after the completion of this if-block
        console.log(`User clicked btn_add`);
    }
    else {
        // this is an unexpected option - something is off and there is a bug
        console.error(`Unexpected popup.html message - it's a bug`);
        console.error(JSON.stringify(request));
        return;
    }

    // only one wasm should be running at a time
    // TODO: disable the button
    if (fetching) {
        chrome.runtime.sendMessage("Already running. Restart the browser if stuck on this message.").then(onSuccess, onError);
        return;
    }

    const playlistId = await getPlaylistIdFromCurrentTabUrl();

    // user ID is loaded first time the extension is invoked
    if (!userUri) {
        try {
            await fetchUserDetails()
        }
        catch {
            chrome.runtime.sendMessage("Error while fetching user details from Spotify. Reload the page and try again.").then(onSuccess, onError);
            return;
        }
    };

    // cannot proceed without userUri 
    if (!userUri) {
        chrome.runtime.sendMessage("Missing user details. Reload the page and try again.").then(onSuccess, onError);
        return;
    }

    // call the WASM code
    if (authHeaderValue && tokenHeaderValue && !fetching) {

        // indicate an active WASM process 
        fetching = true;

        toggleToolbarBadge();

        // call WASM
        add_random_tracks(authHeaderValue, tokenHeaderValue, playlistId, userUri).catch((e) => {
            console.error(e);
            chrome.runtime.sendMessage(JSON.stringify(e)).then(onSuccess, onError);
        }).finally(() => {
            // reset WASM, log to inactive and drop toolbar icon badge
            fetching = false;
            toggleToolbarBadge();
        })
    }
});

/// Sets the badge as per fetching var and notifies the popup about the status change
function toggleToolbarBadge() {
    chrome.action.setBadgeText(
        { text: (fetching) ? "..." : "" }
    ).then(onSuccess, onError)
    chrome.runtime.sendMessage(fetching).then(onSuccess, onError);
}

// Gets Spotify request headers from request details to extract creds
async function captureSessionToken(details) {

    console.log("captureSessionToken fired")
    // console.log(details)
    // console.log(details.tabId)

    // loop through all headers and grab the two we need
    for (const header of details.requestHeaders) {
        if (header.name == 'authorization') {
            authHeaderValue = header.value
            // console.log(authHeaderValue)
        }

        if (header.name == 'client-token') {
            tokenHeaderValue = header.value
            // console.log(tokenHeaderValue)
        }
    }
}

// A Spotify request interceptor to capture user creds
chrome.webRequest.onBeforeSendHeaders.addListener(captureSessionToken, { urls: ['https://api-partner.spotify.com/pathfinder/v1/query*'] }, ["requestHeaders"])


// Captures headers of Spotify user details request to extract user ID later when we need it
// It intercepts the original requests and stores the headers for a later replay
// because I could not find an easy way of capturing the response content of the original request.
chrome.webRequest.onBeforeSendHeaders.addListener(
    captureSpotifyHeaders,
    { urls: ['https://api-partner.spotify.com/pathfinder/v1/query?operationName=profileAndAccountAttributes*'] },
    ["requestHeaders"]);

// Requests user details from Spotify to extract user ID
async function captureSpotifyHeaders(requestDetails) {
    console.log("captureSpotifyHeaders fired")

    // https://stackoverflow.com/questions/40888038/chrome-extension-how-to-remove-a-listener-on-chrome-webrequest-onbeforerequest
    chrome.webRequest.onBeforeSendHeaders.removeListener(captureSpotifyHeaders)
    console.log("captureSpotifyHeaders listener removed")

    // loop through all headers and grab the two we need
    // https://developer.mozilla.org/en-US/docs/Web/API/Headers
    for (const header of requestDetails.requestHeaders) {
        userDetailsRequestHeaders.set(header.name, header.value)
    }
}

// Requests user details from Spotify to extract user ID
async function fetchUserDetails() {
    console.log("captureUserDetailsListener fired")

    // https://javascript.plainenglish.io/fetch-data-in-chrome-extension-v3-2b73719ffc0e
    const resp = await fetch('https://api-partner.spotify.com/pathfinder/v1/query?operationName=profileAndAccountAttributes&variables=%7B%7D&extensions=%7B%22persistedQuery%22%3A%7B%22version%22%3A1%2C%22sha256Hash%22%3A%22d6989ae82c66a7fa0b3e40775552e08fa6856b77af1b71863fdd7f2cffb5d4d4%22%7D%7D', {
        method: 'GET',
        headers: userDetailsRequestHeaders,
    });

    // store the creds in the session vars
    const respJson = await resp.json();
    // console.log(JSON.stringify(respJson));
    /*
        {
            "data": {
                "me": {
                    "profile": {
                        "uri": "spotify:user:onebro.me",
                        "username": "onebro.me",
                        "name": "rimutaka",
                        "avatar": {
                            "sources": [
                                {
                                    "url": "https://i.scdn.co/image/ab67757000003b82cfd0d586af121bdac41f2c7b"
                                },
                                {
                                    "url": "https://i.scdn.co/image/ab6775700000ee85cfd0d586af121bdac41f2c7b"
                                }
                            ]
                        }
                    },
                    "account": {
                        "attributes": {
                            "dsaModeEnabled": false,
                            "dsaModeAvailable": true,
                            "optInTrialPremiumOnlyMarket": false
                        }
                    }
                }
            },
            "extensions": {}
        }
    */
    userUri = respJson?.data?.me?.profile?.uri;
    console.log(`User URI: ${userUri}`)
}

// Performs the extension and UI initialization on install, which is when the extension is activated by the browser
// Uplifted from https://developer.chrome.com/docs/extensions/reference/action/#emulating-pageactions-with-declarativecontent
// requires declarativeContent permission
chrome.runtime.onInstalled.addListener(() => {
    // Page actions are disabled by default and enabled on select tabs
    chrome.action.disable();

    // Clear all rules to ensure only our expected rules are set
    chrome.declarativeContent.onPageChanged.removeRules(undefined, () => {
        // Declare a rule to enable the action on example.com pages
        let playlistPageRule = {
            conditions: [
                new chrome.declarativeContent.PageStateMatcher({
                    pageUrl: { hostSuffix: '.spotify.com', pathContains: 'playlist' },
                })
            ],
            actions: [new chrome.declarativeContent.ShowAction()],
        };

        // Finally, apply our new array of rules
        let rules = [playlistPageRule];
        chrome.declarativeContent.onPageChanged.addRules(rules);
        console.log("Button rule added")
    });
});

// Returns the playlist ID or undefined.
// The playlist is at the end of the URL
// https://open.spotify.com/playlist/3h9rkMXa434AeAIDdA5Dd2
async function getPlaylistIdFromCurrentTabUrl() {

    let queryOptions = { active: true, currentWindow: true };
    let [tab] = await chrome.tabs.query(queryOptions);
    // console.log(JSON.stringify(tab));

    if (!tab || !tab.url) {
        chrome.runtime.sendMessage("Cannot get playlist tab URL. Reload the page and try again.").then(onSuccess, onError);
        console.log("Empty active tab URL")
        return undefined
    }

    const playlistId = tab.url.substring(34)
    console.log(`Playlist ID: ${playlistId}`)

    return playlistId
}