module OpenApiChartDemo {
    export class SimpleChartStreaming {


        //Sample access code replace with your own, or paste another one into the "Access Code" field on the form.
        private ACCESS_TOKEN = "eyJhbGciOiJFUzI1NiIsIng1dCI6IkEwMEFDMEE1MzcxMDRBMTM1RDg0NkM4NkFDN0ZERkU1RUE4REIyOTkifQ.eyJvYWEiOiI3Nzc3MCIsImlzcyI6Im9hIiwiYWlkIjoiMTIiLCJ1aWQiOiJPVjZaTDItQVlCMFZ2VzJGekVxejdBPT0iLCJjaWQiOiJPVjZaTDItQVlCMFZ2VzJGekVxejdBPT0iLCJpc2EiOiJUcnVlIiwidGlkIjoiMjAwNSIsInNpZCI6IjRlMzYzMjc4NGUwZDRmM2JiMTgxZmNjZTQzNDllMjZjIiwiZGdpIjoiODIiLCJleHAiOiIxNDU1Mzg3OTg4In0.r-QTqO5AaxV05wEToar8QB2xPdJ5Z8wXpHxRMTdssOFmqcXb7Hy9ynwtBvNU6DsowlK3Bt1LvaeMb3VWE-xFSw";
        private BASE_URL = "https://gateway.saxobank.com/sim/openapi";
        private CHART_URL = this.BASE_URL + "/chart/v1/charts";


        private renderer = new OpenApi.Renderer("#statusCode", "#responseBody");
        private openApiCommunication = new OpenApi.OpenApiCommunication(this.BASE_URL, this.ACCESS_TOKEN, this.renderer);
        private chart = new HighChart();


        //UI related variables
        private accessTokenDiv = $("#accessToken");
        private assetTypeDiv = $("#assetType");
        private uicDiv = $("#uic");
        private horizonDiv = $("#horizon");
        private timeZoneIdDiv = $("#timeZoneId");

        private startStreamingBtn = $("#startStreamingBtn");
        private getCurrentChartBtn = $("#getCurrentChartBtn");
        private getOlderSamplesBtn = $("#getOlderSamplesBtn");


        //Streaming related variables
        private referenceCounter = 0;
        private snapshotReceived = false;
        private referenceId = "";
        private messageQueue = <any>[]; //TODO can we do better than that?

        //Chart related variables
        private dataVersion = 0;
        private displayAndFormat: any;
        private earliestSampleTime: string;    //TODO take care of this date
        private assetType: string;           //TODO do we have enums?

        //Response to user input:
        //Override the Access token "already baked into the code".
        public setAccessToken = () => {
            this.ACCESS_TOKEN = this.accessTokenDiv.val();
        }

        public startStreaming = () => {
            this.openApiCommunication.createStreamingConnection(this.receiveMessages, this.calledOnConnect);
        }

        public getCurrentChart = () => {
            this.assetType = this.assetTypeDiv.val();
            //i.e subscribe to receive snapshot and then start receiving updates

            this.makeSubscriptionRequest();
            this.getCurrentChartBtn.hide();
            this.getOlderSamplesBtn.show();
        }
        public getOlderSamples = () => {
            this.getHistoricalSamples();
        }
        //TEST ONLY
        public test = () => {
            this.restart();
        }



        private makeSubscriptionRequest = () => {
            this.referenceId = this.openApiCommunication.generateReferenceId("ex");
            var args = {
                AssetType: this.assetTypeDiv.val(),
                Uic: this.uicDiv.val(),
                Horizon: this.horizonDiv.val(),
                TimeZoneId: this.timeZoneIdDiv.val(),
                Count: 100,
                //Time: new Date().toISOString(),
                Time: "2016-01-28T00:00:08.460Z",
                FieldGroups: ['Data', 'ChartInfo', 'DisplayAndFormat']
            };
            this.openApiCommunication.subscribe(this.referenceId, this.CHART_URL, 300, args, this.processSnapshot);
        }


        private calledOnConnect = () => {
            console.log('streaming connection started.');
            this.getCurrentChartBtn.show();
        }


        private processSnapshot = (response: OpenApi.OpenApiSubscriptionResponse) => {
            console.log("Snapshot received- populate chart!");
            this.chart.showLoading();
            this.mapOtherInfo(response.Snapshot);
            this.chart.setTitle({ text: "Simple OpenAPI Chart Data Demo" }, { text: "Chart data for " + this.displayAndFormat.symbol + "-" + this.displayAndFormat.description });
            this.addChartData(response.Snapshot);
            this.storeEarliestSampleTime(response.Snapshot);
            this.chart.redraw();
            this.chart.hideLoading();
            this.processQueuedMessages();
            this.snapshotReceived = true;
        }

