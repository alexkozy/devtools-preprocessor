function Tool() {}

Tool.prototype = {
	_getLib: function(name, path) {
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
	},

	requiredLibs: function() {
		return [];
	},

	preprocessorWithLibs: function() {
		var LIBS_PATH = 'chrome-extension://' + chrome.runtime.id + '/libs/';
		var LIBS_PLACE = '__LIBS__';
		var prefix = '';
		var libs = this.requiredLibs();
		for (var i = 0; i < libs.length; ++i)
			prefix += this._getLib(libs[i], LIBS_PATH);
		var preprocessor_source = this.preprocessor.toString();
		var start_prefix_place = preprocessor_source.indexOf(LIBS_PLACE);
		preprocessor_source = preprocessor_source.substring(0, start_prefix_place) + prefix + preprocessor_source.substring(start_prefix_place + LIBS_PLACE.length);
		preprocessor_source = '(' + preprocessor_source + ')';
		return preprocessor_source;
	}
}

/**
 * Profiler preprocessor
 */
function Profiler() {}

Profiler.prototype = {
	preprocessor: function(source, url, functionName) {
		var start_time = (new Date()).getTime();

		if (!this.libsExported) {
			__LIBS__;
			this.libsExported = true;
		}

		this.esprima = this.esprima || esprima;
		this.estraverse = this.estraverse || estraverse;
		this.escodegen = this.escodegen || escodegen;
		this.sourceMap = this.sourceMap || window.sourceMap;

		if (this.functionID === undefined) this.functionID = 0;
		var functionID = this.functionID;
		var idToFunctionName = {};
		var idToLocation = {};
		var idToURL = {};

		String.prototype.startsWith = function (str){
		    return this.indexOf(str) == 0;
		};

		var ast = esprima.parse(source, {loc:true, comment:true});

		for (var idx in ast.comments) {
			var comment = ast.comments[idx];
			if (comment.value.indexOf('do-not-preprocess') !== -1) {
				return source;
			}
		}
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
				if ((node.type === "FunctionDeclaration" && node.id.name !== "__profiled__") || node.type === "FunctionExpression") {
					functionID++;
					console.log()
					if (node.id)
						idToFunctionName[functionID] = node.id.name;
					else if (node.type === "FunctionExpression" && parent && parent.type === "VariableDeclaration")
						idToFunctionName[functionID] = parent.id.name;
					else if (node.type === "FunctionExpression" && parent && parent.type === "Property")
						idToFunctionName[functionID] = parent.key.name;
					else {
						idToFunctionName[functionID] = '(anonymous: ' + functionID.toString() + ')';
					}
					idToURL[functionID] = url ? url : '';
					idToLocation[functionID] = (node.loc.start.line  ? node.loc.start.line : 1) + ',' + (node.loc.start.column ? node.loc.start.column : 1);

					var profiled_ast = esprima.parse(profiled_block);
					var profiled_function = profiled_ast.body[0].body.body[0];
					// setup inner profiled function body
					profiled_function.body = node.body;
					// setup inner profiled function arguments
					profiled_function.defaults = node.defaults;
					profiled_function.params = node.params;
					// setup function ID
					var function_id_node = profiled_ast.body[0].body.body[1].consequent.body[0].finalizer.body[4].expression.right;
					console.log(functionID);
					function_id_node.raw = functionID.toString();
					function_id_node.value = functionID;
					// setup alternative function body
					node.body = profiled_ast.body[0].body;
				}
			}
		});

		this.functionID = functionID;

	  	var prefix = '';
	  	for (id in idToFunctionName) {
	  		prefix = prefix.concat('window.top.__idToFunctionName[' + id + '] = \'' + idToFunctionName[id] + '\';\n');
	  		prefix = prefix.concat('window.top.__idToLocation[' + id + '] = \'' + idToLocation[id] + '\';\n');
	  		prefix = prefix.concat('window.top.__idToURL[' + id + '] =\'' + idToURL[id] + '\';\n');
	  		if (!url.startsWith('http://'))
	  			prefix = prefix.concat('window.top.__idToHost[' + id + '] = \'http://\' + window.location.host + \'/\';\n');
	  		else
	  			prefix = prefix.concat('window.top.__idToHost[' + id + '] = \'\';\n');
	  	}

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
			//'\n//@ sourceURL=' + url;
	},

	injectedScript: function __beforeAll() {
		/* do-not-preprocess */
  		window.top.__entryTime = window.top.__entryTime || new Float64Array(4 * 4096);
  		window.top.__entryTop = window.top.__entryTop || -1;
  		window.top.__profileFunction = window.top.__profileFunction || new Int16Array(16 * 65536);
  		window.top.__profileStart = window.top.__profileStart || new Float64Array(16 * 65536);
  		window.top.__profileFinish = window.top.__profileFinish || new Float64Array(16 * 65536);
  		window.top.__profileLast = window.top.__profileLast || -1;
  		window.top.__profileStack = window.top.__profileStack || new Int16Array(16 * 65536);
  		window.top.__idToFunctionName = window.top.__idToFunctionName || {};
  		window.top.__idToLocation = window.top.__idToLocation || {};
  		window.top.__idToHost = window.top.__idToHost || {};
  		window.top.__idToURL = window.top.__idToURL || {};
  		window.top.__profileEnable = window.top.__profileEnable !== undefined ? window.top.__profileEnable : false;
		window.top.__idToFunctionName[-1] = 'preprocess';
		window.top.__idToURL[-1] = 'preprocess';
		window.top.__idToLocation[-1] = '1,1';
		window.top.__idToHost[-1] = '';
	},

	requiredLibs: function() {
		return ['esprima.js', 'estraverse.js', 'escodegen.browser.js', 'source-map.js'];
	}
}
Profiler.prototype.__proto__ = Tool.prototype;

