// Copyright (c) 2014 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

chrome.runtime.onMessage.addListener(
	function(request, sender, sendResponse) {
		if (request.command === "getAllFrames" && request.tabId) {
			chrome.tabs.executeScript(request.tabId, {
				code: 'location.href',
				allFrames: true
			}, function (result) {
				console.log('result', result);
				sendResponse(result);
			});
			return true;
		}
	}
);
