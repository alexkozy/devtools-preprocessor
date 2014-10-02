// Copyright (c) 2014 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

function evalAllFrames(expr, callback) {
	var receivedFrames;
	var receivedResources;
	chrome.runtime.sendMessage({tabId: chrome.devtools.inspectedWindow.tabId, command:"getAllFrames"}, allFramesReceived);
	chrome.devtools.inspectedWindow.getResources(allResourcesReceived);
	function allFramesReceived(frames) {
		receivedFrames = frames;
		tryEval();
	}
	function allResourcesReceived(resources) {
		receivedResources = resources;
		tryEval();
	}
	function tryEval() {
		if (receivedResources && receivedFrames) {
			var urls = extractUrls(receivedFrames, receivedResources);
			var results = [];
			urls.forEach(function(url){
		    	var segments = url.split('/');
			    var origin = segments[0] + '//' + segments[1];
			    var options = {
        			frame: {
            			url: url,
            			securityOrigin: origin
        			}
    			}
				chrome.devtools.inspectedWindow.eval(expr, options, resultReceived);
				function resultReceived(result){
					results.push(result);
					if (results.length === urls.length && callback)
						callback(results);
				}
			});
		}
	}
	function extractUrls(frames, resources) {
		urls = [];
		frames.forEach(function(frame){
			var hasURL = false;
			resources.forEach(function(resource){
				if (!hasURL && resource.url.indexOf(frame) !== -1 && urls.indexOf(resource.url) === -1) {
					urls.push(resource.url);
					hasURL = true;
				}
			});
		});
		return urls;
	}
}
