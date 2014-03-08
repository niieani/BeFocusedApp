// from core extension
//Asana.Options.loadOptions(function(options){
//Asana.Options.resetOptions(function(options){

        Asana.ExtensionServer.listen();
        Asana.ServerModel.startPrimingCache();

// end from core extension

//});


chrome.app.runtime.onLaunched.addListener(function() {
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
});
