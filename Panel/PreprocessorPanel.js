(function() {

function preprocessorCoverage(source, url, listenerName) {
	if (preprocessorCoverage.esprima === undefined) {
		__PREFIX__;
	} else {
		esprima = preprocessorCoverage.esprima;
		estraverse = preprocessorCoverage.estraverse;
		escodegen = preprocessorCoverage.escodegen;
	}
	preprocessorCoverage.esprima = esprima;
	preprocessorCoverage.estraverse = estraverse;
	preprocessorCoverage.escodegen = escodegen;

	if (preprocessorCoverage.last_location_id === undefined)
		preprocessorCoverage.last_location_id = -1;

	String.prototype.endsWith = function(suffix) {
	    return this.indexOf(suffix, this.length - suffix.length) !== -1;
	};
	function makeInstrument(id) {
		var instrument_source = 'window.top.__profileEnable && window.top.__hits[0]++';
		var instrument = esprima.parse(instrument_source).body[0].expression;
		var id_property = instrument.right.argument.property;
		id_property.raw = id.toString();
		id_property.value = id;
		return instrument;
	}
	function addSourceUrl(location) {
		location.url = url;
		return location;
	}

<<<<<<< Updated upstream
	var idToLocation = {};
	var ast = esprima.parse(source, {loc:true});

	ast = estraverse.replace(ast, {
		leave: function (node, parent) {
			if (node.type === "ReturnStatement" && node.argument === null) {
			 	++preprocessorCoverage.last_location_id;
			 	idToLocation[preprocessorCoverage.last_location_id] = addSourceUrl(node.loc);	
			 	return { 
			 		type: "ReturnStatement", argument: { 
			 			type: "SequenceExpression", expressions: [
			 				makeInstrument(preprocessorCoverage.last_location_id), 
			 				{ type: "Identifier", name: "undefined" }
			 			]
			 		}
			 	};			
			}
			if (node.type === "EmptyStatement") {
				++preprocessorCoverage.last_location_id;
				idToLocation[preprocessorCoverage.last_location_id] = addSourceUrl(node.loc);			
				return {type: "ExpressionStatement", expression: makeInstrument(preprocessorCoverage.last_location_id), loc: node.loc };			
			}
			if (node.type === "Literal" && !parent.type.endsWith("Expression") && !(parent.type === "Property" && parent.key == node)) {
				++preprocessorCoverage.last_location_id;
				idToLocation[preprocessorCoverage.last_location_id] = addSourceUrl(node.loc);
				return {expressions: [makeInstrument(preprocessorCoverage.last_location_id), node], type: "SequenceExpression"};
			}
			if (node.type.endsWith("Expression") && node.type != "FunctionExpression" && !parent.type.endsWith("Expression")) {
				++preprocessorCoverage.last_location_id;
				idToLocation[preprocessorCoverage.last_location_id] = addSourceUrl(node.loc);
				return {expressions: [makeInstrument(preprocessorCoverage.last_location_id), node], type: "SequenceExpression", old: node };				
=======
	var emptyLines = '';
	for (var i = 0; i < startLine - 1; ++i) emptyLines += '\n';

	var ast = esprima.parse(emptyLines + source, {loc:true});
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
			// 	node.loc.start.line += startLine + 1;
			// 	node.loc.end.line += startLine + 1;
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
>>>>>>> Stashed changes
			}
		}
	});
	
	var processed_source = escodegen.generate(ast);

<<<<<<< Updated upstream
	var prefix = '\
window.top.__hits = window.top.__hits || new Int32Array(1024 * 1024);\n\
window.top.__profileEnable = window.top.__profileEnable !== undefined ? window.top.__profileEnable : false;\n\
window.top.__idToLocation = window.top.__idToLocation || {};\n\
window.top.__urlToSource = window.top.__urlToSource || {};\n';

  	for (id in idToLocation)
  		prefix = prefix.concat('window.top.__idToLocation[' + id + '] = ' + JSON.stringify(idToLocation[id]) + ';\n');

  	prefix = prefix.concat('window.top.__urlToSource[\'' + escape(url) + '\'] = \'' + escape(source) + '\';\n');

  	return '{\n' + prefix + '}\n' + processed_source;
=======
  	var prefix = '{\n\
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
  	}\n';
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
	debugger;
	var processed_result = escodegen.generate(ast, {sourceMap: url, sourceMapWithCode: true, sourceContent: source});
	var processed_source = processed_result.code;

	var lastPointIndex = url.lastIndexOf(".");
	if (lastPointIndex !== -1)
		url = url.substr(0, lastPointIndex) + '.profiled.' + url.substr(lastPointIndex + 1);
	else
		url = url + '.profiled';

	console.log(processed_source + 
			'\n//@ sourceMappingURL=data:application/json;base64,' + btoa(processed_result.map.toString()));

	console.log(processed_result.map.toString());

	if (processed_result.map)
		return processed_source + 
			'\n//@ sourceMappingURL=data:application/json;base64,' + btoa(processed_result.map.toString()) + 
			'\n//@ sourceURL=' + url;
	return '{\n' + prefix + '}\n' + processed_source;// + 
		'\n//@ sourceURL=' + url;
>>>>>>> Stashed changes
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


function reloadWithCoverageAnalysis() {
	var preprocessor_source = preprocessorWithLibs(preprocessorCoverage.toString(), ['esprima.js', 'estraverse.js', 'escodegen.browser.js']);
  	var options = {
    	ignoreCache: true,
    	userAgent: undefined,
    	injectedScript: undefined,
    	preprocessingScript: preprocessor_source
  	};
  	chrome.devtools.inspectedWindow.reload(options);	
}


function getCoverageReport() {
	var report = {};
	for (var i = 0; i < window.top.__hits.length; ++i) {
		if (window.top.__hits[i] > 0) {
			var hits_count = window.top.__hits[i];
			var loc = window.top.__idToLocation[i];
			
			var per_url = report[loc.url] || {hits: [], lines: {}, total: 0, source: '', url: loc.url};

			per_url.hits.push({loc: loc, count: hits_count});
			if (per_url.lines[loc.start.line])
				per_url.lines[loc.start.line] += hits_count;
			else
				per_url.lines[loc.start.line] = hits_count;

			per_url.total += hits_count;
			per_url.source = __urlToSource[escape(loc.url)];

			report[loc.url] = per_url;
		}
	}
	return Object.keys(report).map(function (key) {
    	return report[key];
	});
}


function refreshCoverage() {
	var expr = getCoverageReport.toString() + '\ngetCoverageReport()';
	function onEval(report, isException) {
		if (isException)
			throw new Error('Eval failed for ' + expr, isException.value);

		refreshVisual(report);
	}
	chrome.devtools.inspectedWindow.eval(expr, onEval);	
}


function refreshVisual(report) {
	report.sort(function(a, b){ return b.total - a.total; });

	var ul_tag = document.getElementById('tabs_list');
	while (ul_tag.firstChild) { ul_tag.removeChild(ul_tag.firstChild); }

	var contents_tag = document.getElementById('tabs_content');
	while (contents_tag.firstChild) { contents_tag.removeChild(contents_tag.firstChild); }

	for (var i = 0; i < report.length; ++i) {
		// <li class="active"><a href="#lA" data-toggle="tab">Trace viewer</a></li>
		var li = document.createElement('li');
		li.setAttribute('class', (i === 0 ? ' active': ''));

		var a = document.createElement('a');
		a.setAttribute('href', '#tab-' + (i + 1));
		a.setAttribute('data-toggle', 'tab');
		a.innerHTML = report[i].url.substring(report[i].url.lastIndexOf('/')+1) + ':' + report[i].total; 

		li.appendChild(a);
		ul_tag.appendChild(li);

      	// <div class="tab-pane active" id="lA">
      	//   <textarea id="coveraged_source"></textarea>
      	// </div>
      	var div_content = document.createElement('div');
		div_content.setAttribute('class', 'tab-pane' + (i === 0 ? ' active': ''));
		div_content.setAttribute('id', 'tab-' + (i + 1));

		var textarea = document.createElement('textarea');
		textarea.value = unescape(report[i].source);
		div_content.appendChild(textarea);
		contents_tag.appendChild(div_content);

		var cm = CodeMirror.fromTextArea(textarea, {
			mode: "javascript",
			lineNumbers: true,
			gutters: ["CodeMirror-linenumbers", "hits"]
		});

		var max_hits = 0;
		var report_hits = report[i].hits;
		for (var j = 0; j < report_hits.length; ++j)
			if (report_hits[j].count > max_hits)
				max_hits = report_hits[j].count;

		var mark_count = 100;
		for (var j = 0; j < report_hits.length; ++j) {
			var loc = report_hits[j].loc;
			var hits = report_hits[j].count;
			cm.markText({line: loc.start.line - 1, ch: loc.start.column}, {line: loc.end.line - 1, ch: loc.end.column}, {className: "mark-" + Math.ceil(hits / max_hits * mark_count)});	
		}

		function makeMarker(hits) {
		  var marker = document.createElement("div");
		  marker.innerHTML = hits.toString();
		  return marker;
		}

		for (line in report[i].lines) {
			cm.setGutterMarker(parseInt(line) - 1, "hits", makeMarker(report[i].lines[line]));
		}		
	}
}


function refreshSourceWithCoverageQuery(url) {
	var expr = getCoverageReport.toString() + '\ngetCoverageReport()';
	function onEval(report, isException) {
		if (isException)
			throw new Error('Eval failed for ' + expr, isException.value);

		expr = "window.top.__urlToSource['" + escape(url) + "']";
		function onEval(source, isException) {
			if (isException)
				throw new Error('Eval failed for ' + expr, isException.value);
			refreshSourceWithCoverage(report, url, unescape(source));
		}
		chrome.devtools.inspectedWindow.eval(expr, onEval);
	}
	chrome.devtools.inspectedWindow.eval(expr, onEval);	
}


function refreshSourceWithCoverage(report, url, source) {
	report = report.filter(function(obj){
		return obj.loc.url == url;
	});

	var readOnlyCodeMirror = CodeMirror.fromTextArea(document.getElementById('coveraged_source'), {
        mode: "javascript",
        theme: "default",
        lineNumbers: true,
        readOnly: true,
        gutters: ["CodeMirror-linenumbers", "counts"]
    });

    readOnlyCodeMirror.setValue(source);

    var cm = readOnlyCodeMirror;

    function makeMarker(count) {
    	var marker = document.createElement("div");
    	marker.innerHTML = count.toString();
    	return marker;
    }

    for (var i = 0; i < report.length; ++i) {
    	cm.setGutterMarker(report[i].loc.start.line - 1, "counts", makeMarker(report[i].count));;
    }
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
			// refreshTimeline();
			refreshCoverage();
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
chrome.devtools.panels.sources.createSidebarPane("Selected variable",
	function (sidebar) {
		sidebar.setPage("Panel/VariablesValue.html");
		// sidebar.setHeight("32ex");
		console.log(sidebar.bodyElement);
	});
}


function listen() {
  var refreshButton = document.querySelector('.refresh-button');
  refreshButton.addEventListener('click', refreshCoverage/*refreshTimeline*/);

  var switchButton = document.querySelector('.switch-button');
  switchButton.addEventListener('click', switchProfiler);

  var clearButton = document.querySelector('.clear-button');
  clearButton.addEventListener('click', clearProfile);

  var reloadCoverageButton = document.querySelector('.reload-coverage-button');
  reloadCoverageButton.addEventListener('click', reloadWithCoverageAnalysis);
}

window.addEventListener('load', listen);


function generateMarkStyle(from, to, count) {
    var head = document.head || document.getElementsByTagName('head')[0];
    var style = document.createElement('style');
    var css = '';
	for (var i = 1; i <= count; ++i) {
		var part = i / count;
		var r = (to.r - from.r) * part + from.r;
		var g = (to.g - from.g) * part + from.g;
		var b = (to.b - from.b) * part + from.b;

		css += '.mark-' + i + ' { background: rgb(' + Math.ceil(r) + ',' + Math.ceil(g) + ',' + Math.ceil(b) +'); }\n';
	}
	style.type = 'text/css';
	if (style.styleSheet){
	  style.styleSheet.cssText = css;
	} else {
	  style.appendChild(document.createTextNode(css));
	}

	head.appendChild(style);		
}

var mark_count = 100;
generateMarkStyle({r: 251, g: 255, b: 178}, {r: 247, g: 139, b: 81}, mark_count);


})();