        private processQueuedMessages = () => {
            while (this.messageQueue.length > 0) {
                var messages = this.messageQueue.shift();
                if (!this.processMessages(messages)) {
                    this.restart();
                    return;
                }
            }
        }
        private receiveMessages = (messages: OpenApi.OpenApiStreamingResponse[]) => {
            console.log("receiving streaming data:" + JSON.stringify(messages));
            if (!this.snapshotReceived) {
                this.messageQueue.push(messages);
            }
            else {
                this.processMessages(messages);
            }
        }

        //process an array of messages
        //returns false if messages include instruction to reset subscription, this could either be
        //a) because mesage was a _resetsubscriptions message or
        //b) dataVersion had changed
        private processMessages = (messages: OpenApi.OpenApiStreamingResponse[]) => {
            for (var i = 0; i < messages.length; i++) {
                var message = messages[i];
                if (message.ReferenceId === '_resetsubscriptions') {
                    //Restart if _resetsubscriptions received and TargetReferenceIds include 'our reference id' or is empty.
                    if ((null != message.TargetReferenceIds) || (typeof message.TargetReferenceIds != 'undefined')) {
                        if ($.inArray(this.referenceId, message.TargetReferenceIds) > -1) {
                            return false;
                        }
                    }
                    else {
                        return false;
                    }
                }
                else if (message.ReferenceId === this.referenceId) {
                    if ((null == message.Data.DataVersion) || (typeof message.Data.DataVersion == 'undefined') || (message.Data.DataVersion === this.dataVersion)) {
                        this.mergeChartData(message);
                    }
                    else {
                        return false;
                    }
                }
            }
            return true;
        }

        private restart = () => {
            //something went wrong or has changed
            //delete subscription & reset chart
            this.openApiCommunication.removeSubscription(this.referenceId, () => {
                this.resetUI();
            });
            alert("Something went wrong, so please get data gain. This should of course be done automatically.");
        }
        private resetUI = () => {
            this.getCurrentChartBtn.show();
            this.getOlderSamplesBtn.hide();
            this.chart.series[0].setData([]);
        }
        private mapOtherInfo = (chartData: OpenApiSubscriptionSnapshot) => {
            this.dataVersion = chartData.DataVersion;
            this.displayAndFormat = {
                currency: chartData.DisplayAndFormat.Currency,
                decimals: chartData.DisplayAndFormat.Decimals,
                description: chartData.DisplayAndFormat.Description,
                format: chartData.DisplayAndFormat.Format,
                symbol: chartData.DisplayAndFormat.Symbol
            };
        }
        private addChartData = (chartData: OpenApiSubscriptionSnapshot) => {
            console.log("addChartData started");
            for (var i = 0; i < chartData.Data.length; i++) {
                var point = this.mapChartDataSample(chartData.Data[i]);
                this.chart.series[0].addPoint(point, false);
            }
            console.log("addChartData completed");
        }
        private mapChartDataSample = (d: ChartSample) => {
            var p: any;
            switch (this.assetType) {
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
        private storeEarliestSampleTime = (chartData: ChartData) => {
            if (chartData.Data.length > 0) {
                this.earliestSampleTime = chartData.Data[0].Time;
            }
        }
        private mergeChartData = (chartData: ChartData) => {
            for (var i = 0; i < chartData.Data.length; i++) {
                var d = chartData.Data[i];
                var point = this.mapChartDataSample(d);
                //Determine if we should update existing point or add a new point

                var currentPoint = <HighchartsPointObject>this.chart.get(d.Time);
                if ((null != currentPoint) && (typeof currentPoint != 'undefined')) {
                    currentPoint.update(point);
                    console.log("Updating latest point");
                }
                else {
                    this.chart.series[0].addPoint(point);
                    console.log("Adding new point");
                }
                //Update horizontal line
                if (i == chartData.Data.length - 1) {
                    this.chart.yAxis[0].update({
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
        public getHistoricalSamples = () => {
            var queryParameters = "uic=" + this.uicDiv.val() + "&assetType=" + this.assetTypeDiv.val() + "&horizon=" + this.horizonDiv.val() + '&timeZoneId=' + this.timeZoneIdDiv.val();
            queryParameters += "&mode=UpTo & fieldGroups=Data count=1200 &time=" + this.earliestSampleTime;
            var url = this.CHART_URL + "/?" + queryParameters;
            console.log("callOpenApi - get old samples");
            this.openApiCommunication.callOpenApi("GET", url, {},  (chartData: ChartData)=> {
                console.log("get old samples - returned");
                if ((null == chartData.DataVersion) || (typeof chartData.DataVersion == 'undefined') || (chartData.DataVersion === this.dataVersion)) {
                    this.addChartData(chartData);
                    this.storeEarliestSampleTime(chartData);
                    this.chart.redraw();
                }
                else {
                    this.restart();
                }
            });
        }
    }
}
//# sourceMappingURL=simplechartstreaming.js.map