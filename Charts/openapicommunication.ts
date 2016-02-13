module OpenApi {
    "use strict";
    export interface OpenApiSubscriptionResponse {
        ContextId: string,
        Format: string,
        InactivityTimeOut: string,
        ReferenceId: string,
        RefreshRate: number,
        Snapshot: any,
        State: string,
        Tag: string
    }

    export interface OpenApiStreamingResponse {
        ReferenceId: string,
        TimeStamp: string,  //TODO check this out also
        Data?: any,
        TargetReferenceIds?: string[],
        __p?: number,
        __n?: number
    }


    export interface OpenApiCommunication {
        new (baseUrl: string, accessToken: string, renderer: OpenApi.Renderer): OpenApiCommunication;

        createStreamingConnection(receiveMessages: (messages: any) => void, calledOnConnect: () => void): void;
        connect(callBack: () => void): void;
        subscribe(refId: string, resUrl: string, refreshRate: number, args: any, processSnapshot: any): void;
        removeSubscription(refId: string, callback: () => void): void;
        generateReferenceId(prefix: string): string;
        callOpenApi(verb: string, url: string, data: any, callback: any): void;
    }





    export var OpenApiCommunication: OpenApiCommunication = <ClassFunction>function (baseUrl: string, accessToken: string, renderer: Renderer) {
        "use strict";
        var streamingConnectionUrl = baseUrl + "/streaming/connection";
        var streamingKeepAliveUrl = baseUrl + "/root/subscriptions/keepalive";
        var connection: SignalR;
        var contextId = encodeURIComponent("C" + Date.now());
        var referenceCounter = 0;

        var referenceId = "0"; //TODO for now assume there is only one subscription!!
        var resourceUrl = "";

        //
        //Start of code relating to establishing and keeping alive the streaming connection
        //
        var
            createStreamingConnection = function (receiveMessages: (messages: OpenApiStreamingResponse[]) => void, calledOnConnect: () => void) {  //TODO:messages
                var qs = createQueryString(accessToken);
                console.info("Initializing streaming uri to: " + streamingConnectionUrl);
                connection = $.connection(streamingConnectionUrl, qs, true);
                connection.stateChanged(onStateChanged);
                connection.received(receiveMessages);
                connect(calledOnConnect);
            },

            createQueryString = function (accessToken: string) {
                return "authorization=" + encodeURIComponent(accessToken) + "&context=" + contextId;
            },

            connect = function (callBack: () => void) {
                connection.start({}, function () {
                    console.info("starting streaming connection.");
                }).done(function () {
                    console.log('streaming connection started.');
                    callBack();
                    executeKeepAliveRequest();
                }).fail(function () {
                    console.log("streaming connection failed.");
                });
            },
            executeKeepAliveRequest = function () {
                var url = streamingKeepAliveUrl + "/" + contextId;
                callOpenApi('PUT', url, {}, function (data: any) {
                    console.log("Keep alive done, data: ", JSON.stringify(data));
                    // Schedule next keep alive
                    setTimeout(function () {
                        executeKeepAliveRequest();
                    }, data.NextKeepAlive * 1000);
                });
            },
            onStateChanged = function (change: SignalRStateChange) {
                var oldState = mapConnectionState(change.oldState), newState = mapConnectionState(change.newState);
                console.log("SignalR connection state changed from: '" + oldState + "' to '" + newState + "'");
            },
            mapConnectionState = function (state: number) {
                switch (state) {
                    case $.signalR.connectionState.connecting:
                        return "connecting";
                    case $.signalR.connectionState.connected:
                        return "connected";
                    case $.signalR.connectionState.reconnecting:
                        return "reconnecting";
                    case $.signalR.connectionState.reconnected:
                        return "reconnected";
                    case $.signalR.connectionState.disconnected:
                        return "disconnected";
                    default:
                        return "unknown";
                }
            },
            subscribe = function (refId: string, resUrl: string, refreshRate: number, args: any, processSnapshot: (response: OpenApiSubscriptionResponse) => void) {
                referenceId = refId;
                resourceUrl = resUrl;

                var requestData = {
                    Arguments: args,
                    ContextId: contextId,
                    ReferenceId: refId,
                    RefreshRate: refreshRate
                };
                var url = resourceUrl + '/subscriptions/active';
                callOpenApi('POST', url, requestData, processSnapshot);

            },

            removeSubscription = function (refId: string, callback: () => void) {
                var url = resourceUrl + '/subscriptions/' + contextId + '/' + referenceId;
                callOpenApi("DELETE", url, {}, function () {
                    console.log("subscription removed");
                    callback();
                });
            },

            generateReferenceId = function (prefix = "yy_") {                //TODO check if this works!
                //if ((null === prefix) || (typeof prefix === 'undefined')) {
                //    prefix = "ex_";
                //}
                return prefix + generateUniqueId();
            },
            generateUniqueId = function () {
                var now = new Date();
                return now.getFullYear().toString() + prefixZero(now.getMonth()) + prefixZero(now.getDate()) + prefixZero(now.getHours())
                    + prefixZero(now.getMinutes()) + prefixZero(now.getSeconds()) + prefixZero(now.getMilliseconds()) + (++referenceCounter).toString();
            },

            prefixZero = function (v: number) {
                if (("" + v).length === 1)
                    return "0" + v;
                return v.toString();
            },

            callOpenApi = function (verb: string, url: string, data: any, callback: any) {
                var dataString = (data) ? JSON.stringify(data) : "";
                $.ajax({
                    type: verb,
                    data: dataString,
                    url: url,
                    contentType: "application/json",
                    cache: true,
                    xhrFields: { withCredentials: true },
                    beforeSend: function (jqXHR) {
                        jqXHR.setRequestHeader("Authorization", "BEARER" + " " + accessToken);
                    }
                }).then(function (responseData, status, jqXHR) {
                    renderer.showResponse(jqXHR.status.toString(), responseData);
                    if (callback) {
                        callback(responseData);
                    }
                }).fail(function (jqXHR, textStatus) {
                    var responseMessage = jqXHR.status + ":" + jqXHR.statusText;
                    renderer.showResponse(responseMessage, jqXHR.responseText);
                });
            }

        return {
            createStreamingConnection: createStreamingConnection,
            connect: connect,
            subscribe: subscribe,
            removeSubscription: removeSubscription,
            generateReferenceId,
            callOpenApi
        }

    }
}