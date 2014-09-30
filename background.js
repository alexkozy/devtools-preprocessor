chrome.extension.onRequest.addListener(function(request, sender, callback) {
	if (request.command === "getAllFrames") {
		chrome.tabs.executeScript({
			code: 'location.href',
			allFrames: true
		}, function (result){
			callback(result);
		});
	} else {
		callback({error: 'incorrect command'});
	}
});