// Copyright (c) 2014 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

function Core() {}

Core.prototype = {}

document.addEventListener('polymer-ready', function() {
    var progress_div = document.getElementById('progress');
    var title_el = document.getElementById('title');

    core = new Core(document.getElementById('title'));
    core.Profiler = new ProfilerView(title_el, document.getElementById('profiler-content'), progress_div);
    core.Profiler.setModel(new ProfilerModel());
    core.Profiler.hide();

    core.HitsCounter = new HitsCounterView(title_el, document.getElementById('hits-counter-content'), progress_div);
    core.HitsCounter.setModel(new HitsCounterModel());
    core.HitsCounter.hide();

    var link_profiler = document.getElementById('link-profiler');
    link_profiler.addEventListener('click', function() {
        core.HitsCounter.hide();
        core.Profiler.show();
    });

    var link_hits_counter = document.getElementById('link-hits-counter');
    link_hits_counter.addEventListener('click', function() {
        core.Profiler.hide();
        core.HitsCounter.show();
    });
});