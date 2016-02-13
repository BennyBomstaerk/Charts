var OpenApiChartDemo;
(function (OpenApiChartDemo) {
    OpenApiChartDemo.HighChart = function () {
        Highcharts.setOptions({
            global: {
                useUTC: true
            }
        });
        var chartOptions = {
            chart: {
                renderTo: 'container',
                type: 'candlestick',
                zoomType: 'x',
            },
            title: {
                text: 'Simple OpenAPI Chart Data Demo',
            },
            xAxis: {
                minRange: 60
            },
            yAxis: {
                floor: 0,
                offset: 50,
                plotLines: [{
                        value: 0,
                        width: 1,
                        color: 'blue',
                        dashStyle: 'dash'
                    }]
            },
            exporting: {
                enabled: false
            },
            series: [{
                    data: [],
                    turboThreshold: 0,
                    dataGrouping: {
                        enabled: false
                    }
                }]
        };
        return new Highcharts.StockChart(chartOptions);
    };
})(OpenApiChartDemo || (OpenApiChartDemo = {}));
//# sourceMappingURL=highchart.js.map