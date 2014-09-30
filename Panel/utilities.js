function evalAllFrames(expr, callback) {
	var receivedFrames;
	var receivedResources;
	chrome.extension.sendRequest({command:"getAllFrames"}, allFramesReceived);
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
					if (results.length === urls.length)
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