/**
 * LiveVariable preprocessor
 */
function LiveVariable() {}

LiveVariable.prototype = {
	preprocessor: function(source, url, functionName) {
		debugger;
		if (!this.libsExported) {
			__LIBS__;
			this.libsExported = true;
		}

		console.log(source, url, functionName);

		this.esprima = this.esprima || esprima;
		this.estraverse = this.estraverse || estraverse;
		this.escodegen = this.escodegen || escodegen;

		String.prototype.endsWith = function(suffix) {
			return this.indexOf(suffix, this.length - suffix.length) !== -1;
		}

		var ast = esprima.parse(source, {loc: true});
		estraverse.replace(ast, {
			enter: function(node, parent) {
				if (parent.skip) {
					node.skip = true;
					return node;
				}
				if (parent.type === "AssignmentExpression" && node === parent.left) {
					node.skip = true;
					return node;
				}
				if ('id' in parent && node === parent.id) {
					node.skip = true;
					return node;
				}
				if (parent.type === "MemberExpression") {
					node.skip = true;
					return node;
				}
				if (parent.type === "FunctionDeclaration" && (node !== parent.body && node !== parent.defaults)) {
					node.skip = true;
					return node;
				}
				if (parent.type === "CallExpression" && node === parent.callee) {
					node.skip = true;
					return node;
				}
			},
			leave: function (node, parent) {
				if (node.skip) return node;

				var member_expression = {
					type: "MemberExpression",
					computed: false,
					object: {
						type: "Identifier",
						name: "window"
					},
					property: {
						type: "Identifier",
						name: "__lv"
					}
				};

				if (node.type.endsWith("Expression")) {
					return {type: "CallExpression", callee: member_expression, arguments: [node]};
				}
				if (node.type === "Identifier") {
					return {type: "CallExpression", callee: member_expression, arguments: [node]};
				}
				return node;
			}
		});
		var processed_source = escodegen.generate(ast) + '\n//@ sourceURL=foo.js';
		return processed_source;
	},

	injectedScript: function __beforeAll () {
		/* do-not-preprocess */
		window.__lv =  function(value){ console.log(value); return value; }
	},

	requiredLibs: function() {
		return ['esprima.js', 'estraverse.js', 'escodegen.browser.js'];
	}
}
LiveVariable.prototype.__proto__ = Tool.prototype;
