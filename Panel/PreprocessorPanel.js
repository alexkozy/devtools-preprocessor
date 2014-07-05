// /usr/local/google/home/k…/src/third_party/WebKit/Source
(function() {

function XHRLoadFile(name, path) {
	console.log('Loading lib: ' + name + '..');
	var req = new XMLHttpRequest();
	req.open('GET', path + name, false);
	req.send(null);
	if (req.status === 200) {
		console.log('Lib ' + name + ' loaded');
		return req.responseText;
	}
	else
		throw "Can't load lib: " + name + " with status: " + req.status;
}


function preprocessorWithLibs(preprocessor_source, libs) {
	var LIBS_PATH = 'chrome-extension://' + chrome.runtime.id + '/libs/';
	var PREFIX_PLACE = '__PREFIX__';
	var prefix = '';
	libs.forEach(function(lib_name){
		prefix += XHRLoadFile(lib_name, LIBS_PATH);
	});
	var start_prefix_place = preprocessor_source.indexOf(PREFIX_PLACE);
	// .replace doesn't work, because lib can contain dollar sign
	preprocessor_source = preprocessor_source.substring(0, start_prefix_place) + prefix + preprocessor_source.substring(start_prefix_place + PREFIX_PLACE.length);
	preprocessor_source = '(' + preprocessor_source + ')';
	return preprocessor_source;
}


function reloadWithPreprocessor(preprocessor) {
	console.log(preprocessor.preprocessor.toString());
	console.log(preprocessor.injectedScript.toString() + '__beforeAll()');
  	var options = {
    	ignoreCache: true,
    	userAgent: undefined,
    	injectedScript: preprocessor.injectedScript.toString() + '__beforeAll()',
    	preprocessingScript: preprocessor.preprocessorWithLibs()
  	};
  	chrome.devtools.inspectedWindow.reload(options);
}


function getReport() {
	var profileFunction = window.top.__profileFunction;
	var profileStart = window.top.__profileStart;
	var profileFinish = window.top.__profileFinish;
	var profileLast = window.top.__profileLast;
	var profileStack = window.top.__profileStack;
	var idToFunctionName = window.top.__idToFunctionName;
	var idToLocation = window.top.__idToLocation;
	var idToURL = window.top.__idToURL;
	var idToHost = window.top.__idToHost;

	var report = [];
	for (var i = 0; i <= profileLast; ++i) {
		report.push({
			name: idToFunctionName[profileFunction[i]],
			start: profileStart[i],
			finish: profileFinish[i],
			stack: profileStack[i],
			args: {
				url: idToHost[profileFunction[i]] + idToURL[profileFunction[i]],
				line: parseInt(idToLocation[profileFunction[i]].split(',')[0]),
				column: parseInt(idToLocation[profileFunction[i]].split(',')[1])
			}
		});
	}

	return report;
}


function removePreprocessFromReport(report) {
	var sum_preprocess_time = 0.0;

	// report is sorted by finish time by default, let's check it
	for (var i = 1; i < report.length; ++i)
		if (report[i].finish < report[i - 1].finish)
			throw 'Bad report order by finish time on index: ' + i;

	var report_by_start = [];
	for (var i = 0; i < report.length; ++i) {
		report_by_start.push(report[i]);
	}
	report_by_start.sort(function(a, b){ return a.start - b.start; });

	// report is sorted by finish time after sort, let's check it
	for (var i = 1; i < report.length; ++i)
		if (report[i].finish < report[i - 1].finish)
			throw 'Bad report order on index: ' + i;
	// report by start is sorted by start time, let's check it
	for (var i = 1; i < report_by_start.length; ++i)
		if (report_by_start[i].start < report_by_start[i - 1].start)
			throw 'Bad report_by_start order on index: ' + i;

	var out = [];
	var start_idx = 0;
	var finish_idx = 0;

	var report_by_finish = report;
	// two times for each element - enter and leave
	for (var i = 0; i < report.length * 2; ++i) {
		var cur;
		var is_start = false;

		if (start_idx >= report.length) {
			// if no starts  - alwasys give finish left
			cur = report_by_finish[finish_idx];
			++finish_idx;
		} else if (finish_idx >= report.length || report_by_start[start_idx].start < report_by_finish[finish_idx].finish) {
			// if start and finish records exists - get first by time
			cur = report_by_start[start_idx];
			++start_idx;
			is_start = true;
		} else {
			// if finish exists and finish time less than start time
			cur = report_by_finish[finish_idx];
			++finish_idx;
		}

		if (cur.name == "preprocess") {
			// if it's preprocess record
			if (is_start) {
				// if is preprocess start
				cur.correct_start = cur.start - sum_preprocess_time;
			} else {
				cur.correct_finish = cur.finish - sum_preprocess_time;

				var dur = cur.finish - cur.start;
				sum_preprocess_time += dur;
			}
		} else if (is_start) {
			cur.correct_start = cur.start - sum_preprocess_time
		} else {
			cur.correct_finish = cur.finish - sum_preprocess_time;
			out.push(cur);
		}
	}

	return out;
}


function demoPreprocessor() {
	reloadWithPreprocessor(new Profiler());
}


function refreshTimeline() {
	var expr = getReport.toString() + '\ngetReport()';
	function onEval(report, isException) {
		if (isException)
			throw new Error('Eval failed for ' + expr, isException.value);
		document.getElementById('results_count').innerHTML = 'Total count: ' + report.length.toString();
		refreshVisual(removePreprocessFromReport(report));
	}
	chrome.devtools.inspectedWindow.eval(expr, onEval);
}


function onSelectionChanged(selection) {
	if (selection.length === 1) {
		var title = selection[0].title;
		var url = selection[0].args.url;
		var line = selection[0].args.line;
		chrome.devtools.panels.openResource(url, parseInt(line) - 1);
	}
}


function refreshVisual(report) {
	var data = [];

	var kt = 1000.0;
	for (var i = 0; i < report.length; ++i) {
		data.push({
			"name": report[i].name,
			"cat" : "PERF",
			ph: "X",
			ts: report[i].correct_start * kt,
			dur: (report[i].correct_finish - report[i].correct_start) * kt,
			pid: 0,
			tid: report[i].stack,
			args: report[i].args
		});
	}

	var model = new tracing.TraceModel();
	model.importTraces([data]);

	var viewEl = document.getElementById('results');
	tvcm.ui.decorate(viewEl, tracing.TimelineView);
	viewEl.model = model;
	viewEl.viewTitle = '';
	viewEl.userSelectionChanged = onSelectionChanged;
}


function switchProfiler() {
  	var expr = 'window.top.__profileEnable';
	function onEval(profileEnable, isException) {
		if (isException)
			throw new Error('Eval failed for ' + expr, isException.value);

		var newValue = !profileEnable;
		var newInner = newValue ? 'Disable' : 'Enable';

		var expr = 'window.top.__profileEnable = ' + newValue.toString();
		chrome.devtools.inspectedWindow.eval(expr);
		document.querySelector('.switch-button').innerHTML = newInner;
		if (!newValue)
			refreshTimeline();
	}
	chrome.devtools.inspectedWindow.eval(expr, onEval);
}


function clearProfile() {
  	var expr = 'window.top.__profileLast = -1;';
	function onEval(res, isException) {
		if (isException)
			throw new Error('Eval failed for ' + expr, isException.value);

		refreshTimeline();
	}
	chrome.devtools.inspectedWindow.eval(expr, onEval);
}


function testDataURI() {
	chrome.devtools.panels.openResource('data:application/javascript;charset=utf8,console.log(123)%3B');
}

function listen() {
  var reloadButton = document.querySelector('.reload-button');
  reloadButton.addEventListener('click', demoPreprocessor);

  var refreshButton = document.querySelector('.refresh-button');
  refreshButton.addEventListener('click', refreshTimeline);

  var switchButton = document.querySelector('.switch-button');
  switchButton.addEventListener('click', switchProfiler);

  var clearButton = document.querySelector('.clear-button');
  clearButton.addEventListener('click', clearProfile);

  var testButton = document.querySelector('.test-data-uri');
  testButton.addEventListener('click', testDataURI);
}


window.addEventListener('load', listen);
})();
