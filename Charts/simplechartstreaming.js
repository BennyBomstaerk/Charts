var SimpleChartStreaming = (function () {
    function SimpleChartStreaming() {
        var _this = this;
        //Sample access code replace with your own, or paste another one into the "Access Code" field on the form.
        this.ACCESS_TOKEN = "eyJhbGciOiJFUzI1NiIsIng1dCI6IkEwMEFDMEE1MzcxMDRBMTM1RDg0NkM4NkFDN0ZERkU1RUE4REIyOTkifQ.eyJvYWEiOiI3Nzc3MCIsImlzcyI6Im9hIiwiYWlkIjoiMTIiLCJ1aWQiOiJPVjZaTDItQVlCMFZ2VzJGekVxejdBPT0iLCJjaWQiOiJPVjZaTDItQVlCMFZ2VzJGekVxejdBPT0iLCJpc2EiOiJUcnVlIiwidGlkIjoiMjAwNSIsInNpZCI6IjRlMzYzMjc4NGUwZDRmM2JiMTgxZmNjZTQzNDllMjZjIiwiZGdpIjoiODIiLCJleHAiOiIxNDU1Mzg3OTg4In0.r-QTqO5AaxV05wEToar8QB2xPdJ5Z8wXpHxRMTdssOFmqcXb7Hy9ynwtBvNU6DsowlK3Bt1LvaeMb3VWE-xFSw";
        this.BASE_URL = "https://gateway.saxobank.com/sim/openapi";
        this.CHART_URL = this.BASE_URL + "/chart/v1/charts";
        this.renderer = new Renderer("#statusCode", "#responseBody");
        this.openApiCommunication = new OpenApiCommunication(this.BASE_URL, this.ACCESS_TOKEN, this.renderer);
        this.chart = new HighChart();
        //UI related variables
        this.accessTokenDiv = $("#accessToken");
        this.assetTypeDiv = $("#assetType");
        this.uicDiv = $("#uic");
        this.horizonDiv = $("#horizon");
        this.timeZoneIdDiv = $("#timeZoneId");
        this.startStreamingBtn = $("#startStreamingBtn");
        this.getCurrentChartBtn = $("#getCurrentChartBtn");
        this.getOlderSamplesBtn = $("#getOlderSamplesBtn");
        //Streaming related variables
        this.referenceCounter = 0;
        this.snapshotReceived = false;
        this.referenceId = "";
        this.messageQueue = []; //TODO can we do better than that?
        //Chart related variables
        this.dataVersion = 0;
        //Response to user input:
        //Override the Access token "already baked into the code".
        this.setAccessToken = function () {
            _this.ACCESS_TOKEN = _this.accessTokenDiv.val();
        };
        this.startStreaming = function () {
            _this.openApiCommunication.createStreamingConnection(_this.receiveMessages, _this.calledOnConnect);
        };
        this.getCurrentChart = function () {
            _this.assetType = _this.assetTypeDiv.val();
            //i.e subscribe to receive snapshot and then start receiving updates
            _this.makeSubscriptionRequest();
            _this.getCurrentChartBtn.hide();
            _this.getOlderSamplesBtn.show();
        };
        this.getOlderSamples = function () {
            _this.getHistoricalSamples();
        };
        //TEST ONLY
        this.test = function () {
            _this.restart();
        };
        this.makeSubscriptionRequest = function () {
            _this.referenceId = _this.openApiCommunication.generateReferenceId("ex");
            var args = {
                AssetType: _this.assetTypeDiv.val(),
                Uic: _this.uicDiv.val(),
                Horizon: _this.horizonDiv.val(),
                TimeZoneId: _this.timeZoneIdDiv.val(),
                Count: 100,
                //Time: new Date().toISOString(),
                Time: "2016-01-28T00:00:08.460Z",
                FieldGroups: ['Data', 'ChartInfo', 'DisplayAndFormat']
            };
            _this.openApiCommunication.subscribe(_this.referenceId, _this.CHART_URL, 300, args, _this.processSnapshot);
        };
        this.calledOnConnect = function () {
            console.log('streaming connection started.');
            _this.getCurrentChartBtn.show();
        };
        this.processSnapshot = function (response) {
            console.log("Snapshot received- populate chart!");
            _this.chart.showLoading();
            _this.mapOtherInfo(response.Snapshot);
            _this.chart.setTitle({ text: "Simple OpenAPI Chart Data Demo" }, { text: "Chart data for " + _this.displayAndFormat.symbol + "-" + _this.displayAndFormat.description });
            _this.addChartData(response.Snapshot);
            _this.storeEarliestSampleTime(response.Snapshot);
            _this.chart.redraw();
            _this.chart.hideLoading();
            _this.processQueuedMessages();
            _this.snapshotReceived = true;
        };
        this.processQueuedMessages = function () {
            while (_this.messageQueue.length > 0) {
                var messages = _this.messageQueue.shift();
                if (!_this.processMessages(messages)) {
                    _this.restart();
                    return;
                }
            }
        };
        this.receiveMessages = function (messages) {
            console.log("receiving streaming data:" + JSON.stringify(messages));
            if (!_this.snapshotReceived) {
                _this.messageQueue.push(messages);
            }
            else {
                _this.processMessages(messages);
            }
        };
        //process an array of messages
        //returns false if messages include instruction to reset subscription, this could either be
        //a) because mesage was a _resetsubscriptions message or
        //b) dataVersion had changed
        this.processMessages = function (messages) {
            for (var i = 0; i < messages.length; i++) {
                var message = messages[i];
                if (message.ReferenceId === '_resetsubscriptions') {
                    //Restart if _resetsubscriptions received and TargetReferenceIds include 'our reference id' or is empty.
                    if ((null != message.TargetReferenceIds) || (typeof message.TargetReferenceIds != 'undefined')) {
                        if ($.inArray(_this.referenceId, message.TargetReferenceIds) > -1) {
                            return false;
                        }
                    }
                    else {
                        return false;
                    }
                }
                else if (message.ReferenceId === _this.referenceId) {
                    if ((null == message.Data.DataVersion) || (typeof message.Data.DataVersion == 'undefined') || (message.Data.DataVersion === _this.dataVersion)) {
                        _this.mergeChartData(message);
                    }
                    else {
                        return false;
                    }
                }
            }
            return true;
        };
        this.restart = function () {
            //something went wrong or has changed
            //delete subscription & reset chart
            _this.openApiCommunication.removeSubscription(_this.referenceId, function () {
                _this.resetUI();
            });
            alert("Something went wrong, so please get data gain. This should of course be done automatically.");
        };
        this.resetUI = function () {
            _this.getCurrentChartBtn.show();
            _this.getOlderSamplesBtn.hide();
            _this.chart.series[0].setData([]);
        };
        this.mapOtherInfo = function (chartData) {
            _this.dataVersion = chartData.DataVersion;
            _this.displayAndFormat = {
                currency: chartData.DisplayAndFormat.Currency,
                decimals: chartData.DisplayAndFormat.Decimals,
                description: chartData.DisplayAndFormat.Description,
                format: chartData.DisplayAndFormat.Format,
                symbol: chartData.DisplayAndFormat.Symbol
            };
        };
        this.addChartData = function (chartData) {
            console.log("addChartData started");
            for (var i = 0; i < chartData.Data.length; i++) {
                var point = _this.mapChartDataSample(chartData.Data[i]);
                _this.chart.series[0].addPoint(point, false);
            }
            console.log("addChartData completed");
        };
        this.mapChartDataSample = function (d) {
            var p;
            switch (_this.assetType) {
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
        };
        this.storeEarliestSampleTime = function (chartData) {
            if (chartData.Data.length > 0) {
                _this.earliestSampleTime = chartData.Data[0].Time;
            }
        };
        this.mergeChartData = function (chartData) {
            for (var i = 0; i < chartData.Data.length; i++) {
                var d = chartData.Data[i];
                var point = _this.mapChartDataSample(d);
                //Determine if we should update existing point or add a new point
                var currentPoint = _this.chart.get(d.Time);
                if ((null != currentPoint) && (typeof currentPoint != 'undefined')) {
                    currentPoint.update(point);
                    console.log("Updating latest point");
                }
                else {
                    _this.chart.series[0].addPoint(point);
                    console.log("Adding new point");
                }
                //Update horizontal line
                if (i == chartData.Data.length - 1) {
                    _this.chart.yAxis[0].update({
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
        };
        this.getHistoricalSamples = function () {
            var queryParameters = "uic=" + _this.uicDiv.val() + "&assetType=" + _this.assetTypeDiv.val() + "&horizon=" + _this.horizonDiv.val() + '&timeZoneId=' + _this.timeZoneIdDiv.val();
            queryParameters += "&mode=UpTo & fieldGroups=Data count=1200 &time=" + _this.earliestSampleTime;
            var url = _this.CHART_URL + "/?" + queryParameters;
            console.log("callOpenApi - get old samples");
            _this.openApiCommunication.callOpenApi("GET", url, {}, function (chartData) {
                console.log("get old samples - returned");
                if (chartData.DataVersion === this.dataVersion) {
                    this.addChartData(chartData);
                    this.storeEarliestSampleTime(chartData);
                    this.chart.redraw();
                }
                else {
                    this.restart();
                }
            });
        };
    }
    return SimpleChartStreaming;
})();
//# sourceMappingURL=simplechartstreaming.js.map 
//# sourceMappingURL=simplechartstreaming.js.map