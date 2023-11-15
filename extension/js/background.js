// A static import is required in b/g scripts because they are executed in their own env
// not connected to the content scripts where wasm is loaded automatically
import initWasmModule, { hello_background, rebuild_playlist } from './wasm/wasm_mod.js';

console.log("Background started v16:42");

// values extracted from headers and spotify responses
// for passing onto WASM
let authHeaderValue = ""; // creds
let tokenHeaderValue = ""; // creds
let userUri = ""; // user ID
let userID = ""; // user ID

// a temp flag to stop multiple fetches
let fetching = false;

// run the wasm initializer before calling wasm methods
// the initializer is generated by wasm_pack
(async () => {
    await initWasmModule();
    hello_background();
})();

function onError(error) {
    console.error(`B/g error: ${error}`);
}

// Popup button handler
// Fetches the data from Spotify using the creds extracted earlier
chrome.runtime.onMessage.addListener(async (request, sender, sendResponse) => {
    console.log(`Popup message received: ${JSON.stringify(request)}, ${JSON.stringify(sender)}`);
    const playlistId = await getPlaylistIdFromCurrentTabUrl();

    if (authHeaderValue && tokenHeaderValue && !fetching) {
        fetching = true;
        await rebuild_playlist(authHeaderValue, tokenHeaderValue, playlistId, userUri)
        fetching = false;
    }
});

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


// Spoofs Spotify user details request to extract user ID
// It intercepts the original requests and sends a duplicate at the same time
// because I could not find an easy way of capturing the response content of the original request.
// Spotify will get 2 identical requests very close together.
chrome.webRequest.onBeforeSendHeaders.addListener(
    captureUserDetailsListener,
    { urls: ['https://api.spotify.com/v1/me'] },
    ["requestHeaders"]);

// Requests user details from Spotify to extract user ID
async function captureUserDetailsListener(details) {
    console.log("captureUserDetailsListener fired")
    // console.log(details)
    // console.log(details.tabId)

    // https://stackoverflow.com/questions/40888038/chrome-extension-how-to-remove-a-listener-on-chrome-webrequest-onbeforerequest
    chrome.webRequest.onBeforeSendHeaders.removeListener(captureUserDetailsListener)
    console.log("captureUserDetailsListener listener removed")

    // loop through all headers and grab the two we need
    // https://developer.mozilla.org/en-US/docs/Web/API/Headers
    const headers = new Headers();
    for (const header of details.requestHeaders) {
        headers.append(header.name, header.value)
    }

    // https://javascript.plainenglish.io/fetch-data-in-chrome-extension-v3-2b73719ffc0e
    const resp = await fetch('https://api.spotify.com/v1/me', {
        method: 'GET',
        headers: headers,
    });

    // store the creds in the session vars
    const respJson = await resp.json();
    // console.log(JSON.stringify(respJson));
    // {"display_name":"rimutaka","external_urls":{"spotify":"https://open.spotify.com/user/onebro.me"},"href":"https://api.spotify.com/v1/users/onebro.me","id":"onebro.me","images":[{"url":"https://i.scdn.co/image/ab67757000003b82cfd0d586af121bdac41f2c7b","height":64,"width":64},{"url":"https://i.scdn.co/image/ab6775700000ee85cfd0d586af121bdac41f2c7b","height":300,"width":300}],"type":"user","uri":"spotify:user:onebro.me","followers":{"href":null,"total":0},"country":"NZ","product":"premium","explicit_content":{"filter_enabled":false,"filter_locked":false},"email":"max@onebro.me","birthdate":"1979-05-01","policies":{"opt_in_trial_premium_only_market":false}}
    userUri = respJson.uri;
    userID = respJson.id;
    console.log("User URI / ID")
    console.log(userUri)
    console.log(userID)
}


// might need this later to grab user IDs
// chrome.cookies.get({ url: 'https://open.spotify.com', name: 'sp_t' },
//   function (cookie) {
//     if (cookie) {
//       console.log(cookie.value);
//     }
//     else {
//       console.log('Can\'t get cookie! Check the name!');
//     }
//   });

// might need this later to communicate with the content script
// chrome.tabs
//     .sendMessage(details.tabId, {
//         authHeaderValue: authHeaderValue,
//         tokenHeaderValue: tokenHeaderValue,
//     })
//     .catch(onError);

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
        console.log("Empty active tab URL")
        return undefined
    }

    const playlistId = tab.url.substring(34)
    console.log(`Playlist ID: ${playlistId}`)

    return playlistId
}