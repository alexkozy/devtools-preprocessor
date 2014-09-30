// Copyright (c) 2014 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

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