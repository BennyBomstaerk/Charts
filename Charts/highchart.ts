module OpenApiChartDemo {
    /*
    * Setup chart component
    */


    export interface HighChart {
        new (): HighstockChartObject;
    }


    export var HighChart: HighChart = <ClassFunction>function () {
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
                data: <any>[],
                turboThreshold: 0,
                dataGrouping: {
                    enabled: false
                }
            }]
        };
        return new Highcharts.StockChart(chartOptions);
    }
}