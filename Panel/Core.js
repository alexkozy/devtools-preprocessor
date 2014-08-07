function Core(title_span) {
    this.current_ = "";
    this.title_span_ = title_span;
    this.tools_ = {}
}

Core.prototype = {
    register: function(name, tool, view) {
        this.tools_[name] = {tool: tool, view: view};
        view.hide();

        view.div.querySelector('.reload-button').addEventListener('click', function() {
            var options = {
                ignoreCache: true,
                userAgent: undefined,
                injectedScript: tool.injectedScript.toString() + '__beforeAll()',
                preprocessingScript: tool.preprocessorWithLibs()
            };
            chrome.devtools.inspectedWindow.reload(options);
        });

        view.div.querySelector('.refresh-button').addEventListener('click', function() {
            view.refresh();
        });

        if (view.div.querySelector('.test-button')) {
            view.div.querySelector('.test-button').addEventListener('click', function() {

                chrome.devtools.inspectedWindow.getResources(function(resources){
                    console.log(resources);

                    view.model_._visitFrame(undefined, resources).then(function(urls){
                        function getSingleArray(arrays) {
                            var output = [];
                            for (var i = 0; i < arrays.length; ++i) {
                                if (Array.isArray(arrays[i]))
                                    output = output.concat(getSingleArray(arrays[i]));
                                else
                                    output = output.concat([arrays[i]]);
                            }
                            return output;
                        }

                        urls = getSingleArray(urls);

                        view.model_.getFullReport([undefined].concat(urls)).then(function(reports){
                            console.log(reports);
                        });
                    });
                });
            });
        }

        view.div.querySelector('.enabled-checkbox').addEventListener('change', function() {
            var newValue = view.div.querySelector('.enabled-checkbox').checked;
            var expr = 'window.top.__profileEnable = ' + newValue.toString();
            function onEval(profileEnable, isException) {
                if (isException)
                    throw new Error('Eval failed for ' + expr, isException.value);
            }
            chrome.devtools.inspectedWindow.eval(expr, onEval);
          });
    },

    show: function(name) {
        if (this.current_ in this.tools_)
            this.tools_[this.current_].view.hide();
        this.current_ = "";
        if (name in this.tools_)
            this.tools_[name].view.show();
        this.current_ = name;
        this.title_span_.innerHTML = name;
    }

}

document.addEventListener('polymer-ready', function() {
    core = new Core(document.getElementById('title'));

    core.register('Profiler', new Profiler(), new ProfilerView(document.getElementById('profiler-content')));
    core.register('Hits Counter', new HitsCounter(), new HitsCounterView(document.getElementById('hits-counter-content')));

    var link_profiler = document.getElementById('link-profiler');
    link_profiler.addEventListener('click', function() {
        core.show('Profiler');
    });

    var link_hits_counter = document.getElementById('link-hits-counter');
    link_hits_counter.addEventListener('click', function() {
        core.show('Hits Counter');
    });

    codeMirror = CodeMirror.fromTextArea(document.getElementById('code-view'), {
            mode: "javascript",
            lineNumbers: true,
            gutters: ["CodeMirror-linenumbers", "hits"],
            readOnly: true
    });

    // TODO: move to view
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
});