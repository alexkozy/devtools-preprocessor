chrome.devtools.panels.create(
    'Preprocessor',
    null, // No icon path
    'Panel/PreprocessorPanel.html',
    null // no callback needed
);

// add in Elements panel
// chrome.devtools.panels.elements.createSidebarPane("Selected variable",
// 	function (sidebar) {
// 		sidebar.setPage("Panel/VariablesValue.html");
// 		sidebar.setHeight("8ex");
// 	});
