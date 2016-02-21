// *** utilities

function getTimestamp() {
    return Math.floor((new Date().getTime()) / 1000);
}

// *** db

var MAX_CACHE = 60 * 60 * 24 * 7;  // 7 days


function storeRecord(message) {
    var pinboard_id = message['pinboard_id'];
    var data = message['data'];
    chrome.storage.local.set({pinboard_id: JSON.stringify(data)});
}

function getRecord(tab_id, message) {
    var pinboard_id = message['pinboard_id'];

    chrome.storage.local.get(pinboard_id,
        function (items) {
            if (items.hasOwnProperty(pinboard_id)) {
                var parsed_data = JSON.parse(items[pinboard_id]);
                var now = getTimestamp();
                if ((parsed_data['cached'] + MAX_CACHE) > now) {
                    msg_data = {'id': pinboard_id, 'data': parsed_data}
                    chrome.tabs.sendMessage(tab_id, msg_data);
                    return true;
                } else {
                    // old record;
                    // cleanup to save us some effort next time anyone tries this key again...
                    chrome.storage.local.remove(pinboard_id);
                }
            } else {
                // nothing found
                var msg_data = {'pinboard_id': pinboard_id, 'data': null};
                chrome.tabs.sendMessage(tab_id, msg_data);
            }
        }
    );

}

function msgRouter(message, sender, sendResponse) {
    if (message['action'] == 'get') {
        getRecord(sender.tab.id, message);
    } else if (message['action'] == 'set') {
        storeRecord(message);
    }
}

chrome.runtime.onMessage.addListener(msgRouter);


function flushCache() {
    chrome.storage.local.clear(
        function () {
            console.log("Cleared HackerCreep cache");
        }
    )
}
// uncomment to flush entire cache
//flushCache();


