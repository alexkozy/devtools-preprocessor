// /usr/local/google/home/k…/src/third_party/WebKit/Source
(function() {

// This function is converted to a string and becomes the preprocessor
function preprocessor(source, url, listenerName, startLine) {
	console.log(url);
	console.log(startLine);
	// console.log(source);

	var start_time = (new Date()).getTime();

	if (preprocessor.esprima === undefined) {
		__PREFIX__;
		sourceMap = window.sourceMap;
	} else {
		esprima = preprocessor.esprima;
		estraverse = preprocessor.estraverse;
		escodegen = preprocessor.escodegen;
		sourceMap = preprocessor.sourceMap;
	}
	preprocessor.esprima = esprima;
	preprocessor.estraverse = estraverse;
	preprocessor.escodegen = escodegen;
	preprocessor.sourceMap = sourceMap;
	if (preprocessor.functionID === undefined) preprocessor.functionID = 0;
	var idToFunctionName = {};
	var idToLocation = {};
	var idToURL = {};
	String.prototype.startsWith = function (str){
	    return this.indexOf(str) == 0;
	};

	var ast = esprima.parse(source + '\n\n\n\n', {loc:true});
	var profiled_block = '\
		function fake() {\n\
			function __profiled__(/*here function arguments*/) {\n\
				// here function body\n\
			}\n\
			if (window.top.__profileEnable) {\n\
				try {\n\
					window.top.__entryTime[++window.top.__entryTop] = window.top.performance.now();\n\
					return __profiled__.apply(this, arguments);\n\
				} finally {\n\
					++window.top.__profileLast;\n\
					window.top.__profileFinish[window.top.__profileLast] = window.top.performance.now();\n\
					window.top.__profileStack[window.top.__profileLast] = window.top.__entryTop;\n\
					window.top.__profileStart[window.top.__profileLast] = window.top.__entryTime[window.top.__entryTop--];\n\
					window.top.__profileFunction[window.top.__profileLast] = 1 /* here correct function ID */;\n\
				}\n\
			}\n\
			return __profiled__.apply(this, arguments);\n\
		}\n\
	';

	if (url.length < 1)
		url = 'data:application/javascript;base64,' + btoa(source);

	estraverse.traverse(ast, {
		enter: function (node, parent) {
			// if (node.loc) {
				// node.loc.start.line += startLine + 1;
				// node.loc.end.line += startLine + 1;
			// }
			if ((node.type === "FunctionDeclaration" && node.id.name !== "__profiled__") || node.type === "FunctionExpression") {
				preprocessor.functionID++;
				if (node.id)
					idToFunctionName[preprocessor.functionID] = node.id.name;
				else if (node.type === "FunctionExpression" && parent && parent.type === "VariableDeclaration")
					idToFunctionName[preprocessor.functionID] = parent.id.name;
				else if (node.type === "FunctionExpression" && parent && parent.type === "Property")
					idToFunctionName[preprocessor.functionID] = parent.key.name;
				else {
					idToFunctionName[preprocessor.functionID] = '(anonymous: ' + preprocessor.functionID.toString() + ')';
				}
				idToURL[preprocessor.functionID] = url ? url : '';
				idToLocation[preprocessor.functionID] = (node.loc.start.line  ? node.loc.start.line : 1) + ',' + (node.loc.start.column ? node.loc.start.column : 1);

				var profiled_ast = esprima.parse(profiled_block);
				var profiled_function = profiled_ast.body[0].body.body[0];
				// setup inner profiled function body
				profiled_function.body = node.body;
				// setup inner profiled function arguments
				profiled_function.defaults = node.defaults;
				profiled_function.params = node.params;
				// setup function ID
				var function_id_node = profiled_ast.body[0].body.body[1].consequent.body[0].finalizer.body[4].expression.right;
				function_id_node.raw = preprocessor.functionID.toString();
				function_id_node.value = preprocessor.functionID;
				// setup alternative function body
				node.body = profiled_ast.body[0].body;
			}
		}
	});

  	var prefix = '\
  		window.top.__entryTime = window.top.__entryTime || new Float64Array(4 * 4096);\n\
  		window.top.__entryTop = window.top.__entryTop || -1;\n\
  		window.top.__profileFunction = window.top.__profileFunction || new Int16Array(16 * 65536);\n\
  		window.top.__profileStart = window.top.__profileStart || new Float64Array(16 * 65536);\n\
  		window.top.__profileFinish = window.top.__profileFinish || new Float64Array(16 * 65536);\n\
  		window.top.__profileLast = window.top.__profileLast || -1;\n\
  		window.top.__profileStack = window.top.__profileStack || new Int16Array(16 * 65536);\n\
  		window.top.__idToFunctionName = window.top.__idToFunctionName || {};\n\
  		window.top.__idToLocation = window.top.__idToLocation || {};\n\
  		window.top.__idToHost = window.top.__idToHost || {};\n\
  		window.top.__idToURL = window.top.__idToURL || {};\n\
  		window.top.__profileEnable = window.top.__profileEnable !== undefined ? window.top.__profileEnable : false;\n\
  	';
  	for (id in idToFunctionName) {
  		prefix = prefix.concat('window.top.__idToFunctionName[' + id + '] = \'' + idToFunctionName[id] + '\';\n');
  		prefix = prefix.concat('window.top.__idToLocation[' + id + '] = \'' + idToLocation[id] + '\';\n');
  		prefix = prefix.concat('window.top.__idToURL[' + id + '] =\'' + idToURL[id] + '\';\n');
  		if (!url.startsWith('http://'))
  			prefix = prefix.concat('window.top.__idToHost[' + id + '] = \'http://\' + window.location.host + \'/\';\n');
  		else
  			prefix = prefix.concat('window.top.__idToHost[' + id + '] = \'\';\n');
  	}
	prefix = prefix.concat('window.top.__idToFunctionName[-1] = \'preprocess\';\n');
	prefix = prefix.concat('window.top.__idToURL[-1] = \'preprocess\';\n');
	prefix = prefix.concat('window.top.__idToLocation[-1] = \'1,1\';\n');
	prefix = prefix.concat('window.top.__idToHost[-1] = \'\';\n');

  	var end_time = (new Date()).getTime();
  	var total_time = (end_time - start_time);

  	if (total_time > 0.0) {
	  	prefix += '\
	  		++window.top.__profileLast;\n\
			window.top.__profileFinish[window.top.__profileLast] = window.performance.now();\n\
			window.top.__profileStart[window.top.__profileLast] = window.top.__profileFinish[window.top.__profileLast] - ' + total_time.toString() + ';\n\
			window.top.__profileStack[window.top.__profileLast] = -100;\n\
			window.top.__profileFunction[window.top.__profileLast] = -1;\n\
		';
	}

	var prefix_ast = esprima.parse(prefix);
	var prefix_body = prefix_ast.body;

	ast.body = prefix_body.concat(ast.body);

	var processed_result = escodegen.generate(ast, {sourceMap: url, sourceMapWithCode: true, sourceContent: source});
	var processed_source = processed_result.code;

	var lastPointIndex = url.lastIndexOf(".");
	if (lastPointIndex !== -1)
		url = url.substr(0, lastPointIndex) + '.profiled.' + url.substr(lastPointIndex + 1);
	else
		url = url + '.profiled';

	if (processed_result.map)
		return processed_source +
			'\n//@ sourceMappingURL=data:application/json;base64,' + btoa(processed_result.map.toString()) +
			'\n//@ sourceURL=' + url;
	return '{\n' + prefix + '}\n' + processed_source;// +
		'\n//@ sourceURL=' + url;
}


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


function reloadWithPreprocessor(injectedScript) {
	var preprocessor = new Profiler();
	// var preprocessor_source = preprocessorWithLibs(preprocessor.toString(), ['esprima.js', 'estraverse.js', 'escodegen.browser.js', 'source-map.js']);
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
	function onLoaded() {}
	var loadMonitor = new InspectedWindow.LoadMonitor(onLoaded);
	reloadWithPreprocessor(loadMonitor.injectedScript);
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
