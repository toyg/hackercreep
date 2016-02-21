// ==UserScript==
// @name        hacker_creep
// @namespace   http://www.pythonaro.com/gmscripts
// @description Socializing the antisocial.
// @include     https://pinboard.in/*
// @version     1
// @grant       GM_getValue
// @grant       GM_setValue
// @grant       GM_xmlhttpRequest
// @grant       GM_deleteValue
// @grant       GM_listValues
// @grant       GM_log
// @grant		GM_getResourceURL
// @resource y_icon https://news.ycombinator.com/favicon.ico
// @resource loader	http://www.ajaxload.info/cache/FF/FF/FF/FA/5C/1F/18-1.gif
// ==/UserScript==

var MAX_CACHE = 60 * 60 * 24 * 7;  // 7 days

// global YN icon
var img_icon = document.createElement('img');
img_icon.src = GM_getResourceURL("y_icon");
img_icon.width = 10;
img_icon.height = 10;

var img_loader = document.createElement('img');
img_loader.src = GM_getResourceURL("loader");
img_loader.height = 8;


// global bookmark list
var bookmark_list = document.getElementById("bookmarks");
if(!bookmark_list){
	bookmark_list = document.getElementById("content");
}	

// global styles
function addGlobalStyle(css) {
		try {
			var elmHead, elmStyle;
			elmHead = document.getElementsByTagName('head')[0];
			elmStyle = document.createElement('style');
			elmStyle.type = 'text/css';
			elmHead.appendChild(elmStyle);
			elmStyle.innerHTML = css;
		} catch (e) {
			if (!document.styleSheets.length) {
				document.createStyleSheet();
			}
			document.styleSheets[0].cssText += css;
		}
	}
addGlobalStyle(".yn_box , .private a.yn_box { color:#FA5C1F; padding:0; margin:0; border:0; margin-left: 4px; display: inline-block; font-size: x-small; vertical-align: middle;}");
addGlobalStyle(".yn_box img { vertical-align: middle; margin-right:2px;}");
addGlobalStyle(".yn_box_submit, .private a.in_box_submit { opacity: 0.4; background-color: #FA5C1F; color: white; font-size: xx-small; margin-left: 4px; padding: 0px 2px 0px 2px; text-align: middle; display: inline-block;}");

// *** utilities

function getTimestamp(){
	return Math.floor((new Date().getTime()) / 1000);
}

// *** cache management functions

function storeRecord(pinboard_id, data){
	GM_setValue(pinboard_id, JSON.stringify(data));
}

function getRecord(pinboard_id){
	var raw_data = GM_getValue(pinboard_id, null);
	if(raw_data){
		var parsed_data = JSON.parse(raw_data);
		var now = getTimestamp();
		if((parsed_data['cached'] + MAX_CACHE) > now){
			return parsed_data;
		} 
		// cleanup to save us some effort next time anyone tries this key again...
		GM_deleteValue(pinboard_id);
	} 
	// still here? nothing found or record too old
	return null;
}

function flushCache(){
	var keys = GM_listValues();
	for (var i=0, key=null; key=keys[i]; i++) {
  		GM_deleteValue(key);
	}
}
// uncomment to flush entire cache
//flushCache();


// GUI

function getTitle(pinboard_id){
	var bookmark_div = document.getElementById(pinboard_id);
	var title_a = document.evaluate(".//a[contains(string(@class),'bookmark_title')]", 
					bookmark_div, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
	return title_a;
}

function displayData(pinboard_id, data){
	var title_a = getTitle(pinboard_id);
	var yn_link = document.createElement('a');
	
	if(data['hn_id'] != 0){
		yn_link.setAttribute('class', 'yn_box');
		yn_link.setAttribute('href','https://news.ycombinator.com/item?id=' + data['hn_id']);
		yn_link.appendChild(img_icon.cloneNode(true));
		if(data['fp']){
			yn_link.appendChild(document.createTextNode("🔥︎"));
		}
		yn_link.appendChild(document.createTextNode(data['points']+"⬆︎ " + data['comments'] + " 🗯"));
		
	} else {
		yn_link.setAttribute('class', 'yn_box_submit');
		var qs = "u="+encodeURIComponent(title_a.href)+ "&t="+encodeURIComponent(title_a.innerHTML.trim());
		yn_link.setAttribute('href',"http://news.ycombinator.com/submitlink?" + qs);
		yn_link.appendChild(document.createTextNode("→ Y"));
	}
	toggleLoader(pinboard_id, false);
	title_a.parentNode.insertBefore(yn_link, title_a.nextSibling);
	
}

function toggleLoader(pinboard_id, on){
	
	var title_a = getTitle(pinboard_id);
	if(on){
		var loader = img_loader.cloneNode(true);
		title_a.parentNode.insertBefore(loader, title_a.nextSibling);
	} else {
		var loader = title_a.nextSibling;
		
		if(loader.tagName == 'IMG'){
			title_a.parentNode.removeChild(loader);
			
		}
	} 
}


// remote data retrieval
function getHnDataForUrl(some_url, pin_id){
	var ALGOLIA_CALL = "https://hn.algolia.com/api/v1/search?tags=story&restrictSearchableAttributes=url&query=";
	var api_call = ALGOLIA_CALL + encodeURIComponent(some_url);
	GM_xmlhttpRequest({
  method: "GET",
  url: api_call,
  onload: function(response) {
  	if(response.status != 200){
  		// abort
  		return;
  	}
  
    var result = JSON.parse(response.responseText);
    var data = {'hn_id': 0,
    		'fp': false,
    		'points': 0,
    		'cached': getTimestamp()};
    if(result["nbHits"] > 0){
    	var maxPoints = 0;
    	var chosenOne = null;    	
    	for(i in result["hits"]){
    		hit = result["hits"][i];
    		// if we find a front-paged post, assume is the good one and break out
    		for(i_t in hit["_tags"]){
    			
    			tag = hit["_tags"][i_t];
    			if(tag == 'front_page'){
    				
    				data['fp'] = true;
    				data['hn_id'] = hit['objectID'];
    				data['points'] = hit['points'];
    				data['comments'] = hit['num_comments'];
    				storeRecord(pin_id, data);
    				displayData(pin_id, data);
    				return;
    			}
    		}
    		// if not front-paged, look for the one with most points
    		if(hit["points"] > maxPoints){
    			chosenOne = hit;
    			maxPoints = hit["points"];
    		}
    	}
    	data['hn_id'] = chosenOne['objectID'];
    	data['points'] = chosenOne['points'];
    	data['comments'] = chosenOne['num_comments'];
    	
    }
    storeRecord(pin_id, data);
    displayData(pin_id, data);
  }
});
}


// main flow

if(bookmark_list){
	var snapResults = document.evaluate("./div/div[contains(string(@class),'bookmark')]", 
		bookmark_list, null, XPathResult.UNORDERED_NODE_SNAPSHOT_TYPE, null);
	
	for (var i = snapResults.snapshotLength - 1; i >= 0; i--) {
		var elm = snapResults.snapshotItem(i);
		
		data = getRecord(elm.id);
		
		if(data == null){
			toggleLoader(elm.id, true);
			
			var title = document.evaluate(".//a[contains(string(@class),'bookmark_title')]",
				elm, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
			url = title.getAttribute('href');
			getHnDataForUrl(url, elm.id);
			
		} else {
			
			displayData(elm.id, data);
			
		}
		
	}
};