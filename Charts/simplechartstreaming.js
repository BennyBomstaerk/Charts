//Sample access code replace with your own, or paste another one into the "Access Code" field on the form.
var ACCESS_TOKEN = "eyJhbGciOiJFUzI1NiIsIng1dCI6IkEwMEFDMEE1MzcxMDRBMTM1RDg0NkM4NkFDN0ZERkU1RUE4REIyOTkifQ.eyJvYWEiOiI3Nzc3MCIsImlzcyI6Im9hIiwiYWlkIjoiMTIiLCJ1aWQiOiJPVjZaTDItQVlCMFZ2VzJGekVxejdBPT0iLCJjaWQiOiJPVjZaTDItQVlCMFZ2VzJGekVxejdBPT0iLCJpc2EiOiJUcnVlIiwidGlkIjoiMjAwNSIsInNpZCI6ImFiMDhlNzA5ZmIzNzRiYjliZmNjMTRlOWQ1NmNkZmUyIiwiZGdpIjoiODIiLCJleHAiOiIxNDU1MDQ0MDA1In0.ejFIxT_LmaFZ-lV9gpUfyaRwwongQNUr9Hoj1Srn9Rd9SfqoRPlK7DCYnngHDajGq4xEDvCJrHHgBUM7ci8YZw";
var BASE_URL = "https://gateway.saxobank.com/sim/openapi";
var CHART_URL= BASE_URL+"/chart/v1/charts";


var renderer = new Renderer("#statusCode", "#responseBody");
var openApiCommunication = new OpenApiCommunication(BASE_URL, ACCESS_TOKEN, renderer);
var chart = new HighChart();


//UI related variables
var accessTokenDiv = $("#accessToken");
var assetTypeDiv = $("#assetType");
var uicDiv = $("#uic");
var horizonDiv = $("#horizon");
var timeZoneIdDiv = $("#timeZoneId");

var startStreamingBtn = $("#startStreamingBtn");
var getCurrentChartBtn = $("#getCurrentChartBtn");
var getOlderSamplesBtn = $("#getOlderSamplesBtn");


//Streaming related variables
var referenceCounter = 0;
var snapshotReceived = false;
var referenceId;
var messageQueue = [];

//Chart related variables
var dataVersion;
var displayAndFormat;
var earliestSampleTime;
var assetType;

//Response to user input:
//Override the Access token "already baked into the code".
function setAccessToken() {
    ACCESS_TOKEN = accessTokenDiv.val();
}

function startStreaming() {
    openApiCommunication.createStreamingConnection(receiveMessages,calledOnConnect);
}

function getCurrentChart() {
    assetType = assetTypeDiv.val();
    //i.e subscribe to receive snapshot and then start receiving updates

    makeSubscriptionRequest();
    getCurrentChartBtn.hide();
    getOlderSamplesBtn.show();
}
function getOlderSamples() {
    getHistoricalSamples();
}
//TEST ONLY
function test() {
    restart();
}



function makeSubscriptionRequest() {
    referenceId = openApiCommunication.generateReferenceId();
    var arguments= {
        AssetType: assetTypeDiv.val(),
        Uic: uicDiv.val(),
        Horizon: horizonDiv.val(),
        TimeZoneId: timeZoneIdDiv.val(),
        Count: 100,
        //Time: new Date().toISOString(),
        Time:"2016-01-28T00:00:08.460Z",
        FieldGroups: ['Data', 'ChartInfo', 'DisplayAndFormat']
    };
    openApiCommunication.subscribe(referenceId, CHART_URL, 300, arguments, processSnapshot);
}


function calledOnConnect() {
    console.log('streaming connection started.');
    getCurrentChartBtn.show();
}


function processSnapshot(response) {
    console.log("Snapshot received- populate chart!");
    chart.showLoading();
    mapOtherInfo(response.Snapshot);
    chart.setTitle({ text: "Simple OpenAPI Chart Data Demo" }, { text: "Chart data for " + displayAndFormat.symbol + "-" + displayAndFormat.description });
    addChartData(response.Snapshot);
    storeEarliestSampleTime(response.Snapshot);
    chart.redraw();
    chart.hideLoading();
    processQueuedMessages();
    snapshotReceived = true;
}

function processQueuedMessages() {
    while (messageQueue.length > 0) {
        var messages = messageQueue.shift();
        if (!processMessages(messages)) {
            restart();
            return;
        }
    }
}
function receiveMessages(messages) {
    console.log("receiving streaming data:" + JSON.stringify(messages));
    if (!snapshotReceived) {
        messageQueue.push(messages);
    }
    else {
        processMessages(messages);
    }
}

