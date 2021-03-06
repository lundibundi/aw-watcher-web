/*
 * This code uses event pages, a special webextension thingy documented here:
 * https://developer.chrome.com/extensions/event_pages
 */


"use strict";

// Mininum guaranteed in chrome is 1min
var check_interval = 5;
var max_check_interval = 60;
var heartbeat_interval = 20;
var heartbeat_pulsetime = heartbeat_interval + max_check_interval;


function getCurrentTabs(callback) {
  // Query filter to be passed to chrome.tabs.query - see
  // https://developer.chrome.com/extensions/tabs#method-query
  var queryInfo = {
    active: true,
    currentWindow: true
  };

  chrome.tabs.query(queryInfo, function(tabs) {
    // TODO: Won't necessarily work when code is run as a background plugin instead of as a popup
    // chrome.tabs.query invokes the callback with a list of tabs that match the
    // query. When the popup is opened, there is certainly a window and at least
    // one tab, so we can safely assume that |tabs| is a non-empty array.
    // A window can only have one active tab at a time, so the array consists of
    // exactly one tab.
    callback(tabs);
  });
}

var last_heartbeat_data = null;
var last_heartbeat_time = null;

function heartbeat(tab) {
  // Prevent from sending in incognito mode (needed for firefox) - See https://github.com/ActivityWatch/aw-watcher-web/pull/18
  if (tab.incognito === true) {
    return;
  }
  
  //console.log(JSON.stringify(tab));
  var now = new Date();
  var data = {"url": tab.url, "title": tab.title, "audible": tab.audible, "incognito": tab.incognito};
  // First heartbeat on startup
  if (last_heartbeat_time === null){
    //console.log("aw-watcher-web: First");
    client.sendHeartbeat(now, data, heartbeat_pulsetime);
    last_heartbeat_data = data;
    last_heartbeat_time = now;
  }
  // Any tab data has changed, finish previous event and insert new event
  else if (JSON.stringify(last_heartbeat_data) != JSON.stringify(data)){
    //console.log("aw-watcher-web: Change");
    client.sendHeartbeat(new Date(now-1), last_heartbeat_data, heartbeat_pulsetime);
    client.sendHeartbeat(now, data, heartbeat_pulsetime);
    last_heartbeat_data = data;
    last_heartbeat_time = now;
  }
  // If heartbeat interval has been exceeded
  else if (new Date(last_heartbeat_time.getTime()+(heartbeat_interval*1000)) < now){
    //console.log("aw-watcher-web: Update");
    client.sendHeartbeat(now, data, heartbeat_pulsetime);
    last_heartbeat_time = now;
  }
}

function createAlarm() {
  var when = Date.now() + (check_interval*1000);
  chrome.alarms.create("heartbeat", {"when": when});
}

chrome.alarms.onAlarm.addListener(function(alarm) {
  if(alarm.name === "heartbeat") {
    getCurrentTabs(function(tabs) {
      if(tabs.length >= 1) {
        heartbeat(tabs[0]);
      } else {
        //console.log("tabs had length < 0");
      }
      createAlarm();
    });
  }
});


(function() {
  client.setup();
  createAlarm();
  // Fires when the active tab in a window changes
  chrome.tabs.onActivated.addListener(function(activeInfo) {
    chrome.tabs.get(activeInfo.tabId, function(tab) {
      heartbeat(tab);
    });
  });
})();
