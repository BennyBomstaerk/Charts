interface Renderer {
    new (statusTextId: string, responseDataId: string): Renderer;
    showResponse(statusText: string, responseData: string):void;
}

var Renderer: Renderer = <ClassFunction> function (statusTextId: string, responseDataId: string) {
    var statusTextDiv = $(statusTextId),
        responseDataDiv = $(responseDataId),

        showResponse = function (statusText: string, responseData: string) {
            statusTextDiv.html(statusText);
            responseDataDiv.html(syntaxHighLight(responseData));
        },

        //Taken from http://stackoverflow.com/a/7220510/37147.
        syntaxHighLight = function (json: string) {
            if (json === undefined || json === null) {
                return '';
            }
            if (typeof json !== 'string') {
                json = JSON.stringify(json, undefined, 2);
            }
            // ReSharper disable once QualifiedExpressionMaybeNull
            json = json.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
            return json.replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g, function (match) {
                var cls = 'number';
                if (/^"/.test(match)) {
                    if (/:$/.test(match)) {
                        cls = 'key';
                    }
                    else {
                        cls = 'string';
                    }
                }
                else if (/true|false/.test(match)) {
                    cls = 'boolean';
                }
                else if (/null/.test(match)) {
                    cls = 'null';
                }
                return '<span class="' + cls + '">' + match + '</span>';
            });
        }
    
    return {
        showResponse: showResponse
    } 
}