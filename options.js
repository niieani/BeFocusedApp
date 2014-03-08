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
    var options = opt_options || Asana.Options.loadedOptions; //Asana.Options.loadOptions();
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
      asana_api_key: null,
      default_workspace_id: 0
    };
  },

  loadedOptions: {},

  /**
   * Load the user's preferences synchronously from local storage.
   *
   * @return {dict} The user's stored options
   */
  loadOptions: function(callback) {
      var me = this;
      chrome.storage.sync.get('options', function (result) {
        if (! result.options)
        {
            console.log("loaded default options");
            Asana.Options.loadedOptions = me.defaultOptions();
//            console.log(Asana.Options.loadedOptions);
            Asana.Options.saveOptions(Asana.Options.loadedOptions, function(options){
                callback(options);
//                console.log(options);
            });
        }
        else
        {
            console.log("loaded options from sync");
            console.log(result.options);
            Asana.Options.loadedOptions = JSON.parse(result.options);
            callback(Asana.Options.loadedOptions);
//        console.log(options);
//            return options;
        }

        return Asana.Options.loadedOptions;
     });
      /*
      if (options === null)
      {
          console.log("loaded default options");
          options = this.defaultOptions();
          chrome.storage.sync.set({'options': JSON.stringify(options)});
      }

    console.log("returning options:");
    console.log(options);
    return options;
    */
  },

  /**
   * Save the user's preferences synchronously to local storage.
   * Overwrites all options.
   *
   * @param options {dict} The user's options.
   */
  saveOptions: function(options, callback) {
      var newOptions = JSON.stringify(options);
      Asana.Options.loadedOptions = newOptions;
      chrome.storage.sync.set({'options': newOptions}, function(){
          console.log("saved options");
          console.log(options);
          if(callback)
            callback(options);
      });
  },

  /**
   * Reset the user's preferences to the defaults.
   */
  resetOptions: function(callback) {
    Asana.Options.loadedOptions = this.defaultOptions();
    delete chrome.storage.sync.remove('options', function(){
        console.log("reset options");
        callback(Asana.Options.loadedOptions);
    });
  }

};
