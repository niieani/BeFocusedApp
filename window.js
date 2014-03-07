Window = {
    onLoad: function() {
        var me = this;

        // Our default error handler.
        Asana.ServerModel.onError = function(response) {
            me.showError(response.errors[0].message);
        };

        // And ensure the user is logged in ...
        Asana.ServerModel.isLoggedIn(function(is_logged_in) {
            if (is_logged_in) {
                if (window.quick_add_request) {
                    Asana.ServerModel.logEvent({
                        name: "ChromeExtension-Open-QuickAdd"
                    });
                    // If this was a QuickAdd request (set by the code popping up
                    // the window in Asana.ExtensionServer), then we have all the
                    // info we need and should show the add UI right away.
                    me.showAddUi(
                        quick_add_request.url, quick_add_request.title,
                        quick_add_request.selected_text,
                        quick_add_request.favicon_url,
                        quick_add_request.active_window_titles,
                        quick_add_request.active_window_urls
                    );
                } else {
                    Asana.ServerModel.logEvent({
                        name: "ChromeExtension-Open-Button"
                    });
                    // Otherwise we want to get the selection from the tab that
                    // was active when we were opened. So we set up a listener
                    // to listen for the selection send event from the content
                    // window ...
                    var selection = "";
                    var listener = function(request, sender, sendResponse) {
                        if (request.type === "selection") {
                            chrome.runtime.onMessage.removeListener(listener);
                            console.info("Asana popup got selection");
                            selection = "\n" + request.value;
                        }
                    };
                    chrome.runtime.onMessage.addListener(listener);
                    me.showAddUi(tab.url, tab.title, '', tab.favIconUrl,
                        active_window_titles,
                        active_window_urls);
                }
            } else {
                // The user is not even logged in. Prompt them to do so!
                me.showLogin(
                    Asana.Options.loginUrl(options),
                    Asana.Options.signupUrl(options));
            }
        });



        Asana.update(this, {


        showView: function(name) {
            ["login", "add"].forEach(function(view_name) {
                $("#" + view_name + "_view").css("display", view_name === name ? "" : "none");
            });
        },

        showAddUi: function(url, title, selected_text, favicon_url, active_window_titles, active_window_urls) {
            var me = this;

            // Store off info from page we got triggered from.
            me.page_url = url;
            me.page_title = title;
            me.page_selection = selected_text;
            me.favicon_url = favicon_url;
            me.active_window_titles = active_window_titles;
            me.active_window_urls = active_window_urls;

            // Populate workspace selector and select default.
            Asana.ServerModel.me(function(user) {
                me.user_id = user.id;
                Asana.ServerModel.workspaces(function(workspaces) {
                    me.workspaces = workspaces;
                    var select = $("#workspace_select");
                    select.html("");
                    workspaces.forEach(function(workspace) {
                        $("#workspace_select").append(
                            "<option value='" + workspace.id + "'>" + workspace.name + "</option>");
                    });
                    if (workspaces.length > 1) {
                        $("workspace_select_container").show();
                    } else {
                        $("workspace_select_container").hide();
                    }
                    select.val(me.options.default_workspace_id);
                    me.onWorkspaceChanged();
                    select.change(function() {
                        if (select.val() !== me.options.default_workspace_id) {
                            Asana.ServerModel.logEvent({
                                name: "ChromeExtension-ChangedWorkspace"
                            });
                        }
                        me.onWorkspaceChanged();
                    });

                    // Set initial UI state

                    getCurrentTags = function(){
                        return me.tags_in_asana;
                    }
                    getCurrentProjects = function(){
                        return me.projects_in_asana;
                    }

                    $('#tags_input').tagit({
                        removeConfirmation: true,
                        allowSpaces: true,
                        autoFocus: true,
                        autocomplete: {
//                  autoFocus: true,
                            source: function(request, response){
                                response( $.ui.autocomplete.filter(
                                    getCurrentTags(), request.term ) );
                            }
                        },
                        caseSensitive: false,
                        placeholderText: "Tags",
                        preprocessTag: function(val) {
                            if (!val) { return ''; }
                            // find the correct case
                            var index = $.inArrayIn(val, me.tags_in_asana);
                            if (index > -1)
                            {
                                console.log(me.tags_in_asana[index]);
                                return me.tags_in_asana[index];
                            }
                            else
                                return val;
                        }
                    });

                    $('#projects_input').tagit({
                        removeConfirmation: true,
                        allowSpaces: true,
                        autoFocus: true,
                        autocomplete: {
//                  autoFocus: true,
                            source: function(request, response){
                                response( $.ui.autocomplete.filter(
                                    getCurrentProjects(), request.term ) );
                            }
                        },
                        caseSensitive: false,
                        placeholderText: "Projects",
                        preprocessTag: function(val) {
                            if (!val) { return ''; }
                            // find the correct case
                            var index = $.inArrayIn(val, me.projects_in_asana);
                            if (index > -1)
                            {
                                console.log(me.projects_in_asana[index]);
                                return me.projects_in_asana[index];
                            }
                            else
                                return val;
                        }
                    });

                    me.resetFields();
                    me.showView("add");
                    var name_input = $("#name_input");
                    name_input.focus();
                    name_input.select();

                    if (favicon_url) {
                        $(".icon-use-link").css("background-image", "url(" + favicon_url + ")");
                    } else {
                        $(".icon-use-link").addClass("no-favicon sprite");
                    }
                });
            });
        },

        showError: function(message) {
            console.log("Error: " + message);
            $("#error").css("display", "inline-block");
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

            // Update selected workspace
            $("#workspace").html($("#workspace_select option:selected").text());

            // Save selection as new default.
            me.options.default_workspace_id = workspace_id;
            Asana.ServerModel.saveOptions(me.options, function() {});

            // Update assignee list.
            me.setAddEnabled(false);
            Asana.ServerModel.users(workspace_id, function(users) {
                me.typeahead.updateUsers(users);
                me.setAddEnabled(true);
            });

            // Update tags.
            Asana.ServerModel.tags(workspace_id, function(tags) {
                me.tags = tags;

                me.tags_in_asana = new Array();
                tags.forEach(function(tag) {
                    me.tags_in_asana.push(tag.name)
                });
            });

            // Update projects.
            Asana.ServerModel.projects(workspace_id, function(projects) {
                me.projects = projects;

                me.projects_in_asana = new Array();
                projects.forEach(function(project) {
                    me.projects_in_asana.push(project.name)
                });
            });
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
        showLogin: function(login_url, signup_url) {
            var me = this;
            $("#login_button").click(function() {
                chrome.tabs.create({url: login_url});
                window.close();
                return false;
            });
            $("#signup_button").click(function() {
                chrome.tabs.create({url: signup_url});
                window.close();
                return false;
            });
            me.showView("login");
        }
        });
    }
}


$(window).load(function() {
    Window.onLoad();
});
