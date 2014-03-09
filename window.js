Window = {
    options: null,
    workspaces: null,
    user_id: null,
    tasks_today: null,
    _tasks_refresh_interval: null,
    TASKS_REFRESH_INTERVAL_MS: 8 * 1000,
    current_task_id: null,
    current_task_order: null,
    update_in_progress: false,
    update_timer: new Array(),
    height_size_open: null,
    height_size_closed: null,
    name_input: null,

    onLoad: function() {
        var me = this;

        // Our default error handler.
        Asana.ServerModel.onError = function(response) {
            console.log(response);
            me.showError(response.errors[0].message);
        };

        $('#close_popup').click(function() {
            chrome.app.window.current().close();
        });

        Asana.update(me, {

        showView: function(name) {
            ["login", "add"].forEach(function(view_name) {
                $("#" + view_name + "_view").css("display", view_name === name ? "" : "none");
            });
        },

        showUi: function(miss_cache) {
            var me = this;
//            if (!miss_cache)
//                miss_cache = false;

            $('#update_key').click(function() {
                me.hideError();
                me.showView("login");
            });

            // Populate workspace selector and select default.
            Asana.ServerModel.me(function(user) {
                me.user_id = user.id;
                Asana.ServerModel.workspaces(function(workspaces) {

                    // Set initial UI state
                    me.showView("add");

                    var body = $("body");
                    var screenCssPixelRatio = (window.outerWidth - 8) / window.innerWidth;
                    chrome.app.window.current().setBounds({
                        width: Math.round(Asana.APP_WIDTH_NORMALIZED * screenCssPixelRatio),
                        height: Math.round(body.outerHeight() * screenCssPixelRatio),
                        top: 0
                    });

                    me.height_size_open = Math.round(body.outerHeight() * screenCssPixelRatio);
                    $('.banner').toggle();
                    me.height_size_closed = Math.round(body.outerHeight() * screenCssPixelRatio);
                    $('.banner').toggle();

                    $('#toggle_header').click(function() {
                        var oldHeight;
                        var properHeight;

                        if ($('.banner').is(":visible"))
                        {
                            oldHeight = me.height_size_open;
                            properHeight = me.height_size_closed;
                        }
                        else
                        {
                            oldHeight = me.height_size_closed;
                            properHeight = me.height_size_open;
                        }

                        $('.banner').slideToggle("slow");

                        var from    = {i:oldHeight},
                            to      = {i:properHeight};
                        $(from).animate(to,{duration: "slow", step: function(step){
                            chrome.app.window.current().setBounds({ height: Math.round(step) });
                        }});
                    });

                    me.name_input = $("#name_input");
                    me.disableInput();

                    me.workspaces = workspaces;
                    var select = $("#workspace_select");
                    select.html("");
                    workspaces.forEach(function(workspace) {
                        $("#workspace_select").append(
                            "<option value='" + workspace.id + "'>" + workspace.name + "</option>");
                    });
                    /*
                    if (workspaces.length > 1) {
                        $("workspace_select_container").show();
                    } else {
                        $("workspace_select_container").hide();
                    }
                    */

                    if (!me.options.default_workspace_id || me.options.default_workspace_id == 0 || me.options.default_workspace_id == null)
                        select.val(workspaces[0].id);
                    else
                        select.val(me.options.default_workspace_id);

                    me.onWorkspaceChanged();

                    select.change(function() {
                        me.disableInput();
                        if (select.val() !== me.options.default_workspace_id) {
                            Asana.ServerModel.logEvent({
                                name: "ChromeExtension-ChangedWorkspace"
                            });
                        }
                        me.onWorkspaceChanged();
                    });

                    var complete_button = $('#complete_button');
                    complete_button.click(function() {
                        me.completeTask(me.current_task_id, me.current_task_order);
                    });
                    me.name_input.keypress(function(e) {
                        if ( e.ctrlKey && ( e.which === 13 || e.which === 10 ) ) {
                            console.log( "You pressed CTRL + Enter" );
                            me.completeTask(me.current_task_id, me.current_task_order);
                        }
                        else if(e.which === 13) {
                            // create new task and select it
                            me.disableInput();
                            me.createEmptyTask(function(newTask){
//                                console.log(newTask);
                                me.setCurrent(newTask, me.tasks_today.length - 1);
                                me.name_input.focus();
                            });
//                            alert('You pressed enter!');
                        }
                        /*
                        else if(e.which >=45 && e.which <= 90)
                        {
                            me.updateTask(me.current_task_id, {
                                name: me.name_input.text()
                            });
                        }
                        */
                    });
                    me.name_input.keydown(function(e) {
                        if (e.which === 40) {
                            // down arrow
                            var newTaskOrder = me.current_task_order + 1;
                            if (newTaskOrder >= me.tasks_today.length)
                                newTaskOrder = 0;

                            me.setCurrent(me.tasks_today[newTaskOrder], newTaskOrder);
                        }
                        else if (e.which === 38) {
                            // up arrow
                            var newTaskOrder = me.current_task_order - 1;
                            if (newTaskOrder < 0)
                                newTaskOrder = me.tasks_today.length - 1;

                            me.setCurrent(me.tasks_today[newTaskOrder], newTaskOrder);
                        }
                    });
                    me.name_input.on('input', function() {
                        var nameAtTheTime = me.name_input.val();
                        var idAtTheTime = me.current_task_id;
                        var positionAtTheTime = me.current_task_order;

                        // first update locally:
                        me.tasks_today[positionAtTheTime].name = nameAtTheTime;

                        // now, if 1 second didn't pass, update remotely
                        clearInterval(me.update_timer[idAtTheTime]);
                        me.update_timer[idAtTheTime] = setTimeout(function () {
                            // interval function body
                            // update task
                            me.updateTask(idAtTheTime, {
                                name: nameAtTheTime
                            }, positionAtTheTime);
                            clearTimeout(me.update_timer[idAtTheTime]);
                        }, 1000);
                    });
                });
            }
            //    , null, { miss_cache: miss_cache }
            );
        },

        startPrimingTasks: function() {
            var me = this;
            me.stopPrimingTasks();
            console.log("started priming tasks");
            me._tasks_refresh_interval = setInterval(function() {
                if (!me.update_in_progress)
                {
                    me.fetchTasks();
                }
            }, me.TASKS_REFRESH_INTERVAL_MS);
            if (!me.update_in_progress)
            {
                me.fetchTasks();
            }
        },

        stopPrimingTasks: function() {
            console.log("stopped priming tasks");
            clearInterval(me._tasks_refresh_interval);
        },

        fetchTasks: function() {
            me.update_in_progress = true;
            Asana.ServerModel.tasks(me.selectedWorkspaceId(), me.user_id, function(tasks) {
                me.update_in_progress = false;
                // Prefetch images too
                me.tasks_today = new Array();
                var taskNoLongerExists = true;
                var taskInOrder = 0;
//                console.log("all tasks");
//                console.log(tasks);
                tasks.forEach(function(task) {
                    if (task.completed == false && task.assignee_status == "today")
                    {
//                        console.log(task);
                        me.tasks_today.push(task);

                        // sets first if not there
                        if (me.current_task_id == null)
                            me.setCurrent(task, taskInOrder);

                        // same, current task, just update place if set
                        if (me.current_task_id == task.id)
                        {
                            taskNoLongerExists = false;
                            if (!$("#name_input").is(":focus"))
                                me.setCurrent(task, taskInOrder);
                        }
//                        console.log(task.name);
                        taskInOrder++;
                    }
                });
//                console.log(me.tasks_today);
                if (taskNoLongerExists)
                {
                    if (me.tasks_today.length > 0)
                    {
                        console.log("new task of today is: " + me.tasks_today[0].name);
                        me.setCurrent(me.tasks_today[0], 0);
                    }
                    else
                    {
                        // TODO: create a new task ?
                    }
                }
                me.hideError();
            }, function(response){
                // on error:
                me.update_in_progress = false;
                me.showError(response.errors[0].message);
            }, { miss_cache: true });
        },
            
        disableInput: function()
        {
            me.name_input.prop('disabled', true);
        },

        enableInput: function()
        {
            me.name_input.prop('disabled', false);
        },

        setCurrent: function(current, whichInOrder)
        {
            console.log(current);

//            var me.name_input = $("#name_input");
            var was_focused = me.name_input.is(":focus");

            me.name_input.val(current.name);
            me.enableInput();
            if (was_focused)
                me.name_input.focus();
//            me.name_input.select();
            me.current_task_id = current.id;

            if (whichInOrder !== null)
                me.current_task_order = whichInOrder;

//            console.log('current id ' + current.id);
//            console.log('current in order ' + me.current_task_order);
//            console.log('all tasks');
//            console.log(me.tasks_today);
        },

        createEmptyTask: function(callback)
        {
            if (me.update_in_progress)
            {
                me.stopPrimingTasks();
            }
            me.update_in_progress = true;
            Asana.ServerModel.createTask(me.selectedWorkspaceId(),
                {
                    name: "",
                    assignee: me.user_id, // Default assignee to self
                    assignee_status: "today"
                },
                function(task) {
                    // Success! Show task success, then get ready for another input.
                    Asana.ServerModel.logEvent({
                        name: "ChromeExtension-CreateTask-Success"
                    });
                    me.update_in_progress = false;

                    // add the task to the bottom of the stack
                    me.tasks_today.push(task);
                    console.log(task);
                    callback(task);
                    me.startPrimingTasks();
                },
                function(response) {
                    // Failure. :( Show error, but leave form available for retry.
                    Asana.ServerModel.logEvent({
                        name: "ChromeExtension-CreateTask-Failure"
                    });
                    me.showError(response.errors[0].message);
                    me.update_in_progress = false;
                    me.startPrimingTasks();
                });
        },

        updateTask: function(id, newData, position)
        {
            if (me.update_in_progress)
            {
                me.stopPrimingTasks();
            }
            me.update_in_progress = true;

            Asana.ServerModel.updateTask(id,
                newData,
                function(task) {
                    // Success! Show task success, then get ready for another input.
                    Asana.ServerModel.logEvent({
                        name: "ChromeExtension-UpdateTask-Success"
                    });
                    me.update_in_progress = false;
//                    me.tasks_today[position] = task;
                    me.startPrimingTasks();
                    console.log(task);
                    return task;
                },
                function(response) {
                    // Failure. :( Show error, but leave form available for retry.
                    Asana.ServerModel.logEvent({
                        name: "ChromeExtension-UpdateTask-Failure"
                    });
                    me.showError(response.errors[0].message);
                    me.update_in_progress = false;
                    me.startPrimingTasks();
                    return null;
                });
        },

        completeTask: function(id, order)
        {
            me.disableInput();
//            $('#name_input').prop('disabled', true);

            // this selects the next task:
            /*
            var taskInOrder = 0;
            me.tasks_today.forEach(function(task) {
                if (task.id != id)
                {
                    me.setCurrent(task, taskInOrder);
                    taskInOrder++;
                }
            });
            */

            // this selects the first one, always:
            if (me.tasks_today[0].id != id)
                me.setCurrent(me.tasks_today[0], 0);

            // remove this locally too:
            me.tasks_today.splice(order, 1);

            return me.updateTask(id, { completed: true }, null);
        },

        showError: function(message) {
            console.log("Error: ", message);
            $("#error").css("display", "inline-block");
            this.disableInput();
        },

        hideError: function() {
            $("#error").css("display", "none");
        },

        /**
         * Update the list of users as a result of setting/changing the workspace.
         */
        onWorkspaceChanged: function() {
            var me = this;
            var workspace_id = me.selectedWorkspaceId();

            me.startPrimingTasks();

            // Update selected workspace
            $("#workspace").html($("#workspace_select option:selected").text());

            // Save selection as new default.
            me.options.default_workspace_id = workspace_id;
            Asana.ServerModel.saveOptions(me.options, function() {});
        },

        /**
         * @param id {Integer}
         * @return {dict} Workspace data for the given workspace.
         */
        workspaceById: function(id) {
            var found = null;
            this.workspaces.forEach(function(w) {
                if (w.id === id) {
                    found = w;
                }
            });
            return found;
        },

        /**
         * @return {Integer} ID of the selected workspace.
         */
        selectedWorkspaceId: function() {
            return parseInt($("#workspace_select").val(), 10);
        },

        /**
         * Show the login page.
         */
        showLogin: function(api_key) {
            var me = this;
            $("#api_key_input").val(api_key);

            $("#save_api_key").click(function() {
                Asana.Options.loadedOptions.asana_api_key = $("#api_key_input").val();
                me.options.asana_api_key = $("#api_key_input").val();
//                console.log($("#api_key_input").val());
//                console.log(Asana.Options.loadedOptions.asana_api_key);
//                Asana.Options.loadedOptions = me.options;
//                Asana.ServerModel.refreshCache();
                console.log("options to save: ", me.options);
                Asana.ServerModel.saveOptions(me.options, function() {
                    Asana.ServerModel.startPrimingTasks();
//                    setTimeout(function(){
                        me.showView("add");
                        me.showUi(true);
                        /*
                        var windows = chrome.app.window.getAll();
                        chrome.app.window.create('window.html', {
                            'alwaysOnTop': true,
                            'bounds': {
                                'width': 700,
                                'height': 200
                            },
                            'frame': 'none',
                            'resizable': false,
                            'focused': false
                        });
                        windows.forEach(function(window){
                            window.close();
                        });
                        */
//                    }, 2000);

                });
                return false;
            });
            me.showView("login");
        }
        });


        // Now load our options ...
        Asana.ServerModel.options(function(options) {
            console.log("client loaded options:");
            me.options = options;
            console.log(me.options);

            // And ensure the user is logged in ...
            Asana.ServerModel.isLoggedIn(function(is_logged_in) {
                if (is_logged_in) {
                    me.showUi(false);
                } else {
                    me.showLogin(Asana.Options.loadedOptions.asana_api_key);
                }
            });

        });
    }
}


$(window).load(function() {
    Window.onLoad();
});