//process an array of messages
//returns false if messages include instruction to reset subscription, this could either be
//a) because mesage was a _resetsubscriptions message or
//b) dataVersion had changed
function processMessages(messages) {
    for (var i = 0; i < messages.length; i++) {
        var message = messages[i];
        if (message.ReferenceId === '_resetsubscriptions') {
            //Restart if _resetsubscriptions received and TargetReferenceIds include 'our reference id' or is empty.
            if ((null != message.TargetReferenceIds) || (typeof message.TargetReferenceIds != 'undefined')) {
                if ($.inArray(referenceId, message.TargetReferenceIds) > -1) {
                    return false;
                }
            }
            else {
                return false;
            }
        }
        else if (message.ReferenceId === referenceId) {
            if ((null == message.DataVersion) || (typeof message.DataVersion == 'undefined') || (message.DataVersion === dataVersion)) {
                mergeChartData(message);
            }
            else {
                return false;
            }
        }
    }
    return true;
}

function restart() {
    //something went wrong or has changed
    //delete subscription & reset chart
    openApiCommunication.removeSubscription(referenceId, function () {
        resetUI();
    });
    alert("Something went wrong, so please get data gain. This should of course be done automatically.");
}
function resetUI() {
    getCurrentChartBtn.show();
    getOlderSamplesBtn.hide();
    chart.series[0].setData([]);
}
function mapOtherInfo(chartData) {
    dataVersion = chartData.DataVersion;
    displayAndFormat = {
        currency: chartData.DisplayAndFormat.currency,
        decimals: chartData.DisplayAndFormat.decimals,
        description: chartData.DisplayAndFormat.Description,
        format: chartData.DisplayAndFormat.AllowDecimalPips,
        symbol: chartData.DisplayAndFormat.Symbol
    };
}
function addChartData(chartData) {
    console.log("addChartData started");
    for (var i = 0; i < chartData.Data.length; i++) {
        var point = mapChartDataSample(chartData.Data[i]);
        chart.series[0].addPoint(point, false);
    }
    console.log("addChartData completed");
}
function mapChartDataSample(d) {
    var p;
    switch (assetType) {
        case 'FxSpot':
        case 'CfdOnStock':
        case 'CfdOnIndex':
        case 'cfdOnFutures':
            p = {
                close: d.CloseBid,
                color: (d.CloseBid >= d.OpenBid) ? 'green' : 'red',
                high: d.HighBid,
                id: d.Time,
                low: d.LowBid,
                open: d.OpenBid,
                x: Date.parse(d.Time)
            };
            break;
        case 'Stock':
        case 'FuturesStrategy':
        case 'ManagedFund':
        case 'StockIndex':
            p = {
                close: d.Close,
                color: (d.Close >= d.Open) ? 'green' : 'red',
                high: d.High,
                id: d.Time,
                low: d.Low,
                open: d.Open,
                x: Date.parse(d.Time)
            };
            break;
    }
    return p;
}
function storeEarliestSampleTime(chartData) {
    if (chartData.Data.length > 0) {
        earliestSampleTime = chartData.Data[0].Time;
    }
}
function mergeChartData(chartData) {
    for (var i = 0; i < chartData.Data.length; i++) {
        var d = chartData.Data[i];
        var point = mapChartDataSample(d);
        //Determine if we should update existing point or add a new point
        var currentPoint = chart.get(d.Time);
        if ((null != currentPoint) && (typeof currentPoint != 'undefined')) {
            currentPoint.update(point);
            console.log("Updating latest point");
        }
        else {
            chart.series[0].addPoint(point);
            console.log("Adding new point");
        }
        //Update horizontal line
        if (i == chartData.Data.length - 1) {
            chart.yAxis[0].update({
                plotLines: [{
                        value: point.close,
                        width: 1,
                        color: 'blue',
                        dashStyle: 'dash',
                        zIndex: 10
                    }]
            });
        }
    }
}
function getHistoricalSamples() {
    var queryParameters = "uic=" + uicDiv.val() + "&assetType=" + assetTypeDiv.val() + "&horizon=" + horizonDiv.val() + '&timeZoneId=' + timeZoneIdDiv.val();
    queryParameters += "&mode=UpTo & fieldGroups=Data count=1200 &time=" + earliestSampleTime;
    var url = CHART_URL + "/?" + queryParameters;
    console.log("callOpenApi - get old samples");
    openApiCommunication.callOpenApi("GET", url, {}, function (chartData) {
        console.log("get old samples - returned");
        if (chartData.DataVersion === dataVersion) {
            addChartData(chartData);
            storeEarliestSampleTime(chartData);
            chart.redraw();
        }
        else {
            restart();
        }
    });
}


//# sourceMappingURL=simplechartstreaming.js.map