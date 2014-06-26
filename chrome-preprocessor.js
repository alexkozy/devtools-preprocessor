chrome.devtools.panels.create(
    'Preprocessor',
    null, // No icon path
    'Panel/PreprocessorPanel.html',
    null // no callback needed
);

function addLiveVariable() {
	function selectionGetted(selection) {
		var ol = addLiveVariable.document.getElementById('live-variables');
		var li = addLiveVariable.document.createElement('li');
		li.innerHTML = JSON.stringify(selection);
		ol.appendChild(li);
	}

	chrome.devtools.panels.getSelectedCode(selectionGetted);	
}

chrome.devtools.panels.sources.createSidebarPane("Selected variable",
	function (sidebar) {
		sidebar.setPage("Panel/VariablesValue.html");
		sidebar.onShown.addListener(function (frame) {
  			var addLiveVariableButton = frame.document.querySelector('.add-live-variable');
  			addLiveVariableButton.addEventListener('click', addLiveVariable);
  			addLiveVariable.document = frame.document;

			console.log(frame);
		});
		// sidebar.setHeight("32ex");
		console.log(sidebar.bodyElement);
	});
