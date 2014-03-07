/**
 * Module to load/save options to preferences. Options are represented
 * as a dictionary with the following fields:
 *
 *     asana_host_port {String} host and (optional) port of the asana
 *         server to connect to.
 *     default_workspace_id {Integer} ID of the workspace that tasks should
 *         go into by default. The user will be allowed to choose a
 *         different option when adding a task. This is 0 if no default
 *         workspace is selected.
 *
 * They are stored off in browser local storage for the extension as a
 * single serialized string, read/written all-or-nothing.
 */
Asana.Options = {

  /**
   * @param opt_options {dict} Options to use; if unspecified will be loaded.
   * @return {String} The URL for the login page.
   */
  loginUrl: function(opt_options) {
    var options = opt_options || Asana.Options.loadOptions();
    return 'https://' + options.asana_host_port + '/';
  },

  /**
   * @param opt_options {dict} Options to use; if unspecified will be loaded.
   * @return {String} The URL for the signup page.
   */
  signupUrl: function(opt_options) {
    return 'http://asana.com/?utm_source=chrome&utm_medium=ext&utm_campaign=ext';
  },

  /**
   * @return {dict} Default options.
   */
  defaultOptions: function() {
    return {
      asana_host_port: "app.asana.com",
      default_workspace_id: 0,
      default_assignee_id: 0,
      default_projects: [],
      default_tags: []
    };
  },

  /**
   * Load the user's preferences synchronously from local storage.
   *
   * @return {dict} The user's stored options
   */
  loadOptions: function() {
    var options;
    chrome.storage.local.get('options', function (result) {
        options = JSON.parse(result.options);
        if (result.options)
//        if (result.options && !runtime && !runtime.lastError)
            return options;
    });

    options = this.defaultOptions();
    chrome.storage.local.set({'options': JSON.stringify(options)});

    return options;
  },

  /**
   * Save the user's preferences synchronously to local storage.
   * Overwrites all options.
   *
   * @param options {dict} The user's options.
   */
  saveOptions: function(options) {
      chrome.storage.local.set({'options': JSON.stringify(options)});
  },

  /**
   * Reset the user's preferences to the defaults.
   */
  resetOptions: function() {
    delete chrome.storage.local.remove('options');
    this.loadOptions();
  }

};
